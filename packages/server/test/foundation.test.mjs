// Foundation tests for b6-1: AC-60, AC-61, AC-62, AC-63, AC-64, AC-78 (server start, health, CA, roles, join, T&C, test mode).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = new URL('../src/main.ts', import.meta.url).pathname;

function launch(testMode) {
  const dir = mkdtempSync(join(tmpdir(), 'lms-found-'));
  const env = { ...process.env, PORT: '0', LMS_PROFILE: 'hub', LMS_DATA_DIR: dir, LMS_TLS: 'off', LMS_ACCEPTANCE_DIR: join(dir, 'acc') };
  if (testMode) env.LMS_TEST_MODE = '1'; else delete env.LMS_TEST_MODE;
  const child = spawn(process.execPath, [MAIN], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stderr.on('data', (d) => { err += d; });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no LISTENING line; stderr: ${err}`)), 30000);
    child.stdout.on('data', (d) => {
      out += d;
      const m = /LISTENING (\d+)/.exec(out);
      if (m) {
        clearTimeout(timer);
        const base = `http://127.0.0.1:${m[1]}`;
        let cookie = '';
        const req = async (path, { method = 'GET', body, noCookie } = {}) => {
          const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(cookie && !noCookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
          const set = r.headers.get('set-cookie');
          if (set) cookie = set.split(';')[0];
          const text = await r.text();
          let json = null; try { json = JSON.parse(text); } catch {}
          return { status: r.status, json, text, setCookie: set };
        };
        resolve({ dir, req, out: () => out, err: () => err, clearCookie: () => { cookie = ''; }, stop: () => new Promise((r) => { child.on('exit', r); child.kill('SIGTERM'); }) });
      }
    });
    child.on('exit', (c) => reject(new Error(`exited early ${c}: ${err}`)));
  });
}

let s;
before(async () => {
  s = await launch(true);
  mkdirSync(join(s.dir, 'acc', 'fixtures', 'api'), { recursive: true });
});
after(async () => { await s.stop(); });

test('AC-60 health has ok, profile, schema, version and no secrets', async () => {
  const r = await s.req('/api/health', { noCookie: true });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.profile, 'hub');
  assert.equal(typeof r.json.schema, 'number');
  assert.equal(typeof r.json.version, 'string');
  assert.deepEqual(Object.keys(r.json).sort(), ['ok', 'profile', 'schema', 'version']);
});

test('AC-61 admin invite printed once; CA fingerprint is served', async () => {
  assert.equal((s.out().match(/ADMIN_INVITE /g) || []).length, 1);
  const invite = /ADMIN_INVITE (\S+)/.exec(s.out())[1];
  assert.ok(!s.err().includes(invite), 'invite must not reach stderr');
  assert.equal((await s.req('/api/pairing/fingerprint', { noCookie: true })).status, 401);
  await s.req('/__test/login', { method: 'POST', body: { personId: 't1', roles: ['trainer'] } });
  const f = await s.req('/api/pairing/fingerprint');
  assert.equal(f.status, 200);
  assert.match(f.json.fingerprint, /^[0-9a-f]{64}$/);
  // the invite creates an admin once
  s.clearCookie();
  const join = { code: invite, name: 'Boss', tncVersion: '1' };
  const j = await s.req('/api/join', { method: 'POST', body: join });
  assert.equal(j.status, 200);
  assert.deepEqual(j.json.roles, ['admin']);
  assert.equal((await s.req('/api/join', { method: 'POST', body: join })).status, 409);
});

