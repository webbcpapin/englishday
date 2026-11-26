import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
export function backend() {
  const sheets = new Map(),
    cache = new Map(),
    props = new Map([
      ['CEC_AUTH_ENABLED', 'true'],
      ['CEC_SPREADSHEET_ID', 'test-only'],
      ['CEC_BOOTSTRAP_ADMIN_EMAIL', 'admin@example.test'],
      ['CEC_GOOGLE_CLIENT_ID', 'test-client'],
      ['CEC_ALLOWED_DOMAIN', 'example.test'],
    ]);
  class Sheet {
    constructor() {
      this.data = [];
    }
    getLastRow() {
      return this.data.length;
    }
    getDataRange() {
      return { getValues: () => structuredClone(this.data) };
    }
    appendRow(row) {
      this.data.push(structuredClone(row));
    }
    setFrozenRows() {}
    getRange(row, col, n, h) {
      return {
        setNumberFormat() {},
        setValues: (values) => {
          for (let i = 0; i < values.length; i++) {
            this.data[row - 1 + i] ||= [];
            for (let j = 0; j < values[i].length; j++)
              this.data[row - 1 + i][col - 1 + j] = values[i][j];
          }
        },
      };
    }
  }
  const ss = {
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet: (n) => {
      const s = new Sheet();
      sheets.set(n, s);
      return s;
    },
  };
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256' };
  const c = vm.createContext({
    console,
    Date,
    JSON,
    BigInt,
    Set,
    Map,
    Error,
    Number,
    String,
    Object,
    Array,
    Math,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) }) },
    SpreadsheetApp: {
      openById: (id) => {
        if (id !== 'test-only') throw Error('Production access forbidden in tests');
        return ss;
      },
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => cache.get(k) || null,
        put: (k, v) => cache.set(k, v),
        remove: (k) => cache.delete(k),
      }),
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
      getUserLock: () => ({ waitLock() {}, releaseLock() {} }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({
        text,
        setMimeType() {
          return this;
        },
      }),
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (algorithm, text) => [...crypto.createHash('sha256').update(text).digest()],
      base64DecodeWebSafe: (s) => [...Buffer.from(s, 'base64url')],
      newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
    },
    UrlFetchApp: {
      fetch: () => ({
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ keys: [jwk] }),
      }),
    },
  });
  vm.runInContext(fs.readFileSync(new URL('../gas_backend.gs', import.meta.url), 'utf8'), c);
  c.setupV2();
  const call = (action, payload = {}, token = '', requestId = crypto.randomUUID()) =>
    JSON.parse(
      c.doPost({ postData: { contents: JSON.stringify({ action, payload, token, requestId }) } })
        .text,
    );
  const put = (table, value) => c.put_(table, structuredClone(value)),
    rows = (table) => JSON.parse(JSON.stringify(c.rows_(table)));
  function identity(email = 'admin@example.test', extra = {}) {
    const challenge = call('challenge').challenge,
      claims = {
        iss: 'https://accounts.google.com',
        aud: 'test-client',
        sub: email,
        hd: 'example.test',
        email,
        email_verified: true,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: challenge,
        ...extra,
      };
    const a = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url'),
      b = Buffer.from(JSON.stringify(claims)).toString('base64url'),
      input = a + '.' + b,
      signature = crypto.sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
    return { credential: input + '.' + signature, challenge };
  }
  function login(email = 'admin@example.test', extra = {}) {
    const id = identity(email, extra);
    return { response: call('login', id), ...id };
  }
  return { c, props, sheets, cache, call, put, rows, login, identity, jwk, privateKey };
}
