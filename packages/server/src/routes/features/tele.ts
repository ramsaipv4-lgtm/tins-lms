// Server routes for the web feature group "tele": teleprompter day view, substitute handover, self-learn,
// trainer pack, package library and rehearsal (SPEC 4.7, 4.8, 5.5, 6.3; AC-83, AC-150, AC-151, AC-157, AC-158).
// The release itself stays in content.ts (POST /api/classes/:id/teleprompter). This module adds read models and
// small documents: `substitution:<day>`, `selflearn:<day>` and `rehearsal:<id>` in the class database.
import { z } from 'zod';
import {
  sectionKey, openSection, releasePlan, isReleased, atRisk, isOn,
} from '../../../../core/src/index.ts';

const b64 = (u: Uint8Array): string => Buffer.from(u).toString('base64');
const unb64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'base64'));
const dec = (u: Uint8Array): string => new TextDecoder().decode(u);
const STAFF = ['admin', 'trainer', 'substitute', 'coordinator'];

const substitutionSchema = z.object({
  dayIndex: z.number().int().min(0),
  substituteId: z.string().min(1).nullable().optional(),
  mode: z.enum(['substitute', 'self-learn']),
});
const askSchema = z.object({ text: z.string().trim().min(1).max(500) });
const nextSchema = z.object({ dayIndex: z.number().int().min(0) });
const rehearsalSchema = z.object({
  id: z.string().optional(),
  dayIndex: z.number().int().min(0),
  rows: z.array(z.object({
    id: z.string(), plannedSec: z.number(), actualSec: z.number().nullable(), deltaSec: z.number().nullable(),
  })),
  behindSec: z.number(),
  followUp: z.enum(['teach-back', 'self-check']),
  teachBack: z.string().max(4000).optional(),
  selfCheck: z.array(z.string()).max(50).optional(),
  freshness: z.string().max(40).optional(),
});

