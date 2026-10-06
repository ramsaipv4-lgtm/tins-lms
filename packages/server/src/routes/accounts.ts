// Accounts and sessions (SPEC §5.2, AC-62/63/64, D-30, D-33): /api/me, join, Terms & Conditions, join codes.
// No passwords, no SMS. A one-time class join code or the admin invite creates the person.
import { z } from 'zod';

const text = z.union([z.string(), z.number()]).transform((v) => String(v).trim());

const joinSchema = z.object({
  code: text.pipe(z.string().min(1, 'required')),
  name: z.string().trim().optional(), // optional (SPEC Appendix A)
  rollNumber: text.optional(), // optional; an empty value counts as absent
  dob: z.string().trim().optional(),
  tncVersion: text.pipe(z.string().min(1, 'required')),
});
const tncPublishSchema = z.object({ version: text.pipe(z.string().min(1, 'required')), text: z.string().min(1, 'required') });
const tncAcceptSchema = z.object({ version: text.pipe(z.string().min(1, 'required')) });

// Join codes are stored only as SHA-256 hashes, in the private database.
export async function hashCode(ctx: any, code: string): Promise<string> {
  return ctx.ids.sha256Hex(`join:${String(code).trim()}`);
}

export function register(app: any, ctx: any): void {
  const { people, store, ids, http } = ctx;

  app.get('/api/me', async (c: any) => {
    const s = c.get('session');
    const [person, tnc] = [await people.getPerson(ctx, s.personId), await people.currentTnc(ctx)];
    const minor = person?.minor === true;
    const accepted = person?.tnc ?? null;
    return c.json({
      personId: s.personId,
      roles: s.roles,
      minor,
      coachTrackers: !minor,
      tnc: {
        version: tnc.version,
        acceptedAt: accepted && accepted.version === tnc.version ? accepted.acceptedAt : (accepted?.acceptedAt ?? null),
        acceptedVersion: accepted?.version ?? null,
        needsAcceptance: !accepted || accepted.version !== tnc.version,
      },
    });
  });

  app.post('/api/signout', async (c: any) => {
    ctx.sessions.destroy(c);
    return c.json({ ok: true });
  });

  registerPasskeyRegistration(app, ctx);
  registerSignin(app, ctx);

  app.get('/api/join/tnc', async (c: any) => c.json(await people.currentTnc(ctx)));

  app.post('/api/admin/tnc', ctx.guard.role('admin'), async (c: any) => {
    const b = await http.validateBody(c, tncPublishSchema);
    await store.put(people.ORG_DB, {
      type: 'tnc', id: 'tnc:current', schema: ctx.schema, version: b.version, text: b.text,
      updatedAt: ctx.clock.now(), updatedBy: c.get('session').personId,
    });
    return c.json({ ok: true, version: b.version });
  });

  app.post('/api/me/tnc', async (c: any) => {
    const b = await http.validateBody(c, tncAcceptSchema);
    const tnc = await people.currentTnc(ctx);
    if (b.version !== tnc.version) throw http.fieldError('version', 'not-current');
    const s = c.get('session');
    const now = ctx.clock.now();
    const existing = await people.getPerson(ctx, s.personId);
    await people.savePerson(ctx, s.personId, {
      roles: existing?.roles?.length ? existing.roles : s.roles,
      tnc: { version: tnc.version, acceptedAt: now },
    });
    return c.json({ ok: true, version: tnc.version, acceptedAt: now });
  });

  app.post('/api/classes/:id/join-codes', ctx.guard.role('trainer'), async (c: any) => {
    const classId = ids.keyOf(c.req.param('id'));
    const code = ids.randomCode(8);
    await store.put(store.priv, {
      id: `joincode:${await hashCode(ctx, code)}`, type: 'joinCode', classId, usedAt: null,
      createdAt: ctx.clock.now(), createdBy: c.get('session').personId,
    });
    return c.json({ code });
  });

  app.post('/api/join', async (c: any) => {
    const b = await http.validateBody(c, joinSchema);
    const now = ctx.clock.now();
    const tnc = await people.currentTnc(ctx);
    if (b.tncVersion !== tnc.version) throw http.fieldError('tncVersion', 'not-current');

    const hash = await hashCode(ctx, b.code);
    const invite = await store.get(store.priv, `invite:${hash}`);
    const joinCode = invite ? null : await store.get(store.priv, `joincode:${hash}`);
    const rec = invite ?? joinCode;
    if (!rec) throw http.fieldError('code', 'unknown', 404);
    if (rec.usedAt) throw http.fieldError('code', 'used', 409);

    let minor = false;
    if (b.dob !== undefined && b.dob !== '') minor = people.isMinor(b.dob, now);
    else if (joinCode) throw http.fieldError('dob', 'required');

    // Admin invite: creates an admin person.
    if (invite) {
      const key = ids.randomKey();
      await store.put(store.priv, { ...invite, usedAt: now });
      await people.savePerson(ctx, key, { name: b.name || undefined, roles: ['admin'], dob: b.dob || undefined, minor, tnc: { version: tnc.version, acceptedAt: now } });
      ctx.sessions.create(c, { personId: key, roles: ['admin'] });
      return c.json({ personId: key, roles: ['admin'] });
    }

    // Class code: creates a learner and an enrolment.
    const classId = joinCode.classId;
    const classDb = `class-${classId}`;
    const roll = (b.rollNumber ?? '').toLowerCase();
    const enrolments = roll ? await store.list(classDb, 'enrolment:') : [];
    const same = roll ? enrolments.find((e: any) => String(e.rollNumber ?? '').toLowerCase() === roll) : undefined;
    await store.put(store.priv, { ...joinCode, usedAt: now });
    if (same) {
      // Same roll number twice: warn, do not create a second enrolment; the person continues as the enrolled learner.
      const person = await people.getPerson(ctx, same.personId);
      ctx.sessions.create(c, { personId: same.personId, roles: person?.roles?.length ? person.roles : ['learner'] });
      return c.json({ warning: 'already-enrolled', personId: same.personId, classId, enrolmentId: same.id });
    }
    const key = ids.randomKey();
    await people.savePerson(ctx, key, {
      name: b.name || undefined, roles: ['learner'], dob: b.dob, minor, rollNumber: b.rollNumber || undefined,
      consent: minor ? { required: true, recorded: false } : undefined,
      tnc: { version: tnc.version, acceptedAt: now },
    });
    store.db(`person-${key}`);
    const enrolment = await store.put(classDb, {
      type: 'enrolment', id: `enrolment:${key}`, schema: ctx.schema, personId: key, rollNumber: b.rollNumber || undefined,
      joinedAt: now, status: 'active', profile: ctx.config.profile, updatedAt: now, updatedBy: key,
    });
    ctx.sessions.create(c, { personId: key, roles: ['learner'] });
    return c.json({ personId: key, roles: ['learner'], classId, enrolmentId: enrolment.id, minor }, 201);
  });
}

