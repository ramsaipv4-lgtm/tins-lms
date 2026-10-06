// b7-6 own tests: Shift, rituals, corporate practice, peer review and practice forge over the HTTP API (AC-86, 87, 161, 164, 170).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(new URL('..', import.meta.url).pathname, '..', '..');
let child, base, dir;
const jars = {};

async function call(who, method, path, body) {
  const headers = { 'content-type': 'application/json' };
  if (jars[who]) headers.cookie = jars[who];
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get('set-cookie');
  if (sc) jars[who] = sc.split(';')[0];
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const login = (who, roles) => call(who, 'POST', '/__test/login', { personId: who, roles });
const MIN = 60000;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'lms-shift-'));
  const env = { ...process.env, PORT: '0', LMS_PROFILE: 'hub', LMS_DATA_DIR: dir, LMS_TLS: 'off', LMS_TEST_MODE: '1' };
  child = spawn(process.execPath, [join(ROOT, 'packages/server/src/main.ts')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  base = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server did not start')), 30000);
    child.stdout.on('data', (d) => { out += d; const m = /LISTENING (\d+)/.exec(out); if (m) { clearTimeout(t); res(`http://127.0.0.1:${m[1]}`); } });
    child.on('exit', (c) => rej(new Error('server exited ' + c)));
  });
  const fx = process.env.LMS_ACCEPTANCE_DIR ? 'journeys/base.json' : 'journeys/base.json';
  assert.equal((await call('x', 'POST', '/__test/seed', { fixture: fx })).status, 200);
  assert.equal((await call('x', 'POST', '/__test/seed', { fixture: 'journeys/peer.json' })).status, 200);
  await login('l1', ['learner']); await login('l2', ['learner']); await login('l3', ['learner']); await login('tr1', ['trainer']);
});
after(async () => { await new Promise((r) => { child.on('exit', r); child.kill('SIGTERM'); }); rmSync(dir, { recursive: true, force: true }); });

test('AC-86 shift: tickets arrive over server time, ack and resolve update the SLA board, score lists rubric rows', async () => {
  const t0 = 1_800_000_000_000;
  await call('x', 'POST', '/__test/clock', { now: t0 });
  assert.equal((await call('l1', 'GET', '/api/shift/state')).data.status, 'none');
  const s = (await call('l1', 'POST', '/api/shift/start', {})).data;
  assert.equal(s.status, 'running');
  assert.deepEqual(s.tickets.map((x) => x.id), ['T1']);
  await call('x', 'POST', '/__test/clock', { now: t0 + 6 * MIN });
  assert.deepEqual((await call('l2', 'GET', '/api/shift/state')).data.tickets.map((x) => x.id), ['T1', 'T2']); // team-a shares the run
  await call('l1', 'POST', '/api/shift/events', { kind: 'ack', ticketId: 'T1' });
  const bad = (await call('l1', 'POST', '/api/shift/events', { kind: 'resolve', ticketId: 'T1', answer: 'nope' })).data;
  assert.equal(bad.accepted, false);
  const ok = (await call('l1', 'POST', '/api/shift/events', { kind: 'resolve', ticketId: 'T1', answer: 'missing build step' })).data;
  assert.equal(ok.tickets.find((x) => x.id === 'T1').status, 'resolved');
  const fin = (await call('l1', 'POST', '/api/shift/finish', {})).data;
  assert.equal(fin.status, 'finished');
  assert.equal(fin.mode, 'live');
  assert.ok(fin.score.rows.find((r) => r.id === 'T1').earned > 0);
  assert.equal(fin.score.rows.length, 4);
});