// Commands from fenced code blocks.
function commandsOf(text: string): string[] {
  const out: string[] = [];
  let fenced = false;
  for (const line of text.split('\n')) {
    if (/^```/.test(line.trim())) { fenced = !fenced; continue; }
    if (fenced && line.trim() && !line.trim().startsWith('#')) out.push(line.trim().replace(/^\$\s*/, ''));
  }
  return [...new Set(out)];
}

// Body of the first heading that matches (up to the next heading of the same or higher level).
function section(text: string, heading: RegExp): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && heading.test(l));
  if (start < 0) return '';
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) { if (/^#{1,2}\s/.test(lines[i])) break; out.push(lines[i]); }
  return out.join('\n').trim();
}

export function register(app: any, ctx: any): void {
  const store = ctx.store;
  const priv = store.priv;

  // ---- lookups -------------------------------------------------------------------------------------------------
  const keyOf = (id: string): string => ctx.ids.keyOf(id);
  const personKey = (c: any): string => String(c.get('session')?.personId ?? '');
  const rolesOf = (c: any): string[] => c.get('session')?.roles ?? [];
  const isStaff = (c: any): boolean => rolesOf(c).some((r) => STAFF.includes(r));

  async function classKeys(): Promise<string[]> {
    const keys = new Set<string>();
    for (const n of store.names()) if (/^class-./.test(n)) keys.add(n.slice('class-'.length));
    for (const co of await store.list('org', 'cohort:')) for (const id of co.classIds ?? []) keys.add(keyOf(id));
    return [...keys].sort();
  }
  async function getClass(key: string) {
    const cls = await store.get(`class-${key}`, `class:${key}`);
    if (!cls) throw ctx.http.fieldError('class', 'unknown-class', 404);
    return cls;
  }
  async function enrolmentOf(key: string, person: string) {
    const list = await store.list(`class-${key}`, 'enrolment:');
    return list.find((e: any) => keyOf(String(e.personId)) === person) ?? null;
  }
  async function substitutions(key: string): Promise<any[]> {
    return (await store.list(`class-${key}`, 'substitution:')).sort((a: any, b: any) => a.dayIndex - b.dayIndex);
  }
  async function nameOf(person: string | null | undefined): Promise<string> {
    if (!person) return '';
    const p = await store.get('org', `person:${keyOf(person)}`);
    return p?.name ?? keyOf(person);
  }
  async function dayDocs(key: string): Promise<any[]> {
    return (await store.list(`class-${key}`, 'day:')).filter((d: any) => Array.isArray(d.sections)).sort((a: any, b: any) => a.index - b.index);
  }
  const todayIst = (): string => new Date(ctx.clock.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

  // What may this session do in class `key`? Throws 403 for outsiders.
  async function access(c: any, key: string, dayIndex?: number): Promise<'trainer' | 'substitute' | 'learner'> {
    const roles = rolesOf(c);
    const me = personKey(c);
    await getClass(key);
    if (roles.includes('admin') || roles.includes('trainer')) return 'trainer';
    if (roles.includes('substitute') || roles.includes('coordinator')) {
      const subs = await substitutions(key);
      const mine = subs.some((s: any) => s.substituteId && keyOf(s.substituteId) === me && (dayIndex === undefined || s.dayIndex === dayIndex));
      if (roles.includes('coordinator') || mine) return 'substitute';
      throw new ctx.http.ApiError(403, { error: { class: 'not-assigned' } });
    }
    const en = await enrolmentOf(key, me);
    if (!en || en.status !== 'active') throw new ctx.http.ApiError(403, { error: { class: 'not-enrolled' } });
    return 'learner';
  }

  async function dayKey(key: string, index: number): Promise<Uint8Array> {
    const id = `daykey:${key}:${index}`;
    const d = await store.get(priv, id);
    if (d) return unb64(d.key);
    const raw = crypto.getRandomValues(new Uint8Array(32));
    await store.put(priv, { id, type: 'dayKey', key: b64(raw) });
    return raw;
  }
  function dayStart(cls: any, day: any): number {
    const sched = cls?.schedule?.[day.index] ?? cls?.schedule?.find((s: any) => s.date === day.date);
    const t = Date.parse(`${day.date ?? sched?.date}T${sched?.start ?? '09:00'}:00+05:30`);
    return Number.isFinite(t) ? t : 0;
  }
  function openIds(cls: any, day: any): Set<string> {
    const plan = releasePlan(dayStart(cls, day), day.sections);
    const now = ctx.clock.now();
    return new Set(day.sections
      .filter((s: any) => isReleased(s, plan, { now, reachedIds: day.released ?? [], releaseAll: !!day.releaseAll }))
      .map((s: any) => s.id));
  }
  async function plain(key: string, day: any, i: number): Promise<string> {
    const s = day.sections[i];
    if (typeof s.sealed !== 'string') return '';
    try { return dec(await openSection(await sectionKey(await dayKey(key, day.index), i), unb64(s.sealed))); } catch { return ''; }
  }

  // Package files of the class (its published package, else the newest one).
  async function packageOf(key: string): Promise<any | null> {
    const all = (await store.list(priv, 'package:')).filter((p: any) => p.files && (p.classId === key || p.classId == null));
    const mine = all.filter((p: any) => p.classId === key).sort((a: any, b: any) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
    return mine[0] ?? all.sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0] ?? null;
  }
  function dayFile(pkg: any, index: number, name: string): string {
    const files: Record<string, string> = pkg?.files ?? {};
    const re = new RegExp(`(^|/)day0*${index}/${name}\\.md$|(^|/)${name}_day0*${index}\\.md$`);
    const hit = Object.keys(files).find((p) => re.test(p));
    return hit ? files[hit] : '';
  }
  function recallFile(pkg: any, index: number): string {
    const files: Record<string, string> = pkg?.files ?? {};
    const re = new RegExp(`(^|/)memory_recall_day0*${index}\\.md$`);
    const hit = Object.keys(files).find((p) => re.test(p));
    return hit ? files[hit] : '';
  }
  async function aiOnFor(key: string): Promise<boolean> {
    const cls = await getClass(key);
    return isOn('explainBackAi', { class: cls.switches ?? {} });
  }

  // ---- context and day view ------------------------------------------------------------------------------------
  app.get('/api/tele/context', async (c: any) => {
    const me = personKey(c);
    const out: any[] = [];
    for (const key of await classKeys()) {
      let role: string;
      try { role = await access(c, key); } catch { continue; }
      const cls = await getClass(key);
      const days = await dayDocs(key);
      const subs = await substitutions(key);
      const today = days.find((d: any) => d.date === todayIst());
      const upcoming = days.find((d: any) => d.date && d.date > todayIst());
      const selfLearn = subs.filter((s: any) => s.mode === 'self-learn').map((s: any) => s.dayIndex);
      // The day shown by default: today, else a day handed over to me or to self-learn, else the next, else the last.
      const mine = subs.find((s: any) => s.mode === 'self-learn' || (s.substituteId && keyOf(s.substituteId) === me));
      const todayIndex = (today ?? (role === 'trainer' ? undefined : days.find((d: any) => d.index === mine?.dayIndex)) ?? upcoming ?? days[days.length - 1])?.index ?? 0;
      out.push({
        id: key, name: cls.name ?? key, role, todayIndex,
        days: days.map((d: any) => ({ index: d.index, date: d.date, mode: subs.find((s: any) => s.dayIndex === d.index)?.mode ?? null })),
        selfLearnDays: selfLearn,
        aiOn: isOn('explainBackAi', { class: cls.switches ?? {} }),
      });
    }
    return c.json({ serverNow: ctx.clock.now(), classes: out });
  });

  app.get('/api/tele/classes/:id/days/:index', async (c: any) => {
    const key = keyOf(c.req.param('id'));
    const index = Number(c.req.param('index'));
    if (!Number.isInteger(index) || index < 0) throw ctx.http.fieldError('index', 'invalid');
    const role = await access(c, key);
    const cls = await getClass(key);
    const day = await store.get(`class-${key}`, `day:${index}`);
    if (!day) throw ctx.http.fieldError('day', 'unknown-day', 404);
    const open = openIds(cls, day);
    const dk = await dayKey(key, index);
    const sections = [];
    for (let i = 0; i < day.sections.length; i++) {
      const s = day.sections[i];
      const o: any = { id: s.id, title: s.title, graded: !!s.graded, plannedSec: s.plannedSec, sealed: s.sealed, released: open.has(s.id) };
      if (open.has(s.id)) o.key = b64(await sectionKey(dk, i));
      if (role !== 'learner') o.text = await plain(key, day, i);
      sections.push(o);
    }
    const subs = await substitutions(key);
    return c.json({
      index, date: day.date, serverNow: ctx.clock.now(), sections, reached: day.released ?? [],
      releaseAll: !!day.releaseAll, mode: subs.find((s: any) => s.dayIndex === index)?.mode ?? null,
    });
  });

  // ---- substitute (F-01) ---------------------------------------------------------------------------------------
  app.get('/api/tele/substitutes', ctx.guard.role('trainer'), async (c: any) => {
    const people = await store.list('org', 'person:');
    return c.json({ substitutes: people.filter((p: any) => (p.roles ?? []).includes('substitute')).map((p: any) => ({ id: keyOf(p.id), name: p.name })) });
  });

  app.get('/api/tele/classes/:id/substitutions', async (c: any) => {
    const key = keyOf(c.req.param('id'));
    const role = await access(c, key);
    const me = personKey(c);
    const list = [];
    for (const s of await substitutions(key)) {
      if (role === 'learner') continue;
      if (role === 'substitute' && !(s.substituteId && keyOf(s.substituteId) === me)) continue;
      list.push({ ...s, substituteName: await nameOf(s.substituteId) });
    }
    return c.json({ substitutions: list });
  });

  app.post('/api/tele/classes/:id/substitution', ctx.guard.role('trainer'), async (c: any) => {
    const key = keyOf(c.req.param('id'));
    await access(c, key);
    const b = await ctx.http.validateBody(c, substitutionSchema);
    const day = await store.get(`class-${key}`, `day:${b.dayIndex}`);
    if (!day) throw ctx.http.fieldError('dayIndex', 'unknown-day', 404);
    let subKey: string | null = null;
    if (b.mode === 'substitute') {
      if (!b.substituteId) throw ctx.http.fieldError('substituteId', 'required');
      subKey = keyOf(b.substituteId);
      const p = await store.get('org', `person:${subKey}`);
      if (!p || !(p.roles ?? []).includes('substitute')) throw ctx.http.fieldError('substituteId', 'unknown-substitute', 404);
    }
    const prev = await store.get(`class-${key}`, `substitution:${b.dayIndex}`);
    const doc = await store.put(`class-${key}`, {
      type: 'substitution', id: `substitution:${b.dayIndex}`, schema: ctx.schema, updatedAt: ctx.clock.now(), updatedBy: personKey(c),
      dayIndex: b.dayIndex, mode: b.mode, substituteId: subKey,
      requestedBy: personKey(c), requestedAt: ctx.clock.now(),
      handoverReadAt: prev && prev.substituteId === subKey ? prev.handoverReadAt ?? null : null,
      taughtBy: b.mode === 'self-learn' ? 'ai' : subKey,
    });
    return c.json({ ok: true, substitution: doc });
  });

  async function handoverPack(key: string, index: number) {
    const cls = await getClass(key);
    const day = await store.get(`class-${key}`, `day:${index}`);
    if (!day) throw ctx.http.fieldError('day', 'unknown-day', 404);
    const pkg = await packageOf(key);
    const script = dayFile(pkg, index, 'instructor_script');
    const sections = [];
    for (let i = 0; i < day.sections.length; i++) {
      sections.push({ id: day.sections[i].id, title: day.sections[i].title, plannedSec: day.sections[i].plannedSec, text: await plain(key, day, i) });
    }
    const enrol = (await store.list(`class-${key}`, 'enrolment:')).filter((e: any) => e.status === 'active');
    const attendance = await store.list(`class-${key}`, 'attendance:');
    const days = await dayDocs(key);
    const before = days.filter((d: any) => d.index < index);
    const learners = [];
    for (const e of enrol) {
      const k = keyOf(String(e.personId));
      const missed = before.filter((d: any) => !attendance.some((a: any) => keyOf(String(a.personId)) === k && a.dayIndex === d.index)).length;
      const risk = atRisk({ lockedMissedDays: missed, overdueCards: 0, daysSinceCommit: null, lastShiftScorePct: null });
      learners.push({ id: k, name: await nameOf(k), level: risk.level, reasons: risk.reasons });
    }
    const boards = (await store.list(`class-${key}`, 'board:')).filter((b: any) => b.dayIndex === undefined || b.dayIndex === index);
    const notes = (await store.list(`class-${key}`, 'note:')).filter((n: any) => n.dayIndex === undefined || n.dayIndex === index);
    const sub = (await substitutions(key)).find((s: any) => s.dayIndex === index) ?? null;
    return {
      index, date: day.date, className: cls.name ?? key,
      script: { sections, trainerNotes: section(script, /trainer notes/i) },
      boardPages: boards.map((b: any) => ({ id: b.id, title: b.title ?? b.id })),
      quickLearn: dayFile(pkg, index, 'quicklearn'),
      status: { enrolled: enrol.length, present: attendance.filter((a: any) => a.dayIndex === index).length, dayCount: days.length },
      atRisk: learners.filter((l) => l.level !== 'ok'),
      learnerNotes: notes.map((n: any) => ({ id: n.id, text: n.text ?? '' })),
      substitution: sub ? { mode: sub.mode, substituteId: sub.substituteId, substituteName: await nameOf(sub.substituteId), handoverReadAt: sub.handoverReadAt ?? null } : null,
    };
  }

  app.get('/api/tele/classes/:id/handover/:index', async (c: any) => {
    const key = keyOf(c.req.param('id'));
    const index = Number(c.req.param('index'));
    await access(c, key, index);
    if (!isStaff(c)) throw new ctx.http.ApiError(403, { error: { role: 'forbidden' } });
    return c.json(await handoverPack(key, index));
  });

  app.post('/api/tele/classes/:id/handover/:index/read', ctx.guard.role('substitute'), async (c: any) => {
    const key = keyOf(c.req.param('id'));
    const index = Number(c.req.param('index'));
    await access(c, key, index);
    const sub = await store.get(`class-${key}`, `substitution:${index}`);
    if (!sub || !sub.substituteId || keyOf(sub.substituteId) !== personKey(c)) throw new ctx.http.ApiError(403, { error: { class: 'not-assigned' } });
    await store.put(`class-${key}`, { ...sub, handoverReadAt: ctx.clock.now(), updatedAt: ctx.clock.now(), updatedBy: personKey(c) });
    return c.json({ ok: true });
  });

  // ---- self-learn (AI-delivered) ---------------------------------------------------------------------------------
  async function selfLearnDoc(key: string, index: number) {
    return (await store.get(`class-${key}`, `selflearn:${index}`)) ?? {
      type: 'selfLearn', id: `selflearn:${index}`, schema: ctx.schema, dayIndex: index, current: -1, queue: [], quizRan: false,
    };
  }
  async function selfLearnView(key: string, index: number) {
    const day = await store.get(`class-${key}`, `day:${index}`);
    if (!day) throw ctx.http.fieldError('day', 'unknown-day', 404);
    const sub = await store.get(`class-${key}`, `substitution:${index}`);
    const doc = await selfLearnDoc(key, index);
    const sections = [];
    for (let i = 0; i <= doc.current && i < day.sections.length; i++) {
      const s = day.sections[i];
      sections.push({ id: s.id, title: s.title, graded: !!s.graded, text: await plain(key, day, i) });
    }
    return {
      active: sub?.mode === 'self-learn', aiOn: await aiOnFor(key), index, total: day.sections.length, current: doc.current,
      sections, queue: doc.queue ?? [], quizRan: !!doc.quizRan, done: doc.current >= day.sections.length - 1,
    };
  }

  app.get('/api/tele/classes/:id/self-learn/:index', async (c: any) => {
    const key = keyOf(c.req.param('id'));
    await access(c, key);
    return c.json(await selfLearnView(key, Number(c.req.param('index'))));
  });

  app.post('/api/tele/classes/:id/self-learn/next', async (c: any) => {
    const key = keyOf(c.req.param('id'));
    await access(c, key);
    const b = await ctx.http.validateBody(c, nextSchema);
    const sub = await store.get(`class-${key}`, `substitution:${b.dayIndex}`);
    if (sub?.mode !== 'self-learn') throw new ctx.http.ApiError(409, { error: { mode: 'not-self-learn' } });
    const day = await store.get(`class-${key}`, `day:${b.dayIndex}`);
    const doc = await selfLearnDoc(key, b.dayIndex);
    const next = Math.min(doc.current + 1, day.sections.length - 1);
    const sec = day.sections[next];
    // Reaching the section also releases it to learners (D-38): the player stands in for the teleprompter.
    await store.put(`class-${key}`, { ...day, released: [...new Set([...(day.released ?? []), sec.id])], updatedAt: ctx.clock.now(), updatedBy: 'hub:self-learn' });
    // The scripted quiz runs by itself when a graded section is reached.
    await store.put(`class-${key}`, { ...doc, current: next, quizRan: !!doc.quizRan || !!sec.graded, updatedAt: ctx.clock.now(), updatedBy: 'hub:self-learn' });
    return c.json(await selfLearnView(key, b.dayIndex));
  });

  app.post('/api/tele/classes/:id/self-learn/:index/ask', async (c: any) => {
    const key = keyOf(c.req.param('id'));
    await access(c, key);
    const index = Number(c.req.param('index'));
    const b = await ctx.http.validateBody(c, askSchema);
    const doc = await selfLearnDoc(key, index);
    // No connected model answers here: the question is queued for the trainer (SPEC 6.3, AC-151).
    const queue = [...(doc.queue ?? []), { text: b.text, by: personKey(c), at: ctx.clock.now() }];
    await store.put(`class-${key}`, { ...doc, queue, updatedAt: ctx.clock.now(), updatedBy: personKey(c) });
    return c.json({ queued: true, answered: false, aiOn: await aiOnFor(key), queue });
  });

  // ---- delivery report (who taught) ------------------------------------------------------------------------------
  app.get('/api/tele/classes/:id/reports', ctx.guard.role('trainer', 'coordinator'), async (c: any) => {
    const key = keyOf(c.req.param('id'));
    await access(c, key);
    const cls = await getClass(key);
    const subs = await substitutions(key);
    const trainer = await nameOf((cls.trainerIds ?? [])[0] ?? null);
    const rows = [];
    for (const d of await dayDocs(key)) {
      const s = subs.find((x: any) => x.dayIndex === d.index);
      const sl = await store.get(`class-${key}`, `selflearn:${d.index}`);
      rows.push({
        dayIndex: d.index, date: d.date,
        taughtBy: s ? (s.mode === 'self-learn' ? 'AI-delivered' : await nameOf(s.substituteId)) : trainer,
        mode: s ? (s.mode === 'self-learn' ? 'AI-delivered' : 'substitute') : 'trainer',
        handoverRead: s?.mode === 'substitute' ? !!s.handoverReadAt : null,
        queuedQuestions: (sl?.queue ?? []).length,
      });
    }
    return c.json({ reports: rows });
  });

  // ---- trainer pack (A-11) and package library (E-5) -------------------------------------------------------------
  app.get('/api/tele/classes/:id/pack/:index', async (c: any) => {
    const key = keyOf(c.req.param('id'));
    const index = Number(c.req.param('index'));
    await access(c, key, index);
    if (!isStaff(c)) throw new ctx.http.ApiError(403, { error: { role: 'forbidden' } });
    const pkg = await packageOf(key);
    const script = dayFile(pkg, index, 'instructor_script');
    const deck = recallFile(pkg, index).split('\n').reduce((acc: any[], line: string) => {
      const h = /^##\s+(.+)$/.exec(line);
      if (h) acc.push({ front: h[1].trim(), back: '' });
      const a = /\*\*The answer[^*]*\*\*:?\s*(.*)$/.exec(line);
      if (a && acc.length) acc[acc.length - 1].back = a[1].trim();
      return acc;
    }, []);
    const notes = section(script, /trainer notes/i);
    const likely = notes.split('\n').map((l) => l.trim()).filter((l) => l !== '');
    const cmds = [...new Set([...commandsOf(script), ...commandsOf(dayFile(pkg, index, 'deepdive'))])];
    return c.json({
      index, hasPackage: !!pkg, deck, cheatSheet: dayFile(pkg, index, 'printable_handout'), commands: cmds, likelyQuestions: likely,
    });
  });

  app.get('/api/tele/library', ctx.guard.role('trainer', 'coordinator'), async (c: any) => {
    const pkgs = await store.list(priv, 'package:');
    const rehearsals: any[] = [];
    for (const key of await classKeys()) rehearsals.push(...(await store.list(`class-${key}`, 'rehearsal:')).map((r: any) => ({ ...r, classId: key })));
    const out = [];
    for (const p of pkgs.sort((a: any, b: any) => (a.createdAt ?? 0) - (b.createdAt ?? 0))) {
      const files: Record<string, string> = p.files ?? {};
      const readme = files['README.md'] ?? '';
      const title = /^#\s+(.+)$/m.exec(readme)?.[1] ?? keyOf(p.id);
      const version = /version[:\s*]+v?(\d+(?:\.\d+)*)/i.exec(readme)?.[1] ?? '1';
      out.push({
        id: keyOf(p.id), title, version, status: p.status, classId: p.classId ?? null,
        publishedAt: p.publishedAt ?? null, createdAt: p.createdAt ?? null,
        days: new Set(Object.keys(files).map((f) => /day0*(\d+)\//.exec(f)?.[1]).filter(Boolean)).size,
        rehearsals: rehearsals.filter((r) => !p.classId || r.classId === p.classId)
          .map((r) => ({ id: r.id, dayIndex: r.dayIndex, at: r.at, behindSec: r.behindSec })),
      });
    }
    return c.json({ packages: out });
  });

  // ---- rehearsal (A-9, A-10, E-3) --------------------------------------------------------------------------------
  // Freshness of the day's lab commands: an offline rule, not a network check. A command is `ok` when its tool and
  // sub-command also appear in another file of the package (lab and lesson agree); otherwise `stale`.
  app.get('/api/tele/classes/:id/freshness/:index', ctx.guard.role('trainer', 'substitute'), async (c: any) => {
    const key = keyOf(c.req.param('id'));
    const index = Number(c.req.param('index'));
    const pkg = await packageOf(key);
    const files: Record<string, string> = pkg?.files ?? {};
    const own = [dayFile(pkg, index, 'instructor_script'), dayFile(pkg, index, 'deepdive')];
    const cmds = [...new Set(own.flatMap(commandsOf))];
    const results = cmds.map((cmd) => {
      const head = cmd.split(/\s+/).slice(0, 2).join(' ');
      const others = Object.values(files).filter((txt) => !own.includes(txt) && txt.includes(head)).length;
      const here = own.filter((t) => t.includes(head)).length;
      return { command: cmd, state: others + here >= 2 ? 'ok' : 'stale' };
    });
    const overall = !results.length ? 'not checked' : results.every((r) => r.state === 'ok') ? 'ok' : 'stale';
    return c.json({ overall, results, checkedAt: ctx.clock.now() });
  });

  app.post('/api/tele/classes/:id/rehearsals', ctx.guard.role('trainer'), async (c: any) => {
    const key = keyOf(c.req.param('id'));
    await access(c, key);
    const b = await ctx.http.validateBody(c, rehearsalSchema);
    const { id: given, ...rest } = b;
    const prev = given && String(given).startsWith('rehearsal:') ? await store.get(`class-${key}`, given) : null;
    const id = prev ? given! : `rehearsal:${ctx.ids.randomKey()}`;
    await store.put(`class-${key}`, { ...(prev ?? {}), type: 'rehearsal', id, schema: ctx.schema, updatedAt: ctx.clock.now(), updatedBy: personKey(c), at: prev?.at ?? ctx.clock.now(), by: personKey(c), ...rest });
    return c.json({ ok: true, id });
  });

  app.get('/api/tele/classes/:id/rehearsals', ctx.guard.role('trainer'), async (c: any) => {
    const key = keyOf(c.req.param('id'));
    await access(c, key);
    return c.json({ rehearsals: (await store.list(`class-${key}`, 'rehearsal:')).sort((a: any, b: any) => b.at - a.at) });
  });
}
