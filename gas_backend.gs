const CONFIG = {
  SHEETS: {
    USERS: 'Users',
    PROGRESS: 'Progress',
    ATTEMPTS: 'Attempts',
    LEADERBOARD: 'Leaderboard',
    MENTOR: 'MentorEntries'
  }
};

function doGet(e) {
  const action = (e.parameter.action || '').trim();
  ensureSheets_();

  if (action === 'getUsers') return json_(getUsers_());
  if (action === 'getLeaderboard') return json_(getLeaderboard_());
  if (action === 'getAttempts') return json_(readSheet_(CONFIG.SHEETS.ATTEMPTS));
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

  return json_({ ok: false, error: 'Unknown action: ' + action });
}

function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, CONFIG.SHEETS.USERS, ['nip', 'name', 'unit', 'avatar', 'xp', 'level', 'stars', 'badges', 'registeredAt', 'lastActive', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.PROGRESS, ['nip', 'world', 'level', 'score', 'stars', 'xp', 'updatedAt']);
  ensureSheet_(ss, CONFIG.SHEETS.ATTEMPTS, ['id', 'nip', 'name', 'level', 'topic', 'score', 'stars', 'xp', 'date', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.LEADERBOARD, ['nip', 'name', 'unit', 'xp', 'level', 'stars', 'updatedAt']);
  ensureSheet_(ss, CONFIG.SHEETS.MENTOR, ['id', 'nip', 'name', 'note', 'date', 'rawJson']);
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
}

function upsertUser_(user) {
  if (!user || !user.nip) return { ok: false, error: 'Missing user.nip' };

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.USERS);
  const data = sh.getDataRange().getValues();
  const row = findRow_(data, 0, user.nip);
  const values = [
    user.nip,
    user.name || '',
    user.unit || '',
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
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.PROGRESS);
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
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.ATTEMPTS).appendRow(values);
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
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.MENTOR).appendRow(values);
  return { ok: true, id: id };
}

function syncLeaderboard_(user) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.LEADERBOARD);
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
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
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