// ---------------------------------------------------------------------------------------------
// WebAuthn (SPEC §5.2, D-26): attestation "none", ES256 only, Web Crypto only, minimal CBOR.
// ---------------------------------------------------------------------------------------------
const b64uToBytes = (s: string): Uint8Array => new Uint8Array(Buffer.from(String(s), 'base64url'));
const bytesToB64u = (b: Uint8Array): string => Buffer.from(b).toString('base64url');
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// Minimal CBOR reader: unsigned/negative ints, byte/text strings, arrays, maps (what attestation objects and COSE keys use).
export function cborDecode(buf: Uint8Array): { value: any; end: number } {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const read = (pos: number): { value: any; end: number } => {
    if (pos >= buf.length) throw new Error('cbor-truncated');
    const major = buf[pos] >> 5;
    const info = buf[pos] & 31;
    pos += 1;
    let n: number;
    if (info < 24) n = info;
    else if (info === 24) { n = buf[pos]; pos += 1; }
    else if (info === 25) { n = dv.getUint16(pos); pos += 2; }
    else if (info === 26) { n = dv.getUint32(pos); pos += 4; }
    else throw new Error('cbor-unsupported');
    if (major === 0) return { value: n, end: pos };
    if (major === 1) return { value: -1 - n, end: pos };
    if (major === 2 || major === 3) {
      if (pos + n > buf.length) throw new Error('cbor-truncated');
      const slice = buf.slice(pos, pos + n);
      return { value: major === 2 ? slice : Buffer.from(slice).toString('utf8'), end: pos + n };
    }
    if (major === 4) {
      const arr: any[] = [];
      for (let i = 0; i < n; i++) { const r = read(pos); arr.push(r.value); pos = r.end; }
      return { value: arr, end: pos };
    }
    if (major === 5) {
      const map = new Map<any, any>();
      for (let i = 0; i < n; i++) {
        const k = read(pos); const v = read(k.end);
        map.set(k.value, v.value); pos = v.end;
      }
      return { value: map, end: pos };
    }
    throw new Error('cbor-unsupported');
  };
  return read(0);
}

