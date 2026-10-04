// Pairing and devices (SPEC 5.3, AC-65). Pairing state is the pure core PairingState, kept as one document in the
// private database with only hashes of the codes. A claim creates a device record and a device session; revoking
// the device removes its sessions, so its next request is 401.
import { z } from 'zod';
import { claimPairing, emptyPairingState, issuePairing } from '../../../core/src/index.ts';

const STATE_ID = 'pairing:state';
const claimSchema = z.object({
  code: z.union([z.string(), z.number()]).transform((v) => String(v).trim().toUpperCase()).pipe(z.string().min(1, 'required')),
  deviceId: z.string().trim().min(1, 'required').max(128),
});
const issueSchema = z.object({ personId: z.string().trim().min(1).optional() }).default({});

export function register(app: any, ctx: any): void {
  const { store, ids, http } = ctx;
  const codeKey = (code: string) => ids.sha256Hex(`pairing:${code}`);

  async function loadState() {
    const doc = await store.get(store.priv, STATE_ID);
    return { doc, state: doc?.state ?? emptyPairingState() };
  }
  // Pairing reads and writes one document; serialise so two claims of one code cannot both win.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => undefined);
    return run;
  };

  // The hub CA's SHA-256 fingerprint (hex). Needs a session. No CA outside the hub profile.
  app.get('/api/pairing/fingerprint', ctx.guard.auth, (c: any) => {
    if (!ctx.ca) return c.json({ error: { ca: 'not-available' } }, 404);
    return c.json({ fingerprint: ctx.ca.fingerprint });
  });

  // Trainer issues a one-time code (5 minutes). Optional { personId } binds the device to that person.
  app.post('/api/pairing', ctx.guard.role('trainer'), async (c: any) => {
    let raw: any = {};
    try { raw = await c.req.json(); } catch { raw = {}; }
    const b = http.parseWith(issueSchema, raw ?? {});
    const now = ctx.clock.now();
    const code = ids.randomCode(8);
    const hash = await codeKey(code);
    await serial(async () => {
      const { doc, state } = await loadState();
      const next = issuePairing(state, hash, now);
      await store.put(store.priv, {
        id: STATE_ID, type: 'pairingState', state: next,
        bind: { ...(doc?.bind ?? {}), [hash]: { issuer: c.get('session').personId, personId: b.personId ? ids.keyOf(b.personId) : null } },
      });
    });
    const url = new URL(c.req.url);
    const qr = { hubId: ctx.hubId ?? null, address: `${url.protocol}//${url.host}`, fingerprint: ctx.ca?.fingerprint ?? null, code };
    return c.json({ code, expiresAt: now + 5 * 60 * 1000, qr });
  });

  // No session needed: the code is the credential. 2xx + device session, or 4xx saying used / expired / unknown.
  app.post('/api/pairing/claim', async (c: any) => {
    const b = await http.validateBody(c, claimSchema);
    const now = ctx.clock.now();
    const hash = await codeKey(b.code);
    const out = await serial(async () => {
      const { doc, state } = await loadState();
      const r = claimPairing(state, hash, b.deviceId, now);
      if (r.result !== 'ok') return { result: r.result, bind: null as any };
      await store.put(store.priv, { ...doc, id: STATE_ID, type: 'pairingState', state: r.state });
      return { result: 'ok', bind: doc?.bind?.[hash] ?? {} };
    });
    if (out.result !== 'ok') {
      const status = out.result === 'used' ? 409 : out.result === 'expired' ? 410 : 404;
      throw http.fieldError('code', out.result, status);
    }
    let personId = out.bind.personId ?? `device-${b.deviceId}`;
    let roles = ['learner'];
    if (out.bind.personId) {
      const person = await ctx.people.getPerson(ctx, personId);
      if (person?.roles?.length) roles = person.roles;
    }
    await store.put(store.priv, {
      id: `device:${b.deviceId}`, type: 'device', deviceId: b.deviceId, personId, roles,
      pairedAt: now, pairedBy: out.bind.issuer ?? null, revoked: false,
    });
    ctx.sessions.create(c, { personId, roles, deviceId: b.deviceId });
    return c.json({ ok: true, deviceId: b.deviceId, personId, roles });
  });

  app.get('/api/devices', ctx.guard.role('trainer'), async (c: any) => {
    const all = await store.list(store.priv, 'device:');
    const devices = all.filter((d: any) => !d.revoked).map((d: any) => ({
      deviceId: d.deviceId, id: d.deviceId, personId: d.personId, pairedAt: d.pairedAt,
    }));
    return c.json({ devices });
  });

  app.delete('/api/devices/:deviceId', ctx.guard.role('trainer'), async (c: any) => {
    const deviceId = c.req.param('deviceId');
    const dev = await store.get(store.priv, `device:${deviceId}`);
    if (!dev || dev.revoked) throw http.fieldError('deviceId', 'unknown', 404);
    await store.put(store.priv, { ...dev, revoked: true, revokedAt: ctx.clock.now() });
    const dropped = ctx.sessions.revokeWhere((s: any) => s.deviceId === deviceId);
    return c.json({ ok: true, deviceId, sessionsRevoked: dropped });
  });
}
