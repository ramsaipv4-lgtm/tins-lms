// Server routes for the web feature group "files" (AC-95, AC-96, AC-167): the phone bundle, signed day packages that
// carry the keys of released sections, and the fire-drill record. Section keys leave the server only for sections
// that are released (D-38); the rules for "released" are the same core calls the day route uses (D-22).
import { z } from 'zod';
import {
  buildManifest, tarPack, generateSigningKeys, signPackage, sectionKey, releasePlan, isReleased, parsePackage,
} from '../../../../core/src/index.ts';

type Doc = Record<string, any>;
type FileEntry = { path: string; bytes: Uint8Array };

const enc = new TextEncoder();
const b64 = (u: Uint8Array): string => Buffer.from(u).toString('base64');
const json = (v: unknown): string => JSON.stringify(v, null, 1) + '\n';

function stripRev(doc: Doc): Doc { const d = { ...doc }; delete d._rev; return d; }

// Class start for a day: schedule date + start in the program's default zone (Asia/Kolkata), as the day route does.
function dayStart(cls: Doc, day: Doc): number {
  const sched = cls?.schedule?.[day.index] ?? cls?.schedule?.find((s: Doc) => s.date === day.date);
  const date = day.date ?? sched?.date;
  const t = Date.parse(`${date}T${sched?.start ?? '09:00'}:00+05:30`);
  return Number.isFinite(t) ? t : 0;
}

const drillStart = z.object({ classId: z.string().min(1) });
const drillAck = z.object({ ok: z.boolean(), sections: z.number().int().min(0).max(10000), cards: z.number().int().min(0).max(100000) });

