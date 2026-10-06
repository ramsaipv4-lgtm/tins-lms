// b6-2: AC-66 attendance.
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
before(async () => {
  s = await launch();
  const r = s.client();
  assert.equal((await r('/__test/seed', { method: 'POST', body: { fixture: 'api/base.json' } })).status, 200);
});
after(async () => { await s.stop(); });

async function as(personId, roles) {
  const r = s.client();
  await r('/__test/login', { method: 'POST', body: { personId, roles } });
  return r;
}
const T0 = Date.parse('2026-11-03T10:00:00Z');

test('AC-66 rotating code marks present and verified; two periods old is rejected', async () => {
  const trainer = await as('tr1', ['trainer']);
  const learner = await as('l2', ['learner']);
  await trainer('/__test/clock', { method: 'POST', body: { now: T0 } });
  const got = await trainer('/api/classes/c1/attendance-code');
  assert.equal(got.status, 200);
  assert.match(got.json.code, /^\d{6}$/);
  assert.ok(got.json.secondsLeft >= 1 && got.json.secondsLeft <= 60);
  const mark = await learner('/api/classes/c1/attendance', { method: 'POST', body: { code: got.json.code } });
  assert.equal(mark.status, 200);
  assert.equal(mark.json.verified, true);
  assert.equal(mark.json.dayIndex, 1);
  await trainer('/__test/clock', { method: 'POST', body: { now: T0 + 60000 } }); // previous period still accepted
  assert.equal((await learner('/api/classes/c1/attendance', { method: 'POST', body: { code: got.json.code } })).status, 200);
  await trainer('/__test/clock', { method: 'POST', body: { now: T0 + 120000 } });
  const old = await learner('/api/classes/c1/attendance', { method: 'POST', body: { code: got.json.code } });
  assert.equal(old.status, 400);
  assert.match(old.text, /invalid/);
});

test('AC-66 printed fallback marks verified false; roles and enrolment are enforced', async () => {
  const trainer = await as('tr1', ['trainer']);
  const learner = await as('l1', ['learner']);
  await trainer('/__test/clock', { method: 'POST', body: { now: T0 } });
  const printed = await trainer('/api/classes/c1/printed-code?day=2');
  assert.equal(printed.status, 200);
  assert.match(printed.json.code, /^\d{8}$/);
  const wrongDay = await learner('/api/classes/c1/attendance', { method: 'POST', body: { code: printed.json.code } });
  assert.equal(wrongDay.status, 400);
  const mark = await learner('/api/classes/c1/attendance', { method: 'POST', body: { code: printed.json.code, day: 2 } });
  assert.equal(mark.status, 200);
  assert.equal(mark.json.verified, false);
  assert.equal(mark.json.method, 'printed');
  assert.equal((await learner('/api/classes/c1/attendance-code')).status, 403);
  assert.equal((await s.client()('/api/classes/c1/attendance', { method: 'POST', body: { code: '123456' } })).status, 401);
  const stranger = await as('zz', ['learner']);
  assert.equal((await stranger('/api/classes/c1/attendance', { method: 'POST', body: { code: '123456' } })).status, 403);
  assert.equal((await trainer('/api/classes/nope/attendance-code')).status, 404);
  await trainer('/__test/clock', { method: 'POST', body: { now: null } });
});

test('b11-1 seeded enrolment ids (enrolment:c1-l1) are found by personId; a scheduled day without package content is recorded as that day', async () => {
  const trainer = await as('tr1', ['trainer']);
  assert.equal((await trainer('/__test/seed', { method: 'POST', body: { fixture: 'journeys/base.json' } })).status, 200);
  const learner = await as('l1', ['learner']);
  const sched = (await trainer('/api/classes/c1/days/0')).status; void sched;
  // the fourth scheduled day (index 3) has no package content in the fixture: it must be recorded as day 3, not day 2
  await trainer('/__test/clock', { method: 'POST', body: { now: Date.parse('2026-11-05T10:00:00Z') } });
  const code = (await trainer('/api/classes/c1/attendance-code')).json.code;
  const ok = await learner('/api/classes/c1/attendance', { method: 'POST', body: { code } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.dayIndex, 3);
  await trainer('/__test/clock', { method: 'POST', body: { now: null } });
});
