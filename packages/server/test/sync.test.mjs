// Sync tests for b6-4: AC-69 (replication + personal DB ownership), AC-70 (merge pass), AC-71 (schema check),
// AC-121 (coachEntry ciphertext only) and the minor rule of AC-122 on personal databases.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-adapter-memory'));
const MAIN = new URL('../src/main.ts', import.meta.url).pathname;

let child, dir, base;

function launch() {
  dir = mkdtempSync(join(tmpdir(), 'lms-sync-'));
  const env = { ...process.env, PORT: '0', LMS_PROFILE: 'hub', LMS_DATA_DIR: dir, LMS_TLS: 'off', LMS_TEST_MODE: '1' };
  child = spawn(process.execPath, [MAIN], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error('no LISTENING line')), 30000);
    child.stdout.on('data', (d) => { out += d; const m = /LISTENING (\d+)/.exec(out); if (m) { clearTimeout(timer); resolve(`http://127.0.0.1:${m[1]}`); } });
    child.on('exit', (c) => reject(new Error(`exited early ${c}`)));
  });
}

async function login(personId, roles) {
  const r = await fetch(base + '/__test/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId, roles }) });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}

let n = 0;
function remote(dbName, cookie, schema) {
  return new PouchDB(`${base}/db/${dbName}`, {
    fetch: (url, opts) => {
      opts.headers.set('cookie', cookie);
      if (schema !== undefined) opts.headers.set('x-lms-schema', String(schema));
      return PouchDB.fetch(url, opts);
    },
  });
}
const local = () => new PouchDB(`local-${process.pid}-${n++}`, { adapter: 'memory' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => { base = await launch(); });
after(async () => { child.kill('SIGTERM'); await new Promise((r) => child.on('exit', r)); rmSync(dir, { recursive: true, force: true }); });

test('AC-69 a session replicates both ways; no session is refused; another learner cannot read a personal database', async () => {
  const cookie = await login('l1', ['learner']);
  const a = local();
  await a.put({ _id: 'ticket:t1', type: 'ticket', id: 't1', title: 'one', status: 'todo' });
  await a.replicate.to(remote('class-c1', cookie));
  const b = local();
  await b.replicate.from(remote('class-c1', cookie));
  assert.equal((await b.get('ticket:t1')).title, 'one');
  await b.put({ ...(await b.get('ticket:t1')), title: 'two' });
  await b.replicate.to(remote('class-c1', cookie));
  await a.replicate.from(remote('class-c1', cookie));
  assert.equal((await a.get('ticket:t1')).title, 'two');

  const anon = await fetch(`${base}/db/class-c1`);
  assert.equal(anon.status, 401);

  const other = await login('l2', ['learner']);
  const own = await fetch(`${base}/db/person-l1/_all_docs`, { headers: { cookie } });
  assert.equal(own.status, 200);
  const denied = await fetch(`${base}/db/person-l1/_all_docs`, { headers: { cookie: other } });
  assert.equal(denied.status, 403);
  const deniedWrite = await fetch(`${base}/db/person-l1`, { method: 'POST', headers: { cookie: other, 'content-type': 'application/json' }, body: '{"_id":"x"}' });
  assert.equal(deniedWrite.status, 403);
  const learnerOrg = await fetch(`${base}/db/org`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{"_id":"x"}' });
  assert.equal(learnerOrg.status, 403);
  const hidden = await fetch(`${base}/db/lms-private/_all_docs`, { headers: { cookie } });
  assert.equal(hidden.status, 403);
});

test('AC-70 offline edits to one ticket merge to the core revision within 5 s and leave no conflicts', async () => {
  const cookie = await login('l1', ['learner']);
  const seed = local();
  await seed.put({ _id: 'ticket:m1', type: 'ticket', id: 'm1', title: 'base', status: 'todo', updatedAt: 1, updatedBy: 'l1', history: [] });
  await seed.replicate.to(remote('class-c2', cookie));
  const a = local(); const b = local();
  await a.replicate.from(remote('class-c2', cookie));
  await b.replicate.from(remote('class-c2', cookie));
  await a.put({ ...(await a.get('ticket:m1')), status: 'doing', updatedAt: 10, updatedBy: 'l1', history: [{ id: 'h-a' }] });
  await b.put({ ...(await b.get('ticket:m1')), status: 'done', updatedAt: 5, updatedBy: 'l2', history: [{ id: 'h-b' }] });
  await a.replicate.to(remote('class-c2', cookie));
  await b.replicate.to(remote('class-c2', cookie));
  const t0 = Date.now();
  let hub;
  for (;;) {
    hub = await remote('class-c2', cookie).get('ticket:m1', { conflicts: true });
    if (!hub._conflicts && hub.status === 'done' && hub.history.length === 2) break;
    assert.ok(Date.now() - t0 < 5000, 'merge pass did not finish within 5 s');
    await sleep(100);
  }
  assert.deepEqual(hub.history.map((h) => h.id), ['h-a', 'h-b']);
  await a.replicate.from(remote('class-c2', cookie));
  await b.replicate.from(remote('class-c2', cookie));
  for (const c of [a, b]) {
    const d = await c.get('ticket:m1', { conflicts: true });
    assert.equal(d.status, 'done');
    assert.equal(d._conflicts, undefined);
    assert.equal(d._rev, hub._rev);
  }
});

test('AC-71 a client 3 versions behind is refused with update-app and keeps its local data', async () => {
  const cookie = await login('l1', ['learner']);
  const health = await (await fetch(`${base}/api/health`)).json();
  const old = local();
  await old.put({ _id: 'ticket:old', type: 'ticket', id: 'old', title: 'mine', status: 'todo' });
  const r = await fetch(`${base}/db/class-c3/_all_docs`, { headers: { cookie, 'x-lms-schema': String(health.schema - 3) } });
  assert.ok(r.status >= 400 && r.status < 500);
  assert.match(await r.text(), /update-app/);
  await assert.rejects(old.replicate.to(remote('class-c3', cookie, health.schema - 3)));
  assert.equal((await old.get('ticket:old')).title, 'mine');
  const near = await fetch(`${base}/db/class-c3/_all_docs`, { headers: { cookie, 'x-lms-schema': String(health.schema - 2) } });
  assert.notEqual(near.status, 426);
  assert.ok(near.status < 400 || near.status === 404);
});

test('AC-121 coachEntry plaintext is refused; ciphertext is stored as ciphertext', async () => {
  const cookie = await login('l3', ['learner']);
  const db = remote('person-l3', cookie);
  await assert.rejects(db.put({ _id: 'coachEntry:e1', type: 'coachEntry', id: 'e1', kind: 'food', values: { kcal: 300 }, source: 'manual' }), (e) => e.status === 400);
  await db.put({ _id: 'coachEntry:e2', type: 'coachEntry', id: 'e2', schema: 1, updatedBy: 'l3', enc: { iv: 'aXY=', ct: 'Y2lwaGVydGV4dA==' } });
  const loc = local();
  await loc.bulkDocs([{ _id: 'coachEntry:e3', type: 'coachEntry', id: 'e3', kind: 'sleep' }]);
  await assert.rejects(loc.replicate.to(db).then((r) => { if (r.doc_write_failures) throw new Error('write failures'); }));
  const raw = await (await fetch(`${base}/db/person-l3/coachEntry:e2`, { headers: { cookie } })).text();
  assert.ok(raw.includes('"ct"') && !raw.includes('kcal') && !raw.includes('"kind"'));
  const all = await db.allDocs({ include_docs: true });
  assert.equal(all.rows.filter((r) => r.doc.kind || r.doc.values).length, 0);
});

test('AC-122 (personal database) a minor account refuses every coachEntry with 403', async () => {
  const admin = await login('adm', ['admin']);
  await remote('org', admin).put({ _id: 'person:kid1', type: 'person', id: 'kid1', name: 'Kid', roles: ['learner'], minor: true, schema: 1, updatedBy: 'adm' });
  const kid = await login('kid1', ['learner']);
  const db = remote('person-kid1', kid);
  await assert.rejects(db.put({ _id: 'coachEntry:k1', type: 'coachEntry', id: 'k1', enc: { iv: 'aXY=', ct: 'Yw==' } }), (e) => e.status === 403);
  await db.put({ _id: 'card:k1', type: 'card', id: 'k1', deck: 'd', front: 'f', back: 'b' }); // other documents are fine
});
