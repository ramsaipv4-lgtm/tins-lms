// Packages, content gate on upload, sealed sections and teleprompter release (SPEC 5.5, D-38, AC-67, AC-68).
// Section plaintext is sealed at write time and never stored, served or replicated in the clear:
// day documents in class databases keep only `sealed` (base64); the per-day key lives in the private db.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  tarUnpack, runGate, parsePackage, sectionKey, sealSection, releasePlan, isReleased,
} from '../../../core/src/index.ts';

const b64 = (u: Uint8Array): string => Buffer.from(u).toString('base64');
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const dec = (u: Uint8Array): string => new TextDecoder().decode(u);

const waiversSchema = z.array(z.object({
  check: z.string().min(1), reason: z.string().min(1), by: z.string().min(1), expiresAt: z.number().finite(),
}));
const teleSchema = z.object({
  sectionId: z.string().min(1).optional(),
  releaseAll: z.boolean().optional(),
  dayIndex: z.number().int().min(0).optional(),
});

function readDir(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (abs: string, rel: string) => {
    for (const name of readdirSync(abs).sort()) {
      const a = join(abs, name);
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(a).isDirectory()) walk(a, r); else out[r] = readFileSync(a, 'utf8');
    }
  };
  walk(root, '');
  return out;
}

// Text of one script section: from its heading line to the next "## " heading.
function sectionText(script: string | undefined, title: string): string {
  if (!script) return title;
  const lines = script.split('\n');
  const start = lines.findIndex((l) => /^##\s/.test(l) && l.includes(title));
  if (start < 0) return title;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^##\s/.test(lines[i])) { end = i; break; }
  return lines.slice(start, end).join('\n');
}

// Class start for a day: schedule date + start in the program's default zone (Asia/Kolkata).
function dayStart(cls: any, day: any): number {
  const sched = cls?.schedule?.[day.index] ?? cls?.schedule?.find((s: any) => s.date === day.date);
  const date = day.date ?? sched?.date;
  const t = Date.parse(`${date}T${sched?.start ?? '09:00'}:00+05:30`);
  return Number.isFinite(t) ? t : 0;
}

// Archive paths, always normalised the same way: drop "./" prefixes and directory entries; when every
// path shares one first folder (a package archived as `package/...`), remove that single wrapper folder.
function normalizePaths(entries: [string, string][]): Record<string, string> {
  const list = entries.map(([p, t]) => [p.replace(/^(\.\/)+/, ''), t] as [string, string]).filter(([p]) => p !== '' && !p.endsWith('/'));
  const first = list[0]?.[0].split('/')[0];
  const wrapped = list.length > 0 && list.every(([p]) => p.includes('/') && p.split('/')[0] === first);
  return Object.fromEntries(list.map(([p, t]) => [wrapped ? p.slice(first.length + 1) : p, t]));
}

export function register(app: any, ctx: any): void {
  const store = ctx.store;
  const priv = store.priv;

  async function dayKey(classKey: string, index: number): Promise<Uint8Array> {
    const id = `daykey:${classKey}:${index}`;
    const doc = await store.get(priv, id);
    if (doc) return new Uint8Array(Buffer.from(doc.key, 'base64'));
    const raw = crypto.getRandomValues(new Uint8Array(32));
    await store.put(priv, { id, type: 'dayKey', key: b64(raw) });
    return raw;
  }

  // Seal every section body of a day document; the plaintext body is dropped.
  async function sealDay(classKey: string, doc: any): Promise<any> {
    if (!Array.isArray(doc.sections)) return doc;
    const dk = await dayKey(classKey, doc.index);
    const sections = [];
    for (let i = 0; i < doc.sections.length; i++) {
      const { body, ...rest } = doc.sections[i];
      if (typeof body === 'string' || typeof rest.sealed !== 'string') {
        const key = await sectionKey(dk, i);
        rest.sealed = b64(await sealSection(key, enc(typeof body === 'string' ? body : '')));
      }
      sections.push(rest);
    }
    return { ...doc, sections };
  }

  // Every write of a day document into a class database goes through sealing, wherever it comes from (seed, publish).
  const rawPut = store.put.bind(store);
  store.put = async (dbName: string, doc: any) => {
    if (doc && doc.type === 'day' && typeof dbName === 'string' && dbName.startsWith('class-')) {
      doc = await sealDay(dbName.slice('class-'.length), doc);
    }
    return rawPut(dbName, doc);
  };

  async function storePackage(files: Record<string, string>, classKey: string | null, by: string) {
    const gate = runGate(files, [], ctx.clock.now());
    const id = ctx.ids.randomKey();
    const status = gate.pass ? 'ready' : 'draft';
    await store.put(priv, { id: `package:${id}`, type: 'package', status, classId: classKey, checks: gate.checks, files, createdBy: by, createdAt: ctx.clock.now() });
    return { id, status, checks: gate.checks };
  }

  async function publishPackage(pkg: any, classKey: string | null): Promise<void> {
    const key = classKey ?? pkg.classId;
    if (key) {
      const cls = await store.get(`class-${key}`, `class:${key}`);
      const parsed = parsePackage(pkg.files);
      const seen = new Set<number>();
      for (const d of parsed.days) {
        if (seen.has(d.index)) continue;
        seen.add(d.index);
        const script = Object.entries<string>(pkg.files).find(([p]) => /(^|\/)day0*${d.index}\/instructor_script\.md$/.test(p) || new RegExp(`instructor_script_day0*${d.index}\\.md$`).test(p))?.[1];
        const prev = await store.get(`class-${key}`, `day:${d.index}`);
        await store.put(`class-${key}`, {
          type: 'day', id: `day:${d.index}`, schema: ctx.schema, updatedAt: ctx.clock.now(), updatedBy: 'hub:package',
          index: d.index, date: cls?.schedule?.[d.index]?.date ?? prev?.date ?? null,
          sections: d.sections.map((s: any) => ({
            id: s.id, title: s.title, plannedSec: s.plannedSec, graded: s.graded, kind: s.graded ? 'quiz' : 'lecture',
            body: sectionText(script, s.title),
          })),
          released: prev?.released ?? [], releaseAll: prev?.releaseAll ?? false,
        });
      }
    }
    await store.put(priv, { ...pkg, status: 'published', classId: key ?? null, publishedAt: ctx.clock.now() });
  }

  ctx.hooks.seedPackage = async (p: { path: string; file: string | null; classId: string; publish: boolean }) => {
    if (!p.file || !existsSync(p.file)) return;
    const files = statSync(p.file).isDirectory()
      ? readDir(p.file)
      : Object.fromEntries(tarUnpack(new Uint8Array(readFileSync(p.file))).map((f) => [f.path, dec(f.bytes)]));
    const r = await storePackage(files, p.classId, 'hub:seed');
    if (p.publish) {
      const pkg = await store.get(priv, `package:${r.id}`);
      if (pkg.status === 'ready') await publishPackage(pkg, p.classId);
    }
  };

  app.post('/api/packages', ctx.guard.role('trainer'), async (c: any) => {
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.length === 0) throw ctx.http.fieldError('body', 'empty-package');
    let files: Record<string, string>;
    try {
      files = normalizePaths(tarUnpack(bytes).map((f) => [f.path, dec(f.bytes)] as [string, string]));
    } catch { throw ctx.http.fieldError('body', 'not-a-tar'); }
    if (Object.keys(files).length === 0) throw ctx.http.fieldError('body', 'not-a-tar');
    const q = c.req.query('classId');
    const r = await storePackage(files, q ? ctx.ids.keyOf(q) : null, c.get('session')?.personId ?? 'unknown');
    return c.json({ ...r, pass: r.status !== 'draft' });
  });

  app.post('/api/packages/:id/publish', ctx.guard.role('trainer'), async (c: any) => {
    const pkg = await store.get(priv, `package:${c.req.param('id')}`);
    if (!pkg) throw ctx.http.fieldError('id', 'unknown-package', 404);
    let body: any = {};
    try { body = JSON.parse((await c.req.text()) || '{}'); } catch { /* no body */ }
    const waivers = ctx.http.parseWith(waiversSchema, body?.waivers ?? []).map((w: any) => ({ ...w, by: w.by }));
    // Re-run the gate with the waivers: G7 can never be waived and an expired waiver is ignored (core decides).
    const gate = runGate(pkg.files, waivers, ctx.clock.now());
    if (!gate.pass) {
      throw new ctx.http.ApiError(409, {
        error: { package: 'gate-failed' }, status: pkg.status,
        checks: gate.checks.filter((k: any) => !k.pass && !k.waived),
      });
    }
    pkg.checks = gate.checks;
    const classId: string | null = typeof body?.classId === 'string' ? body.classId : (c.req.query('classId') ?? null);
    await publishPackage(pkg, classId ? ctx.ids.keyOf(classId) : null);
    return c.json({ id: c.req.param('id'), status: 'published' });
  });

  async function loadDay(classKey: string, index: number) {
    const cls = await store.get(`class-${classKey}`, `class:${classKey}`);
    if (!cls) throw ctx.http.fieldError('class', 'unknown-class', 404);
    const day = await store.get(`class-${classKey}`, `day:${index}`);
    if (!day) throw ctx.http.fieldError('day', 'unknown-day', 404);
    return { cls, day };
  }

  const releasedIds = (cls: any, day: any): Set<string> => {
    const sections = day.sections ?? [];
    const plan = releasePlan(dayStart(cls, day), sections);
    const now = ctx.clock.now();
    return new Set(sections.filter((s: any) => isReleased(s, plan, { now, reachedIds: day.released ?? [], releaseAll: !!day.releaseAll })).map((s: any) => s.id));
  };

  app.get('/api/classes/:id/days/:index', async (c: any) => {
    const classKey = ctx.ids.keyOf(c.req.param('id'));
    const index = Number(c.req.param('index'));
    if (!Number.isInteger(index) || index < 0) throw ctx.http.fieldError('index', 'invalid');
    const s = c.get('session');
    const staff = (s?.roles ?? []).some((r: string) => ['admin', 'trainer', 'substitute', 'coordinator'].includes(r));
    if (!staff) {
      const en = await store.get(`class-${classKey}`, `enrolment:${s?.personId}`);
      if (!en || en.status !== 'active') throw new ctx.http.ApiError(403, { error: { class: 'not-enrolled' } });
    }
    const { cls, day } = await loadDay(classKey, index);
    const open = releasedIds(cls, day);
    const dk = await dayKey(classKey, index);
    const sections = [];
    for (let i = 0; i < (day.sections ?? []).length; i++) {
      const sec = day.sections[i];
      const out: any = { id: sec.id, title: sec.title, graded: !!sec.graded, sealed: sec.sealed };
      if (open.has(sec.id)) out.key = b64(await sectionKey(dk, i));
      sections.push(out);
    }
    return c.json({ index, date: day.date, sections });
  });

  app.post('/api/classes/:id/teleprompter', ctx.guard.role('trainer', 'substitute'), async (c: any) => {
    const classKey = ctx.ids.keyOf(c.req.param('id'));
    const b = await ctx.http.validateBody(c, teleSchema);
    if (!b.sectionId && !b.releaseAll) throw ctx.http.fieldError('sectionId', 'sectionId or releaseAll required');
    const cls = await store.get(`class-${classKey}`, `class:${classKey}`);
    if (!cls) throw ctx.http.fieldError('class', 'unknown-class', 404);
    const days = (await store.list(`class-${classKey}`, 'day:')).filter((d: any) => Array.isArray(d.sections) && d.sections.length > 0);
    let targets = b.dayIndex === undefined ? days : days.filter((d: any) => d.index === b.dayIndex);
    if (b.dayIndex === undefined) {
      const today = new Date(ctx.clock.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
      const current = days.filter((d: any) => d.date === today);
      if (current.length) targets = current;
    }
    if (b.sectionId) {
      const withIt = targets.filter((d: any) => d.sections.some((s: any) => s.id === b.sectionId));
      targets = withIt.length ? [withIt[0]] : days.filter((d: any) => d.sections.some((s: any) => s.id === b.sectionId)).slice(0, 1);
      if (!targets.length) throw ctx.http.fieldError('sectionId', 'unknown-section', 404);
    }
    for (const d of targets) {
      const next = { ...d, updatedAt: ctx.clock.now(), updatedBy: c.get('session')?.personId ?? 'unknown' };
      if (b.releaseAll) next.releaseAll = true;
      else next.released = [...new Set([...(d.released ?? []), b.sectionId])];
      await store.put(`class-${classKey}`, next);
    }
    return c.json({ ok: true, days: targets.map((d: any) => d.index), releaseAll: !!b.releaseAll, sectionId: b.sectionId ?? null });
  });
}
