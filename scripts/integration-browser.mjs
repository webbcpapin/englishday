/** Actual browser -> HTTP API -> GAS emulator -> isolated in-memory sheets.
 * The identity provider is a TEST RSA key, not a real Google login. */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { backend } from '../tests/backend-harness.mjs';
const db = backend(),
  root = path.resolve(import.meta.dirname, '..');
db.put('V2Users', {
  id: 'test-mentor',
  name: 'Test Mentor',
  email: 'mentor@example.test',
  role: 'mentor',
  unit: 'Test',
  cohort: 'a',
  googleSub: '',
  disabled: false,
});
const mime = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const server = http.createServer(async (req, res) => {
  if (req.url === '/test-api') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const result = db.c.doPost({ postData: { contents: raw } });
    res.setHeader('Content-Type', 'application/json');
    const check = JSON.parse(result.text);
    if (!check.ok) console.log('TEST API response', JSON.parse(raw).action, check);
    res.end(result.text);
    return;
  }
  const url = new URL(req.url, 'http://localhost'),
    file = path.resolve(
      root,
      '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)),
    );
  try {
    if (!file.startsWith(root + path.sep)) throw Error();
    res.setHeader('Content-Type', mime[path.extname(file)] || 'text/plain');
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-proxy-server'],
});
async function session(email, route) {
  const c = await browser.newContext({ serviceWorkers: 'block' }),
    page = await c.newPage();
  await page.route('**/js/config.js', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `window.CEC_CONFIG={apiUrl:${JSON.stringify(base + '/test-api')},googleClientId:'test-client',institutionalAuthApproved:true};`,
    }),
  );
  await page.goto(base);
  await page.evaluate(async (id) => {
    await (await import('/js/api.mjs')).signIn(id.credential, id.challenge);
  }, db.identity(email));
  await page.goto(base + '/#' + route);
  await page.locator('h1').waitFor();
  return { c, page };
}
try {
  const admin = await session('admin@example.test', 'admin');
  await admin.page.locator('#admin-email').fill('learner@example.test');
  await admin.page.locator('#admin-name').fill('Test Learner');
  await admin.page.locator('#admin-unit').fill('Test unit');
  await admin.page.locator('#admin-cohort').fill('a');
  await admin.page.getByRole('button', { name: 'Simpan pengguna' }).click();
  await admin.page
    .locator('#admin-user-select option')
    .filter({ hasText: 'Test Learner' })
    .waitFor({ state: 'attached' });
  const learner = db.rows('V2Users').find((v) => v.email === 'learner@example.test');
  assert.equal(learner.role, 'learner');
  const mentor = await session('mentor@example.test', 'mentor');
  await mentor.page.locator('#mentor-session-title').fill('TEST: clear communication');
  await mentor.page.locator('#mentor-session-date').fill('2026-11-26');
  await mentor.page
    .locator('#mentor-session-description')
    .fill('Synthetic test session; not production data.');
  await mentor.page.locator('#mentor-session-prompt').fill('Write a polite clarification request.');
  await mentor.page.locator('#mentor-session-status').selectOption('published');
  await mentor.page.getByRole('button', { name: 'Simpan sesi', exact: true }).click();
  await mentor.page
    .locator('#mentor-record-session option')
    .filter({ hasText: 'TEST: clear communication' })
    .waitFor({ state: 'attached' });
  assert.equal(db.rows('V2EnglishDay').length, 1);
  const pupil = await session('learner@example.test', 'englishday');
  await pupil.page.locator('.session-answer-form textarea').waitFor();
  await pupil.page
    .locator('.session-answer-form textarea')
    .fill('Could you clarify the required format, please?');
  const submissionResponse = pupil.page.waitForResponse(
    (r) => r.url().endsWith('/test-api') && r.request().postDataJSON().action === 'submitSession',
  );
  await pupil.page.getByRole('button', { name: 'Kirim untuk review mentor' }).click();
  assert.equal((await (await submissionResponse).json()).ok, true);
  assert.equal(db.rows('V2Submissions')[0].status, 'pending_mentor');
  await mentor.page.getByRole('button', { name: 'Refresh data cohort' }).click();
  await mentor.page.locator('.rubric-form').waitFor();
  for (let i = 0; i < 4; i++) await mentor.page.locator(`[name="rubric-${i}"]`).selectOption('3');
  await mentor.page
    .locator('.rubric-form textarea')
    .fill('Clear and polite; give one specific next step.');
  await mentor.page.getByRole('button', { name: 'Simpan review rubrik' }).click();
  await mentor.page.getByText('Tidak ada jawaban menunggu review.').waitFor();
  assert.equal(db.rows('V2Submissions')[0].score, 75);
  await pupil.page.goto(base + '/#progress');
  await pupil.page.getByRole('button', { name: 'Refresh nilai resmi' }).click();
  await pupil.page.locator('#official-progress').getByText('writing: 75% · 1 bukti').waitFor();
  // A learner cannot invoke administration even if the menu is manually bypassed.
  const attack = await pupil.page.evaluate(async () => {
    try {
      return await (
        await import('/js/api.mjs')
      ).request('adminOverview', { role: 'administrator' });
    } catch (e) {
      return e.message;
    }
  });
  assert.match(attack, /not authorised/);
  await admin.page.goto(base + '/#admin');
  await admin.page.locator('#admin-user-select').waitFor();
  const dl = admin.page.waitForEvent('download');
  await admin.page.getByRole('button', { name: 'Download backup V2' }).click();
  assert.match((await dl).suggestedFilename(), /private-backup/);
  const result = {
    testedAt: new Date().toISOString(),
    status: 'passed',
    environment: 'Chrome + isolated GAS emulator; synthetic identities; no production access',
    flows: [
      'Administrator provisions learner',
      'Mentor publishes session',
      'Learner submits open response',
      'Mentor reviews four-dimension rubric',
      'Learner refreshes authoritative 75% writing score',
      'Forged role rejected',
      'Administrator downloads backup',
    ],
  };
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'test-results/integration-results.json'),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  server.close();
}
