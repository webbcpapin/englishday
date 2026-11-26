import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { LESSONS, QUESTIONS, VOCABULARY } from '../data/curriculum.mjs';
import { validateQuestion } from '../js/core.mjs';
const root = path.resolve(import.meta.dirname, '..');
for (const dir of ['js', 'data', 'scripts', 'tests'])
  for (const name of fs.readdirSync(path.join(root, dir)))
    if (/\.(mjs|js)$/.test(name)) {
      const file = path.join(root, dir, name),
        r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
    }
new vm.Script(fs.readFileSync(path.join(root, 'gas_backend.gs'), 'utf8'));
for (const q of QUESTIONS) assert.deepEqual(validateQuestion(q), [], q.id);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)) {
  const ref = match[1];
  if (!ref.startsWith('http')) assert.ok(fs.existsSync(path.join(root, ref)), ref);
}
assert.ok(!html.includes('<script>'), 'No inline application scripts');
const c = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'data/questions.js'), 'utf8'), c);
assert.equal(c.window.DRIVE_QUESTION_BANK.length, 200);
for (const q of c.window.DRIVE_QUESTION_BANK) {
  if (q.options) {
    assert.equal(new Set(q.options).size, q.options.length);
    assert.ok(q.options.includes(q.answer));
    assert.ok(q.options.length >= 2);
  }
}
const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
assert.equal(m.scope, './');
for (const icon of m.icons) assert.ok(fs.existsSync(path.join(root, icon.src)));
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
assert.ok(sw.includes("e.request.method!=='GET'"));
assert.ok(sw.includes('u.origin!==self.location.origin'));
console.log(
  `Validated static references, JavaScript syntax, ${LESSONS.length} lesson structures, ${QUESTIONS.length} preview questions, ${VOCABULARY.length} vocabulary entries, and 200 archive questions.`,
);
