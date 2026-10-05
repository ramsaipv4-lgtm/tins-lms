// b7-4 tests: AC-83 teleprompter release, AC-150/151 substitute and self-learn, AC-157 trainer pack, AC-158 rehearsal.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(new URL('..', import.meta.url).pathname, '..', '..');
let server, base, child, dir;

async function startServer() {
  dir = mkdtempSync(join(tmpdir(), 'lms-tele-'));
  const env = { ...process.env, PORT: '0', LMS_PROFILE: 'hub', LMS_DATA_DIR: dir, LMS_TLS: 'off', LMS_TEST_MODE: '1' };
  child = spawn(process.execPath, [join(ROOT, 'packages/server/src/main.ts')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  base = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server did not start')), 30000);
    child.stdout.on('data', (d) => { out += d; const m = /LISTENING (\d+)/.exec(out); if (m) { clearTimeout(t); res(`http://127.0.0.1:${m[1]}`); } });
    child.on('exit', (c) => rej(new Error('server exited ' + c)));
  });
}
const post = (p, body, cookie) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
async function login(personId, roles) {
  const r = await post('/__test/login', { personId, roles });
  return r.headers.get('set-cookie').split(';')[0];
}
async function browser() {
  const { chromium } = await import(join(process.env.LMS_NODE_MODULES ?? join(ROOT, 'node_modules'), '@playwright/test/index.mjs'));
  const d = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  const rev = readdirSync(d).find((x) => /^chromium-\d+$/.test(x));
  return chromium.launch(rev ? { executablePath: join(d, rev, 'chrome-linux', 'chrome') } : {});
}
async function signedIn(b, personId, roles, path) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const c = await login(personId, roles);
  const [name, ...v] = c.split('=');
  await ctx.addCookies([{ name, value: v.join('='), url: base }]);
  const page = await ctx.newPage();
  await page.goto(base + path);
  await page.getByTestId('app-ready').waitFor({ timeout: 30000 });
  return page;
}

before(async () => {
  spawnSync('npm', ['run', 'build', '-w', 'packages/web'], { cwd: ROOT, encoding: 'utf8' });
  await startServer();
  const r = await post('/__test/seed', { fixture: 'journeys/base.json' });
  assert.equal(r.status, 200, await r.clone().text());
  await post('/__test/clock', { now: Date.parse('2026-11-02T09:01:00+05:30') });
}, { timeout: 180000 });
after(async () => { child?.kill('SIGTERM'); if (dir) rmSync(dir, { recursive: true, force: true }); });

test('AC-83 learner day page shows a section released by the trainer without reloading', { timeout: 90000 }, async () => {
  const b = await browser();
  try {
    const learner = await signedIn(b, 'l1', ['learner'], '/learn/today');
    await learner.getByTestId('section-warm-up').waitFor({ timeout: 15000 });
    assert.equal(await learner.getByTestId('section-concept-walkthrough').count(), 0);
    const trainer = await signedIn(b, 'tr1', ['trainer'], '/teach/teleprompter');
    await trainer.getByTestId('teleprompter').waitFor();
    await trainer.getByTestId('tp-next').click();
    await trainer.getByTestId('tp-pace').filter({ hasText: /ahead|behind/i }).waitFor();
    await learner.getByTestId('section-concept-walkthrough').waitFor({ timeout: 15000 });
    assert.match(await learner.getByTestId('section-concept-walkthrough').innerText(), /Concept walkthrough/);
  } finally { await b.close(); }
});

test('AC-150 / AC-151 substitute handover, mark read, self-learn with AI off, report', { timeout: 90000 }, async () => {
  const b = await browser();
  try {
    const tr = await signedIn(b, 'tr1', ['trainer'], '/teach/substitute');
    await tr.getByRole('button', { name: /can.?t take day 1/i }).click();
    await tr.getByRole('combobox', { name: /substitute/i }).selectOption({ label: 'Sam Substitute' });
    await tr.getByRole('button', { name: /confirm/i }).click();
    const sub = await signedIn(b, 'sub1', ['substitute'], '/teach/handover');
    await sub.getByTestId('handover-pack').waitFor();
    await sub.getByRole('button', { name: /mark (as )?read/i }).click();
    await sub.getByText(/marked this handover as read/i).waitFor();
    await tr.goto(base + '/teach/delivery-reports');
    await tr.getByRole('cell', { name: 'Sam Substitute' }).waitFor();
    // self-learn on day 2
    await tr.goto(base + '/teach/substitute');
    await tr.getByRole('button', { name: /can.?t take day 2/i }).click();
    await tr.getByRole('button', { name: /^self-learn mode$/i }).click();
    await tr.getByRole('button', { name: /confirm/i }).click();
    await tr.getByTestId('self-learn').waitFor();
    await tr.getByRole('button', { name: /^next section$/i }).click();
    await tr.getByRole('textbox', { name: /question/i }).fill('What is a build?');
    await tr.getByRole('button', { name: /^ask$/i }).click();
    await tr.getByText(/queued for the trainer/i).first().waitFor();
    await tr.goto(base + '/teach/delivery-reports');
    await tr.getByRole('cell', { name: 'AI-delivered' }).waitFor();
  } finally { await b.close(); }
});

test('AC-157 trainer pack and package library', { timeout: 60000 }, async () => {
  const b = await browser();
  try {
    const p = await signedIn(b, 'tr1', ['trainer'], '/teach/trainer-pack');
    const pack = p.getByTestId('trainer-pack');
    await pack.waitFor();
    for (const h of [/card deck/i, /cheat sheet/i, /command reference/i, /likely questions/i]) await pack.getByRole('heading', { name: h }).waitFor();
    await pack.getByText('kettle init demo-site').first().waitFor();
    await p.goto(base + '/teach/package-library');
    await p.getByTestId('package-library').waitFor();
    await p.getByText(/rehearsal history/i).first().waitFor();
  } finally { await b.close(); }
});

test('AC-158 rehearsal shows planned vs actual, self-check and freshness', { timeout: 90000 }, async () => {
  const b = await browser();
  try {
    const p = await signedIn(b, 'tr1', ['trainer'], '/teach/rehearsal');
    await p.clock.install();
    await p.getByRole('button', { name: /start rehearsal/i }).click();
    await p.getByTestId('teleprompter').waitFor();
    await p.clock.fastForward(20 * 60 * 1000);
    await p.getByTestId('tp-next').click();
    await p.getByTestId('tp-pace').filter({ hasText: /behind/i }).waitFor();
    await p.getByRole('button', { name: /finish rehearsal/i }).click();
    await p.getByTestId('rehearsal-report').waitFor();
    await p.getByRole('heading', { name: /self.?check/i }).waitFor();
    assert.ok(await p.getByRole('checkbox').count() >= 1);
    await p.getByText(/freshness check: (ok|stale|not checked)/i).waitFor();
  } finally { await b.close(); }
});