// DER ECDSA signature -> raw r||s (64 bytes) for Web Crypto.
export function derToRaw(der: Uint8Array): Uint8Array {
  let p = 0;
  if (der[p++] !== 0x30) throw new Error('bad-der');
  if (der[p] & 0x80) p += der[p] & 0x7f;
  p += 1;
  const out = new Uint8Array(64);
  for (let i = 0; i < 2; i++) {
    if (der[p++] !== 0x02) throw new Error('bad-der');
    let len = der[p++];
    let start = p;
    p += len;
    while (len > 32 && der[start] === 0) { start++; len--; }
    if (len > 32) throw new Error('bad-der');
    out.set(der.slice(start, start + len), i * 32 + (32 - len));
  }
  return out;
}

type Challenge = { purpose: 'register' | 'signin'; personId?: string; expires: number };

export function createWebauthn(ctx: any) {
  const challenges = new Map<string, Challenge>();
  const { store, http } = ctx;

  const issue = (purpose: Challenge['purpose'], personId?: string): string => {
    const now = ctx.clock.now();
    for (const [k, v] of challenges) if (v.expires <= now) challenges.delete(k);
    const challenge = bytesToB64u(crypto.getRandomValues(new Uint8Array(32)));
    challenges.set(challenge, { purpose, personId, expires: now + CHALLENGE_TTL_MS });
    return challenge;
  };
  // One-time: the challenge is removed on first use whether or not the rest verifies.
  const consume = (challenge: string, purpose: Challenge['purpose']): Challenge => {
    const rec = challenges.get(challenge);
    challenges.delete(challenge);
    if (!rec || rec.purpose !== purpose) throw http.fieldError('challenge', 'unknown');
    if (rec.expires <= ctx.clock.now()) throw http.fieldError('challenge', 'expired');
    return rec;
  };
  const expected = (c: any) => {
    const origin: string = process.env.LMS_ORIGIN || c.req.header('origin') || new URL(c.req.url).origin;
    const rpId: string = process.env.LMS_RP_ID || new URL(origin).hostname;
    return { origin, rpId };
  };
  const sha256 = async (b: Uint8Array): Promise<Uint8Array> => new Uint8Array(await crypto.subtle.digest('SHA-256', b));
  const checkClientData = (clientDataJSON: Uint8Array, type: string, origin: string) => {
    let cd: any;
    try { cd = JSON.parse(Buffer.from(clientDataJSON).toString('utf8')); } catch { throw http.fieldError('clientDataJSON', 'invalid'); }
    if (cd.type !== type) throw http.fieldError('clientDataJSON', 'wrong-type');
    if (typeof cd.challenge !== 'string') throw http.fieldError('challenge', 'unknown');
    return cd;
  };
  const parseAuthData = (ad: Uint8Array) => {
    if (ad.length < 37) throw http.fieldError('authenticatorData', 'invalid');
    return { rpIdHash: ad.slice(0, 32), flags: ad[32], counter: new DataView(ad.buffer, ad.byteOffset).getUint32(33) };
  };
  const bytesField = (v: any, field: string): Uint8Array => {
    if (typeof v !== 'string' || v === '') throw http.fieldError(field, 'required');
    return b64uToBytes(v);
  };

  const registerOptions = async (c: any) => {
    const s = c.get('session');
    const { rpId } = expected(c);
    const person = await ctx.people.getPerson(ctx, s.personId);
    return c.json({
      challenge: issue('register', s.personId),
      rp: { id: rpId, name: 'Coach LMS' },
      user: { id: bytesToB64u(new TextEncoder().encode(s.personId)), name: person?.name || s.personId, displayName: person?.name || s.personId },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      attestation: 'none',
      timeout: CHALLENGE_TTL_MS,
    });
  };

  const register = async (c: any) => {
    const s = c.get('session');
    const b: any = await c.req.json().catch(() => ({}));
    const credId = bytesField(b?.id, 'id');
    const clientDataJSON = bytesField(b?.response?.clientDataJSON, 'clientDataJSON');
    const attestationObject = bytesField(b?.response?.attestationObject, 'attestationObject');
    const { origin, rpId } = expected(c);
    const cd = checkClientData(clientDataJSON, 'webauthn.create', origin);
    const rec = consume(cd.challenge, 'register');
    if (rec.personId !== s.personId) throw http.fieldError('challenge', 'unknown');
    if (cd.origin !== origin) throw http.fieldError('origin', 'mismatch');
    let att: any;
    try { att = cborDecode(attestationObject).value; } catch { throw http.fieldError('attestationObject', 'invalid'); }
    if (!(att instanceof Map) || att.get('fmt') !== 'none') throw http.fieldError('attestationObject', 'unsupported-format');
    const ad = att.get('authData');
    if (!(ad instanceof Uint8Array)) throw http.fieldError('attestationObject', 'invalid');
    const p = parseAuthData(ad);
    if (!sameBytes(p.rpIdHash, await sha256(new TextEncoder().encode(rpId)))) throw http.fieldError('rpId', 'mismatch');
    if (!(p.flags & 0x01)) throw http.fieldError('flags', 'user-not-present');
    if (!(p.flags & 0x40)) throw http.fieldError('flags', 'no-credential-data');
    let pos = 37 + 16;
    const idLen = (ad[pos] << 8) | ad[pos + 1];
    pos += 2;
    const idInAuth = ad.slice(pos, pos + idLen);
    if (!sameBytes(idInAuth, credId)) throw http.fieldError('id', 'mismatch');
    pos += idLen;
    let cose: any;
    try { cose = cborDecode(ad.slice(pos)).value; } catch { throw http.fieldError('attestationObject', 'invalid'); }
    const x = cose instanceof Map ? cose.get(-2) : null;
    const y = cose instanceof Map ? cose.get(-3) : null;
    if (!(cose instanceof Map) || cose.get(1) !== 2 || cose.get(3) !== -7 || cose.get(-1) !== 1
      || !(x instanceof Uint8Array) || !(y instanceof Uint8Array) || x.length !== 32 || y.length !== 32) {
      throw http.fieldError('publicKey', 'unsupported-algorithm');
    }
    const publicJwk = { kty: 'EC', crv: 'P-256', x: bytesToB64u(x), y: bytesToB64u(y) };
    try { await crypto.subtle.importKey('jwk', publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); }
    catch { throw http.fieldError('publicKey', 'invalid'); }
    const id = bytesToB64u(credId);
    const existing = await store.get(store.priv, `passkey:${id}`);
    if (existing && existing.personId !== s.personId) throw http.fieldError('id', 'taken', 409);
    await store.put(store.priv, {
      id: `passkey:${id}`, type: 'passkey', personId: s.personId, publicJwk, counter: p.counter,
      createdAt: ctx.clock.now(),
    });
    return c.json({ ok: true, id }, 201);
  };

  const signinOptions = async (c: any) => {
    const { rpId } = expected(c);
    return c.json({ challenge: issue('signin'), rpId, allowCredentials: [], userVerification: 'preferred', timeout: CHALLENGE_TTL_MS });
  };

  const signin = async (c: any) => {
    const b: any = await c.req.json().catch(() => ({}));
    const credId = bytesField(b?.id, 'id');
    const clientDataJSON = bytesField(b?.response?.clientDataJSON, 'clientDataJSON');
    const authData = bytesField(b?.response?.authenticatorData, 'authenticatorData');
    const signature = bytesField(b?.response?.signature, 'signature');
    const { origin, rpId } = expected(c);
    const cd = checkClientData(clientDataJSON, 'webauthn.get', origin);
    consume(cd.challenge, 'signin');
    if (cd.origin !== origin) throw http.fieldError('origin', 'mismatch');
    const p = parseAuthData(authData);
    if (!sameBytes(p.rpIdHash, await sha256(new TextEncoder().encode(rpId)))) throw http.fieldError('rpId', 'mismatch');
    if (!(p.flags & 0x01)) throw http.fieldError('flags', 'user-not-present');
    const rec = await store.get(store.priv, `passkey:${bytesToB64u(credId)}`);
    if (!rec) throw new http.ApiError(401, { error: { passkey: 'unknown' } });
    let ok = false;
    try {
      const key = await crypto.subtle.importKey('jwk', rec.publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const signed = new Uint8Array([...authData, ...(await sha256(clientDataJSON))]);
      ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(signature), signed);
    } catch { ok = false; }
    if (!ok) throw new http.ApiError(401, { error: { signature: 'invalid' } });
    if ((p.counter !== 0 || rec.counter !== 0) && p.counter <= rec.counter) throw new http.ApiError(401, { error: { counter: 'replayed' } });
    await store.put(store.priv, { ...rec, counter: p.counter, lastUsedAt: ctx.clock.now() });
    const person = await ctx.people.getPerson(ctx, rec.personId);
    const roles = person?.roles?.length ? person.roles : ['learner'];
    ctx.sessions.create(c, { personId: rec.personId, roles });
    return c.json({ personId: rec.personId, roles });
  };

  // Sign in with Google: needs LMS_GOOGLE_CLIENT_ID; the ID token is checked by Google's tokeninfo endpoint.
  const google = async (c: any) => {
    const clientId = process.env.LMS_GOOGLE_CLIENT_ID;
    if (!clientId) return c.json({ error: { code: 'not-configured' } }, 501);
    const b: any = await c.req.json().catch(() => ({}));
    if (typeof b?.idToken !== 'string' || !b.idToken) throw http.fieldError('idToken', 'required');
    let info: any = null;
    try {
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(b.idToken)}`);
      info = r.ok ? await r.json() : null;
    } catch { info = null; }
    if (!info || info.aud !== clientId || !info.sub) throw new http.ApiError(401, { error: { idToken: 'invalid' } });
    const link = await store.get(store.priv, `google:${info.sub}`);
    if (!link) throw new http.ApiError(403, { error: { google: 'not-linked' } });
    const person = await ctx.people.getPerson(ctx, link.personId);
    ctx.sessions.create(c, { personId: link.personId, roles: person?.roles?.length ? person.roles : ['learner'] });
    return c.json({ personId: link.personId, roles: person?.roles ?? ['learner'] });
  };

  return { registerOptions, register, signinOptions, signin, google };
}

const webauthnByCtx = new WeakMap<object, ReturnType<typeof createWebauthn>>();
function webauthnFor(ctx: any) {
  let w = webauthnByCtx.get(ctx);
  if (!w) { w = createWebauthn(ctx); webauthnByCtx.set(ctx, w); }
  return w;
}

function registerPasskeyRegistration(app: any, ctx: any): void {
  const w = webauthnFor(ctx);
  app.post('/api/passkeys/register/options', w.registerOptions);
  app.post('/api/passkeys/register', w.register);
}

// Sign-in routes need no session: the central guard (core/guard.ts) lists /api/signin (SPEC Appendix A).
function registerSignin(app: any, ctx: any): void {
  const w = webauthnFor(ctx);
  app.post('/api/signin/passkey/options', w.signinOptions);
  app.post('/api/signin/passkey', w.signin);
  app.post('/api/signin/google', w.google);
}
