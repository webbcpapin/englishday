const CONFIG = {
  SPREADSHEET_ID: '1ezBkjO0aKxs65iJuYOwrNMOXIszWWkBPQi_ZmR-mf0c',
  SHEETS: {
    USERS: 'Users',
    PROGRESS: 'Progress',
    ATTEMPTS: 'Attempts',
    LEADERBOARD: 'Leaderboard',
    MENTOR: 'MentorEntries',
    PROGRAM_DATA: 'ProgramData',
    MONTHLY_PLANS: 'MonthlyPlans',
    ASSESSMENTS: 'Assessments',
    REPORTS: 'Reports'
  }
};

function doGet(e) {
  const action = (e.parameter.action || '').trim();
  ensureSheets_();

  if (action === 'getUsers') return json_(getUsers_());
  if (action === 'getLeaderboard') return json_(getLeaderboard_());
  if (action === 'getAttempts') return json_(readSheet_(CONFIG.SHEETS.ATTEMPTS));
  if (action === 'getProgramData') return json_({ ok: true, rows: readSheet_(CONFIG.SHEETS.PROGRAM_DATA) });
  if (action === 'getMonthlyPlans') return json_({ ok: true, rows: readSheet_(CONFIG.SHEETS.MONTHLY_PLANS) });
  if (action === 'getAssessments') return json_({ ok: true, rows: readSheet_(CONFIG.SHEETS.ASSESSMENTS) });
  if (action === 'test') return json_({ ok: true, app: 'CEC Quest Backend', time: new Date().toISOString() });

  return json_({
    ok: true,
    message: 'CEC Quest Google Apps Script backend is ready.',
    actions: ['getUsers', 'getLeaderboard', 'getAttempts', 'test']
  });
}

function doPost(e) {
  ensureSheets_();
  const body = parseBody_(e);
  const action = body.action;
  const payload = body.payload || {};

  if (action === 'registerUser') return json_(upsertUser_(payload));
  if (action === 'saveProgress') return json_(saveProgress_(payload));
  if (action === 'saveAttempt') return json_(saveAttempt_(payload));
  if (action === 'saveMentorEntry') return json_(saveMentorEntry_(payload));
  if (action === 'saveProgramData') return json_(saveProgramData_(payload));

  return json_({ ok: false, error: 'Unknown action: ' + action });
}

