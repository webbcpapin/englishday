export const SKILLS = ['vocabulary', 'grammar', 'reading', 'listening', 'speaking', 'writing'];
export const INTERVALS = [0, 1, 3, 7, 14, 30];
export function tuesdayDates(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw Error('Periode tidak valid');
  const [year, m] = month.split('-').map(Number);
  if (m < 1 || m > 12) throw Error('Bulan tidak valid');
  const dates = [];
  for (let day = 1; day <= 31; day++) {
    const d = new Date(Date.UTC(year, m - 1, day));
    if (d.getUTCMonth() !== m - 1) break;
    if (d.getUTCDay() === 2) dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
export const dayKey = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
export const normalize = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, '')
    .replace(/\s+/g, ' ');
export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function csvCell(value) {
  const s = String(value ?? '');
  return '"' + (/^[\s]*[=+@\-\t\r]/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"';
}
export function csv(rows) {
  return '\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
export function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}
export function grade(question, answer) {
  if (['speaking', 'writing', 'roleplay', 'pronunciation'].includes(question.type))
    return { correct: null, score: null, status: 'pending_mentor' };
  const accepted = [question.answer, ...(question.alternatives || [])];
  const correct = accepted.some((a) => a != null && normalize(a) === normalize(answer));
  return { correct, score: correct ? 100 : 0, status: 'graded' };
}
export function reviewNext(previous, success, now = Date.now()) {
  const step = success ? Math.min((previous?.step ?? -1) + 1, INTERVALS.length - 1) : 0;
  const delay = success ? INTERVALS[step] * 86400000 : 600000;
  return {
    step,
    dueAt: now + delay,
    lastReviewedAt: now,
    lapses: (previous?.lapses || 0) + (success ? 0 : 1),
    mastered: success && step === 5,
  };
}
export function skillSummary(events) {
  return Object.fromEntries(
    SKILLS.map((skill) => {
      const latest = new Map();
      for (const e of events)
        if (e.skill === skill && typeof e.correct === 'boolean') latest.set(e.questionId, e);
      const samples = [...latest.values()].slice(-30);
      return [
        skill,
        {
          score: samples.length
            ? Math.round(
                samples.reduce(
                  (s, e) => s + (Number.isFinite(e.score) ? e.score : e.correct ? 100 : 0),
                  0,
                ) / samples.length,
              )
            : null,
          evidence: samples.length,
        },
      ];
    }),
  );
}
export function recommend(lessons, progress, events, placementLevel = null) {
  const skills = skillSummary(events);
  const weak = Object.entries(skills)
    .filter(([, v]) => v.evidence > 0)
    .sort((a, b) => a[1].score - b[1].score)[0]?.[0];
  const startWorld = placementLevel === 'B1' ? 3 : placementLevel === 'A2' ? 2 : 1;
  return lessons
    .map((l, i) => {
      const evidence = events.filter((e) => e.lessonId === l.id && typeof e.correct === 'boolean'),
        latest = new Map();
      evidence.forEach((e) => latest.set(e.questionId, e));
      const last = [...latest.values()],
        errors = last.filter((e) => !e.correct).length,
        slow =
          evidence.length &&
          evidence.reduce((s, e) => s + (e.durationMs || 0), 0) / evidence.length > 60000;
      const priority =
        (progress[l.id]?.mastered ? 0 : l.world >= startWorld ? 20 : 5) +
        (errors ? 60 + (errors / last.length) * 20 : 0) +
        (slow ? 5 : 0) +
        Math.min(5, evidence.filter((e) => !e.correct).length) +
        (l.focusSkill === weak ? 10 : 0) -
        i / 1000;
      return { lesson: l, priority };
    })
    .sort((a, b) => b.priority - a.priority)[0]?.lesson;
}
export function dailyStreak(events, now = new Date()) {
  const dates = new Set(events.map((e) => dayKey(new Date(e.at || e.createdAt))));
  let count = 0,
    cursor = new Date(now);
  if (!dates.has(dayKey(cursor))) cursor.setTime(cursor.getTime() - 86400000);
  while (dates.has(dayKey(cursor))) {
    count++;
    cursor.setTime(cursor.getTime() - 86400000);
  }
  return count;
}
export function programHealth({
  sessions = [],
  attendance = [],
  assessments = [],
  assignments = [],
  reports = [],
  planned = 0,
}) {
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  const completed = sessions.filter((s) => s.status === 'completed');
  const components = {
    attendance: attendance.length
      ? (attendance.filter((a) => a.present).length / attendance.length) * 100
      : 0,
    activity: attendance.length
      ? (attendance.filter((a) => a.active).length / attendance.length) * 100
      : 0,
    tasks: assignments.length
      ? (assignments.filter((a) => a.completed).length / assignments.length) * 100
      : 0,
    speaking: avg(assessments.filter((a) => Number.isFinite(a.speaking)).map((a) => a.speaking)),
    meetings: planned ? Math.min(100, (completed.length / planned) * 100) : 0,
    documentation: completed.length
      ? (completed.filter((s) => safeUrl(s.documentationUrl)).length / completed.length) * 100
      : 0,
    reports: reports.some((r) => r.status === 'approved') ? 100 : 0,
  };
  const weights = {
    attendance: 0.25,
    activity: 0.15,
    tasks: 0.15,
    speaking: 0.15,
    meetings: 0.15,
    documentation: 0.1,
    reports: 0.05,
  };
  return {
    score: Math.round(Object.keys(weights).reduce((s, k) => s + components[k] * weights[k], 0)),
    components,
    weights,
    hasEvidence: !!(completed.length || attendance.length || assessments.length),
  };
}
export function estimatePlacement(events) {
  const summary = skillSummary(events),
    objective = ['vocabulary', 'grammar', 'reading', 'listening'];
  const measured = objective.filter((s) => summary[s].evidence >= 2);
  if (measured.length < 4) return { level: null, status: 'insufficient_evidence', summary };
  const score = measured.reduce((s, k) => s + summary[k].score, 0) / 4;
  return {
    level: score >= 85 ? 'B1' : score >= 60 ? 'A2' : 'A1',
    status: 'provisional',
    summary,
    note: 'Estimasi skrining internal A1–B1; B2–C2 serta speaking/writing memerlukan assessment mentor, bukan sertifikasi CEFR.',
  };
}
export function validateQuestion(q) {
  const errors = [];
  if (!q || typeof q !== 'object') return ['Object soal wajib diisi'];
  for (const key of [
    'id',
    'source',
    'explanation',
    'cefr',
    'skill',
    'type',
    'contentVersion',
    'reviewStatus',
  ])
    if (!q[key]) errors.push(key);
  if (!/^[\w.-]{1,100}$/.test(q.id || '')) errors.push('id format');
  if (!SKILLS.includes(q.skill)) errors.push('skill');
  if (
    q.options &&
    (new Set(q.options.map(normalize)).size !== q.options.length || !q.options.includes(q.answer))
  )
    errors.push('options');
  if (!['speaking', 'writing', 'roleplay', 'pronunciation'].includes(q.type) && !q.answer)
    errors.push('answer');
  return errors;
}
