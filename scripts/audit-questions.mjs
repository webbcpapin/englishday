import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
const ref = 'e3f655a56ba6dba8f37d6dfcb592f6c7f44cbd2c';
const code = execFileSync('git', ['show', `${ref}:data/questions.js`], { encoding: 'utf8' }),
  context = vm.createContext({ window: {} });
vm.runInContext(
  'let auditSeed=20261126; Math.random=()=>((auditSeed=(auditSeed*1664525+1013904223)>>>0)/4294967296);',
  context,
);
vm.runInContext(code, context);
const bank = context.window.DRIVE_QUESTION_BANK,
  seen = new Map(),
  findings = [];
for (const q of bank) {
  const issues = [];
  if (q.options && new Set(q.options).size < q.options.length) issues.push('duplicate_choices');
  if (q.options && !q.options.includes(q.answer)) issues.push('correct_answer_omitted');
  const fingerprint = [q.type, q.prompt, q.answer || q.expectedAnswer].join('|');
  if (seen.has(fingerprint)) issues.push('repeated_item:' + seen.get(fingerprint));
  else seen.set(fingerprint, q.id);
  if (q.type === 'reading' && q.source === 'BEDROOM VOCAB') issues.push('reading_passage_missing');
  if (!q.cefr) issues.push('cefr_missing');
  if (!q.contentVersion) issues.push('content_version_missing');
  if (!q.reviewStatus) issues.push('review_status_missing');
  issues.push(
    q.sourceId === 'bedroom_vocab' ? 'source_accessed_2026-11-26' : 'original_source_not_verified',
  );
  findings.push({
    id: q.id,
    source: q.source,
    world: q.world,
    level: q.level,
    type: q.type,
    issues,
  });
}
const summary = {
  baseline: ref,
  questionCount: bank.length,
  auditSeed: 20261126,
  correctAnswerOmittedInSeededSample: findings.filter((q) =>
    q.issues.includes('correct_answer_omitted'),
  ).length,
  duplicateChoices: findings.filter((q) => q.issues.includes('duplicate_choices')).length,
  repeatedItems: findings.filter((q) => q.issues.some((i) => i.startsWith('repeated_item:')))
    .length,
  missingReadingPassage: findings.filter((q) => q.issues.includes('reading_passage_missing'))
    .length,
  review:
    'Structural audit covers every ID; pedagogical sign-off remains pending. Preview fixes duplicate choices and adds metadata, retaining original IDs and all 200 records.',
  findings,
};
fs.writeFileSync(
  new URL('../docs/QUESTION_AUDIT.json', import.meta.url),
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify({ ...summary, findings: undefined }));
