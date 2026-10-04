// AC-110, AC-111: GitHub adapter against a fake GitHub API (no real calls).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createGithubAdapter } from '../src/github.ts';

const TOKEN = 'test-token-do-not-use';

function fakeGithub() {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null;
      calls.push({ method: req.method, path: req.url, body, auth: req.headers.authorization });
      const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      const u = req.url, m = req.method;
      if (m === 'GET' && u === '/users/asha') return send(200, { id: 4242, login: 'asha' });
      if (m === 'GET' && u === '/orgs/acme') return send(200, { node_id: 'O_node' });
      if (m === 'POST' && u === '/orgs/acme/invitations') return send(201, {});
      if (m === 'PUT' && u === '/orgs/acme/teams/batch-1/memberships/asha') return send(200, { state: 'pending' });
      if (m === 'POST' && u === '/repos/acme/template/generate') return send(201, { full_name: 'acme/asha-lab' });
      if (m === 'PUT' && u === '/repos/acme/asha-lab/branches/main/protection') return send(200, {});
      if (m === 'POST' && u === '/graphql') {
        if (body.query.includes('createProjectV2Field')) return send(200, { data: { createProjectV2Field: { projectV2Field: {} } } });
        return send(200, { data: { createProjectV2: { projectV2: { id: 'PVT_1' } } } });
      }
      if (m === 'GET' && u === '/repos/acme/asha-lab/git/ref/heads/main') return send(200, { object: { sha: 'abc123' } });
      if (m === 'POST' && u === '/repos/acme/asha-lab/git/refs') return send(201, {});
      if (m === 'POST' && u === '/repos/acme/asha-lab/pulls') return send(201, { number: 7 });
      if (m === 'PUT' && u === '/repos/acme/asha-lab/pulls/7/merge') return send(403, { message: 'Persona may not merge' });
      if (m === 'PUT' && u.startsWith('/repos/acme/asha-lab/contents/')) {
        return body.branch === 'main' ? send(403, { message: 'Protected branch' }) : send(201, {});
      }
      if (m === 'POST' && u === '/app/installations/99/access_tokens') {
        return send(201, { token: 'test-persona-token-do-not-use', expires_at: new Date(Date.parse('2026-12-01T00:00:00Z')).toISOString() });
      }
      send(404, { message: 'Not Found' });
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${server.address().port}`;
    r({ url, calls, close: () => server.close() });
  }));
}

async function setup() {
  const f = await fakeGithub();
  const gh = createGithubAdapter({ apiUrl: f.url, graphqlUrl: f.url + '/graphql', token: TOKEN, org: 'acme' });
  return { f, gh };
}

test('AC-110 provisionLearner calls the contract endpoints and never creates an account', async () => {
  const { f, gh } = await setup();
  const out = await gh.provisionLearner({ username: 'asha', team: 'batch-1', template: 'acme/template', repo: 'asha-lab', projectTitle: 'Asha sprint' });
  assert.deepEqual(out, { repo: 'acme/asha-lab', projectId: 'PVT_1' });
  const seen = f.calls.map((c) => `${c.method} ${c.path}`);
  for (const want of [
    'GET /users/asha', 'POST /orgs/acme/invitations', 'PUT /orgs/acme/teams/batch-1/memberships/asha',
    'POST /repos/acme/template/generate', 'PUT /repos/acme/asha-lab/branches/main/protection', 'POST /graphql',
  ]) assert.ok(seen.includes(want), `missing ${want}`);
  assert.equal(f.calls.find((c) => c.path.endsWith('/invitations')).body.invitee_id, 4242);
  const prot = f.calls.find((c) => c.path.endsWith('/protection')).body;
  assert.equal(prot.allow_force_pushes, false);
  assert.ok(prot.required_pull_request_reviews);
  const gql = f.calls.filter((c) => c.path === '/graphql').map((c) => c.body);
  assert.ok(gql.some((b) => b.query.includes('createProjectV2(')));
  assert.ok(gql.some((b) => b.variables.dataType === 'ITERATION'));
  assert.ok(f.calls.every((c) => c.auth === `Bearer ${TOKEN}`));
  assert.ok(!f.calls.some((c) => /admin\/users|\/users$/.test(c.path) && c.method === 'POST'));
  f.close();
});

test('AC-110 provisionLearner rejects when the user does not exist', async () => {
  const { f, gh } = await setup();
  await assert.rejects(gh.provisionLearner({ username: 'ghost', team: 'batch-1', template: 'acme/template', repo: 'x', projectTitle: 'p' }), /lookup user/);
  f.close();
});

test('AC-111 persona opens a branch and PR, cannot merge or write to main', async () => {
  const { f, gh } = await setup();
  assert.deepEqual(await gh.openPullRequest({ repo: 'acme/asha-lab', branch: 'persona/review', title: 'Review notes' }), { number: 7 });
  const merge = await gh.mergePullRequest({ repo: 'acme/asha-lab', number: 7 });
  assert.equal(merge.ok, false);
  assert.equal(merge.status, 403);
  const toMain = await gh.writeFile({ repo: 'acme/asha-lab', branch: 'main', path: 'a/b.md', content: 'x' });
  assert.equal(toMain.ok, false);
  const toBranch = await gh.writeFile({ repo: 'acme/asha-lab', branch: 'persona/review', path: 'a/b.md', content: 'hello' });
  assert.deepEqual(toBranch, { ok: true });
  const put = f.calls.filter((c) => c.method === 'PUT' && c.path.includes('/contents/')).pop();
  assert.equal(Buffer.from(put.body.content, 'base64').toString(), 'hello');
  f.close();
});

test('AC-111 persona tokens expire no later than the batch end and refuse after it', async () => {
  const { f, gh } = await setup();
  const batchEndsAt = Date.parse('2026-11-01T00:00:00Z');
  const t = await gh.personaToken({ installationId: 99, batchEndsAt, now: Date.parse('2026-10-04T00:00:00Z') });
  assert.equal(t.token, 'test-persona-token-do-not-use');
  assert.ok(t.expiresAt <= batchEndsAt);
  const late = await gh.personaToken({ installationId: 99, batchEndsAt, now: batchEndsAt });
  assert.equal(late.ok, false);
  assert.equal(f.calls.filter((c) => c.path.includes('access_tokens')).length, 1);
  f.close();
});
