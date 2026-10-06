// b12-1: AC-94 (the English OCR data in the form the browser inflates natively).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import http from 'node:http';

const MAIN = new URL('../src/main.ts', import.meta.url).pathname;
let child, port, cookie = '';
before(async () => {
  const env = { ...process.env, PORT: '0', LMS_PROFILE: 'hub', LMS_DATA_DIR: mkdtempSync(join(tmpdir(), 'lms-b121-')), LMS_TLS: 'off', LMS_TEST_MODE: '1' };
  delete env.LMS_TESSDATA_DIR;
  child = spawn(process.execPath, [MAIN], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('no LISTENING line')), 30000);
    child.stdout.on('data', (d) => { out += d; const m = /LISTENING (\d+)/.exec(out); if (m) { clearTimeout(t); resolve(Number(m[1])); } });
  });
  const r = await fetch(`http://127.0.0.1:${port}/__test/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId: 'l1', roles: ['learner'] }) });
  cookie = r.headers.get('set-cookie').split(';')[0];
});
after(() => new Promise((r) => { child.on('exit', r); child.kill('SIGTERM'); }));

// node:http does not inflate by itself, so the test sees the bytes exactly as the wire carries them.
const raw = (path, acceptEncoding) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path, headers: { cookie, 'accept-encoding': acceptEncoding } }, (res) => {
    const parts = []; res.on('data', (d) => parts.push(d)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts) }));
  }).on('error', reject);
});

test('AC-94 the unzipped-name data route sends the gzip bytes with Content-Encoding: gzip', async () => {
  const r = await raw('/api/coach/ocr/lang/eng.traineddata', 'gzip');
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-encoding'], 'gzip');
  assert.ok(r.body.length > 1_000_000 && r.body.length < 6_000_000, `wire size ${r.body.length}`);
  assert.ok(gunzipSync(r.body).length > 4_000_000, 'inflates to more than the wire size');
});

test('AC-94 a client that does not accept gzip still gets the plain traineddata', async () => {
  const r = await raw('/api/coach/ocr/lang/eng.traineddata', 'identity');
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-encoding'], undefined);
  assert.ok(r.body.length > 4_000_000);
});

test('AC-94 the .gz name keeps working for clients that unzip themselves', async () => {
  const r = await raw('/api/coach/ocr/lang/eng.traineddata.gz', 'identity');
  assert.equal(r.status, 200);
  assert.ok(gunzipSync(r.body).length > r.body.length);
});