function ensureSheets_() {
  const ss = getSs_();
  ensureSheet_(ss, CONFIG.SHEETS.USERS, ['nip', 'name', 'unit', 'password', 'avatar', 'xp', 'level', 'stars', 'badges', 'registeredAt', 'lastActive', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.PROGRESS, ['nip', 'world', 'level', 'score', 'stars', 'xp', 'updatedAt']);
  ensureSheet_(ss, CONFIG.SHEETS.ATTEMPTS, ['id', 'nip', 'name', 'level', 'topic', 'score', 'stars', 'xp', 'date', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.LEADERBOARD, ['nip', 'name', 'unit', 'xp', 'level', 'stars', 'updatedAt']);
  ensureSheet_(ss, CONFIG.SHEETS.MENTOR, ['id', 'nip', 'name', 'note', 'date', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.PROGRAM_DATA, ['id', 'type', 'programType', 'title', 'date', 'participants', 'documentationUrl', 'notes', 'createdAt', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.MONTHLY_PLANS, ['id', 'month', 'year', 'bigTheme', 'meetingsCount', 'createdAt', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.ASSESSMENTS, ['id', 'sessionId', 'participantName', 'date', 'attendance', 'active', 'speaking', 'writing', 'grammar', 'presentation', 'createdAt', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.REPORTS, ['id', 'month', 'year', 'healthScore', 'status', 'createdAt', 'rawJson']);
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return;
  }
  let current = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  headers.forEach(function(header, index) {
    if (current.indexOf(header) === -1) {
      sh.insertColumnBefore(index + 1);
      sh.getRange(1, index + 1).setValue(header);
      current.splice(index, 0, header);
    }
  });
}

function getSs_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function upsertUser_(user) {
  if (!user || !user.nip) return { ok: false, error: 'Missing user.nip' };

  const sh = getSs_().getSheetByName(CONFIG.SHEETS.USERS);
  const data = sh.getDataRange().getValues();
  const row = findRow_(data, 0, user.nip);
  const values = [
    user.nip,
    user.name || '',
    user.unit || '',
    user.password || '',
    user.avatarEmoji || user.avatar || '',
    Number(user.xp || 0),
    Number(user.level || 1),
    Number(user.stars || 0),
    Array.isArray(user.badges) ? user.badges.join(',') : (user.badges || ''),
    user.registeredAt || new Date().toISOString(),
    user.lastActive || new Date().toISOString(),
    JSON.stringify(user)
  ];

  if (row > 0) sh.getRange(row, 1, 1, values.length).setValues([values]);
  else sh.appendRow(values);

  syncLeaderboard_(user);
  return { ok: true, user: user };
}

function saveProgress_(payload) {
  const user = payload.user || payload;
  const attempt = payload.latestAttempt;
  const userResult = upsertUser_(user);
  let attemptResult = null;
  if (attempt) attemptResult = saveAttempt_(Object.assign({}, attempt, { nip: user.nip, name: user.name }));

  if (user.progress) {
    const latestKeys = Object.keys(user.progress);
    latestKeys.forEach(function(key) {
      const parts = key.split('_');
      const row = user.progress[key];
      upsertProgressRow_(user.nip, parts[0], parts[1], row.score, row.stars, attempt ? attempt.xp : 0, row.date);
    });
  }

  return { ok: true, userResult: userResult, attemptResult: attemptResult };
}

function upsertProgressRow_(nip, world, level, score, stars, xp, updatedAt) {
  const sh = getSs_().getSheetByName(CONFIG.SHEETS.PROGRESS);
  const data = sh.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(nip) && String(data[i][1]) === String(world) && String(data[i][2]) === String(level)) {
      rowIndex = i + 1;
      break;
    }
  }
  const values = [nip, world, level, score || 0, stars || 0, xp || 0, updatedAt || new Date().toISOString()];
  if (rowIndex > 0) sh.getRange(rowIndex, 1, 1, values.length).setValues([values]);
  else sh.appendRow(values);
}

function saveAttempt_(attempt) {
  if (!attempt || !attempt.nip) return { ok: false, error: 'Missing attempt.nip' };
  const id = Utilities.getUuid();
  const values = [
    id,
    attempt.nip,
    attempt.name || '',
    attempt.level || '',
    attempt.topic || '',
    Number(attempt.score || 0),
    Number(attempt.stars || 0),
    Number(attempt.xp || 0),
    attempt.date || new Date().toISOString(),
    JSON.stringify(attempt)
  ];
  getSs_().getSheetByName(CONFIG.SHEETS.ATTEMPTS).appendRow(values);
  return { ok: true, id: id };
}

function saveMentorEntry_(entry) {
  if (!entry || !entry.nip) return { ok: false, error: 'Missing entry.nip' };
  const id = Utilities.getUuid();
  const values = [
    id,
    entry.nip,
    entry.name || '',
    entry.note || '',
    entry.date || new Date().toISOString(),
    JSON.stringify(entry)
  ];
  getSs_().getSheetByName(CONFIG.SHEETS.MENTOR).appendRow(values);
  return { ok: true, id: id };
}

function saveProgramData_(payload) {
  const type = payload.type || 'program_data';
  const data = payload.data || payload;
  const id = data.id || Utilities.getUuid();
  if (type === 'monthly_plan') {
    getSs_().getSheetByName(CONFIG.SHEETS.MONTHLY_PLANS).appendRow([
      id,
      data.month || '',
      data.year || '',
      data.bigTheme || '',
      data.meetings ? data.meetings.length : 0,
      new Date().toISOString(),
      JSON.stringify(data)
    ]);
    return { ok: true, id: id, type: type };
  }
  if (type === 'assessment') {
    const att = data.attendance || {};
    const assessment = data.assessment || {};
    getSs_().getSheetByName(CONFIG.SHEETS.ASSESSMENTS).appendRow([
      assessment.id || id,
      assessment.sessionId || att.sessionId || '',
      assessment.participantName || att.participantName || '',
      assessment.date || att.date || '',
      att.status || '',
      att.active === true ? 'yes' : 'no',
      Number(assessment.speaking || 0),
      Number(assessment.writing || 0),
      Number(assessment.grammar || 0),
      Number(assessment.presentation || 0),
      new Date().toISOString(),
      JSON.stringify(data)
    ]);
    return { ok: true, id: assessment.id || id, type: type };
  }
  getSs_().getSheetByName(CONFIG.SHEETS.PROGRAM_DATA).appendRow([
    id,
    type,
    data.programType || '',
    data.title || data.theme || data.topic || '',
    data.date || data.publishDate || '',
    Array.isArray(data.participants) ? data.participants.join(', ') : (data.participants || data.pic || ''),
    data.documentationUrl || data.link || '',
    data.notes || data.mentorNotes || data.languageReviewNotes || '',
    new Date().toISOString(),
    JSON.stringify(data)
  ]);
  return { ok: true, id: id, type: type };
}

function syncLeaderboard_(user) {
  const sh = getSs_().getSheetByName(CONFIG.SHEETS.LEADERBOARD);
  const data = sh.getDataRange().getValues();
  const row = findRow_(data, 0, user.nip);
  const values = [
    user.nip,
    user.name || '',
    user.unit || '',
    Number(user.xp || 0),
    Number(user.level || 1),
    Number(user.stars || 0),
    new Date().toISOString()
  ];
  if (row > 0) sh.getRange(row, 1, 1, values.length).setValues([values]);
  else sh.appendRow(values);
}

function getUsers_() {
  return { ok: true, rows: readSheet_(CONFIG.SHEETS.USERS) };
}

function getLeaderboard_() {
  const rows = readSheet_(CONFIG.SHEETS.LEADERBOARD);
  rows.sort(function(a, b) { return Number(b.xp || 0) - Number(a.xp || 0); });
  return { ok: true, rows: rows };
}

function readSheet_(name) {
  const sh = getSs_().getSheetByName(name);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return cell !== ''; });
  }).map(function(row) {
    const obj = {};
    headers.forEach(function(header, i) { obj[header] = row[i]; });
    return obj;
  });
}

function findRow_(data, col, value) {
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col]) === String(value)) return i + 1;
  }
  return -1;
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
