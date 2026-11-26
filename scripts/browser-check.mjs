// Real browser smoke/regression tests. Uses synthetic anonymous data only.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { QUESTIONS, LESSONS } from '../data/curriculum.mjs';
const root = path.resolve(import.meta.dirname, '..'),
  out = path.join(root, 'test-results');
fs.mkdirSync(out, { recursive: true });
const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.gs': 'text/plain',
};
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'),
      file = path.resolve(
        root,
        '.' +
          decodeURIComponent(
            url.pathname.replace(/^\/englishday/, '') === '/'
              ? '/index.html'
              : url.pathname.replace(/^\/englishday/, ''),
          ),
      );
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const bytes = fs.readFileSync(file);
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/englishday`,
  results = [];
try {
  for (const channel of ['chrome', 'msedge']) {
    let browser;
    try {
      browser = await chromium.launch({ channel, headless: true, args: ['--no-proxy-server'] });
    } catch (e) {
      results.push({
        channel,
        test: 'browser launch',
        status: 'environment_unavailable',
        reason: e.message.split('\n')[0],
      });
      continue;
    }
    try {
      const context = await browser.newContext({
          viewport: { width: 1440, height: 1050 },
          reducedMotion: 'reduce',
        }),
        page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (e) => {
        if (e.type() === 'error') errors.push(e.text());
      });
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.locator('h1').waitFor();
      assert.match(await page.title(), /CEC Quest 2.0/);
      await page.screenshot({ path: path.join(out, channel + '-desktop.png'), fullPage: true });
      const routes = [
        'worlds',
        'world/1',
        'world/6',
        'daily',
        'vocabulary',
        'grammar',
        'listening',
        'speaking',
        'conversation',
        'tutor',
        'review',
        'progress',
        'englishday',
        'achievements',
        'leaderboard',
        'bank',
        'reports',
        'account',
        'placement',
        'mentor',
        'admin',
      ];
      for (const route of routes) {
        await page.goto(base + '/#' + route);
        await page.locator('h1').waitFor();
        assert.ok(
          !(await page.locator('main').innerText()).includes('Belum dapat dimuat.'),
          route + ': ' + (await page.locator('main').innerText()),
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          route + ' desktop overflow',
        );
      }
      await page.goto(base + '/#lesson/w1-l1');
      await page.getByRole('button', { name: 'Saya sudah mempelajari materi' }).click();
      await page.locator('[data-understand="I am a customs officer."]').click();
      await page.getByRole('button', { name: 'Mulai latihan' }).click();
      for (const word of ['I', 'am', 'a', 'customs', 'officer'])
        await page
          .locator('[data-token]')
          .filter({ hasText: new RegExp('^' + word + '$') })
          .click();
      await page.getByRole('button', { name: 'Cek susunan' }).click();
      await page.getByRole('button', { name: 'Lanjut speaking' }).click();
      await page.getByRole('button', { name: 'Latihan mandiri selesai' }).click();
      await page.getByRole('button', { name: 'Mulai evaluasi' }).click();
      for (const q of LESSONS[0].questions) {
        if (q.options)
          await page
            .locator('[data-answer]')
            .filter({
              hasText: new RegExp('^' + q.answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'),
            })
            .click();
        else {
          await page
            .locator('#quiz-answer')
            .fill(q.type === 'writing' ? 'I am a customs officer. I help visitors.' : q.answer);
          await page.getByRole('button', { name: 'Periksa / simpan jawaban' }).click();
        }
        // Double-click guard: a disabled answer cannot earn duplicate XP.
        await page
          .getByRole('button', {
            name: q === LESSONS[0].questions.at(-1) ? 'Lihat hasil' : 'Soal berikutnya',
          })
          .click();
      }
      assert.match(await page.locator('main').innerText(), /100% · hasil objektif/);
      const state = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('cecQuestV2Practice')),
      );
      assert.equal(state.xp, 40);
      assert.equal(state.events.filter((e) => e.correct === null).length, 1);
      assert.equal(state.progress['w1-l1'].mastered, true);
      results.push({
        channel,
        test: 'six-stage lesson; scoring; pending writing; persistence',
        status: 'passed',
      });
      await page.reload();
      await page.goto(base + '/#progress');
      assert.match(await page.locator('main').innerText(), /4[\s\S]*Respons objektif/);
      await page.goto(base + '/#conversation');
      await page
        .locator('#conversation-answer')
        .fill('<img src=x onerror=alert(1)> I is an officer.');
      await page.getByRole('button', { name: 'Review respons saya' }).click();
      assert.equal(await page.locator('#conversation-feedback img').count(), 0);
      assert.match(await page.locator('#conversation-feedback').innerText(), /I am/);
      await page.goto(base + '/#tutor');
      await page.locator('#tutor-input').fill('I is a customs officer.');
      await page.getByRole('button', { name: 'Bantu saya berlatih' }).click();
      assert.match(await page.locator('#tutor-result').innerText(), /I am a customs officer/);
      await page.goto(base + '/#reports');
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'CSV · Excel compatible' }).click();
      const download = await downloadPromise;
      assert.match(download.suggestedFilename(), /\.csv$/);
      await page.setViewportSize({ width: 390, height: 844 });
      for (const route of ['home', ...routes, 'lesson/w1-l1']) {
        await page.goto(base + '/#' + route);
        await page.locator('h1').waitFor();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          route + ' mobile overflow',
        );
      }
      await page.goto(base + '/#home');
      await page.screenshot({ path: path.join(out, channel + '-mobile.png'), fullPage: true });
      // Public app shell is cached, API responses are not. Offline reload is real.
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      await page.reload();
      await context.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('h1').waitFor();
      assert.match(await page.locator('h1').innerText(), /Your next chapter/);
      await context.setOffline(false);
      const cache = await page.evaluate(async () => {
        const keys = await caches.keys(),
          urls = [];
        for (const key of keys) {
          const c = await caches.open(key);
          urls.push(...(await c.keys()).map((r) => r.url));
        }
        return urls;
      });
      assert.ok(cache.every((u) => u.startsWith(locationOrigin(base))));
      results.push({
        channel,
        test: '21 routes desktop/mobile, XSS rendering, tutor rule, CSV download, offline reload',
        status: 'passed',
        consoleErrors: errors,
      });
      assert.deepEqual(errors, []);
      await context.close();
    } finally {
      await browser.close();
    }
  }
  function locationOrigin(url) {
    return new URL(url).origin;
  }
  fs.writeFileSync(
    path.join(out, 'browser-results.json'),
    JSON.stringify({ testedAt: new Date().toISOString(), results }, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  server.close();
}
