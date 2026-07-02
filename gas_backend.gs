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
    REPORTS: 'Reports',
    LOGIN_HISTORY: 'LoginHistory',
    ENGLISH_DAY_SESSIONS: 'EnglishDaySessions',
    QUESTIONS: 'Questions',
    SUBMISSIONS: 'Submissions',
    SCORE_HISTORY: 'ScoreHistory'
  }
};

function doGet(e) {
  const action = (e.parameter.action || '').trim();
  ensureSheets_();

  if (action === 'getUsers') return json_(getUsers_());
  if (action === 'getUserByNip') return json_(getUserByNip_(e.parameter.nip));
  if (action === 'getUserProgress') return json_(getUserProgress_(e.parameter.nip));
  if (action === 'getLeaderboard') return json_(getLeaderboard_());
  if (action === 'getAttempts') return json_(readSheet_(CONFIG.SHEETS.ATTEMPTS));
  if (action === 'getProgramData') return json_({ ok: true, rows: readSheet_(CONFIG.SHEETS.PROGRAM_DATA) });
  if (action === 'getMonthlyPlans') return json_({ ok: true, rows: readSheet_(CONFIG.SHEETS.MONTHLY_PLANS) });
  if (action === 'getAssessments') return json_({ ok: true, rows: readSheet_(CONFIG.SHEETS.ASSESSMENTS) });
  if (action === 'getLoginHistory') return json_({ ok: true, rows: readSheet_(CONFIG.SHEETS.LOGIN_HISTORY) });
  if (action === 'getEnglishDaySessions') return json_({ ok: true, rows: readSheet_(CONFIG.SHEETS.ENGLISH_DAY_SESSIONS) });
  if (action === 'getQuestions') return json_({ ok: true, rows: readSheet_(CONFIG.SHEETS.QUESTIONS) });
  if (action === 'getSubmissions') return json_({ ok: true, rows: readSheet_(CONFIG.SHEETS.SUBMISSIONS) });
  if (action === 'getScoreHistory') return json_({ ok: true, rows: readSheet_(CONFIG.SHEETS.SCORE_HISTORY) });
  if (action === 'test') return json_({ ok: true, app: 'CEC Quest Backend', time: new Date().toISOString() });

  return json_({
    ok: true,
    message: 'CEC Quest Google Apps Script backend is ready.',
    actions: ['getUsers', 'getUserByNip', 'getUserProgress', 'getLeaderboard', 'getAttempts', 'saveUserState', 'syncUser', 'test']
  });
}

function doPost(e) {
  ensureSheets_();
  const body = parseBody_(e);
  const action = body.action;
  const payload = body.payload || {};

  if (action === 'registerUser') return json_(upsertUser_(payload));
  if (action === 'saveUserState') return json_(upsertUser_(payload));
  if (action === 'syncUser') return json_(upsertUser_(payload.user || payload));
  if (action === 'saveProgress') return json_(saveProgress_(payload));
  if (action === 'saveAttempt') return json_(saveAttempt_(payload));
  if (action === 'saveMentorEntry') return json_(saveMentorEntry_(payload));
  if (action === 'saveProgramData') return json_(saveProgramData_(payload));
  if (action === 'saveLoginHistory') return json_(saveLoginHistory_(payload));
  if (action === 'saveEnglishDaySeed') return json_(saveEnglishDaySeed_(payload));
  if (action === 'saveQuestionSubmission') return json_(saveQuestionSubmission_(payload));

  return json_({ ok: false, error: 'Unknown action: ' + action });
}

