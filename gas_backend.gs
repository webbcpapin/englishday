/** CEC Quest V2 staging API. See docs/DEPLOYMENT.md; legacy sheets are preserved. */
const TABLES = [
  'V2Users',
  'V2Sessions',
  'V2Events',
  'V2Questions',
  'V2Lessons',
  'V2EnglishDay',
  'V2Submissions',
  'V2Assessments',
  'V2MentorNotes',
  'V2Attendance',
  'V2Assignments',
  'V2Reports',
  'V2AuditLogs',
  'V2Sources',
];
function doGet() {
  return json_({
    ok: true,
    app: 'CEC Quest',
    schemaVersion: 2,
    message: 'Authenticated POST API only.',
  });
}
function doPost(e) {
  let lock;
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 250000) fail_('INVALID', 'Invalid request size.');
    const b = JSON.parse(raw),
      p = b.payload || {},
      action = b.action;
    if (PropertiesService.getScriptProperties().getProperty('CEC_AUTH_ENABLED') !== 'true')
      fail_('NOT_CONFIGURED', 'Institutional authentication is not enabled.');
    if (action === 'challenge') {
      rate_('public', 60);
      const challenge = Utilities.getUuid();
      CacheService.getScriptCache().put('nonce:' + challenge, '1', 300);
      return json_({ ok: true, challenge });
    }
    if (action === 'login') {
      rate_('login', 30);
      const identity = verifyGoogleToken_(p.credential);
      if (!p.challenge || identity.nonce !== p.challenge)
        fail_('UNAUTHORIZED', 'Invalid challenge.');
      lock = LockService.getScriptLock();
      lock.waitLock(10000);
      if (!CacheService.getScriptCache().get('nonce:' + p.challenge))
        fail_('UNAUTHORIZED', 'Expired or used challenge.');
      CacheService.getScriptCache().remove('nonce:' + p.challenge);
      const u = rows_('V2Users').find(
        (v) => v.email === identity.email.toLowerCase() && !v.disabled,
      );
      if (!u || (u.googleSub && u.googleSub !== identity.sub))
        fail_('UNAUTHORIZED', 'Account not authorised. Contact the administrator.');
      if (!u.googleSub) {
        u.googleSub = identity.sub;
        put_('V2Users', u);
      }
      const token = Utilities.getUuid() + Utilities.getUuid(),
        expiresAt = Date.now() + 8 * 3600000;
      put_('V2Sessions', { id: hash_(token), ownerId: u.id, expiresAt, revoked: false });
      audit_(u, 'login', u.id);
      return json_({
        ok: true,
        token,
        expiresAt,
        user: publicUser_(read_('V2Users', u.id)),
        state: state_(u.id),
      });
    }
    let u = authenticate_(b.token);
    rate_('user:' + u.id, 90);
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    u = authenticate_(b.token); // Re-check revocation/role after acquiring the mutation lock.
    if (action === 'logout') {
      const s = read_('V2Sessions', hash_(b.token));
      s.revoked = true;
      put_('V2Sessions', s);
      audit_(u, 'logout', u.id);
      return json_({ ok: true });
    }
    if (action === 'me') return json_({ ok: true, user: publicUser_(u), state: state_(u.id) });
    if (action === 'leaderboard')
      return json_({
        ok: true,
        rows: rows_('V2Users')
          .filter((v) => v.showLeaderboard && !v.disabled)
          .map((v) => ({ alias: v.alias || 'CEC Learner', xp: state_(v.id).xp }))
          .sort((a, c) => c.xp - a.xp)
          .slice(0, 30),
      });
    if (action === 'setPreferences') {
      checkRevision_(u, p.revision);
      u.showLeaderboard = p.showLeaderboard === true;
      u.alias = text_(p.alias, 40);
      put_('V2Users', u);
      return json_({ ok: true, user: publicUser_(read_('V2Users', u.id)) });
    }
    if (action === 'learn') {
      const l = read_('V2Lessons', p.lessonId);
      if (!l || l.reviewStatus !== 'approved') fail_('INVALID', 'Lesson not published.');
      const id = u.id + ':learn:' + l.id;
      if (!read_('V2Events', id))
        put_('V2Events', { id, ownerId: u.id, kind: 'learn', lessonId: l.id, at: now_() });
      return json_({ ok: true });
    }
    if (action === 'submit') return json_(submit_(u, p, b.requestId));
    if (action === 'sessions')
      return json_({
        ok: true,
        rows: rows_('V2EnglishDay').filter(
          (s) => s.status === 'published' || s.status === 'completed',
        ),
      });
    if (action === 'submitSession') {
      const s = read_('V2EnglishDay', p.sessionId);
      if (!s || s.status !== 'published') fail_('INVALID', 'Session is not open.');
      const answer = text_(p.answer, 6000);
      if (!answer) fail_('INVALID', 'Answer required.');
      const id = u.id + ':session:' + s.id;
      if (!read_('V2Submissions', id))
        put_('V2Submissions', {
          id,
          ownerId: u.id,
          sessionId: s.id,
          skill: 'writing',
          answer,
          status: 'pending_mentor',
          createdAt: now_(),
        });
      return json_({ ok: true, status: 'pending_mentor' });
    }
    if (action === 'mentorOverview') {
      role_(u, ['mentor', 'administrator']);
      const users = rows_('V2Users').filter((v) => scope_(u, v)),
        ids = users.map((v) => v.id),
        out = {
          ok: true,
          users: users.map((v) => ({ user: publicUser_(v), state: state_(v.id) })),
          sessions: rows_('V2EnglishDay'),
          reports: rows_('V2Reports'),
        };
      ['Submissions', 'Attendance', 'Assessments', 'Assignments', 'MentorNotes'].forEach(
        (t) => (out[t.toLowerCase()] = rows_('V2' + t).filter((v) => ids.indexOf(v.ownerId) >= 0)),
      );
      return json_(out);
    }
    if (action === 'saveSession') {
      role_(u, ['mentor', 'administrator']);
      const s = p.session || {},
        newId = u.id + ':session:' + text_(b.requestId, 100),
        old = read_('V2EnglishDay', s.id || newId);
      if (old && !s.id) return json_({ ok: true, session: old, duplicate: true });
      if (old) {
        if (old.createdBy !== u.id && u.role !== 'administrator')
          fail_('FORBIDDEN', 'Not your session.');
        checkRevision_(old, s.revision);
      }
      const v = {
        id: old ? old.id : newId,
        title: text_(s.title, 150),
        date: date_(s.date),
        description: text_(s.description, 4000),
        videoUrl: url_(s.videoUrl),
        documentationUrl: url_(s.documentationUrl),
        prompt: text_(s.prompt, 2000),
        program: enum_(s.program, [
          'language_mastery',
          'english_day',
          'engliscape',
          'lingualeap',
          'workplace_communication',
        ]),
        status: enum_(s.status, ['draft', 'published', 'completed']),
        createdBy: u.id,
        createdAt: old ? old.createdAt : now_(),
      };
      if (!v.title || !v.prompt) fail_('INVALID', 'Title and prompt required.');
      put_('V2EnglishDay', v);
      audit_(u, action, v.id);
      return json_({ ok: true, session: read_('V2EnglishDay', v.id) });
    }
    if (action === 'reviewSubmission') {
      role_(u, ['mentor', 'administrator']);
      const s = read_('V2Submissions', p.id);
      if (!s) fail_('INVALID', 'Submission missing.');
      scoped_(u, s.ownerId);
      checkRevision_(s, p.revision);
      if (!Array.isArray(p.rubric) || p.rubric.length !== 4)
        fail_('INVALID', 'Four rubric dimensions required.');
      if (s.skill === 'speaking' && p.observedLive !== true)
        fail_(
          'INVALID',
          'Speaking assessment requires an observed oral sample, not a typed transcript alone.',
        );
      s.rubric = p.rubric.map((v) => num_(v, 0, 4));
      s.score = Math.round((s.rubric.reduce((a, c) => a + c, 0) / 16) * 100);
      s.feedback = text_(p.feedback, 3000);
      if (!s.feedback) fail_('INVALID', 'Feedback required.');
      s.status = 'reviewed';
      s.reviewedBy = u.id;
      s.observedLive = p.observedLive === true;
      put_('V2Submissions', s);
      put_('V2Events', {
        id: 'review:' + s.id,
        ownerId: s.ownerId,
        kind: 'mentor',
        questionId: s.questionId || 'session:' + s.sessionId,
        skill: s.skill,
        correct: s.score >= 75,
        score: s.score,
        xp: 0,
        at: now_(),
        reviewedBy: u.id,
      });
      audit_(u, action, s.id);
      return json_({ ok: true, score: s.score });
    }
    const recordActions = {
      saveAttendance: 'V2Attendance',
      saveAssessment: 'V2Assessments',
      saveAssignment: 'V2Assignments',
      saveMentorNote: 'V2MentorNotes',
    };
    if (recordActions[action]) {
      role_(u, ['mentor', 'administrator']);
      scoped_(u, p.ownerId);
      const s = read_('V2EnglishDay', p.sessionId);
      if (!s) fail_('INVALID', 'Session missing.');
      const table = recordActions[action],
        id = p.ownerId + ':' + s.id,
        old = read_(table, id);
      if (old) checkRevision_(old, p.revision);
      const v = { id, ownerId: p.ownerId, sessionId: s.id, date: s.date, mentorId: u.id };
      if (action === 'saveAttendance') {
        v.present = p.present === true;
        v.active = p.active === true && v.present;
      }
      if (action === 'saveAssessment') {
        v.speaking = num_(p.speaking, 0, 100);
        v.writing = num_(p.writing, 0, 100);
        v.feedback = text_(p.feedback, 3000);
        if (!v.feedback) fail_('INVALID', 'Feedback required.');
      }
      if (action === 'saveAssignment') {
        v.title = text_(p.title, 200);
        v.completed = p.completed === true;
      }
      if (action === 'saveMentorNote') v.note = text_(p.note, 3000);
      put_(table, v);
      if (action === 'saveAssessment')
        ['speaking', 'writing'].forEach((skill) =>
          put_('V2Events', {
            id: 'assessment:' + id + ':' + skill,
            ownerId: p.ownerId,
            kind: 'mentor',
            questionId: 'assessment:' + s.id + ':' + skill,
            skill,
            score: v[skill],
            correct: v[skill] >= 75,
            xp: 0,
            reviewedBy: u.id,
            at: now_(),
          }),
        );
      audit_(u, action, id);
      return json_({ ok: true });
    }
    if (action === 'adminOverview') {
      role_(u, ['administrator']);
      return json_({
        ok: true,
        users: rows_('V2Users').map(publicUser_),
        audit: rows_('V2AuditLogs').slice(-100),
        questions: rows_('V2Questions'),
        lessons: rows_('V2Lessons'),
        sources: rows_('V2Sources'),
      });
    }
    if (action === 'saveUser') {
      role_(u, ['administrator']);
      const v = p.user || {},
        old = v.id ? read_('V2Users', v.id) : null;
      if (old) checkRevision_(old, v.revision);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email || ''))
        fail_('INVALID', 'Valid email required.');
      const r = enum_(v.role, ['learner', 'mentor', 'administrator']);
      if (old && old.id === u.id && (r !== 'administrator' || v.disabled))
        fail_('INVALID', 'Cannot revoke your own administrative access.');
      if (
        rows_('V2Users').some(
          (vv) => vv.email === v.email.toLowerCase() && vv.id !== (old && old.id),
        )
      )
        fail_('CONFLICT', 'Email already registered.');
      const record = Object.assign(
        {},
        old || { id: Utilities.getUuid(), googleSub: '', showLeaderboard: false },
        {
          email: v.email.toLowerCase(),
          name: text_(v.name, 100),
          unit: text_(v.unit, 100),
          cohort: text_(v.cohort, 100),
          role: r,
          disabled: v.disabled === true,
        },
      );
      if (old && old.email !== record.email) {
        record.googleSub = '';
        rows_('V2Sessions')
          .filter((v) => v.ownerId === old.id)
          .forEach((v) => {
            v.revoked = true;
            put_('V2Sessions', v);
          });
      }
      put_('V2Users', record);
      audit_(u, action, record.id);
      return json_({ ok: true, user: publicUser_(read_('V2Users', record.id)) });
    }
    if (action === 'importContent') {
      role_(u, ['administrator']);
      const items = p.questions;
      if (!Array.isArray(items) || items.length > 200)
        fail_('INVALID', 'Import at most 200 questions.');
      const ids = {};
      items.forEach((q) => {
        validateQuestion_(q);
        if (ids[q.id] || read_('V2Questions', q.id))
          fail_('CONFLICT', 'Duplicate or existing question ID.');
        ids[q.id] = true;
      });
      items.forEach((q) => put_('V2Questions', Object.assign({}, q, { reviewStatus: 'draft' })));
      audit_(u, action, String(items.length));
      return json_({ ok: true, count: items.length });
    }
    if (action === 'approveContent') {
      role_(u, ['mentor', 'administrator']);
      const q = read_('V2Questions', p.id),
        l = read_('V2Lessons', p.id),
        v = q || l;
      if (!v) fail_('INVALID', 'Content missing.');
      checkRevision_(v, p.revision);
      if (q) validateQuestion_(q);
      v.reviewStatus = 'approved';
      v.reviewedBy = u.id;
      v.reviewNote = text_(p.note, 2000);
      if (!v.reviewNote) fail_('INVALID', 'Review note required.');
      put_(q ? 'V2Questions' : 'V2Lessons', v);
      audit_(u, action, v.id);
      return json_({ ok: true });
    }
    if (action === 'backup') {
      role_(u, ['administrator']);
      const tables = {};
      TABLES.filter((t) => t !== 'V2Sessions').forEach((t) => (tables[t] = rows_(t)));
      audit_(u, action, 'v2');
      return json_({ ok: true, schemaVersion: 2, createdAt: now_(), tables });
    }
    fail_('INVALID', 'Unknown or retired action.');
  } catch (err) {
    return json_({
      ok: false,
      code: err.code || 'SERVER_ERROR',
      error: err.code
        ? err.message
        : 'Request failed. Check the private Apps Script execution log.',
    });
  } finally {
    if (lock) lock.releaseLock();
  }
}
function submit_(u, p, requestId) {
  const id = u.id + ':attempt:' + text_(requestId, 100);
  if (!/^[\w:.-]+$/.test(id)) fail_('INVALID', 'Invalid request ID.');
  const old = read_('V2Events', id);
  if (old) return { ok: true, result: old, duplicate: true, state: state_(u.id) };
  const q = read_('V2Questions', p.questionId);
  if (!q || q.reviewStatus !== 'approved') fail_('INVALID', 'Question not published.');
  if (!read_('V2Events', u.id + ':learn:' + q.lessonId) && p.mode !== 'placement')
    fail_('INVALID', 'Study the lesson before assessment.');
  const answer = text_(p.answer, 6000),
    open = ['speaking', 'writing', 'roleplay', 'pronunciation'].indexOf(q.type) >= 0;
  if (open) {
    if (!answer) fail_('INVALID', 'Response required.');
    put_('V2Submissions', {
      id,
      ownerId: u.id,
      questionId: q.id,
      lessonId: q.lessonId,
      skill: q.skill,
      answer,
      status: 'pending_mentor',
      createdAt: now_(),
    });
  }
  const correct = open
    ? null
    : [q.answer].concat(q.alternatives || []).some((v) => normal_(v) === normal_(answer));
  const earned = rows_('V2Events').some(
    (v) =>
      v.ownerId === u.id && v.questionId === q.id && v.correct === true && v.mode !== 'placement',
  );
  const event = {
    id,
    ownerId: u.id,
    kind: open ? 'open' : 'attempt',
    questionId: q.id,
    lessonId: q.lessonId,
    skill: q.skill,
    correct,
    score: open ? null : correct ? 100 : 0,
    xp: correct && !earned && p.mode !== 'placement' ? 10 : 0,
    mode: p.mode === 'placement' ? 'placement' : 'practice',
    durationMs: num_(p.durationMs, 0, 3600000),
    at: now_(),
  };
  put_('V2Events', event);
  return { ok: true, result: event, state: state_(u.id) };
}
function state_(id) {
  const events = rows_('V2Events')
      .filter((v) => v.ownerId === id)
      .sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0)),
    skills = {};
  ['vocabulary', 'grammar', 'reading', 'listening', 'speaking', 'writing'].forEach((skill) => {
    const latest = {};
    events
      .filter((v) => v.skill === skill && typeof v.score === 'number')
      .forEach((v) => (latest[v.questionId] = v));
    const sample = Object.values(latest).slice(-30);
    skills[skill] = {
      score: sample.length
        ? Math.round(sample.reduce((s, v) => s + v.score, 0) / sample.length)
        : null,
      evidence: sample.length,
    };
  });
  return {
    xp: events.reduce((s, v) => s + Number(v.xp || 0), 0),
    skills,
    events,
    legacy: read_('V2Users', id).legacyProgress || null,
  };
}
function authenticate_(token) {
  if (typeof token !== 'string' || token.length < 60 || token.length > 100)
    fail_('UNAUTHORIZED', 'Sign in required.');
  const s = read_('V2Sessions', hash_(token));
  if (!s || s.revoked || s.expiresAt < Date.now())
    fail_('UNAUTHORIZED', 'Session expired. Sign in again.');
  const u = read_('V2Users', s.ownerId);
  if (!u || u.disabled) fail_('UNAUTHORIZED', 'Account unavailable.');
  return u;
}
function role_(u, roles) {
  if (roles.indexOf(u.role) < 0) fail_('FORBIDDEN', 'Action not authorised.');
}
function scope_(mentor, u) {
  return (
    mentor.role === 'administrator' ||
    (mentor.role === 'mentor' && !!mentor.cohort && mentor.cohort === u.cohort)
  );
}
function scoped_(mentor, id) {
  const u = read_('V2Users', id);
  if (!u || !scope_(mentor, u)) fail_('FORBIDDEN', 'Participant outside your cohort.');
  return u;
}
function publicUser_(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    unit: u.unit,
    role: u.role,
    cohort: u.cohort,
    revision: u.revision,
    disabled: u.disabled === true,
    alias: u.alias || '',
    showLeaderboard: u.showLeaderboard === true,
  };
}
function checkRevision_(v, r) {
  if (Number(r) !== Number(v.revision))
    fail_('CONFLICT', 'Data changed on another device. Refresh before saving.');
}
function getSs_() {
  const id = PropertiesService.getScriptProperties().getProperty('CEC_SPREADSHEET_ID');
  if (!id) fail_('NOT_CONFIGURED', 'Spreadsheet not configured.');
  return SpreadsheetApp.openById(id);
}
function rows_(t) {
  if (TABLES.indexOf(t) < 0) fail_('INVALID', 'Unknown table.');
  const sh = getSs_().getSheetByName(t);
  if (!sh) fail_('NOT_CONFIGURED', 'Run setupV2 in the editor.');
  return sh
    .getDataRange()
    .getValues()
    .slice(1)
    .filter((r) => r[0])
    .map((r) => Object.assign(JSON.parse(r[1]), { revision: Number(r[2]), updatedAt: r[3] }));
}
function read_(t, id) {
  return rows_(t).find((v) => v.id === id) || null;
}
function put_(t, v) {
  if (typeof v.id !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_:.-]{0,499}$/.test(v.id))
    fail_('INVALID', 'Invalid record ID.');
  const sh = getSs_().getSheetByName(t),
    data = sh.getDataRange().getValues(),
    i = data.findIndex((r, n) => n > 0 && String(r[0]) === String(v.id)),
    revision = i < 0 ? 1 : Number(data[i][2]) + 1,
    at = now_(),
    row = [
      String(v.id),
      JSON.stringify(Object.assign({}, v, { revision, updatedAt: at })),
      revision,
      at,
      String(v.ownerId || ''),
    ];
  if (i < 0) sh.appendRow(row);
  else sh.getRange(i + 1, 1, 1, 5).setValues([row]);
}
function audit_(u, action, target) {
  put_('V2AuditLogs', { id: Utilities.getUuid(), actorId: u.id, action, target, at: now_() });
}
function ensureV2Tables_() {
  const ss = getSs_();
  TABLES.forEach((t) => {
    let sh = ss.getSheetByName(t);
    if (!sh) sh = ss.insertSheet(t);
    if (!sh.getLastRow()) {
      sh.appendRow(['id', 'data', 'revision', 'updatedAt', 'ownerId']);
      sh.setFrozenRows(1);
      sh.getRange('A:B').setNumberFormat('@');
    }
  });
}
function setupV2() {
  ensureV2Tables_();
  const email = PropertiesService.getScriptProperties().getProperty('CEC_BOOTSTRAP_ADMIN_EMAIL');
  if (!email) throw Error('Approved bootstrap administrator email required.');
  if (!rows_('V2Users').some((v) => v.role === 'administrator'))
    put_('V2Users', {
      id: Utilities.getUuid(),
      email: email.toLowerCase(),
      name: 'CEC Administrator',
      unit: '',
      cohort: '',
      role: 'administrator',
      googleSub: '',
      showLeaderboard: false,
      disabled: false,
    });
}
/** Editor-only additive migration; use exact NIP, never prefixes or numeric coercion. */
function linkLegacyProgress(legacyNip, v2UserId) {
  const u = read_('V2Users', v2UserId);
  if (!u) throw Error('V2 user missing.');
  const sh = getSs_().getSheetByName('Users');
  if (!sh) throw Error('Legacy sheet missing.');
  const values = sh.getDataRange().getValues(),
    headers = values.shift(),
    records = values.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
  const found = records.filter(
    (r) => String(r.nip).replace(/\s/g, '') === String(legacyNip).replace(/\s/g, ''),
  );
  if (found.length !== 1) throw Error('NIP not uniquely matched; manual review required.');
  const row = found[0];
  let raw = {};
  try {
    raw = JSON.parse(row.rawJson || '{}');
  } catch (e) {}
  u.legacyProgress = {
    schemaVersion: 1,
    importedAt: now_(),
    source: 'Users',
    xp: Number(row.xp || 0),
    progress: raw.progress || {},
    badges: raw.badges || [],
    label: 'Historical activity; not V2 competency',
  };
  put_('V2Users', u);
  audit_({ id: 'editor' }, 'linkLegacyProgress', u.id);
}
/** Editor-only recovery into an EMPTY V2 staging database. No overwrite/delete. */
function restoreV2Backup(backup) {
  if (!backup || backup.schemaVersion !== 2 || !backup.tables) throw Error('Invalid V2 backup.');
  ensureV2Tables_();
  const names = Object.keys(backup.tables);
  names.forEach((t) => {
    if (TABLES.indexOf(t) < 0 || t === 'V2Sessions' || !Array.isArray(backup.tables[t]))
      throw Error('Unsupported backup table.');
    const ids = new Set();
    backup.tables[t].forEach((v) => {
      if (!v.id || ids.has(v.id)) throw Error('Duplicate or missing ID.');
      ids.add(v.id);
      if (t === 'V2Questions') validateQuestion_(v);
    });
  });
  if (names.some((t) => rows_(t).length))
    throw Error(
      'Restore destination must have empty V2 tables. Use a fresh staging copy, not production.',
    );
  names.forEach((t) => backup.tables[t].forEach((v) => put_(t, v)));
  audit_({ id: 'editor' }, 'restoreBackup', 'fresh-staging');
}
function verifyGoogleToken_(token) {
  if (typeof token !== 'string' || token.length > 12000) fail_('UNAUTHORIZED', 'Invalid token.');
  const a = token.split('.');
  if (a.length !== 3) fail_('UNAUTHORIZED', 'Invalid token.');
  const decode = (s) =>
      JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(s)).getDataAsString()),
    h = decode(a[0]),
    v = decode(a[1]);
  if (h.alg !== 'RS256' || !h.kid) fail_('UNAUTHORIZED', 'Invalid signature algorithm.');
  const cache = CacheService.getScriptCache();
  let keys = cache.get('google-jwks');
  if (!keys) {
    const res = UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v3/certs', {
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) fail_('UNAUTHORIZED', 'Identity provider unavailable.');
    keys = res.getContentText();
    cache.put('google-jwks', keys, 3600);
  }
  const k = JSON.parse(keys).keys.find(
    (k) => k.kid === h.kid && k.kty === 'RSA' && k.alg === 'RS256',
  );
  if (!k) {
    cache.remove('google-jwks');
    fail_('UNAUTHORIZED', 'Signing key rotated. Retry sign-in.');
  }
  if (!verifyRsa_(a[0] + '.' + a[1], a[2], k)) fail_('UNAUTHORIZED', 'Invalid identity signature.');
  const props = PropertiesService.getScriptProperties(),
    aud = props.getProperty('CEC_GOOGLE_CLIENT_ID'),
    domain = props.getProperty('CEC_ALLOWED_DOMAIN'),
    now = Math.floor(Date.now() / 1000);
  if (
    !aud ||
    !domain ||
    v.aud !== aud ||
    (v.azp && v.azp !== aud) ||
    ['accounts.google.com', 'https://accounts.google.com'].indexOf(v.iss) < 0 ||
    !Number.isFinite(v.exp) ||
    v.exp <= now ||
    !Number.isFinite(v.iat) ||
    v.iat > now + 60 ||
    v.iat < now - 7200 ||
    !(v.email_verified === true || v.email_verified === 'true') ||
    v.hd !== domain ||
    !v.sub ||
    !v.email
  )
    fail_('UNAUTHORIZED', 'Identity claims rejected.');
  return v;
}
function verifyRsa_(message, signature, key) {
  const bytes = (s) => Utilities.base64DecodeWebSafe(s).map((v) => (v + 256) % 256),
    toInt = (a) => BigInt('0x' + a.map((v) => v.toString(16).padStart(2, '0')).join('')),
    modulus = bytes(key.n),
    sig = bytes(signature);
  if (sig.length !== modulus.length) return false;
  const n = toInt(modulus),
    s = toInt(sig);
  if (s >= n) return false;
  let power = toInt(bytes(key.e)),
    base = s,
    result = 1n;
  while (power > 0n) {
    if (power & 1n) result = (result * base) % n;
    base = (base * base) % n;
    power >>= 1n;
  }
  const decoded = result.toString(16).padStart(modulus.length * 2, '0'),
    digest = hash_(message),
    tail = '3031300d060960864801650304020105000420' + digest,
    padding = modulus.length - tail.length / 2 - 3;
  return padding >= 8 && decoded === '0001' + 'ff'.repeat(padding) + '00' + tail;
}
function validateQuestion_(q) {
  if (
    !q ||
    !/^[\w.-]{1,100}$/.test(q.id || '') ||
    !q.lessonId ||
    !q.explanation ||
    !q.source ||
    !q.contentVersion
  )
    fail_('INVALID', 'Question metadata missing.');
  enum_(q.skill, ['vocabulary', 'grammar', 'reading', 'listening', 'speaking', 'writing']);
  enum_(q.type, [
    'mcq',
    'dictation',
    'sentence',
    'fill',
    'truefalse',
    'speaking',
    'writing',
    'roleplay',
    'pronunciation',
  ]);
  enum_(q.cefr, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  const open = ['speaking', 'writing', 'roleplay', 'pronunciation'].indexOf(q.type) >= 0;
  if (!open && !q.answer) fail_('INVALID', 'Answer required.');
  if (
    q.options &&
    (new Set(q.options.map(normal_)).size !== q.options.length || q.options.indexOf(q.answer) < 0)
  )
    fail_('INVALID', 'Invalid choices.');
}
function rate_(key, limit) {
  const lock = LockService.getUserLock();
  lock.waitLock(5000);
  try {
    const c = CacheService.getScriptCache(),
      k = 'rate:' + key + ':' + Math.floor(Date.now() / 60000),
      n = Number(c.get(k) || 0);
    if (n >= limit) fail_('RATE_LIMIT', 'Too many requests. Retry later.');
    c.put(k, String(n + 1), 120);
  } finally {
    lock.releaseLock();
  }
}
function now_() {
  return new Date().toISOString();
}
function text_(v, max) {
  if (typeof v !== 'string' || v.length > max) fail_('INVALID', 'Invalid text.');
  return v.normalize('NFKC').trim();
}
function num_(v, min, max) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    fail_('INVALID', 'Invalid number.');
  return v;
}
function date_(v) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v || '') ||
    isNaN(Date.parse(v)) ||
    new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v
  )
    fail_('INVALID', 'Invalid date.');
  return v;
}
function url_(v) {
  if (!v) return '';
  if (typeof v !== 'string' || v.length > 2000 || !/^https:\/\/[^\s]+$/i.test(v))
    fail_('INVALID', 'HTTPS URL required.');
  return v;
}
function enum_(v, allowed) {
  if (allowed.indexOf(v) < 0) fail_('INVALID', 'Invalid option.');
  return v;
}
function normal_(v) {
  return String(v == null ? '' : v)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, '')
    .replace(/\s+/g, ' ');
}
function hash_(v) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, v, Utilities.Charset.UTF_8)
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, '0'))
    .join('');
}
function fail_(code, message) {
  const e = new Error(message);
  e.code = code;
  throw e;
}
function json_(v) {
  return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
