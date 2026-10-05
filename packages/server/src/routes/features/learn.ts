// Server routes for the web feature group "learn": catch-up gate, diagnostics, quick-learn text, daily cards,
// error notebook, exit tickets, explain-it-back and the first-run phone-only start.
// Uses ctx only (routes/index.ts). Decisions come from core: catchUpState, reviewCard/dueCards, tallyExitTickets,
// checkExplanation, parsePackage.
import { z } from 'zod';
import { catchUpState } from '../../../../core/src/catchup.ts';
import { reviewCard, dueCards } from '../../../../core/src/cards.ts';
import { tallyExitTickets } from '../../../../core/src/faq.ts';
import { checkExplanation } from '../../../../core/src/explain.ts';
import { parsePackage } from '../../../../core/src/gate.ts';

const IST_MS = 5.5 * 3600 * 1000;
const norm = (s: string): string[] => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);

// A free-text answer is right when every word of the key appears in it (so an exact answer, or the key inside a
// longer sentence, passes; a shorter or different answer does not).
export function answerMatches(given: string, key: string): boolean {
  const g = new Set(norm(given));
  const k = norm(key);
  return g.size > 0 && k.length > 0 && k.every((w) => g.has(w));
}

export function register(app: any, ctx: any): void {
  const { store, ids, http } = ctx;
  const L = ctx.guard.role('learner');

  const classKeys = (): string[] => store.names().filter((n: string) => n.startsWith('class-')).map((n: string) => n.slice(6));

  async function enrolmentOf(db: string, personKey: string) {
    return (await store.list(db, 'enrolment:')).find((e: any) => ids.keyOf(String(e.personId ?? e.id)) === personKey) ?? null;
  }

  // The class a signed-in person works in: trainer lists, learner enrolled, else (staff only) the first class.
  async function myClass(c: any) {
    const s = c.get('session');
    const me = ids.keyOf(s.personId);
    const keys = classKeys();
    for (const key of keys) {
      const doc = await store.get(`class-${key}`, `class:${key}`);
      if (!doc) continue;
      if ((doc.trainerIds ?? []).map((x: string) => ids.keyOf(x)).includes(me)) return { key, db: `class-${key}`, doc };
      const en = await enrolmentOf(`class-${key}`, me);
      if (en && en.status !== 'dropped') return { key, db: `class-${key}`, doc };
    }
    if (!s.roles.includes('learner') || s.roles.includes('admin')) {
      for (const key of keys) {
        const doc = await store.get(`class-${key}`, `class:${key}`);
        if (doc) return { key, db: `class-${key}`, doc };
      }
    }
    throw http.fieldError('class', 'none', 404);
  }

  // Class days in order: the schedule decides how many there are; package days add content.
  async function dayCount(db: string, doc: any): Promise<number> {
    const docs = await store.list(db, 'day:');
    return Math.max((doc.schedule ?? []).length, ...docs.map((d: any) => d.index + 1), 0);
  }

  async function todayIndex(db: string, doc: any, now: number): Promise<number> {
    const today = new Date(now + IST_MS).toISOString().slice(0, 10);
    const dates: (string | null)[] = (doc.schedule ?? []).map((d: any) => d?.date ?? null);
    if (!dates.some(Boolean)) {
      for (const d of await store.list(db, 'day:')) dates[d.index] = d.date ?? null;
    }
    let idx = 0;
    dates.forEach((d, i) => { if (d && String(d) <= today) idx = i; });
    return idx;
  }

  async function dayDoc(db: string, index: number) {
    return (await store.list(db, 'day:')).find((d: any) => d.index === index) ?? null;
  }

  async function pkgFiles(classKey: string): Promise<Record<string, string> | null> {
    const pkgs = (await store.list(store.priv, 'package:')).filter((p: any) => p.status === 'published' && p.classId === classKey);
    return pkgs.length ? pkgs[pkgs.length - 1].files : null;
  }

  async function pkgDay(classKey: string, index: number) {
    const files = await pkgFiles(classKey);
    if (!files) return null;
    return parsePackage(files).days.find((d: any) => d.index === index) ?? null;
  }

  async function bestScores(db: string, personKey: string): Promise<Record<number, number>> {
    const best: Record<number, number> = {};
    for (const a of await store.list(db, 'attempt:')) {
      if (ids.keyOf(a.personId ?? '') !== personKey) continue;
      const m = /^day(\d+):diag/.exec(String(a.itemId ?? ''));
      if (!m) continue;
      best[+m[1]] = Math.max(best[+m[1]] ?? 0, Number(a.score ?? 0));
    }
    return best;
  }

  async function catchup(c: any) {
    const me = ids.keyOf(c.get('session').personId);
    const { db, doc } = await myClass(c);
    const n = await dayCount(db, doc);
    const today = await todayIndex(db, doc, ctx.clock.now());
    const dayIds = Array.from({ length: n }, (_, i) => `day:${i}`);
    const attended = (await store.list(db, 'attendance:')).filter((a: any) => ids.keyOf(a.personId) === me).map((a: any) => `day:${a.dayIndex}`);
    const best = await bestScores(db, me);
    const passMark = doc.passMark ?? 6;
    const st = catchUpState({
      dayIds, todayIndex: today, attended,
      bestScores: Object.fromEntries(Object.entries(best).map(([i, v]) => [`day:${i}`, v])), passMark,
    });
    const days = dayIds.map((id, i) => ({
      index: i,
      state: st.missed.includes(id) ? (st.unlocked.includes(id) ? 'unlocked' : 'locked') : i === today ? 'today' : i < today ? 'attended' : 'upcoming',
      best: best[i] ?? null,
    }));
    return { today, passMark, days, nextGate: st.nextGate === null ? null : Number(st.nextGate.split(':')[1]), selfStudyBlocked: st.selfStudyBlocked };
  }

  app.get('/api/learn/catchup', L, async (c: any) => c.json(await catchup(c)));

  // The day's diagnostic questions (no answers). Only today and earlier days can be taken.
  app.get('/api/learn/diagnostic', L, async (c: any) => {
    const { key, db, doc } = await myClass(c);
    const today = await todayIndex(db, doc, ctx.clock.now());
    const day = Number(c.req.query('day') ?? today);
    if (!Number.isInteger(day) || day < 0 || day > today) throw http.fieldError('day', 'invalid');
    const pd = await pkgDay(key, day);
    if (!pd || !pd.questions.length) throw http.fieldError('day', 'no-diagnostic', 404);
    return c.json({ day, questions: pd.questions.map((q: any, i: number) => ({ n: i + 1, text: q.text })) });
  });

  const diagSchema = z.object({ day: z.number().int().min(0), answers: z.array(z.object({ n: z.number().int(), answer: z.string() })) });
  app.post('/api/learn/diagnostic', L, async (c: any) => {
    const b = await http.validateBody(c, diagSchema);
    const me = ids.keyOf(c.get('session').personId);
    const { key, db, doc } = await myClass(c);
    const now = ctx.clock.now();
    const today = await todayIndex(db, doc, now);
    if (b.day > today) throw http.fieldError('day', 'invalid');
    const pd = await pkgDay(key, b.day);
    if (!pd || !pd.questions.length) throw http.fieldError('day', 'no-diagnostic', 404);
    const given = new Map<number, string>(b.answers.map((a: any) => [a.n, a.answer]));
    const rows = pd.questions.map((q: any, i: number) => {
      const g = given.get(i + 1) ?? '';
      return { n: i + 1, itemId: `day${b.day}:diag:${i + 1}`, given: g, correct: answerMatches(g, q.answer), q };
    });
    const score = rows.filter((r: any) => r.correct).length;
    await store.put(db, {
      type: 'attempt', id: `attempt:${ids.randomKey()}`, schema: ctx.schema, updatedAt: now, updatedBy: me,
      personId: `person:${me}`, itemId: `day${b.day}:diag`, seed: `diag-${key}-${me}-${b.day}`, mode: 'recorded',
      answers: rows.map((r: any) => ({ itemId: r.itemId, given: r.given, correct: r.correct })), score, max: pd.questions.length,
      timing: { durationMs: 0, flags: [] }, aiPolicy: 'closed', aiUsage: [],
    });
    // Wrong answers go to the learner's error notebook (replaced on each try so a retry does not pile up).
    const pdb = `person-${me}`;
    for (const old of await store.list(pdb, `errorNote:diag${b.day}:`)) await store.remove(pdb, old.id);
    for (const r of rows.filter((x: any) => !x.correct)) {
      await store.put(pdb, {
        type: 'errorNote', id: `errorNote:diag${b.day}:${r.n}`, schema: ctx.schema, updatedAt: now, updatedBy: me,
        dayIndex: b.day, subtopic: 'Diagnostic', question: r.q.text, given: r.given, correct: r.q.answer,
      });
    }
    return c.json({ score, max: pd.questions.length, passed: score >= (doc.passMark ?? 6), state: await catchup(c) });
  });

  // Quick-learn text of a day, for reading aloud (the answer key is cut off, the diagnostic questions stay).
  app.get('/api/learn/quick-learn', L, async (c: any) => {
    const { key, db, doc } = await myClass(c);
    const today = await todayIndex(db, doc, ctx.clock.now());
    const files = await pkgFiles(key);
    if (!files) throw http.fieldError('day', 'no-content', 404);
    const days = parsePackage(files).days.map((d: any) => d.index).sort((a: number, b: number) => a - b);
    const asked = c.req.query('day');
    const day = asked !== undefined ? Number(asked) : (days.filter((d: number) => d <= today).pop() ?? days[0]);
    const re = new RegExp(`(^|/)(day0*${day}/quicklearn\\.md|quicklearn_day0*${day}\\.md)$`);
    const path = Object.keys(files).find((p) => re.test(p));
    if (!path || (asked !== undefined && day > today)) throw http.fieldError('day', 'no-content', 404);
    let md = files[path];
    const cut = md.search(/^#{1,6}\s.*answer key/im);
    if (cut >= 0) md = md.slice(0, cut);
    const text = md
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s*(.*)$/gm, '$1.')
      .replace(/[*_`>|]/g, '')
      .replace(/^\s*[-+]\s+/gm, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return c.json({ day, text });
  });

  // ---- Cards (SPEC §4.2): card documents live in the learner's personal database, FSRS state in `fsrs`.
  const asCard = (d: any) => ({ ...d.fsrs, id: d.id, due: Number(d.fsrs?.due ?? 0), reps: Number(d.fsrs?.reps ?? 0) });

  app.get('/api/learn/cards', L, async (c: any) => {
    const me = ids.keyOf(c.get('session').personId);
    const docs = await store.list(`person-${me}`, 'card:');
    const byId = new Map<string, any>(docs.map((d: any) => [d.id, d]));
    const due = dueCards(docs.map(asCard), ctx.clock.now());
    return c.json({
      due: due.length, total: docs.length,
      cards: due.map((x: any) => { const d = byId.get(x.id); return { id: d.id, deck: d.deck ?? '', front: d.front, back: d.back }; }),
    });
  });

  const reviewSchema = z.object({ id: z.string().min(1), rating: z.enum(['again', 'hard', 'good', 'easy']) });
  app.post('/api/learn/cards/review', L, async (c: any) => {
    const b = await http.validateBody(c, reviewSchema);
    const me = ids.keyOf(c.get('session').personId);
    const db = `person-${me}`;
    const d = await store.get(db, b.id);
    if (!d || d.type !== 'card') throw http.fieldError('id', 'unknown-card', 404);
    const now = ctx.clock.now();
    const next: any = reviewCard(asCard(d), b.rating, now);
    const { id: _id, ...rest } = next;
    const lr = rest.last_review;
    await store.put(db, { ...d, fsrs: { ...rest, due: next.due, last_review: lr instanceof Date ? lr.getTime() : lr ?? null }, updatedAt: now, updatedBy: me });
    const docs = await store.list(db, 'card:');
    return c.json({ ok: true, due: dueCards(docs.map(asCard), now).length });
  });

  // ---- Error notebook: the learner's own wrong answers, grouped by subtopic.
  app.get('/api/learn/errors', L, async (c: any) => {
    const me = ids.keyOf(c.get('session').personId);
    const notes = (await store.list(`person-${me}`, 'errorNote:')).sort((a: any, b: any) => a.dayIndex - b.dayIndex);
    const groups = new Map<string, any[]>();
    for (const n of notes) {
      const g = groups.get(n.subtopic ?? '') ?? [];
      g.push({ day: n.dayIndex, question: n.question, given: n.given, correct: n.correct });
      groups.set(n.subtopic ?? '', g);
    }
    return c.json({ subtopics: [...groups].map(([subtopic, items]) => ({ subtopic, items })) });
  });

  // ---- Exit ticket (SPEC §4.19). Choices are generated from the day's sections plus three fixed ones.
  async function ticketDay(db: string, doc: any, now: number): Promise<number> {
    const today = await todayIndex(db, doc, now);
    const withContent = (await store.list(db, 'day:')).filter((d: any) => (d.sections ?? []).length > 0).map((d: any) => d.index).sort((a: number, b: number) => a - b);
    return withContent.filter((i: number) => i <= today).pop() ?? withContent[0] ?? today;
  }

  async function ticketChoices(db: string, day: number) {
    const dd = await dayDoc(db, day);
    const choices = (dd?.sections ?? []).map((sec: any) => ({ id: `unclear:${sec.id}`, kind: 'unclear', title: String(sec.title ?? sec.id) }));
    choices.push({ id: 'pace-fast', kind: 'fast', title: '' }, { id: 'pace-slow', kind: 'slow', title: '' }, { id: 'all-clear', kind: 'clear', title: '' });
    return choices;
  }

  app.get('/api/learn/exit-ticket', ctx.guard.role('learner', 'trainer', 'substitute'), async (c: any) => {
    const s = c.get('session');
    const { db, doc } = await myClass(c);
    const day = await ticketDay(db, doc, ctx.clock.now());
    const choices = await ticketChoices(db, day);
    const tickets = (await store.list(db, 'exitTicket:')).filter((x: any) => x.dayIndex === day);
    const counts = new Map<string, number>(tallyExitTickets(tickets).map((t) => [t.choiceId, t.count]));
    const me = ids.keyOf(s.personId);
    const staff = s.roles.some((r: string) => r === 'trainer' || r === 'substitute' || r === 'admin');
    return c.json({
      day, choices: choices.map((ch: any) => ({ ...ch, count: counts.get(ch.id) ?? 0 })),
      submitted: tickets.some((x: any) => ids.keyOf(x.personId) === me), total: tickets.length,
      comments: staff ? tickets.filter((x: any) => x.text).map((x: any) => x.text) : [],
    });
  });

  const ticketSchema = z.object({ choiceIds: z.array(z.string()).max(30), text: z.string().max(2000).optional() });
  app.post('/api/learn/exit-ticket', L, async (c: any) => {
    const b = await http.validateBody(c, ticketSchema);
    const me = ids.keyOf(c.get('session').personId);
    const { db, doc } = await myClass(c);
    const now = ctx.clock.now();
    const day = await ticketDay(db, doc, now);
    const valid = new Set((await ticketChoices(db, day)).map((x: any) => x.id));
    const choiceIds = [...new Set<string>(b.choiceIds)].filter((x) => valid.has(x));
    await store.put(db, {
      type: 'exitTicket', id: `exitTicket:${me}:${day}`, schema: ctx.schema, updatedAt: now, updatedBy: me,
      personId: `person:${me}`, dayIndex: day, choiceIds, text: b.text?.trim() || undefined,
    });
    return c.json({ ok: true, day });
  });

  // ---- Explain-it-back with AI off: the offline checklist (SPEC §4.17).
  const explainSchema = z.object({ text: z.string().min(1).max(10000) });
  app.post('/api/learn/explain', L, async (c: any) => {
    const b = await http.validateBody(c, explainSchema);
    const { db, doc } = await myClass(c);
    const day = Number(c.req.query('day') ?? (await todayIndex(db, doc, ctx.clock.now())));
    const all = (await store.list(db, 'checklist:')).sort((a: any, b2: any) => a.dayIndex - b2.dayIndex);
    const list = all.filter((x: any) => x.dayIndex === day).pop() ?? all.filter((x: any) => x.dayIndex <= day).pop() ?? all[0];
    if (!list) throw http.fieldError('day', 'no-checklist', 404);
    const label = (x: any) => String(x.label ?? x.id);
    const r = checkExplanation(b.text, {
      concepts: (list.concepts ?? []).map((x: any) => ({ id: label(x), anyOf: x.anyOf ?? [] })),
      misconceptions: (list.misconceptions ?? []).map((x: any) => ({ id: label(x), anyOf: x.anyOf ?? [] })),
    });
    return c.json({ day: list.dayIndex, ...r });
  });

  // ---- First run, "use on this phone only": a learner with no class, signed in on this device.
  // Public like the join routes (no session yet); the person can do nothing class-related without an enrolment.
  app.post('/api/join/phone-only', async (c: any) => {
    const key = ids.randomKey();
    const now = ctx.clock.now();
    const tnc = await ctx.people.currentTnc(ctx);
    await ctx.people.savePerson(ctx, key, { name: 'Phone learner', roles: ['learner'], minor: false, profile: 'phone', tnc: { version: tnc.version, acceptedAt: now } });
    store.db(`person-${key}`);
    ctx.sessions.create(c, { personId: key, roles: ['learner'] });
    return c.json({ personId: key, roles: ['learner'] }, 201);
  });
}
