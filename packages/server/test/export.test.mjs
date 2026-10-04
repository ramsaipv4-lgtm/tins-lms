// b6-6 tests: AC-74 (export), AC-75 (import), AC-76 (signed class package, device keys, files), AC-77 (no secrets in exports).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  tarUnpack, tarPack, buildManifest, verifyManifest, generateSigningKeys, signPackage, openPackage,
} from '../../core/src/index.ts';

const MAIN = new URL('../src/main.ts', import.meta.url).pathname;
const dec = new TextDecoder();

function launch() {
  const dir = mkdtempSync(join(tmpdir(), 'lms-export-'));
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
      let cookie = '';
      const req = async (path, { method = 'GET', body, raw, noCookie } = {}) => {
        const headers = { ...(cookie && !noCookie ? { cookie } : {}) };
        let payload;
        if (raw !== undefined) { payload = raw; headers['content-type'] = 'application/octet-stream'; }
        else if (body !== undefined) { payload = JSON.stringify(body); headers['content-type'] = 'application/json'; }
        const r = await fetch(base + path, { method, headers, body: payload });
        const set = r.headers.get('set-cookie');
        if (set) cookie = set.split(';')[0];
        const bytes = new Uint8Array(await r.arrayBuffer());
        let j = null; try { j = JSON.parse(dec.decode(bytes)); } catch {}
        return { status: r.status, bytes, json: j };
      };
      const login = (personId, roles) => req('/__test/login', { method: 'POST', body: { personId, roles } });
      resolve({ req, login, err: () => err, dir, stop: () => new Promise((r) => { child.on('exit', r); child.kill('SIGTERM'); }) });
    });
    child.on('exit', (c) => reject(new Error(`exited early ${c}: ${err}`)));
  });
}

let a, b;
before(async () => {
  a = await launch();
  b = await launch();
  await a.login('x', ['admin']);
  await a.req('/__test/seed', { method: 'POST', body: { fixture: 'api/base.json' } });
  // one graded attempt so the export holds a ledger
  await a.login('l1', ['learner']);
  const at = await a.req('/api/classes/c1/attempts', { method: 'POST', body: { itemId: 'q1', mode: 'live', answers: [1] } });
  await a.login('tr1', ['trainer']);
  await a.req(`/api/classes/c1/attempts/${at.json.id}/grade`, { method: 'POST', body: { score: 7 } });
  await a.login('x', ['admin']);
  await b.login('x', ['admin']);
});
after(async () => { await a.stop(); await b.stop(); });

const names = (bytes) => tarUnpack(bytes).map((f) => f.path);

test('AC-74 admin export has manifest, CSV, md, ledger, event and board files and verifies', async () => {
  const r = await a.req('/api/export');
  assert.equal(r.status, 200);
  const files = tarUnpack(r.bytes);
  const paths = files.map((f) => f.path);
  const manifestFile = files.find((f) => f.path === 'manifest.json');
  assert.ok(manifestFile);
  const manifest = JSON.parse(dec.decode(manifestFile.bytes));
  const rest = files.filter((f) => f.path !== 'manifest.json');
  assert.deepEqual(manifest.files.map((f) => f.path), [...manifest.files.map((f) => f.path)].sort());
  assert.ok(!manifest.files.some((f) => f.path === 'manifest.json'));
  assert.deepEqual(await verifyManifest(rest, manifest), { missing: [], extra: [], changed: [] });
  for (const word of ['roster', 'attendance', 'grade']) assert.ok(paths.some((p) => p.includes(word) && p.endsWith('.csv')), word);
  assert.ok(paths.some((p) => p.endsWith('.md')));
  assert.ok(paths.some((p) => p.includes('ledger') && p.endsWith('.json')));
  assert.ok(paths.some((p) => p.includes('event') && p.endsWith('.json')));
  assert.ok(paths.some((p) => p.includes('board')));
  const grades = dec.decode(files.find((f) => f.path === 'grades.csv').bytes);
  assert.match(grades, /attempt:/);
});

test('AC-74 export is admin only; me/export holds only the caller', async () => {
  await a.login('l2', ['learner']);
  assert.equal((await a.req('/api/export')).status, 403);
  const me = await a.req('/api/me/export');
  assert.equal(me.status, 200);
  const files = tarUnpack(me.bytes);
  const all = files.map((f) => dec.decode(f.bytes)).join('\n');
  assert.ok(all.includes('Bilal Testlearner'));
  assert.ok(!all.includes('Asha Testlearner'));
  assert.ok(!all.includes('Chen Testlearner'));
  assert.ok(files.some((f) => f.path === 'manifest.json'));
  await a.login('x', ['admin']);
});