test('AC-87 rituals: blocked stand-up, poker spread names low and high voters, retro item becomes a ticket', async () => {
  await call('l1', 'POST', '/api/rituals/standup', { yesterday: 'a', today: 'b', blockers: "Waiting on Ravi's PR" });
  await call('l2', 'POST', '/api/rituals/standup', { yesterday: 'a', today: 'b', blockers: 'None' });
  const su = (await call('l1', 'GET', '/api/rituals/standup')).data;
  assert.deepEqual(su.map((e) => e.blocked).sort(), [false, true]);
  await call('l1', 'POST', '/api/rituals/poker/start', { title: 'x' });
  await call('l1', 'POST', '/api/rituals/poker/vote', { points: 2 });
  await call('l2', 'POST', '/api/rituals/poker/vote', { points: 8 });
  await call('l3', 'POST', '/api/rituals/poker/vote', { points: 3 });
  assert.equal((await call('l1', 'POST', '/api/rituals/poker/vote', { points: 4 })).status, 400);
  const r = (await call('l1', 'POST', '/api/rituals/poker/reveal', {})).data.round;
  assert.deepEqual(r.result, { result: 'discuss', low: ['Lena Learner'], high: ['Liam Learner'] });
  const { id } = (await call('l1', 'POST', '/api/rituals/retro', { text: 'Fix flaky build', column: 'improve' })).data;
  await call('l1', 'POST', `/api/rituals/retro/${encodeURIComponent(id)}/ticket`, {});
  const tickets = (await call('l1', 'GET', '/api/corp/tickets')).data;
  assert.ok(tickets.some((x) => x.title === 'Fix flaky build' && x.acceptance));
});

test('AC-164 corporate: prod deploy needs an approved change request; tickets need acceptance criteria; drill runs in order', async () => {
  assert.equal((await call('l1', 'POST', '/api/corp/deploys', { environment: 'prod' })).status, 403);
  const cr = (await call('l1', 'POST', '/api/corp/change-requests', { summary: 'Ship', rollback: 'revert' })).data;
  assert.equal((await call('l1', 'POST', '/api/corp/deploys', { environment: 'prod' })).status, 403);
  assert.equal((await call('l1', 'POST', `/api/corp/change-requests/${encodeURIComponent(cr.id)}/decide`, { approve: true })).status, 403);
  await call('tr1', 'POST', `/api/corp/change-requests/${encodeURIComponent(cr.id)}/decide`, { approve: true });
  assert.equal((await call('l1', 'POST', '/api/corp/deploys', { environment: 'prod' })).status, 200);
  assert.equal((await call('l1', 'POST', '/api/corp/tickets', { title: 'T', acceptance: '' })).status, 400);
  assert.equal((await call('l1', 'POST', '/api/corp/drill', { step: 'rotate' })).status, 409);
  await call('tr1', 'POST', '/api/corp/drill/start', {});
  for (const s of ['revoke', 'rotate', 'scrub', 'report']) await call('l1', 'POST', '/api/corp/drill', { step: s });
  assert.equal((await call('l1', 'GET', '/api/corp/drill')).data.complete, true);
  const g = (await call('l1', 'POST', '/api/corp/templates/grade', { kind: 'adr', text: 'Context. Options. Decision. Consequences.' })).data;
  assert.equal(g.earned, 4);
});

test('AC-161 peer review is scored; pair programming follows the class switch', async () => {
  const list = (await call('l1', 'GET', '/api/peer/reviews')).data;
  assert.equal(list.length, 1);
  assert.equal((await call('l2', 'GET', '/api/peer/reviews')).data.length, 0);
  const r = (await call('l1', 'POST', `/api/peer/reviews/${encodeURIComponent(list[0].id)}`, { checked: ['builds', 'names'], comment: 'ok' })).data;
  assert.deepEqual(r.score, { points: 2, total: 3, pct: 67 });
  assert.equal((await call('l1', 'GET', '/api/shift/context')).data.pairProgramming, false);
  assert.equal((await call('l1', 'POST', '/api/shift/settings', { pairProgramming: true })).status, 403);
  await call('tr1', 'POST', '/api/shift/settings', { pairProgramming: true });
  assert.equal((await call('l1', 'GET', '/api/shift/context')).data.pairProgramming, true);
  const p = (await call('l1', 'GET', '/api/shift/pair')).data;
  assert.deepEqual(p.members, ['Lena Learner', 'Liam Learner']);
  assert.equal(p.leftMs, 15 * MIN);
});

test('AC-170 forge exercise completes without GitHub; linking GitHub offers moving repos', async () => {
  assert.equal((await call('l3', 'GET', '/api/forge/state')).data.done, false);
  assert.equal((await call('l3', 'POST', '/api/forge/move', {})).status, 409);
  assert.equal((await call('l3', 'POST', '/api/forge/check', {})).data.done, true);
  await call('l3', 'POST', '/api/forge/link', { githubUser: 'mira-l' });
  const m = (await call('l3', 'POST', '/api/forge/move', {})).data;
  assert.equal(m.moved, true);
  assert.equal(m.githubPass, true);
});
