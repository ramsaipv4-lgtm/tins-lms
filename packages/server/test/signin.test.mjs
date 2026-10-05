// b6-8: AC-81 (learner join with optional fields) and AC-62 (sessions/sign-in gate) for sign-out, passkeys, Google stub, pseudo-locale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, webcrypto } from 'node:crypto';

const MAIN = new URL('../src/main.ts', import.meta.url).pathname;
const subtle = webcrypto.subtle;

function launch(extraEnv = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'lms-b68-'));
  const env = { ...process.env, PORT: '0', LMS_PROFILE: 'hub', LMS_DATA_DIR: dir, LMS_TLS: 'off', LMS_TEST_MODE: '1', ...extraEnv };
  delete env.LMS_GOOGLE_CLIENT_ID;
  Object.assign(env, extraEnv);
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
      const client = () => {
        let cookie = '';
        const f = async (path, { method = 'GET', body } = {}) => {
          const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
          const set = r.headers.get('set-cookie');
          if (set) cookie = /lms_session=;|Max-Age=0/i.test(set) ? '' : set.split(';')[0];
          const text = await r.text();
          let json = null; try { json = JSON.parse(text); } catch {}
          return { status: r.status, json, text, headers: r.headers };
        };
        return f;
      };
      resolve({ base, client, stop: () => new Promise((r) => { child.on('exit', r); child.kill('SIGTERM'); }) });
    });
    child.on('exit', (c) => reject(new Error(`exited early ${c}: ${err}`)));
  });
}

// ---- a software authenticator -------------------------------------------------------------
const b64u = (b) => Buffer.from(b).toString('base64url');
const sha256 = (b) => createHash('sha256').update(b).digest();
function cborBytes(b) { return Buffer.concat([cborHead(2, b.length), Buffer.from(b)]); }
function cborHead(major, n) {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  return Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
}
const cborText = (s) => Buffer.concat([cborHead(3, Buffer.byteLength(s)), Buffer.from(s)]);
const cborInt = (n) => (n >= 0 ? cborHead(0, n) : cborHead(1, -1 - n));
const cborMap = (pairs) => Buffer.concat([cborHead(5, pairs.length), ...pairs.flat()]);

async function newAuthenticator() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', kp.publicKey);
  return { kp, jwk, credId: webcrypto.getRandomValues(new Uint8Array(16)), counter: 0 };
}
const clientData = (type, challenge, origin) => Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
function authData(rpId, flags, counter, attested) {
  const c = Buffer.alloc(4); c.writeUInt32BE(counter);
  return Buffer.concat([sha256(Buffer.from(rpId)), Buffer.from([flags]), c, ...(attested ? [attested] : [])]);
}
function registration(auth, rpId, challenge, origin, opts = {}) {
  const x = Buffer.from(auth.jwk.x, 'base64url'), y = Buffer.from(auth.jwk.y, 'base64url');
  const cose = cborMap([[cborInt(1), cborInt(2)], [cborInt(3), cborInt(opts.alg ?? -7)], [cborInt(-1), cborInt(1)], [cborInt(-2), cborBytes(x)], [cborInt(-3), cborBytes(y)]]);
  const idLen = Buffer.from([0, auth.credId.length]);
  const attested = Buffer.concat([Buffer.alloc(16), idLen, Buffer.from(auth.credId), cose]);
  const ad = authData(opts.rpId ?? rpId, 0x41, 0, attested);
  const att = cborMap([[cborText('fmt'), cborText('none')], [cborText('attStmt'), cborMap([])], [cborText('authData'), cborBytes(ad)]]);
  return { id: b64u(auth.credId), response: { clientDataJSON: b64u(clientData('webauthn.create', challenge, opts.origin ?? origin)), attestationObject: b64u(att) } };
}
function derOf(raw) {
  const enc = (v) => { let i = 0; while (i < 31 && v[i] === 0) i++; let b = v.slice(i); if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]); return Buffer.concat([Buffer.from([2, b.length]), b]); };
  const body = Buffer.concat([enc(raw.slice(0, 32)), enc(raw.slice(32))]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}
