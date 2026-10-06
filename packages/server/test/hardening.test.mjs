// b11-1: AC-94 (English OCR data served from the hub), AC-116 (MCP), guard prefix, compression moved into static.ts.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { isPublicApi } from '../src/core/guard.ts';

const MAIN = new URL('../src/main.ts', import.meta.url).pathname;
const ROOT = new URL('../../../', import.meta.url).pathname;

let child, base, cookie = '';
before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lms-b111-'));
  const env = { ...process.env, PORT: '0', LMS_PROFILE: 'hub', LMS_DATA_DIR: dir, LMS_TLS: 'off', LMS_TEST_MODE: '1' };
  delete env.LMS_TESSDATA_DIR;
  child = spawn(process.execPath, [MAIN], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  base = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('no LISTENING line')), 30000);
    child.stdout.on('data', (d) => { out += d; const m = /LISTENING (\d+)/.exec(out); if (m) { clearTimeout(t); resolve(`http://127.0.0.1:${m[1]}`); } });
  });
});
after(() => new Promise((r) => { child.on('exit', r); child.kill('SIGTERM'); }));

async function req(path, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return r;
}
const login = (personId, roles) => req('/__test/login', { method: 'POST', body: { personId, roles } });

test('guard follows SPEC: /api/signin is public, /api/sign-in is not', () => {
  assert.equal(isPublicApi('/api/signin/passkey'), true);
  assert.equal(isPublicApi('/api/signin/google'), true);
  assert.equal(isPublicApi('/api/sign-in/passkey'), false);
  assert.equal(isPublicApi('/api/join/tnc'), true);
  assert.equal(isPublicApi('/api/classes'), false);
});

test('AC-94 the hub serves the pinned English tesseract data as a gzip of a traineddata file', async () => {
  await login('l1', ['learner']);
  const st = await (await req('/api/coach/ocr/status')).json();
  assert.equal(st.english, true);
  const r = await req('/api/coach/ocr/lang/eng.traineddata.gz');
  assert.equal(r.status, 200);
  const raw = Buffer.from(await r.arrayBuffer());
  assert.ok(raw.length > 1_000_000, `size ${raw.length}`);
  const plain = gunzipSync(raw);
  assert.ok(plain.length > raw.length, 'a real gzip');
});

test('AC-94 the OCR core script is sent compressed when the browser accepts it', async () => {
  await login('l1', ['learner']);
  const r = await fetch(base + '/api/coach/ocr/core/tesseract-core-simd-lstm.wasm.js', { headers: { cookie, 'accept-encoding': 'br' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-encoding'), 'br');
  assert.ok(Number(r.headers.get('content-length') ?? (await r.arrayBuffer()).byteLength) < 3_000_000);
});

const rpc = async (method, params, id = 1) => {
  const r = await req('/mcp', { method: 'POST', body: { jsonrpc: '2.0', id, method, params } });
  return { status: r.status, body: await r.json().catch(() => null) };
};

test('AC-116 /mcp needs a session; read tools are read-only; write tools only return a pending diff', async () => {
  cookie = '';
  assert.equal((await rpc('initialize', {})).status, 401);
  await req('/__test/seed', { method: 'POST', body: { fixture: 'api/base.json' } });
  await login('tr1', ['trainer']);
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  assert.equal(init.body.result.serverInfo.name, 'coach-lms-hub');
  const list = (await rpc('tools/list')).body.result.tools;
  const writes = list.filter((t) => t.annotations.readOnlyHint === false).map((t) => t.name).sort();
  assert.deepEqual(writes, ['grade_edit', 'post_message', 'repo_write']);
  assert.ok(list.filter((t) => t.annotations.readOnlyHint === true).length >= 1);
  const classes = (await rpc('tools/call', { name: 'list_classes', arguments: {} })).body.result.structuredContent.classes;
  assert.ok(classes.some((c) => c.id === 'c1'));
  const w = (await rpc('tools/call', { name: 'post_message', arguments: { recipients: ['l1', 'l2'], text: 'hello' } })).body.result.structuredContent;
  assert.equal(w.status, 'pending');
  assert.ok(w.pendingId && w.diff);
  assert.equal((await rpc('tools/call', { name: 'nope', arguments: {} })).body.error.code, -32602);
  assert.equal((await rpc('bogus')).body.error.code, -32601);
  // a learner reads only what a learner may read
  await login('l1', ['learner']);
  const mine = (await rpc('tools/call', { name: 'list_attempts', arguments: { classId: 'c1' } })).body.result.structuredContent.attempts;
  assert.ok(mine.every((a) => a.personId === 'l1'));
});
