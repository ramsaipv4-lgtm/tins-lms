// b6-2: AC-65 pairing and devices.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = new URL('../src/main.ts', import.meta.url).pathname;

function launch() {
  const dir = mkdtempSync(join(tmpdir(), 'lms-b62-'));
  const env = { ...process.env, PORT: '0', LMS_PROFILE: 'hub', LMS_DATA_DIR: dir, LMS_TLS: 'off', LMS_TEST_MODE: '1' };
  const child = spawn(process.execPath, [MAIN], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stderr.on('data', (d) => { err += d; });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no LISTENING line; stderr: ${err}`)), 30000);
    child.stdout.on('data', (d) => {
      out += d;
      const m = /LISTENING (\d+)/.exec(out);
      if (!m) return;
      clearTimeout(timer);
      const base = `http://127.0.0.1:${m[1]}`;
      // client() returns a requester with its own cookie jar
      const client = () => {
        let cookie = '';
        return async (path, { method = 'GET', body } = {}) => {
          const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
          const set = r.headers.get('set-cookie');
          if (set) cookie = set.split(';')[0];
          const text = await r.text();
          let json = null; try { json = JSON.parse(text); } catch {}
          return { status: r.status, json, text };
        };
      };
      resolve({ client, stop: () => new Promise((r) => { child.on('exit', r); child.kill('SIGTERM'); }) });
    });
    child.on('exit', (c) => reject(new Error(`exited early ${c}: ${err}`)));
  });
}

let s;
before(async () => { s = await launch(); });
after(async () => { await s.stop(); });

async function as(personId, roles) {
  const r = s.client();
  await r('/__test/login', { method: 'POST', body: { personId, roles } });
  return r;
}

test('AC-65 pairing code is issued, claimed once, listed, and revoking gives 401', async () => {
  const trainer = await as('tr1', ['trainer']);
  const t0 = Date.now();
  await trainer('/__test/clock', { method: 'POST', body: { now: t0 } });
  const issued = await trainer('/api/pairing', { method: 'POST', body: {} });
  assert.equal(issued.status, 200);
  assert.ok(issued.json.code);
  assert.equal(issued.json.expiresAt, t0 + 300000);
  const fp = (await trainer('/api/pairing/fingerprint')).json.fingerprint;
  assert.equal(issued.json.qr.fingerprint, fp);
  assert.ok(issued.json.qr.hubId);
  assert.match(issued.json.qr.address, /^http:\/\/127\.0\.0\.1:\d+$/);

  const dev = s.client();
  const ok = await dev('/api/pairing/claim', { method: 'POST', body: { code: issued.json.code, deviceId: 'dev-a' } });
  assert.equal(ok.status, 200);
  assert.equal((await dev('/api/me')).status, 200);
  const again = await s.client()('/api/pairing/claim', { method: 'POST', body: { code: issued.json.code, deviceId: 'dev-b' } });
  assert.equal(again.status, 409);
  assert.match(again.text, /used/);

  const list = await trainer('/api/devices');
  assert.ok(list.json.devices.some((d) => d.deviceId === 'dev-a'));
  assert.equal((await trainer('/api/devices/dev-a', { method: 'DELETE' })).status, 200);
  assert.equal((await dev('/api/me')).status, 401);
  assert.ok(!(await trainer('/api/devices')).json.devices.some((d) => d.deviceId === 'dev-a'));
});

test('AC-65 expired and unknown codes are refused; learners cannot issue', async () => {
  const trainer = await as('tr1', ['trainer']);
  const t0 = Date.now();
  await trainer('/__test/clock', { method: 'POST', body: { now: t0 } });
  const { json } = await trainer('/api/pairing', { method: 'POST', body: {} });
  await trainer('/__test/clock', { method: 'POST', body: { now: t0 + 301000 } });
  const late = await s.client()('/api/pairing/claim', { method: 'POST', body: { code: json.code, deviceId: 'dev-c' } });
  assert.equal(late.status, 410);
  assert.match(late.text, /expired/);
  const unk = await s.client()('/api/pairing/claim', { method: 'POST', body: { code: 'NOPE', deviceId: 'dev-c' } });
  assert.equal(unk.status, 404);
  assert.match(unk.text, /unknown/);
  assert.equal((await s.client()('/api/pairing/claim', { method: 'POST', body: {} })).status, 400);
  const learner = await as('l1', ['learner']);
  assert.equal((await learner('/api/pairing', { method: 'POST', body: {} })).status, 403);
  assert.equal((await learner('/api/devices')).status, 403);
  assert.equal((await s.client()('/api/devices')).status, 401);
  await trainer('/__test/clock', { method: 'POST', body: { now: null } });
});