test('AC-62 sessions and roles', async () => {
  s.clearCookie();
  assert.equal((await s.req('/api/me')).status, 401);
  assert.equal((await s.req('/api/join/tnc')).status, 200);
  await s.req('/__test/login', { method: 'POST', body: { personId: 'l1', roles: ['learner'] } });
  assert.equal((await s.req('/api/me')).status, 200);
  assert.equal((await s.req('/api/classes/c1/join-codes', { method: 'POST' })).status, 403);
  assert.equal((await s.req('/api/admin/tnc', { method: 'POST', body: { version: '2', text: 'x' } })).status, 403);
  await s.req('/__test/login', { method: 'POST', body: { personId: 'sub', roles: ['substitute'] } });
  assert.equal((await s.req('/api/classes/c1/join-codes', { method: 'POST' })).status, 403);
  const bad = await s.req('/__test/clock', { method: 'POST', body: { now: 'x' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.json.error.now);
});

test('AC-63 join code is one-time; same roll number warns', async () => {
  await s.req('/__test/login', { method: 'POST', body: { personId: 't1', roles: ['trainer'] } });
  const a = (await s.req('/api/classes/c1/join-codes', { method: 'POST' })).json.code;
  const b = (await s.req('/api/classes/c1/join-codes', { method: 'POST' })).json.code;
  s.clearCookie();
  const body = (code, roll) => ({ code, name: 'Asha', rollNumber: roll, dob: '2000-01-01', tncVersion: '1' });
  const first = await s.req('/api/join', { method: 'POST', body: body(a, 'R1') });
  assert.equal(first.status, 201);
  assert.ok(first.setCookie?.includes('HttpOnly'));
  const reuse = await s.req('/api/join', { method: 'POST', body: body(a, 'R2') });
  assert.equal(reuse.status, 409);
  const dup = await s.req('/api/join', { method: 'POST', body: body(b, 'R1') });
  assert.equal(dup.status, 200);
  assert.ok(dup.text.includes('already-enrolled'));
  const miss = await s.req('/api/join', { method: 'POST', body: { code: 'nope', name: 'x', tncVersion: '1' } });
  assert.equal(miss.status, 404);
  const invalid = await s.req('/api/join', { method: 'POST', body: { code: 'x' } });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.json.error.name && invalid.json.error.tncVersion);
});

test('AC-64 T&C acceptance, new version asks again, minors', async () => {
  await s.req('/__test/login', { method: 'POST', body: { personId: 'l9', roles: ['learner'] } });
  let me = (await s.req('/api/me')).json;
  assert.equal(me.tnc.needsAcceptance, true);
  assert.equal((await s.req('/api/me/tnc', { method: 'POST', body: { version: '1' } })).status, 200);
  me = (await s.req('/api/me')).json;
  assert.equal(me.tnc.needsAcceptance, false);
  assert.equal(typeof me.tnc.acceptedAt, 'number');
  await s.req('/__test/login', { method: 'POST', body: { personId: 'adm', roles: ['admin'] } });
  assert.equal((await s.req('/api/admin/tnc', { method: 'POST', body: { version: '2', text: 'new terms' } })).status, 200);
  assert.deepEqual((await s.req('/api/join/tnc')).json, { version: '2', text: 'new terms' });
  await s.req('/__test/login', { method: 'POST', body: { personId: 'l9', roles: ['learner'] } });
  assert.equal((await s.req('/api/me')).json.tnc.needsAcceptance, true);
  // minor joins
  await s.req('/__test/clock', { method: 'POST', body: { now: Date.UTC(2026, 5, 1) } });
  await s.req('/__test/login', { method: 'POST', body: { personId: 't1', roles: ['trainer'] } });
  const code = (await s.req('/api/classes/c2/join-codes', { method: 'POST' })).json.code;
  s.clearCookie();
  const j = await s.req('/api/join', { method: 'POST', body: { code, name: 'Kid', rollNumber: 'K1', dob: '2010-06-02', tncVersion: '2' } });
  assert.equal(j.status, 201);
  const kid = (await s.req('/api/me')).json;
  assert.equal(kid.minor, true);
  assert.equal(kid.coachTrackers, false);
  assert.equal(kid.tnc.needsAcceptance, false);
});

test('seed loads a fixture and reset wipes data', async () => {
  writeFileSync(join(s.dir, 'acc', 'fixtures', 'api', 'tiny.json'), JSON.stringify({
    databases: { 'class-c7': [{ type: 'class', id: 'class:c7', schema: 1, name: 'C7' }] },
    joinCodes: [{ code: 'SEED-1', classId: 'class:c7' }],
  }));
  await s.req('/__test/login', { method: 'POST', body: { personId: 'adm', roles: ['admin'] } });
  const r = await s.req('/__test/seed', { method: 'POST', body: { fixture: 'api/tiny.json' } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.docs, 1);
  const db = await s.req('/db/class-c7/class:c7');
  assert.equal(db.status, 200);
  assert.equal(db.json.name, 'C7');
  assert.equal((await s.req('/db/lms-private/_all_docs')).status, 403);
  assert.equal((await s.req('/__test/seed', { method: 'POST', body: { fixture: '../../etc/passwd' } })).status, 404);
  assert.equal((await s.req('/__test/reset', { method: 'POST' })).status, 200);
  assert.notEqual((await s.req('/db/class-c7/class:c7')).status, 200);
  assert.equal((await s.req('/api/join/tnc')).json.version, '1');
});

test('AC-78 /__test/* is 404 without LMS_TEST_MODE', async () => {
  const t = await launch(false);
  try {
    for (const [m, p] of [['POST', '/__test/login'], ['POST', '/__test/seed'], ['POST', '/__test/clock'], ['POST', '/__test/reset'], ['GET', '/__test/anything']]) {
      assert.equal((await t.req(p, { method: m, body: m === 'POST' ? {} : undefined })).status, 404, p);
    }
  } finally { await t.stop(); }
});

test('no secrets reach the logs (AC-120 groundwork)', async () => {
  const joined = s.out() + s.err();
  assert.ok(!/lms_session|cookie|privateJwk/i.test(joined));
  assert.equal((s.out().match(/ADMIN_INVITE/g) || []).length, 1);
});

after(() => { try { rmSync(s.dir, { recursive: true, force: true }); } catch {} });
