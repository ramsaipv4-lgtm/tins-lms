// Foundation tests for b7-1: AC-81 (learner join journey), AC-123 (strings, pseudo-locale), feature registry layout.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB = new URL('..', import.meta.url).pathname;
const ROOT = join(WEB, '..', '..');
const GROUPS = ['admin', 'attend', 'tele', 'learn', 'shift', 'classroom', 'coach', 'files', 'board'];

// Each build goes to its own folder under .test-dist and is served from there, so this file never
// empties the shared dist that other test files and journeys are using (integration I-3).
function build(name, env = {}) {
  const out = join(WEB, '.test-dist', name);
  const r = spawnSync('npm', ['run', 'build', '-w', 'packages/web'], { cwd: ROOT, env: { ...process.env, ...env, LMS_WEB_OUT: out }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return out;
}

async function startServer(webDist) {
  const dir = mkdtempSync(join(tmpdir(), 'lms-web-'));
  const env = { ...process.env, PORT: '0', LMS_PROFILE: 'hub', LMS_DATA_DIR: dir, LMS_TLS: 'off', LMS_TEST_MODE: '1', LMS_WEB_DIST: webDist };
  const child = spawn(process.execPath, [join(ROOT, 'packages/server/src/main.ts')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  const base = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server did not start')), 30000);
    child.stdout.on('data', (d) => { out += d; const m = /LISTENING (\d+)/.exec(out); if (m) { clearTimeout(t); res(`http://127.0.0.1:${m[1]}`); } });
    child.on('exit', (c) => rej(new Error('server exited ' + c)));
  });
  const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { base, post, stop: () => new Promise((r) => { child.on('exit', r); child.kill('SIGTERM'); rmSync(dir, { recursive: true, force: true }); }) };
}

async function browser() {
  const { chromium } = await import(join(process.env.LMS_NODE_MODULES ?? join(ROOT, 'node_modules'), '@playwright/test/index.mjs'));
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  const rev = readdirSync(dir).find((d) => /^chromium-\d+$/.test(d));
  return chromium.launch(rev ? { executablePath: join(dir, rev, 'chrome-linux', 'chrome') } : {});
}

test('registry: one folder per group with routes and strings; shell strings exist', () => {
  for (const g of GROUPS) {
    const idx = readFileSync(join(WEB, 'src/features', g, 'index.tsx'), 'utf8');
    assert.match(idx, /export const routes/, g);
    JSON.parse(readFileSync(join(WEB, 'src/features', g, 'strings.en.json'), 'utf8'));
  }
  assert.ok(existsSync(join(WEB, 'src/features/registry.ts')));
  const en = JSON.parse(readFileSync(join(WEB, 'src/strings/en.json'), 'utf8'));
  assert.ok(en['join.tncAccept'] && en['setup.title']);
});

for (const pseudo of [false, true]) {
  test(`AC-81 learner joins: T&C, date of birth, setup check [pseudo-locale ${pseudo}]`, { timeout: 120_000 }, async () => {
    const out = build(pseudo ? 'pseudo' : 'plain', pseudo ? { LMS_PSEUDO_LOCALE: '1' } : {});
    const b = await browser(); const s = await startServer(out);
    try {
      const seed = await s.post('/__test/seed', { fixture: 'journeys/base.json' });
      assert.equal(seed.status, 200, await seed.text());
      const page = await b.newPage();
      await page.goto(`${s.base}/join/JOIN-C1-0001`);
      await page.getByTestId('app-ready').waitFor();
      await page.getByTestId('tnc-accept').check();
      await page.getByLabel(/full name/i).fill('Lena Learner');
      await page.getByLabel(/roll/i).fill('R-100');
      await page.getByLabel(/date of birth/i).fill('2004-05-06');
      if (pseudo) assert.match(await page.getByRole('heading', { level: 1 }).innerText(), /^⟦.*⟧$/);
      await page.getByRole('button', { name: /continue|next|join|create account|sign up/i }).click();
      const sc = page.getByTestId('setup-check');
      await sc.waitFor();
      const states = await sc.locator('[data-state]').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));
      assert.ok(states.length >= 3 && states.every((x) => x === 'pass' || x === 'fail'), states.join());
      assert.ok(states.includes('pass'));
      // The session cookie works and the learner space is deep-linkable with its own <nav>.
      await page.goto(`${s.base}/learn`);
      await page.getByTestId('home-learner').waitFor();
      assert.ok(await page.locator('nav').count() >= 1);
      // A used code is refused with a readable message.
      const p2 = await b.newPage();
      await p2.goto(`${s.base}/join/JOIN-C1-0001`);
      await p2.getByTestId('tnc-accept').check();
      await p2.getByLabel(/date of birth/i).fill('2004-05-06');
      await p2.getByRole('button', { name: /create account/i }).click();
      await p2.getByRole('alert').first().waitFor();
    } finally { await b.close(); await s.stop(); }
  });
}

test('foundation: built output has a manifest, a service worker and a small shell', () => {
  const out = build('size');
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest']) assert.ok(existsSync(join(out, f)), f);
  // The shell is what index.html loads: its scripts and modulepreloads, plus every chunk those import
  // statically. Lazy chunks (import()) such as the board are not part of the shell (integration I-4).
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  const todo = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
  const seen = new Set();
  while (todo.length) {
    const f = todo.pop(); if (seen.has(f)) continue; seen.add(f);
    const code = readFileSync(join(out, 'assets', f), 'utf8');
    for (const m of code.matchAll(/(?:^|[;\n}])\s*import\s*(?:[\w$*{}\s,]+from\s*)?["']\.\/([^"']+\.js)["']/g)) todo.push(m[1]);
  }
  assert.ok(seen.size >= 1, 'index.html loads no script from /assets');
  let total = 0;
  for (const f of seen) total += spawnSync('gzip', ['-c', join(out, 'assets', f)]).stdout.length;
  assert.ok(total < 300 * 1024, `shell JS ${total} bytes gzip in ${seen.size} chunk(s)`);
});