async function assertion(auth, rpId, challenge, origin, opts = {}) {
  auth.counter += 1;
  const ad = authData(opts.rpId ?? rpId, opts.flags ?? 0x01, auth.counter);
  const cd = clientData('webauthn.get', challenge, opts.origin ?? origin);
  const signed = Buffer.concat([ad, sha256(cd)]);
  const raw = Buffer.from(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, opts.key ?? auth.kp.privateKey, signed));
  const sig = derOf(raw);
  if (opts.tamper) sig[sig.length - 1] ^= 1;
  return { id: b64u(auth.credId), response: { clientDataJSON: b64u(cd), authenticatorData: b64u(ad), signature: b64u(sig) } };
}

async function trainerAndPerson(s) {
  const t = s.client();
  await t('/__test/login', { method: 'POST', body: { personId: 'tr1', roles: ['trainer'] } });
  return t;
}
async function joinLearner(s, body = {}) {
  const t = await trainerAndPerson(s);
  const { code } = (await t('/api/classes/c1/join-codes', { method: 'POST', body: {} })).json;
  const tnc = (await s.client()('/api/join/tnc')).json.version;
  const l = s.client();
  const r = await l('/api/join', { method: 'POST', body: { code, dob: '2000-01-01', tncVersion: tnc, ...body } });
  return { l, r, t, code, tnc };
}

test('AC-81 join works with name and rollNumber omitted', async () => {
  const s = await launch();
  try {
    const { l, r } = await joinLearner(s);
    assert.equal(r.status, 201);
    assert.equal((await l('/api/me')).status, 200);
    const again = await joinLearner(s, { rollNumber: 'R1', name: 'Asha' });
    assert.equal(again.r.status, 201);
    const dup = await joinLearner(s, { rollNumber: 'r1' });
    assert.equal(dup.r.status, 200);
    assert.match(dup.r.text, /already-enrolled/);
    // two joins without roll numbers are two people
    const n1 = await joinLearner(s), n2 = await joinLearner(s);
    assert.notEqual(n1.r.json.personId, n2.r.json.personId);
  } finally { await s.stop(); }
});

test('AC-62 signout ends the session; sign-in routes need no session; others still 401', async () => {
  const s = await launch();
  try {
    const c = s.client();
    await c('/__test/login', { method: 'POST', body: { personId: 'p1', roles: ['learner'] } });
    assert.equal((await c('/api/me')).status, 200);
    const so = await c('/api/signout', { method: 'POST', body: {} });
    assert.equal(so.status, 200);
    assert.equal((await c('/api/me')).status, 401);
    assert.equal((await s.client()('/api/signout', { method: 'POST', body: {} })).status, 401);
    assert.equal((await s.client()('/api/passkeys/register/options', { method: 'POST', body: {} })).status, 401);
    assert.equal((await s.client()('/api/signin/passkey/options', { method: 'POST', body: {} })).status, 200);
    const g = await s.client()('/api/signin/google', { method: 'POST', body: { idToken: 'x' } });
    assert.equal(g.status, 501);
    assert.equal(g.json.error.code, 'not-configured');
  } finally { await s.stop(); }
});

