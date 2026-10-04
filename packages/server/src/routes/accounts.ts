// Accounts and sessions (SPEC §5.2, AC-62/63/64, D-30, D-33): /api/me, join, Terms & Conditions, join codes.
// No passwords, no SMS. A one-time class join code or the admin invite creates the person.
import { z } from 'zod';

const text = z.union([z.string(), z.number()]).transform((v) => String(v).trim());

const joinSchema = z.object({
  code: text.pipe(z.string().min(1, 'required')),
  name: z.string().trim().min(1, 'required'),
  rollNumber: text.pipe(z.string().min(1, 'required')).optional(),
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
      await people.savePerson(ctx, key, { name: b.name, roles: ['admin'], dob: b.dob || undefined, minor, tnc: { version: tnc.version, acceptedAt: now } });
      ctx.sessions.create(c, { personId: key, roles: ['admin'] });
      return c.json({ personId: key, roles: ['admin'] });
    }

    // Class code: creates a learner and an enrolment.
    if (!b.rollNumber) throw http.fieldError('rollNumber', 'required');
    const classId = joinCode.classId;
    const classDb = `class-${classId}`;
    const roll = b.rollNumber.toLowerCase();
    const enrolments = await store.list(classDb, 'enrolment:');
    const same = enrolments.find((e: any) => String(e.rollNumber ?? '').toLowerCase() === roll);
    await store.put(store.priv, { ...joinCode, usedAt: now });
    if (same) {
      // Same roll number twice: warn, do not create a second enrolment; the person continues as the enrolled learner.
      const person = await people.getPerson(ctx, same.personId);
      ctx.sessions.create(c, { personId: same.personId, roles: person?.roles?.length ? person.roles : ['learner'] });
      return c.json({ warning: 'already-enrolled', personId: same.personId, classId, enrolmentId: same.id });
    }
    const key = ids.randomKey();
    await people.savePerson(ctx, key, {
      name: b.name, roles: ['learner'], dob: b.dob, minor, rollNumber: b.rollNumber,
      consent: minor ? { required: true, recorded: false } : undefined,
      tnc: { version: tnc.version, acceptedAt: now },
    });
    store.db(`person-${key}`);
    const enrolment = await store.put(classDb, {
      type: 'enrolment', id: `enrolment:${key}`, schema: ctx.schema, personId: key, rollNumber: b.rollNumber,
      joinedAt: now, status: 'active', profile: ctx.config.profile, updatedAt: now, updatedBy: key,
    });
    ctx.sessions.create(c, { personId: key, roles: ['learner'] });
    return c.json({ personId: key, roles: ['learner'], classId, enrolmentId: enrolment.id, minor }, 201);
  });
}