export function register(app: any, ctx: any): void {
  const store = ctx.store;
  const priv: string = store.priv;
  const keyOf = (id: string): string => ctx.ids.keyOf(id);
  const classNames = (): string[] => store.names().filter((n: string) => n.startsWith('class-')).sort();

  // The hub's signing key pair: the same document the class-package route in export.ts reads (private db, never exported).
  async function hubKeys(): Promise<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey }> {
    const doc = await store.get(priv, 'hubkey:signing');
    if (doc?.privateJwk && doc?.publicJwk) return { publicJwk: doc.publicJwk, privateJwk: doc.privateJwk };
    const keys = await generateSigningKeys();
    await store.put(priv, { type: 'hubkey', id: 'hubkey:signing', schema: ctx.schema, ...keys, updatedAt: ctx.clock.now(), updatedBy: 'hub' });
    return keys;
  }

  async function dayKey(classKey: string, index: number): Promise<Uint8Array | null> {
    const doc = await store.get(priv, `daykey:${classKey}:${index}`);
    return doc?.key ? new Uint8Array(Buffer.from(doc.key, 'base64')) : null;
  }

  // Section ids of a day that are released now (teleprompter, planned time for ungraded sections, release all).
  function releasedIds(cls: Doc, day: Doc): Set<string> {
    const sections = day.sections ?? [];
    const plan = releasePlan(dayStart(cls, day), sections);
    const now = ctx.clock.now();
    return new Set(sections.filter((s: Doc) => isReleased(s, plan, { now, reachedIds: day.released ?? [], releaseAll: !!day.releaseAll })).map((s: Doc) => s.id));
  }

  // The 8-question diagnostic of each day of the class's published package: { index -> [{ n, text, answer }] }.
  async function diagnostics(classKey: string): Promise<Record<number, { n: number; text: string; answer: string }[]>> {
    const out: Record<number, { n: number; text: string; answer: string }[]> = {};
    const pkgs = (await store.list(priv, 'package:')).filter((p: Doc) => p.status === 'published' && p.classId === classKey && p.files);
    for (const p of pkgs) {
      for (const d of parsePackage(p.files).days) {
        if (out[d.index] || !d.questions?.length) continue;
        out[d.index] = d.questions.map((q: Doc, i: number) => ({ n: i + 1, text: q.text, answer: q.answer }));
      }
    }
    return out;
  }

  async function dayView(cls: Doc, classKey: string, day: Doc) {
    const open = releasedIds(cls, day);
    const dk = await dayKey(classKey, day.index);
    const sections = [];
    for (let i = 0; i < (day.sections ?? []).length; i++) {
      const s = day.sections[i];
      const out: Doc = { id: s.id, title: s.title, graded: !!s.graded, sealed: s.sealed };
      if (dk && open.has(s.id)) out.key = b64(await sectionKey(dk, i));
      sections.push(out);
    }
    return { index: day.index, date: day.date ?? null, sections };
  }

  // Classes the caller may carry on a phone: the ones they are enrolled in, or teach (admin: all).
  async function classesOf(session: { personId: string; roles: string[] }): Promise<{ key: string; cls: Doc; profile: string | null }[]> {
    const staff = session.roles.some((r) => ['admin', 'trainer', 'substitute', 'coordinator'].includes(r));
    const out: { key: string; cls: Doc; profile: string | null }[] = [];
    for (const db of classNames()) {
      const key = db.slice('class-'.length);
      const cls = await store.get(db, `class:${key}`);
      if (!cls) continue;
      const enrol = (await store.list(db, 'enrolment:')).find((e: Doc) => keyOf(String(e.personId)) === session.personId && e.status !== 'dropped');
      const teaches = (cls.trainerIds ?? []).some((id: string) => keyOf(String(id)) === session.personId) || session.roles.includes('admin');
      if (enrol || (staff && teaches)) out.push({ key, cls, profile: enrol?.profile ?? null });
    }
    return out;
  }

  const requireTrainer = ctx.guard.role('trainer', 'substitute');

  // ---- AC-95: everything a phone needs to keep working without the hub ----
  app.get('/api/files/bundle', ctx.guard.auth, async (c: any) => {
    const s = c.get('session');
    const classes = [];
    for (const { key, cls, profile } of await classesOf(s)) {
      const days = [];
      for (const d of (await store.list(`class-${key}`, 'day:')).sort((a: Doc, b: Doc) => a.index - b.index)) {
        if (Array.isArray(d.sections) && d.sections.length) days.push(await dayView(cls, key, d));
      }
      const drills = (await store.list(priv, `drill:${key}:`)).filter((d: Doc) => d.state === 'running').sort((a: Doc, b: Doc) => b.startedAt - a.startedAt);
      classes.push({
        key, name: cls.name ?? key, profile, days, diagnostics: await diagnostics(key),
        drill: drills[0] ? { id: drills[0].id, startedAt: drills[0].startedAt } : null,
      });
    }
    return c.json({ now: ctx.clock.now(), schema: ctx.schema, personId: s.personId, hubKey: (await hubKeys()).publicJwk, classes });
  });

  // ---- AC-96: a signed day package that carries the keys of the released sections ----
  app.get('/api/files/package', requireTrainer, async (c: any) => {
    const q = ctx.http.validateQuery(c, z.object({ classId: z.string().min(1), day: z.coerce.number().int().min(0) }));
    const classKey = keyOf(q.classId);
    const db = `class-${classKey}`;
    const cls = await store.get(db, `class:${classKey}`);
    if (!cls) throw ctx.http.fieldError('classId', 'unknown', 404);
    const day = (await store.list(db, 'day:')).find((d: Doc) => d.index === q.day);
    if (!day) throw ctx.http.fieldError('day', 'unknown-day', 404);
    const view = await dayView(cls, classKey, day);
    // Downloading the day package is the trainer's own act of handing the day out to learners who have no hub link, so
    // every ungraded section is included with its key; graded sections only when they are already released (D-38).
    const dk = await dayKey(classKey, q.day);
    const keys: Record<string, string> = {};
    for (let i = 0; i < view.sections.length; i++) {
      const s = view.sections[i];
      if (s.key) keys[s.id] = s.key;
      else if (!s.graded && dk) keys[s.id] = b64(await sectionKey(dk, i));
    }
    const diag = (await diagnostics(classKey))[q.day] ?? [];
    const outline = [`# ${cls.name ?? classKey}: day ${q.day} ${day.date ?? ''}`.trim(), '',
      ...view.sections.map((s: Doc) => `- ${s.title}${s.graded ? ' (graded)' : ''}${keys[s.id] ? '' : ' (not released yet)'}`), ''].join('\n');
    const files: FileEntry[] = [
      { path: 'class.json', bytes: enc.encode(json({ id: classKey, name: cls.name ?? classKey })) },
      { path: `day-${q.day}.json`, bytes: enc.encode(json({ ...view, sections: view.sections.map(({ key: _k, ...rest }: Doc) => rest) })) },
      { path: `day-${q.day}.md`, bytes: enc.encode(outline) },
      { path: 'diagnostic.json', bytes: enc.encode(json(diag)) },
      { path: 'keys.json', bytes: enc.encode(json(keys)) },
    ].sort((a, b) => (a.path < b.path ? -1 : 1));
    const manifest = await buildManifest(files);
    const archive = tarPack([{ path: 'manifest.json', bytes: enc.encode(json(manifest)) }, ...files]);
    const signed = await signPackage(archive, (await hubKeys()).privateJwk);
    return c.body(signed, 200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' });
  });

  // ---- AC-167: the fire drill record (the trainer's wizard; phones acknowledge when they see it running) ----
  app.post('/api/files/drill', requireTrainer, async (c: any) => {
    const b = await ctx.http.validateBody(c, drillStart);
    const key = keyOf(b.classId);
    if (!(await store.get(`class-${key}`, `class:${key}`))) throw ctx.http.fieldError('classId', 'unknown', 404);
    const id = `drill:${key}:${ctx.ids.randomKey()}`;
    const now = ctx.clock.now();
    const me = c.get('session').personId;
    await store.put(priv, { type: 'drill', id, schema: ctx.schema, classKey: key, state: 'running', startedAt: now, startedBy: me, acks: [], updatedAt: now, updatedBy: me });
    return c.json({ id, state: 'running', startedAt: now }, 201);
  });

  app.get('/api/files/drill', requireTrainer, async (c: any) => {
    const id = c.req.query('id') ?? '';
    const d = await store.get(priv, id);
    if (!d || d.type !== 'drill') throw ctx.http.fieldError('id', 'unknown', 404);
    return c.json({ id: d.id, state: d.state, startedAt: d.startedAt, finishedAt: d.finishedAt ?? null, acks: d.acks });
  });

  app.post('/api/files/drill-finish', requireTrainer, async (c: any) => {
    const b = await ctx.http.validateBody(c, z.object({ id: z.string().min(1) }));
    const d = await store.get(priv, b.id);
    if (!d || d.type !== 'drill') throw ctx.http.fieldError('id', 'unknown', 404);
    const now = ctx.clock.now();
    await store.put(priv, { ...stripRev(d), state: 'done', finishedAt: now, updatedAt: now, updatedBy: c.get('session').personId });
    return c.json({ id: d.id, state: 'done', acks: d.acks.length });
  });

  app.post('/api/files/drill-ack', ctx.guard.auth, async (c: any) => {
    const b = await ctx.http.validateBody(c, drillAck.extend({ id: z.string().min(1) }));
    const me = c.get('session').personId;
    const d = await store.get(priv, b.id);
    if (!d || d.type !== 'drill') throw ctx.http.fieldError('id', 'unknown', 404);
    const mine = (await classesOf(c.get('session'))).some((x) => x.key === d.classKey);
    if (!mine) throw new ctx.http.ApiError(403, { error: { class: 'not-in-class' } });
    const now = ctx.clock.now();
    const acks = [...d.acks.filter((a: Doc) => a.personId !== me), { personId: me, ok: b.ok, sections: b.sections, cards: b.cards, at: now }];
    await store.put(priv, { ...stripRev(d), acks, updatedAt: now, updatedBy: me });
    return c.json({ ok: true });
  });
}