test('AC-62 passkey register then sign in; replay, bad signature, wrong origin/rp, expiry rejected', async () => {
  const s = await launch();
  try {
    const origin = s.base, rpId = '127.0.0.1';
    const { l, r } = await joinLearner(s, { name: 'Asha', rollNumber: 'R9' });
    const personId = r.json.personId;
    const auth = await newAuthenticator();
    const opts = await l('/api/passkeys/register/options', { method: 'POST', body: {} });
    assert.equal(opts.status, 200);
    assert.equal(opts.json.rp.id, rpId);
    assert.equal(opts.json.attestation, 'none');
    // wrong rp, bad origin, unsupported alg all fail (each burns its challenge)
    for (const bad of [{ rpId: 'evil.example' }, { origin: 'http://evil.example' }]) {
      const o = (await l('/api/passkeys/register/options', { method: 'POST', body: {} })).json;
      assert.equal((await l('/api/passkeys/register', { method: 'POST', body: registration(auth, rpId, o.challenge, origin, bad) })).status, 400);
    }
    const o2 = (await l('/api/passkeys/register/options', { method: 'POST', body: {} })).json;
    assert.equal((await l('/api/passkeys/register', { method: 'POST', body: registration(auth, rpId, o2.challenge, origin, { alg: -257 }) })).status, 400);
    const o3 = (await l('/api/passkeys/register/options', { method: 'POST', body: {} })).json;
    const reg = registration(auth, rpId, o3.challenge, origin);
    assert.equal((await l('/api/passkeys/register', { method: 'POST', body: reg })).status, 201);
    assert.equal((await l('/api/passkeys/register', { method: 'POST', body: reg })).status, 400, 'challenge is one-time');

    // sign in (no session)
    const anon = s.client();
    const so = (await anon('/api/signin/passkey/options', { method: 'POST', body: {} })).json;
    const good = await assertion(auth, rpId, so.challenge, origin);
    const ok = await anon('/api/signin/passkey', { method: 'POST', body: good });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.personId, personId);
    assert.equal((await anon('/api/me')).status, 200);
    assert.equal((await s.client()('/api/signin/passkey', { method: 'POST', body: good })).status, 400, 'replayed challenge');

    const fails = [{ tamper: true }, { origin: 'http://evil.example' }, { rpId: 'evil.example' }, { flags: 0 }, { key: (await newAuthenticator()).kp.privateKey }];
    for (const bad of fails) {
      const o = (await anon('/api/signin/passkey/options', { method: 'POST', body: {} })).json;
      const a = await assertion(auth, rpId, o.challenge, origin, bad);
      const x = s.client();
      const res = await x('/api/signin/passkey', { method: 'POST', body: a });
      assert.ok(res.status >= 400, JSON.stringify(bad));
      assert.equal((await x('/api/me')).status, 401);
    }
    // unknown credential
    const stranger = await newAuthenticator();
    const o = (await anon('/api/signin/passkey/options', { method: 'POST', body: {} })).json;
    assert.equal((await s.client()('/api/signin/passkey', { method: 'POST', body: await assertion(stranger, rpId, o.challenge, origin) })).status, 401);
    // expired challenge
    const oe = (await anon('/api/signin/passkey/options', { method: 'POST', body: {} })).json;
    await anon('/__test/clock', { method: 'POST', body: { now: Date.now() + 6 * 60 * 1000 } });
    const late = await s.client()('/api/signin/passkey', { method: 'POST', body: await assertion(auth, rpId, oe.challenge, origin) });
    assert.equal(late.status, 400);
    assert.match(late.text, /expired/);
  } finally { await s.stop(); }
});

test('pseudo-locale meta is injected into index.html only with LMS_PSEUDO_LOCALE=1', async () => {
  const dist = new URL('../../web/dist', import.meta.url).pathname;
  const made = !existsSync(join(dist, 'index.html'));
  if (made) { mkdirSync(dist, { recursive: true }); writeFileSync(join(dist, 'index.html'), '<!doctype html><html><head><title>t</title></head><body></body></html>'); }
  try {
    const on = await launch({ LMS_PSEUDO_LOCALE: '1' });
    try {
      const r = await on.client()('/');
      assert.ok(r.text.replace(/<!--[\s\S]*?-->/g, '').includes('<meta name="lms-pseudo-locale" content="1">'));
    } finally { await on.stop(); }
    const off = await launch();
    try { assert.doesNotMatch((await off.client()('/')).text.replace(/<!--[\s\S]*?-->/g, ''), /lms-pseudo-locale/); } finally { await off.stop(); }
  } finally { if (made) rmSync(dist, { recursive: true, force: true }); }
});