function ensureSheets_() {
  const ss = getSs_();
  ensureSheet_(ss, CONFIG.SHEETS.USERS, ['nip', 'name', 'unit', 'passwordHash', 'avatar', 'xp', 'level', 'stars', 'badges', 'registeredAt', 'lastActive', 'totalScore', 'levelName', 'lastActivity', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.PROGRESS, ['nip', 'world', 'level', 'score', 'stars', 'xp', 'updatedAt']);
  ensureSheet_(ss, CONFIG.SHEETS.ATTEMPTS, ['id', 'nip', 'name', 'level', 'topic', 'score', 'stars', 'xp', 'date', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.LEADERBOARD, ['nip', 'name', 'unit', 'xp', 'level', 'stars', 'updatedAt']);
  ensureSheet_(ss, CONFIG.SHEETS.MENTOR, ['id', 'nip', 'name', 'note', 'date', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.PROGRAM_DATA, ['id', 'type', 'programType', 'title', 'date', 'participants', 'documentationUrl', 'notes', 'createdAt', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.MONTHLY_PLANS, ['id', 'month', 'year', 'bigTheme', 'meetingsCount', 'createdAt', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.ASSESSMENTS, ['id', 'sessionId', 'participantName', 'date', 'attendance', 'active', 'speaking', 'writing', 'grammar', 'presentation', 'createdAt', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.REPORTS, ['id', 'month', 'year', 'healthScore', 'status', 'createdAt', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.LOGIN_HISTORY, ['id', 'userId', 'nip', 'name', 'loginAt', 'logoutAt', 'deviceInfo', 'status', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.ENGLISH_DAY_SESSIONS, ['id', 'title', 'agenda', 'topic', 'date', 'videoUrl', 'description', 'status', 'createdAt', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.QUESTIONS, ['id', 'sessionId', 'questionText', 'questionType', 'options', 'correctAnswer', 'scorePoint', 'orderNumber', 'keywords', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.SUBMISSIONS, ['id', 'sessionId', 'userId', 'questionId', 'questionText', 'answerText', 'isCorrect', 'scoreAwarded', 'submittedAt', 'reviewedBy', 'mentorNote', 'rawJson']);
  ensureSheet_(ss, CONFIG.SHEETS.SCORE_HISTORY, ['id', 'userId', 'sessionId', 'score', 'source', 'createdAt', 'rawJson']);
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
  user.nip = normalizeNip_(user.nip);

  const sh = getSs_().getSheetByName(CONFIG.SHEETS.USERS);
  const data = sh.getDataRange().getValues();
  const row = findRow_(data, 0, user.nip);
  const values = [
    user.nip,
    user.name || '',
    user.unit || '',
    user.passwordHash || '',
    user.avatarEmoji || user.avatar || '',
    Number(user.xp || 0),
    Number(user.level || 1),
    Number(user.stars || 0),
    Array.isArray(user.badges) ? user.badges.join(',') : (user.badges || ''),
    user.registeredAt || new Date().toISOString(),
    user.lastActive || new Date().toISOString(),
    Number(user.totalScore || user.xp || 0),
    user.levelName || '',
    user.lastActivity || user.lastActive || new Date().toISOString(),
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

function saveLoginHistory_(entry) {
  if (!entry || !entry.id) return { ok: false, error: 'Missing login history id' };
  const sh = getSs_().getSheetByName(CONFIG.SHEETS.LOGIN_HISTORY);
  const data = sh.getDataRange().getValues();
  const row = findRow_(data, 0, entry.id);
  const existing = row > 0 ? data[row - 1] : [];
  const values = [
    entry.id,
    entry.userId || entry.nip || existing[1] || '',
    entry.nip || entry.userId || existing[2] || '',
    entry.name || existing[3] || '',
    entry.loginAt || existing[4] || '',
    entry.logoutAt || existing[5] || '',
    entry.deviceInfo || existing[6] || '',
    entry.status || existing[7] || '',
    JSON.stringify(entry)
  ];
  if (row > 0) sh.getRange(row, 1, 1, values.length).setValues([values]);
  else sh.appendRow(values);
  return { ok: true, id: entry.id };
}

function saveEnglishDaySeed_(payload) {
  const session = payload.session || {};
  const questions = payload.questions || [];
  if (!session.id) return { ok: false, error: 'Missing session id' };
  upsertEnglishDaySession_(session);
  questions.forEach(function(question, index) {
    upsertQuestion_(Object.assign({}, question, {
      sessionId: session.id,
      orderNumber: index + 1,
      questionType: 'short_answer'
    }));
  });
  return { ok: true, sessionId: session.id, questions: questions.length };
}

function upsertEnglishDaySession_(session) {
  const sh = getSs_().getSheetByName(CONFIG.SHEETS.ENGLISH_DAY_SESSIONS);
  const data = sh.getDataRange().getValues();
  const row = findRow_(data, 0, session.id);
  const values = [
    session.id,
    session.title || '',
    session.agenda || '',
    session.topic || '',
    session.date || '',
    session.videoUrl || '',
    session.description || '',
    session.status || 'active',
    new Date().toISOString(),
    JSON.stringify(session)
  ];
  if (row > 0) sh.getRange(row, 1, 1, values.length).setValues([values]);
  else sh.appendRow(values);
}

function upsertQuestion_(question) {
  const sh = getSs_().getSheetByName(CONFIG.SHEETS.QUESTIONS);
  const data = sh.getDataRange().getValues();
  const row = findRow_(data, 0, question.id);
  const values = [
    question.id,
    question.sessionId || '',
    question.text || question.questionText || '',
    question.questionType || 'short_answer',
    JSON.stringify(question.options || []),
    question.correctAnswer || '',
    Number(question.points || question.scorePoint || 0),
    Number(question.orderNumber || 0),
    Array.isArray(question.keywords) ? question.keywords.join(', ') : (question.keywords || ''),
    JSON.stringify(question)
  ];
  if (row > 0) sh.getRange(row, 1, 1, values.length).setValues([values]);
  else sh.appendRow(values);
}

function saveQuestionSubmission_(payload) {
  const user = payload.user || {};
  const session = payload.session || {};
  const sessionEntry = payload.sessionEntry || {};
  const answers = payload.answers || [];
  const scoreHistory = payload.scoreHistory || {};
  if (user.nip) upsertUser_(user);
  if (session.id) upsertEnglishDaySession_(session);
  answers.forEach(function(answer) { appendSubmission_(answer); });
  if (scoreHistory.id) appendScoreHistory_(scoreHistory);
  saveProgramData_({ type: 'english_day_session_history', data: sessionEntry });
  return { ok: true, userId: user.nip || '', submissions: answers.length };
}

function appendSubmission_(answer) {
  getSs_().getSheetByName(CONFIG.SHEETS.SUBMISSIONS).appendRow([
    answer.id || Utilities.getUuid(),
    answer.sessionId || '',
    answer.userId || '',
    answer.questionId || '',
    answer.questionText || '',
    answer.answerText || '',
    answer.isCorrect === true ? 'yes' : 'no',
    Number(answer.scoreAwarded || 0),
    answer.submittedAt || new Date().toISOString(),
    answer.reviewedBy || '',
    answer.mentorNote || '',
    JSON.stringify(answer)
  ]);
}

function appendScoreHistory_(row) {
  getSs_().getSheetByName(CONFIG.SHEETS.SCORE_HISTORY).appendRow([
    row.id || Utilities.getUuid(),
    row.userId || '',
    row.sessionId || '',
    Number(row.score || 0),
    row.source || '',
    row.createdAt || new Date().toISOString(),
    JSON.stringify(row)
  ]);
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

function normalizeNip_(nip) {
  return String(nip || '').trim().replace(/\s+/g, '');
}

function getUserByNip_(nip) {
  const key = normalizeNip_(nip);
  if (!key) return { ok: false, error: 'Missing nip' };
  const row = readSheet_(CONFIG.SHEETS.USERS).find(function(item) {
    return normalizeNip_(item.nip) === key;
  });
  return { ok: true, user: row || null };
}

function getUserProgress_(nip) {
  const key = normalizeNip_(nip);
  if (!key) return { ok: false, error: 'Missing nip' };
  return {
    ok: true,
    user: getUserByNip_(key).user,
    progress: readSheet_(CONFIG.SHEETS.PROGRESS).filter(function(row) { return normalizeNip_(row.nip) === key; }),
    attempts: readSheet_(CONFIG.SHEETS.ATTEMPTS).filter(function(row) { return normalizeNip_(row.nip) === key; }),
    submissions: readSheet_(CONFIG.SHEETS.SUBMISSIONS).filter(function(row) { return normalizeNip_(row.userId || row.nip) === key; }),
    scoreHistory: readSheet_(CONFIG.SHEETS.SCORE_HISTORY).filter(function(row) { return normalizeNip_(row.userId || row.nip) === key; })
  };
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