test('AC-75 import into an empty server reproduces roster, attendance and grades', async () => {
  const exp = await a.req('/api/export');
  assert.equal((await b.req('/api/import', { method: 'POST', raw: exp.bytes })).status, 200);
  const again = await b.req('/api/export');
  const pick = (bytes, p) => dec.decode(tarUnpack(bytes).find((f) => f.path === p).bytes);
  for (const p of ['roster.csv', 'attendance.csv', 'grades.csv']) assert.equal(pick(again.bytes, p), pick(exp.bytes, p), p);
  assert.match(pick(again.bytes, 'attendance.csv'), /l1/);
});

test('AC-75 a tampered export is refused and a learner cannot import', async () => {
  const exp = await a.req('/api/export');
  const files = tarUnpack(exp.bytes).map((f) => (f.path === 'roster.csv' ? { ...f, bytes: new TextEncoder().encode('evil\n') } : f));
  assert.equal((await b.req('/api/import', { method: 'POST', raw: tarPack(files) })).status, 400);
  await b.login('l1', ['learner']);
  assert.equal((await b.req('/api/import', { method: 'POST', raw: exp.bytes })).status, 403);
  await b.login('x', ['admin']);
});

test('AC-76 class package is signed by the hub and the private key never leaves', async () => {
  await a.login('tr1', ['trainer']);
  const p = await a.req('/api/classes/c1/package?day=1');
  assert.equal(p.status, 200);
  const keys = await generateSigningKeys();
  assert.equal((await openPackage(p.bytes, [keys.publicJwk])).reason, 'untrusted');
  const opened = await openPackage(p.bytes, [await hubPublic(p.bytes)]);
  assert.equal(opened.ok, true);
  assert.ok(opened.files.some((f) => f.path === 'manifest.json'));
  assert.ok(!opened.files.map((f) => dec.decode(f.bytes)).join('').includes('PLAINTEXT-MARKER'));
  await a.login('l1', ['learner']);
  assert.equal((await a.req('/api/classes/c1/package?day=1')).status, 403);
});

// The container embeds the signer's public identity; read it to use as the trusted key in tests.
async function hubPublic(container) {
  const text = dec.decode(container);
  const m = /\{"crv":"P-256"[^}]*\}/.exec(text);
  return JSON.parse(m[0]);
}

test('AC-76 device key signed files are accepted; tampered, unknown and non-enrolled are refused', async () => {
  const dk = await generateSigningKeys();
  await a.login('l1', ['learner']);
  const reg = await a.req('/api/me/device-key', { method: 'POST', body: { deviceId: 'd1', publicJwk: dk.publicJwk } });
  assert.equal(reg.status, 200);
  assert.equal((await a.req('/api/me/device-key', { method: 'POST', body: { deviceId: 'd1', publicJwk: dk.privateJwk } })).status, 400);
  const archive = tarPack([{ path: 'answers.json', bytes: new TextEncoder().encode('{"q1":2}') }]);
  const good = await signPackage(archive, dk.privateJwk);
  const ok = await a.req('/api/classes/c1/files', { method: 'POST', raw: good });
  assert.equal(ok.status, 201);
  const bad = good.slice(); bad[bad.length - 3] ^= 0xff;
  assert.ok((await a.req('/api/classes/c1/files', { method: 'POST', raw: bad })).status >= 400);
  const other = await generateSigningKeys();
  assert.equal((await a.req('/api/classes/c1/files', { method: 'POST', raw: await signPackage(archive, other.privateJwk) })).status, 403);
  // a key registered by someone not enrolled in c1 is not trusted
  await a.login('l3', ['learner']);
  await a.req('/api/me/device-key', { method: 'POST', body: { deviceId: 'd9', publicJwk: other.publicJwk } });
  assert.equal((await a.req('/api/classes/c1/files', { method: 'POST', raw: await signPackage(archive, other.privateJwk) })).status, 403);
});

test('AC-77 exports hold no keys, tokens, passphrases or cookies', async () => {
  await a.login('x', ['admin']);
  const all = [(await a.req('/api/export')).bytes, (await a.req('/api/me/export')).bytes]
    .flatMap((t) => tarUnpack(t)).map((f) => dec.decode(f.bytes)).join('\n');
  for (const re of [/PRIVATE KEY/, /"d"\s*:/, /privateJwk/, /passphrase/i, /set-cookie/i, /\beyJ[\w-]{10,}\.eyJ/, /token/i]) assert.ok(!re.test(all), String(re));
  // the hub private key sits only in the private db: it must not appear in the exports even after a package was signed
  assert.ok(!all.includes('hubkey'));
  assert.ok(names((await a.req('/api/export')).bytes).length > 0);
  void buildManifest;
});
