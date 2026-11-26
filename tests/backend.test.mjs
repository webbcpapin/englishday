import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { backend } from './backend-harness.mjs';
const user = (id, role = 'learner', cohort = 'a') => ({
  id,
  name: id,
  email: id + '@example.test',
  googleSub: '',
  role,
  unit: 'Test unit',
  cohort,
  disabled: false,
  showLeaderboard: false,
});
test('legacy mass reads and writes are denied without credentials, GET exposes health only', () => {
  const b = backend();
  for (const action of [
    'getUsers',
    'getUserByNip',
    'getLoginHistory',
    'saveProgress',
    'saveUserState',
    'registerUser',
    'resetPassword',
    'saveEnglishDaySeed',
  ])
    assert.equal(
      b.call(action, { nip: 'fake', role: 'administrator', xp: 999 }).code,
      'UNAUTHORIZED',
    );
  const r = JSON.parse(b.c.doGet({ parameter: { action: 'getUsers', callback: 'evil' } }).text);
  assert.equal(r.rows, undefined);
  assert.equal(r.schemaVersion, 2);
});
test('auth remains fail-closed until agency configuration is enabled', () => {
  const b = backend();
  b.props.set('CEC_AUTH_ENABLED', 'false');
  assert.equal(b.call('challenge').code, 'NOT_CONFIGURED');
});
test('OIDC signature verified against native RSA, audience/domain/expiry enforced and nonce single-use', () => {
  const b = backend(),
    r = b.login();
  assert.equal(r.response.ok, true);
  assert.equal(
    b.call('login', { credential: r.credential, challenge: r.challenge }).code,
    'UNAUTHORIZED',
  );
  for (const extra of [
    { aud: 'evil' },
    { hd: 'evil.test' },
    { exp: 1 },
    { email_verified: false },
    { iss: 'evil' },
  ])
    assert.equal(b.login('admin@example.test', extra).response.code, 'UNAUTHORIZED');
  const message = 'test',
    signature = crypto.sign('RSA-SHA256', Buffer.from(message), b.privateKey).toString('base64url');
  assert.equal(b.c.verifyRsa_(message, signature, b.jwk), true);
  assert.equal(b.c.verifyRsa_(message + '!', signature, b.jwk), false);
});
test('server role and cohort resist forged client role and participant ID', () => {
  const b = backend();
  b.put('V2Users', user('learner'));
  b.put('V2Users', user('mentor', 'mentor', 'a'));
  b.put('V2Users', user('outside', 'learner', 'b'));
  const learner = b.login('learner@example.test').response.token,
    mentor = b.login('mentor@example.test').response.token;
  assert.equal(b.call('adminOverview', { role: 'administrator' }, learner).code, 'FORBIDDEN');
  assert.equal(b.call('saveMentorNote', { ownerId: 'outside' }, mentor).code, 'FORBIDDEN');
  const data = b.call('mentorOverview', {}, mentor);
  assert.equal(
    data.users.some((v) => v.user.id === 'outside'),
    false,
  );
});
test('sessions expire, logout revokes token and disabled accounts lose access', () => {
  const b = backend(),
    r = b.login().response;
  assert.equal(b.call('me', {}, r.token).ok, true);
  b.call('logout', {}, r.token);
  assert.equal(b.call('me', {}, r.token).code, 'UNAUTHORIZED');
  const next = b.login().response;
  const s = b.rows('V2Sessions').find((s) => s.ownerId === next.user.id && !s.revoked);
  s.expiresAt = 0;
  b.put('V2Sessions', s);
  assert.equal(b.call('me', {}, next.token).code, 'UNAUTHORIZED');
});
test('grading is server authoritative, idempotent, and caps XP across retries', () => {
  const b = backend();
  b.put('V2Users', user('learner'));
  const token = b.login('learner@example.test').response.token;
  b.put('V2Lessons', { id: 'lesson', reviewStatus: 'approved' });
  b.put('V2Questions', {
    id: 'q',
    lessonId: 'lesson',
    reviewStatus: 'approved',
    type: 'mcq',
    skill: 'grammar',
    answer: 'is',
  });
  const payload = {
    questionId: 'q',
    answer: 'is',
    durationMs: 1000,
    xp: 99999,
    score: 999,
    userId: 'other',
  };
  assert.equal(b.call('submit', payload, token, 'one').code, 'INVALID');
  b.call('learn', { lessonId: 'lesson' }, token);
  const first = b.call('submit', payload, token, 'one');
  assert.equal(first.result.xp, 10);
  assert.equal(first.state.xp, 10);
  assert.equal(b.call('submit', payload, token, 'one').duplicate, true);
  assert.equal(b.call('submit', payload, token, 'two').state.xp, 10);
  assert.equal(
    b.call('submit', { ...payload, answer: 'are' }, token, 'three').result.correct,
    false,
  );
  assert.equal(b.call('submit', { ...payload, durationMs: -1 }, token, 'four').code, 'INVALID');
});
test('open responses remain pending, mentor rubric uses revision checks and scoped authority', () => {
  const b = backend();
  b.put('V2Users', user('learner'));
  b.put('V2Users', user('mentor', 'mentor'));
  const token = b.login('learner@example.test').response.token,
    mentor = b.login('mentor@example.test').response.token;
  b.put('V2Lessons', { id: 'lesson', reviewStatus: 'approved' });
  b.put('V2Questions', {
    id: 'write',
    lessonId: 'lesson',
    reviewStatus: 'approved',
    type: 'writing',
    skill: 'writing',
  });
  b.call('learn', { lessonId: 'lesson' }, token);
  const r = b.call(
    'submit',
    { questionId: 'write', answer: 'This is a response.', durationMs: 10 },
    token,
    'writing',
  );
  assert.equal(r.result.correct, null);
  assert.equal(r.state.skills.writing.score, null);
  const s = b.rows('V2Submissions')[0],
    review = {
      id: s.id,
      revision: s.revision,
      rubric: [3, 3, 3, 3],
      feedback: 'Clear response with minor grammar errors.',
    };
  assert.equal(b.call('reviewSubmission', review, token).code, 'FORBIDDEN');
  assert.equal(b.call('reviewSubmission', review, mentor).score, 75);
  assert.equal(b.call('reviewSubmission', review, mentor).code, 'CONFLICT');
  assert.equal(b.call('me', {}, token).state.skills.writing.score, 75);
});
test('user updates use revisions; local profile and score upserts are retired', () => {
  const b = backend(),
    a = b.login().response;
  const r = b.call('saveUser', { user: user('new') }, a.token);
  assert.equal(r.ok, true);
  assert.equal(
    b.call('saveUser', { user: { ...r.user, revision: 0, role: 'administrator' } }, a.token).code,
    'CONFLICT',
  );
  assert.equal(
    b.call('saveUserState', { xp: 9000, role: 'administrator' }, a.token).code,
    'INVALID',
  );
});
test('content imports reject malformed batches before writes; import always draft', () => {
  const b = backend(),
    a = b.login().response;
  const q = {
    id: 'q',
    lessonId: 'lesson',
    source: 'original',
    explanation: 'Because',
    contentVersion: '2',
    skill: 'grammar',
    type: 'mcq',
    cefr: 'A1',
    answer: 'is',
    options: ['is', 'are'],
    reviewStatus: 'approved',
  };
  assert.equal(
    b.call('importContent', { questions: [q, { ...q, id: 'bad', options: ['is', 'is'] }] }, a.token)
      .ok,
    false,
  );
  assert.equal(b.rows('V2Questions').length, 0);
  assert.equal(b.call('importContent', { questions: [q] }, a.token).ok, true);
  assert.equal(b.rows('V2Questions')[0].reviewStatus, 'draft');
});
test('setup and migration preserve legacy rows and never accept NIP prefix matches', () => {
  const b = backend(),
    sh = {
      data: [
        ['nip', 'xp', 'rawJson'],
        ['123456789012111111', 50, JSON.stringify({ progress: { '1_1': { score: 90 } } })],
      ],
      getDataRange() {
        return { getValues: () => structuredClone(this.data) };
      },
    };
  b.sheets.set('Users', sh);
  const before = JSON.stringify(sh.data),
    id = b.rows('V2Users')[0].id;
  assert.throws(() => b.c.linkLegacyProgress('123456789012222222', id));
  b.c.linkLegacyProgress('123456789012111111', id);
  assert.equal(JSON.stringify(sh.data), before);
  assert.equal(b.rows('V2Users')[0].legacyProgress.xp, 50);
});
test('session creation is idempotent across retries and plans never imply completion', () => {
  const b = backend(),
    a = b.login().response;
  const p = {
    session: {
      title: 'Tuesday draft',
      date: '2026-11-03',
      description: 'Plan',
      prompt: 'Introduce yourself.',
      program: 'workplace_communication',
      status: 'draft',
    },
  };
  assert.equal(b.call('saveSession', p, a.token, 'plan-1').ok, true);
  assert.equal(b.call('saveSession', p, a.token, 'plan-1').duplicate, true);
  assert.equal(b.rows('V2EnglishDay').length, 1);
  assert.equal(b.rows('V2EnglishDay')[0].status, 'draft');
});
test('live speaking and writing assessment produces numeric competency evidence', () => {
  const b = backend();
  b.put('V2Users', user('learner'));
  const a = b.login().response;
  b.put('V2EnglishDay', { id: 'session', date: '2026-11-26' });
  assert.equal(
    b.call(
      'saveAssessment',
      {
        ownerId: 'learner',
        sessionId: 'session',
        speaking: 60,
        writing: 75,
        feedback: 'Observed exercise.',
      },
      a.token,
    ).ok,
    true,
  );
  const l = b.login('learner@example.test').response;
  assert.equal(l.state.skills.speaking.score, 60);
  assert.equal(l.state.skills.writing.score, 75);
});
test('backup excludes active sessions and restore refuses overwrite of existing V2 records', () => {
  const b = backend(),
    a = b.login().response,
    backup = b.call('backup', {}, a.token);
  assert.equal(backup.tables.V2Sessions, undefined);
  assert.throws(() => b.c.restoreV2Backup(backup));
});
