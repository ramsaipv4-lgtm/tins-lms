// Tests for b6-5: AC-72, AC-73 (attempts, grade ledger, appeals, integrity log).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
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
const DAY = 24 * 3600 * 1000;
const login = (personId, roles) => s.req('/__test/login', { method: 'POST', body: { personId, roles } });
const clock = (now) => s.req('/__test/clock', { method: 'POST', body: { now } });
before(async () => {
  s = await launch(true);
  mkdirSync(join(s.dir, 'acc', 'fixtures', 'api'), { recursive: true });
  writeFileSync(join(s.dir, 'acc', 'fixtures', 'api', 'g.json'), JSON.stringify({ databases: { 'class-c1': [
    { type: 'class', id: 'class:c1', schema: 1, updatedAt: 1, updatedBy: 'x', name: 'C', trainerIds: ['tr1'], schedule: [], seedSalt: 'salt-g', switches: {}, passMark: 6 },
  ] } }));
  assert.equal((await s.req('/__test/seed', { method: 'POST', body: { fixture: 'api/g.json' } })).status, 200);
});
after(async () => { await s.stop(); });

const timing = { hubStart: 1000, hubEnd: 61000, monotonicMs: 60000, deviceStart: 1000, deviceEnd: 61000 };
async function submit(body = {}) {
  await login('l1', ['learner']);
  const r = await s.req('/api/classes/c1/attempts', { method: 'POST', body: { itemId: 'q1', mode: 'live', answers: [1], timing, aiUsage: [], ...body } });
  assert.equal(r.status, 201, r.text);
  return r.json.id;
}

test('AC-72 attempt stores seed, mode, timing flags and AI summary; grade is a ledger entry; correction keeps the original', async () => {
  const id = await submit({ timing: { hubStart: null, hubEnd: null, monotonicMs: 1000, deviceStart: 0, deviceEnd: 900000 }, aiUsage: [{ at: 1, toolKind: 'chat' }, { at: 2, toolKind: 'chat' }], aiPolicy: 'explain-only' });
  assert.equal((await s.req('/api/classes/c1/attempts', { method: 'POST', body: { itemId: 'q1', mode: 'bogus' } })).status, 400);
  await login('tr1', ['trainer']);
  assert.equal((await s.req(`/api/classes/c1/attempts/${id}/grade`, { method: 'POST', body: { score: 5 } })).status, 200);
  const c = await s.req(`/api/classes/c1/attempts/${id}/grade`, { method: 'POST', body: { score: 7, reason: 'rechecked' } });
  assert.equal(c.json.seq, 1);
  await login('sub1', ['substitute']);
  assert.equal((await s.req(`/api/classes/c1/attempts/${id}/grade`, { method: 'POST', body: { score: 9 } })).status, 403);
  await login('l1', ['learner']);
  assert.equal((await s.req(`/api/classes/c1/attempts/${id}/grade`, { method: 'POST', body: { score: 9 } })).status, 403);
});

test('AC-73 appeal within 7 days appears in the inbox with evidence; later is window-closed', async () => {
  await clock(1_000_000);
  const id = await submit({ rubricRows: [{ row: 'r1', score: 2 }], aiUsage: [{ at: 5, toolKind: 'chat', confirmed: true, read: false }] });
  await login('tr1', ['trainer']);
  await s.req(`/api/classes/c1/attempts/${id}/grade`, { method: 'POST', body: { score: 4 } });
  await login('l1', ['learner']);
  await s.req('/api/classes/c1/integrity', { method: 'POST', body: { context: 'exam', kind: 'tab-blur', at: 7 } });
  assert.equal((await s.req('/api/classes/c1/integrity', { method: 'POST', body: { context: 'x', kind: 'k', at: 1 } })).status, 400);
  await login('l2', ['learner']);
  assert.equal((await s.req('/api/classes/c1/appeals', { method: 'POST', body: { attemptId: id, reason: 'not mine' } })).status, 404);
  await login('l1', ['learner']);
  assert.equal((await s.req('/api/classes/c1/appeals', { method: 'GET' })).status, 403);
  const a = await s.req('/api/classes/c1/appeals', { method: 'POST', body: { attemptId: id, reason: 'unfair' } });
  assert.equal(a.status, 201);
  assert.equal(a.json.state, 'upheld');
  assert.equal((await s.req('/api/classes/c1/appeals', { method: 'POST', body: { attemptId: id, reason: 'again' } })).status, 409);
  await login('tr1', ['trainer']);
  const inbox = (await s.req('/api/classes/c1/appeals')).json;
  assert.equal(inbox.length, 1);
  const ev = inbox[0].evidence;
  assert.match(ev.seed, /\S/);
  assert.equal(ev.mode, 'live');
  assert.equal(ev.unreadConfirmations, 1);
  assert.equal(ev.rubricRows.length, 1);
  assert.ok(ev.events.some((e) => e.kind === 'tab-blur'));
  const ints = (await s.req('/api/classes/c1/integrity?personId=l1')).json;
  assert.equal(ints.length, 1);
  // window closes after 7 days
  const id2 = await submit();
  await clock(1_000_000 + 8 * DAY);
  await login('l1', ['learner']);
  const late = await s.req('/api/classes/c1/appeals', { method: 'POST', body: { attemptId: id2, reason: 'late' } });
  assert.ok(late.status >= 400 && late.text.includes('window-closed'), late.text);
});

test('AC-122 a minor learner\'s integrity log keeps exam events only (D-33); an adult keeps both', async () => {
  writeFileSync(join(s.dir, 'acc', 'fixtures', 'api', 'minor.json'), JSON.stringify({ databases: { org: [
    { type: 'person', id: 'person:kid1', schema: 1, updatedAt: 1, updatedBy: 'x', name: 'Kid', roles: ['learner'], minor: true },
  ] } }));
  assert.equal((await s.req('/__test/seed', { method: 'POST', body: { fixture: 'api/minor.json' } })).status, 200);
  await login('kid1', ['learner']);
  assert.equal((await s.req('/api/classes/c1/integrity', { method: 'POST', body: { context: 'exam', kind: 'blur', at: 10 } })).status, 201);
  assert.equal((await s.req('/api/classes/c1/integrity', { method: 'POST', body: { context: 'practice', kind: 'blur', at: 11 } })).status, 202);
  await login('l1', ['learner']);
  assert.equal((await s.req('/api/classes/c1/integrity', { method: 'POST', body: { context: 'practice', kind: 'blur', at: 12 } })).status, 201);
  await login('tr1', ['trainer']);
  const kid = (await s.req('/api/classes/c1/integrity?personId=kid1')).json;
  assert.deepEqual(kid.map((e) => e.context), ['exam']);
  const adult = (await s.req('/api/classes/c1/integrity?personId=l1')).json;
  assert.ok(adult.some((e) => e.context === 'practice'));
});
