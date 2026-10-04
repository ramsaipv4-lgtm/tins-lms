// AC-112, AC-115: Forgejo adapter and push check against a fake Forgejo API (no real calls).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createForgejoAdapter, createPushCheck } from '../src/forgejo.ts';

const TOKEN = 'test-token-do-not-use';
// Invented credential, assembled at runtime so no secret-shaped literal sits in this file.
const FAKE_AWS = 'AK' + 'IA' + 'ZZZZ9999YYYY8888';

function fakeForgejo({ userExists = false } = {}) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null;
      calls.push({ method: req.method, path: req.url, body, auth: req.headers.authorization });
      const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      const u = req.url, m = req.method;
      if (m === 'GET' && u === '/api/v1/users/asha') return userExists ? send(200, { login: 'asha' }) : send(404, { message: 'user does not exist' });
      if (m === 'POST' && u === '/api/v1/admin/users') return send(201, { login: body.username });
      if (m === 'GET' && u.startsWith('/api/v1/orgs/acme/teams/search')) return send(200, { data: [{ id: 5, name: 'batch-1' }] });
      if (m === 'PUT' && u === '/api/v1/teams/5/members/asha') return send(204, null);
      if (m === 'POST' && u === '/api/v1/repos/acme/template/generate') return send(201, {});
      if (m === 'POST' && u === '/api/v1/repos/acme/asha-lab/branch_protections') return send(201, {});
      if (m === 'POST' && u === '/api/v1/repos/acme/asha-lab/branches') return send(201, {});
      if (m === 'POST' && u === '/api/v1/repos/acme/asha-lab/pulls') return send(201, { number: 3 });
      if (m === 'POST' && u === '/api/v1/repos/acme/asha-lab/pulls/3/merge') return send(403, { message: 'not allowed' });
      if (m === 'GET' && u.startsWith('/api/v1/repos/acme/asha-lab/contents/')) return send(404, {});
      if (m === 'POST' && u.startsWith('/api/v1/repos/acme/asha-lab/contents/')) {
        return body.branch === 'main' ? send(403, { message: 'protected' }) : send(201, {});
      }
      if (m === 'POST' && u === '/api/v1/users/persona-bot/tokens') return send(201, { sha1: 'test-persona-token-do-not-use' });
      if (m === 'POST' && u === '/api/v1/repos/acme/asha-lab/hooks') return send(201, { id: 1 });
      send(404, { message: 'Not Found' });
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => {
    r({ url: `http://127.0.0.1:${server.address().port}`, calls, close: () => server.close() });
  }));
}

const learner = { username: 'asha', email: 'asha@example.invalid', team: 'batch-1', template: 'acme/template', repo: 'asha-lab' };

test('AC-112 creates the Forgejo login when missing, then team, repo and protection', async () => {
  const f = await fakeForgejo();
  const fg = createForgejoAdapter({ apiUrl: f.url, token: TOKEN, org: 'acme' });
  const out = await fg.provisionLearner(learner);
  assert.equal(out.repo, 'acme/asha-lab');
  const seen = f.calls.map((c) => `${c.method} ${c.path}`);
  assert.ok(seen.indexOf('POST /api/v1/admin/users') > seen.indexOf('GET /api/v1/users/asha'));
  assert.ok(seen.indexOf('PUT /api/v1/teams/5/members/asha') > seen.indexOf('POST /api/v1/admin/users'));
  const created = f.calls.find((c) => c.path === '/api/v1/admin/users').body;
  assert.equal(created.must_change_password, true);
  assert.equal(created.username, 'asha');
  assert.ok(seen.includes('POST /api/v1/repos/acme/template/generate'));
  assert.ok(seen.includes('POST /api/v1/repos/acme/asha-lab/branch_protections'));
  assert.equal(f.calls.find((c) => c.path.endsWith('/branch_protections')).body.branch_name, 'main');
  assert.ok(f.calls.every((c) => c.auth === `token ${TOKEN}`));
  f.close();
});

