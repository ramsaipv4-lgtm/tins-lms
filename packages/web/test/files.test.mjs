// b7-9 tests: AC-95 offline phone profile data, AC-96 file exchange, AC-98 export my data, AC-167 robustness records.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(new URL('..', import.meta.url).pathname, '..', '..');
const core = await import(join(ROOT, 'packages/core/src/index.ts'));
let child, base, dir;

const call = (path, o = {}) => fetch(base + path, o);
const post = (p, body, cookie) => call(p, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
async function login(personId, roles) {
  const r = await post('/__test/login', { personId, roles });
  return r.headers.get('set-cookie').split(';')[0];
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'lms-files-'));
  const env = { ...process.env, PORT: '0', LMS_PROFILE: 'hub', LMS_DATA_DIR: dir, LMS_TLS: 'off', LMS_TEST_MODE: '1' };
  child = spawn(process.execPath, [join(ROOT, 'packages/server/src/main.ts')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  base = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server did not start')), 30000);
    child.stdout.on('data', (d) => { out += d; const m = /LISTENING (\d+)/.exec(out); if (m) { clearTimeout(t); res(`http://127.0.0.1:${m[1]}`); } });
    child.on('exit', (c) => rej(new Error('server exited ' + c)));
  });
  assert.equal((await post('/__test/seed', { fixture: 'journeys/base.json' })).status, 200);
  await post('/__test/clock', { now: Date.parse('2026-11-02T09:01:00+05:30') });
}, { timeout: 60000 });
after(() => { child?.kill('SIGTERM'); rmSync(dir, { recursive: true, force: true }); });

test('AC-95 bundle: sealed sections, keys only for released ones, diagnostic and hub key', async () => {
  const c = await login('l3', ['learner']);
  const r = await call('/api/files/bundle', { headers: { cookie: c } });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.classes.length, 1);
  const cls = b.classes[0];
  assert.equal(cls.profile, 'phone');
  assert.ok(cls.days.length >= 1 && cls.diagnostics['0'].length === 8);
  assert.equal(b.hubKey.kty, 'EC');
  assert.equal(JSON.stringify(b).includes('"d"'), false, 'no private key');
  const keyed = cls.days.flatMap((d) => d.sections).filter((s) => s.key);
  assert.ok(keyed.length >= 1, 'something is released at the clock time');
  assert.equal((await call('/api/files/bundle')).status, 401);
});

test('AC-96 package: signed, opens with the hub key, carries keys; learner submission is accepted', async () => {
  const tr = await login('tr1', ['trainer']);
  const lc = await login('l3', ['learner']);
  const bundle = await (await call('/api/files/bundle', { headers: { cookie: lc } })).json();
  assert.equal((await call('/api/files/package?classId=c1&day=0', { headers: { cookie: lc } })).status, 403);
  const res = await call('/api/files/package?classId=c1&day=0', { headers: { cookie: tr } });
  assert.equal(res.status, 200);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const opened = await core.openPackage(bytes, [bundle.hubKey]);
  assert.equal(opened.ok, true);
  const paths = opened.files.map((f) => f.path);
  for (const p of ['manifest.json', 'class.json', 'day-0.json', 'keys.json', 'diagnostic.json']) assert.ok(paths.includes(p), p);
  const keys = JSON.parse(new TextDecoder().decode(opened.files.find((f) => f.path === 'keys.json').bytes));
  const day = JSON.parse(new TextDecoder().decode(opened.files.find((f) => f.path === 'day-0.json').bytes));
  const sec = day.sections.find((s) => keys[s.id]);
  const text = new TextDecoder().decode(await core.openSection(Uint8Array.from(Buffer.from(keys[sec.id], 'base64')), Uint8Array.from(Buffer.from(sec.sealed, 'base64'))));
  assert.ok(text.length > 0);
  assert.equal((await core.openPackage(bytes, [])).reason, 'untrusted');
  // submission from the enrolled learner's device key
  const k = await core.generateSigningKeys();
  assert.equal((await post('/api/me/device-key', { deviceId: 'd1', publicJwk: k.publicJwk }, lc)).status, 200);
  const sub = await core.signPackage(core.tarPack([{ path: 'submission.json', bytes: new TextEncoder().encode('{}') }]), k.privateJwk);
  const ok = await call('/api/classes/c1/files', { method: 'POST', headers: { cookie: tr }, body: sub });
  assert.equal(ok.status, 201);
  assert.equal((await ok.json()).personId, 'l3');
  const bad = new Uint8Array(sub); bad[bad.length - 1] ^= 1;
  assert.ok((await call('/api/classes/c1/files', { method: 'POST', headers: { cookie: tr }, body: bad })).status >= 400);
});

test('AC-167 fire drill: trainer starts, phone acknowledges, trainer finishes', async () => {
  const tr = await login('tr1', ['trainer']);
  const lc = await login('l1', ['learner']);
  const d = await (await post('/api/files/drill', { classId: 'c1' }, tr)).json();
  assert.equal(d.state, 'running');
  assert.equal((await post('/api/files/drill', { classId: 'c1' }, lc)).status, 403);
  const b = await (await call('/api/files/bundle', { headers: { cookie: lc } })).json();
  assert.equal(b.classes[0].drill.id, d.id);
  assert.equal((await post('/api/files/drill-ack', { id: d.id, ok: true, sections: 2, cards: 3 }, lc)).status, 200);
  const s = await (await call(`/api/files/drill?id=${encodeURIComponent(d.id)}`, { headers: { cookie: tr } })).json();
  assert.equal(s.acks.length, 1);
  assert.equal((await post('/api/files/drill-finish', { id: d.id }, tr)).status, 200);
  const after = await (await call('/api/files/bundle', { headers: { cookie: lc } })).json();
  assert.equal(after.classes[0].drill, null);
});

test('AC-98 my export holds the caller only', async () => {
  const lc = await login('l1', ['learner']);
  const r = await call('/api/me/export', { headers: { cookie: lc } });
  assert.equal(r.status, 200);
  const files = core.tarUnpack(new Uint8Array(await r.arrayBuffer()));
  const all = files.map((f) => new TextDecoder().decode(f.bytes)).join('\n');
  assert.ok(all.includes('Lena Learner'));
  assert.equal(all.includes('Liam Learner'), false);
  assert.equal(all.includes('Mira Learner'), false);
});
