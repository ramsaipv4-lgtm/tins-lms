// b6-3 tests: AC-67 (gate on upload, draft cannot publish), AC-68 (sealed sections, teleprompter release).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tarPack, openSection } from '../../core/src/index.ts';

const MAIN = new URL('../src/main.ts', import.meta.url).pathname;
const PKG = new URL('../../../acceptance/fixtures/package', import.meta.url).pathname;

function launch() {
  const dir = mkdtempSync(join(tmpdir(), 'lms-content-'));
  mkdirSync(join(dir, 'acc'), { recursive: true });
  const env = { ...process.env, PORT: '0', LMS_PROFILE: 'hub', LMS_DATA_DIR: dir, LMS_TLS: 'off', LMS_TEST_MODE: '1', LMS_ACCEPTANCE_DIR: join(dir, 'acc') };
  const child = spawn(process.execPath, [MAIN], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stderr.on('data', (d) => { err += d; });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no LISTENING: ' + err)), 30000);
    child.stdout.on('data', (d) => {
      out += d;
      const m = /LISTENING (\d+)/.exec(out);
      if (!m) return;
      clearTimeout(timer);
      const base = `http://127.0.0.1:${m[1]}`;
      let cookie = '';
      const req = async (path, { method = 'GET', body, raw } = {}) => {
        const r = await fetch(base + path, { method, headers: { ...(raw ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) }, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
        const text = await r.text();
        let json = null; try { json = JSON.parse(text); } catch {}
        return { status: r.status, json, text };
      };
      const login = async (personId, roles) => {
        cookie = '';
        const r = await fetch(base + '/__test/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId, roles }) });
        cookie = r.headers.get('set-cookie').split(';')[0];
      };
      resolve({ dir, req, login, stop: () => new Promise((r) => { child.on('exit', r); child.kill('SIGTERM'); }) });
    });
    child.on('exit', (c) => reject(new Error(`exited ${c}: ${err}`)));
  });
}

function pkgFiles(dir = PKG) {
  const out = [];
  const walk = (abs, rel) => {
    for (const n of readdirSync(abs).sort()) {
      const a = join(abs, n), r = rel ? `${rel}/${n}` : n;
      if (statSync(a).isDirectory()) walk(a, r); else out.push({ path: r, bytes: new Uint8Array(readFileSync(a)) });
    }
  };
  walk(dir, '');
  return out;
}

let s;
before(async () => { s = await launch(); });
after(async () => { await s.stop(); rmSync(s.dir, { recursive: true, force: true }); });

test('AC-67 upload runs the gate; a failing package is a draft and cannot be published', async () => {
  await s.login('tr1', ['trainer']);
  const good = await s.req('/api/packages', { method: 'POST', raw: tarPack(pkgFiles()) });
  assert.equal(good.status, 200);
  assert.ok(good.json.checks.length >= 8);
  assert.ok(good.json.checks.every((c) => c.pass));
  assert.notEqual(good.json.status, 'draft');
  const bad = pkgFiles().filter((f) => !f.path.endsWith('day1/deepdive.md'));
  const r = await s.req('/api/packages', { method: 'POST', raw: tarPack(bad) });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'draft');
  assert.ok(r.json.checks.some((c) => c.id === 'G1-files' && !c.pass));
  const pub = await s.req(`/api/packages/${r.json.id}/publish`, { method: 'POST' });
  assert.ok(pub.status >= 400 && pub.status < 500);
  const ok = await s.req(`/api/packages/${good.json.id}/publish`, { method: 'POST' });
  assert.equal(ok.status, 200);
  await s.login('l1', ['learner']);
  assert.equal((await s.req('/api/packages', { method: 'POST', raw: tarPack(pkgFiles()) })).status, 403);
});

test('AC-68 sealed sections, teleprompter release, no plaintext served or replicated', async () => {
  await s.login('admin1', ['admin']);
  assert.equal((await s.req('/__test/seed', { method: 'POST', body: { fixture: 'api/base.json' } })).status, 200);
  await s.login('l1', ['learner']);
  let d = await s.req('/api/classes/c1/days/0');
  assert.equal(d.status, 200);
  assert.ok(!d.text.includes('PLAINTEXT-MARKER'));
  assert.equal(d.json.sections.length, 4);
  for (const sec of d.json.sections) { assert.ok(sec.sealed); assert.equal(sec.key, undefined); }
  const repl = await s.req('/db/class-c1/day:0');
  assert.ok(!repl.text.includes('PLAINTEXT-MARKER'));
  await s.login('tr1', ['trainer']);
  assert.equal((await s.req('/api/classes/c1/teleprompter', { method: 'POST', body: { sectionId: 's-quiz' } })).status, 200);
  await s.login('l1', ['learner']);
  d = await s.req('/api/classes/c1/days/0');
  const by = Object.fromEntries(d.json.sections.map((x) => [x.id, x]));
  assert.ok(by['s-quiz'].key);
  assert.equal(by['s-exam'].key, undefined);
  const plain = new TextDecoder().decode(await openSection(new Uint8Array(Buffer.from(by['s-quiz'].key, 'base64')), new Uint8Array(Buffer.from(by['s-quiz'].sealed, 'base64'))));
  assert.equal(plain, 'PLAINTEXT-MARKER-s-quiz-9c1d');
  // time fallback: ungraded released by its planned time, graded not
  await s.login('admin1', ['admin']);
  await s.req('/__test/clock', { method: 'POST', body: { now: Date.parse('2026-11-02T09:30:00+05:30') + 650_000 } });
  await s.login('l1', ['learner']);
  d = await s.req('/api/classes/c1/days/0');
  const t = Object.fromEntries(d.json.sections.map((x) => [x.id, x]));
  assert.ok(t['s-intro'].key); assert.ok(t['s-quiz'].key); assert.equal(t['s-lab'].key, undefined); assert.equal(t['s-exam'].key, undefined);
  await s.login('tr1', ['trainer']);
  assert.equal((await s.req('/api/classes/c1/teleprompter', { method: 'POST', body: { releaseAll: true } })).status, 200);
  await s.login('l1', ['learner']);
  d = await s.req('/api/classes/c1/days/0');
  assert.ok(d.json.sections.every((x) => x.key));
  await s.login('l1', ['learner']);
  assert.equal((await s.req('/api/classes/c1/teleprompter', { method: 'POST', body: { releaseAll: true } })).status, 403);
});

test('seeded package publishes days with sealed sections', async () => {
  await s.login('admin1', ['admin']);
  const r = await s.req('/__test/seed', { method: 'POST', body: { fixture: 'journeys/base.json' } });
  assert.equal(r.status, 200);
  await s.login('tr1', ['trainer']);
  const d = await s.req('/api/classes/c1/days/1');
  assert.equal(d.status, 200);
  assert.equal(d.json.sections.length, 5);
  assert.ok(d.json.sections.every((x) => x.sealed && !x.key));
});
