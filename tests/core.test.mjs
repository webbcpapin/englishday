import test from 'node:test';
import assert from 'node:assert/strict';
import {
  grade,
  reviewNext,
  skillSummary,
  estimatePlacement,
  programHealth,
  csvCell,
  dayKey,
  dailyStreak,
  safeUrl,
  validateQuestion,
  recommend,
  tuesdayDates,
} from '../js/core.mjs';
import { LESSONS, QUESTIONS, WORLDS, SCENARIOS } from '../data/curriculum.mjs';
test('six worlds each contain ten functional lesson structures', () => {
  assert.equal(LESSONS.length, 60);
  for (const w of WORLDS) {
    assert.equal(LESSONS.filter((l) => l.world === w.id).length, 10);
  }
  for (const l of LESSONS) {
    for (const field of [
      'objective',
      'concept',
      'vocabulary',
      'examples',
      'dialogue',
      'audio',
      'caseStudy',
      'questions',
      'sources',
    ])
      assert.ok(l[field]?.length || typeof l[field] === 'object', l.id + ':' + field);
    assert.equal(l.reviewStatus, 'editorial_preview');
  }
});
test('all questions have unique IDs, supported skills, explanations and unambiguous choices', () => {
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length);
  for (const q of QUESTIONS) assert.deepEqual(validateQuestion(q), [], q.id);
  assert.equal(SCENARIOS.length, 12);
});
test('objective grading accepts case/whitespace and terminal punctuation, rejects incorrect answer', () => {
  assert.equal(
    grade({ type: 'dictation', answer: 'I am an officer.' }, ' i AM an officer ').correct,
    true,
  );
  assert.equal(grade({ type: 'mcq', answer: 'at' }, 'of').correct, false);
});
test('open response is never automatically correct or scored', () => {
  for (const type of ['writing', 'speaking', 'roleplay', 'pronunciation'])
    assert.deepEqual(grade({ type }, 'x'.repeat(1000)), {
      correct: null,
      score: null,
      status: 'pending_mentor',
    });
});
test('spaced repetition follows 0,1,3,7,14,30 days; failure resets to ten minutes', () => {
  let r;
  const now = 100;
  for (const n of [0, 1, 3, 7, 14, 30]) {
    r = reviewNext(r, true, now);
    assert.equal(r.dueAt, now + n * 86400000);
  }
  assert.equal(r.mastered, true);
  r = reviewNext(r, false, now);
  assert.equal(r.dueAt, now + 600000);
  assert.equal(r.mastered, false);
  assert.equal(r.lapses, 1);
});
test('competency uses unique latest evidence, not login count or cumulative XP', () => {
  const events = [
    { skill: 'grammar', questionId: 'a', correct: false },
    { skill: 'grammar', questionId: 'a', correct: true },
    ...Array.from({ length: 100 }, () => ({ skill: 'grammar', questionId: 'b', correct: false })),
  ];
  assert.equal(skillSummary(events).grammar.score, 50);
  assert.equal(skillSummary(events).speaking.score, null);
  assert.equal(skillSummary(events).grammar.evidence, 2);
});
test('placement refuses incomplete evidence and caps short screen at B1', () => {
  assert.equal(estimatePlacement([]).level, null);
  const e = ['grammar', 'vocabulary', 'reading', 'listening'].flatMap((s) =>
    [1, 2].map((n) => ({ skill: s, questionId: s + n, correct: true })),
  );
  assert.equal(estimatePlacement(e).level, 'B1');
  assert.equal(estimatePlacement(e).summary.speaking.score, null);
});
test('health has no baseline invented activity and dates alone cannot complete meetings', () => {
  const none = programHealth({});
  assert.equal(none.score, 0);
  assert.equal(none.hasEvidence, false);
  const planned = programHealth({
    planned: 1,
    sessions: [{ date: '2020-01-01', status: 'published' }],
  });
  assert.equal(planned.components.meetings, 0);
  const done = programHealth({
    planned: 1,
    sessions: [{ status: 'completed' }],
    assessments: [{ speaking: 0 }],
  });
  assert.equal(done.components.speaking, 0);
  assert.equal(done.components.meetings, 100);
  assert.equal(
    Object.values(done.weights).reduce((a, b) => a + b, 0),
    1,
  );
});
test('CSV formula injection is neutralised even behind whitespace', () => {
  for (const v of ['=cmd()', ' +SUM(A1)', '@x', '-1', '\t=1'])
    assert.ok(csvCell(v).startsWith('"\''));
  assert.equal(csvCell('a"b'), '"a""b"');
});
test('Jakarta day boundaries and streak use the intended timezone', () => {
  assert.equal(dayKey(new Date('2026-11-25T18:00:00Z')), '2026-11-26');
  assert.equal(
    dailyStreak(
      [{ at: '2026-11-25T18:00:00Z' }, { at: '2026-11-24T18:00:00Z' }],
      new Date('2026-11-26T10:00:00Z'),
    ),
    2,
  );
});
test('external URLs must be HTTPS', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('https://example.org/x'), 'https://example.org/x');
});
test('fresh recommendation works before any evidence and adapts to weak grammar', () => {
  assert.equal(recommend(LESSONS, {}, []).id, 'w1-l1');
  assert.ok(
    recommend(LESSONS, {}, [{ skill: 'grammar', questionId: 'q', correct: false }]).questions.some(
      (q) => q.skill === 'grammar',
    ),
  );
});
test('numeric mentor rubric scores are preserved in reports', () => {
  assert.equal(
    skillSummary([{ skill: 'writing', questionId: 'q', correct: true, score: 75 }]).writing.score,
    75,
  );
});
test('Tuesday plans use calendar dates without timezone drift', () => {
  assert.deepEqual(tuesdayDates('2026-11'), [
    '2026-11-03',
    '2026-11-10',
    '2026-11-17',
    '2026-11-24',
  ]);
  assert.throws(() => tuesdayDates('2026-13'));
});