test('AC-112 skips login creation when the user already exists', async () => {
  const f = await fakeForgejo({ userExists: true });
  const fg = createForgejoAdapter({ apiUrl: f.url, token: TOKEN, org: 'acme' });
  await fg.provisionLearner(learner);
  assert.ok(!f.calls.some((c) => c.path === '/api/v1/admin/users'));
  f.close();
});

test('AC-112 persona branch, PR, refused merge, refused write to main, token expiry', async () => {
  const f = await fakeForgejo();
  const fg = createForgejoAdapter({ apiUrl: f.url, token: TOKEN, org: 'acme' });
  assert.deepEqual(await fg.openPullRequest({ repo: 'acme/asha-lab', branch: 'persona/x', title: 'T' }), { number: 3 });
  const merge = await fg.mergePullRequest({ repo: 'acme/asha-lab', number: 3 });
  assert.equal(merge.ok, false);
  assert.equal((await fg.writeFile({ repo: 'acme/asha-lab', branch: 'main', path: 'n.md', content: 'x' })).ok, false);
  assert.deepEqual(await fg.writeFile({ repo: 'acme/asha-lab', branch: 'persona/x', path: 'n.md', content: 'x' }), { ok: true });
  const batchEndsAt = 2_000_000;
  const t = await fg.personaToken({ username: 'persona-bot', batchEndsAt, now: 1_000_000 });
  assert.ok(t.token && t.expiresAt <= batchEndsAt);
  assert.equal((await fg.personaToken({ username: 'persona-bot', batchEndsAt, now: batchEndsAt })).ok, false);
  f.close();
});

function listen(handler) {
  const s = http.createServer(handler);
  return new Promise((r) => s.listen(0, '127.0.0.1', () => r({ url: `http://127.0.0.1:${s.address().port}`, close: () => s.close() })));
}
async function push(url, files) {
  const r = await fetch(url, { method: 'POST', body: JSON.stringify({ repository: 'acme/asha-lab', pusher: 'asha', files }) });
  return { status: r.status, json: await r.json() };
}

test('AC-115 installPushCheck registers the hook url', async () => {
  const f = await fakeForgejo();
  const fg = createForgejoAdapter({ apiUrl: f.url, token: TOKEN, org: 'acme' });
  assert.deepEqual(await fg.installPushCheck({ repo: 'acme/asha-lab', hookUrl: 'http://hub.invalid/hook' }), { ok: true });
  assert.equal(f.calls.find((c) => c.path.endsWith('/hooks')).body.config.url, 'http://hub.invalid/hook');
  f.close();
});

test('AC-115 push with a test credential is blocked, key never repeated; switch off passes and logs who', async () => {
  const log = [];
  const pc = createPushCheck({ log: (e) => log.push(e) });
  const s = await listen(pc.handler);
  const bad = [{ path: 'src/conf.txt', content: `aws = ${FAKE_AWS}\n` }];
  const clean = [{ path: 'README.md', content: 'hello world\n' }];

  const blocked = await push(s.url, bad);
  assert.equal(blocked.status, 200);
  assert.equal(blocked.json.allowed, false);
  assert.match(blocked.json.message, /rotate/i);
  assert.ok(!blocked.json.message.includes(FAKE_AWS));
  assert.deepEqual((await push(s.url, clean)).json, { allowed: true });

  pc.setSecretScan(false, 'trainer-7');
  assert.deepEqual((await push(s.url, bad)).json, { allowed: true });
  assert.equal(log.length, 1);
  assert.equal(log[0].switch, 'secretScan');
  assert.equal(log[0].on, false);
  assert.equal(log[0].by, 'trainer-7');
  assert.equal(typeof log[0].at, 'number');

  pc.setSecretScan(true, 'trainer-7');
  assert.equal((await push(s.url, bad)).json.allowed, false);
  s.close();
});
