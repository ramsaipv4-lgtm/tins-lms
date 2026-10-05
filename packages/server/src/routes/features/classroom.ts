// Server routes for the web feature group "classroom": appeals, doubts, drop switch, accommodations,
// item analysis, misconception suggestions and package diff (SPEC 4.11, 4.21, 4.26, 4.30, 5.7; AC-88, 91, 152, 153, 166).
// Everything lives under /api/classroom/* (plus /api/admin/classroom/* for admin-only screens) so it never
// collides with routes owned by other groups. Uses ctx only (see routes/index.ts).
import { z } from 'zod';
import { openAppeal, appealStep, appealTick } from '../../../../core/src/appeal.ts';
import { appendEntry } from '../../../../core/src/ledger.ts';
import { dropPlan, undoDropPlan } from '../../../../core/src/drop.ts';
import { itemAnalysis } from '../../../../core/src/items.ts';
import { effectiveLimitMs } from '../../../../core/src/timing.ts';
import { parsePackage } from '../../../../core/src/gate.ts';
import { tarUnpack } from '../../../../core/src/export.ts';

const dec = (b: Uint8Array): string => new TextDecoder().decode(b);
const GENERIC_WRONG = new Set(['', 'not sure', "don't know", 'dont know', 'idk', 'no idea', 'skip']);

export function register(app: any, ctx: any): void {
  const { store, ids, http } = ctx;
  const T = ctx.guard.role('trainer');
  const TS = ctx.guard.role('trainer', 'substitute');
  const L = ctx.guard.role('learner');
  const A = ctx.guard.role('admin');
  const AUTH = ctx.guard.auth;

  const classKeys = (): string[] => store.names().filter((n: string) => n.startsWith('class-')).map((n: string) => n.slice(6));
  // A dropped learner's enrolment is parked under `droppedEnrolment:` so the attendance roll (which lists
  // `enrolment:` documents) no longer shows them; undo moves it back (AC-152).
  const enrolmentOf = async (db: string, personKey: string) => {
    for (const prefix of ['enrolment:', 'droppedEnrolment:']) {
      const e = (await store.list(db, prefix)).find((x: any) => ids.keyOf(String(x.personId ?? x.id)) === personKey);
      if (e) return e;
    }
    return null;
  };

  // The class a signed-in person works in: trainer lists, learner enrolled, else the first class.
  async function myClass(c: any) {
    const me = ids.keyOf(c.get('session').personId);
    const docs: { key: string; doc: any }[] = [];
    for (const key of classKeys()) {
      const doc = await store.get(`class-${key}`, `class:${key}`);
      if (doc) docs.push({ key, doc });
    }
    for (const { key, doc } of docs) {
      if ((doc.trainerIds ?? []).some((x: string) => ids.keyOf(x) === me)) return { key, db: `class-${key}`, doc };
      if (await enrolmentOf(`class-${key}`, me)) return { key, db: `class-${key}`, doc };
    }
    if (docs[0]) return { key: docs[0].key, db: `class-${docs[0].key}`, doc: docs[0].doc };
    throw http.fieldError('class', 'none', 404);
  }

  const nameOf = async (personId: string): Promise<string> => {
    const p = await store.get('org', `person:${ids.keyOf(personId)}`);
    return p?.name || ids.keyOf(personId);
  };

  app.get('/api/classroom/context', AUTH, async (c: any) => {
    const { key, doc } = await myClass(c);
    return c.json({ classId: key, className: doc.name ?? key });
  });

  // Is the signed-in learner dropped from a class? (shown as a notice on every screen)
  app.get('/api/classroom/my-status', L, async (c: any) => {
    const me = ids.keyOf(c.get('session').personId);
    for (const key of classKeys()) {
      const e = (await store.list(`class-${key}`, 'droppedEnrolment:')).find((x: any) => ids.keyOf(String(x.personId ?? x.id)) === me);
      if (e) return c.json({ dropped: true, classId: key });
    }
    return c.json({ dropped: false });
  });

  // ---- AC-88 Appeals -------------------------------------------------------------------------
  const unreadOf = (a: any): number =>
    (Array.isArray(a?.aiUsage) ? a.aiUsage : []).filter((e: any) => e && typeof e === 'object' && e.confirmed === true && e.read !== true).length
    + (typeof a?.unreadConfirmations === 'number' ? a.unreadConfirmations : 0);

  // The learner's published grades with the score history (ledger) and the appeal state.
  app.get('/api/classroom/grades', L, async (c: any) => {
    const { key, db } = await myClass(c);
    const me = ids.keyOf(c.get('session').personId);
    const out: any[] = [];
    for (const a of await store.list(db, 'attempt:')) {
      if (ids.keyOf(a.personId) !== me || typeof a.score !== 'number') continue;
      const attemptKey = ids.keyOf(a.id);
      const ledger = await store.get(db, `ledger:attempt-${attemptKey}`);
      const appeal = await store.get(db, `appeal:${attemptKey}`);
      const history = (ledger?.entries ?? []).map((e: any) => ({ score: e.value, at: e.at, by: e.by, reason: e.reason ?? null, corrects: e.corrects ?? null }));
      if (!history.length) history.push({ score: a.originalScore ?? a.score, at: a.publishedAt ?? a.updatedAt, by: 'hub', reason: null, corrects: null });
      out.push({
        attemptId: attemptKey, itemId: a.itemId, score: a.score, max: a.max ?? null, mode: a.mode, publishedAt: a.publishedAt ?? null,
        history, appeal: appeal ? { state: appeal.state, reason: appeal.reason ?? null } : null,
      });
    }
    return c.json({ classId: key, grades: out.sort((x, y) => String(x.itemId).localeCompare(String(y.itemId))) });
  });

  const appealBody = z.object({ attemptId: z.string().min(1, 'required'), reason: z.string().min(1, 'required') });
  app.post('/api/classroom/appeals', L, async (c: any) => {
    const b = await http.validateBody(c, appealBody);
    const { db } = await myClass(c);
    const s = c.get('session');
    const attemptKey = ids.keyOf(b.attemptId);
    const attempt = await store.get(db, `attempt:${attemptKey}`);
    if (!attempt || ids.keyOf(attempt.personId) !== ids.keyOf(s.personId)) throw http.fieldError('attemptId', 'unknown', 404);
    if (await store.get(db, `appeal:${attemptKey}`)) throw http.fieldError('attemptId', 'already-appealed', 409);
    const now = ctx.clock.now();
    const r = openAppeal({ id: attemptKey, publishedAt: attempt.publishedAt ?? attempt.submittedAt ?? attempt.updatedAt, unreadConfirmations: unreadOf(attempt) }, now);
    if (!r.ok) throw http.fieldError('attemptId', r.reason, 409);
    await store.put(db, {
      type: 'appeal', id: `appeal:${attemptKey}`, schema: ctx.schema, attemptId: attemptKey, personId: s.personId, learnerReason: b.reason,
      state: r.appeal.state, reason: r.appeal.reason, openedAt: r.appeal.openedAt, history: r.appeal.history,
      updatedAt: now, updatedBy: s.personId,
    });
    return c.json({ id: attemptKey, state: r.appeal.state }, 201);
  });

  // Trainer inbox: each appeal with its evidence pack and the attempt's score.
  app.get('/api/classroom/appeals', TS, async (c: any) => {
    const { db } = await myClass(c);
    const now = ctx.clock.now();
    const out: any[] = [];
    for (const raw of await store.list(db, 'appeal:')) {
      const ticked = appealTick({ state: raw.state, reason: raw.reason, openedAt: raw.openedAt, history: raw.history ?? [] }, now);
      const a = ticked.state !== raw.state ? { ...raw, ...ticked } : raw;
      if (ticked.state !== raw.state) await store.put(db, { ...a, updatedAt: now, updatedBy: 'hub:appeal-tick' });
      const attempt = await store.get(db, `attempt:${a.attemptId}`);
      const integrity = (await store.list(db, 'integrity:')).filter((e: any) => e.personId === a.personId);
      out.push({
        attemptId: a.attemptId, personId: a.personId, name: await nameOf(a.personId), state: a.state, reason: a.reason ?? null,
        learnerReason: a.learnerReason ?? '', openedAt: a.openedAt, history: a.history ?? [],
        itemId: attempt?.itemId ?? null, score: attempt?.score ?? null, max: attempt?.max ?? null,
        evidence: {
          seed: attempt?.seed ?? null, mode: attempt?.mode ?? null,
          events: [...(Array.isArray(attempt?.aiUsage) ? attempt.aiUsage : []), ...integrity.map((e: any) => ({ context: e.context, kind: e.kind, at: e.at }))],
          rubricRows: attempt?.rubricRows ?? [], unreadConfirmations: unreadOf(attempt),
        },
      });
    }
    return c.json({ appeals: out.sort((x, y) => x.openedAt - y.openedAt) });
  });

  const decideBody = z.object({
    kind: z.enum(['uphold', 'reject', 'escalate', 'decide-final']),
    outcome: z.enum(['uphold', 'reject']).optional(),
    correctedScore: z.number().finite().min(0).optional(),
    reason: z.string().optional(),
  });
  app.post('/api/classroom/appeals/:attemptId/decide', T, async (c: any) => {
    const b = await http.validateBody(c, decideBody);
    const { db } = await myClass(c);
    const s = c.get('session');
    const attemptKey = ids.keyOf(c.req.param('attemptId'));
    const raw = await store.get(db, `appeal:${attemptKey}`);
    if (!raw) throw http.fieldError('attemptId', 'unknown', 404);
    const now = ctx.clock.now();
    const next = appealStep({ state: raw.state, reason: raw.reason, openedAt: raw.openedAt, history: raw.history ?? [] },
      { kind: b.kind, by: s.personId, at: now, outcome: b.outcome });
    await store.put(db, { ...raw, state: next.state, reason: next.reason, history: next.history, updatedAt: now, updatedBy: s.personId });

    const upholding = (b.kind === 'uphold' || (b.kind === 'decide-final' && b.outcome === 'uphold')) && typeof b.correctedScore === 'number';
    if (upholding) {
      // Correction keeps the original ledger entry (P-10): if the attempt was never signed off, record the original first.
      const attempt = await store.get(db, `attempt:${attemptKey}`);
      const ledgerId = `ledger:attempt-${attemptKey}`;
      const prev = await store.get(db, ledgerId);
      let entries = prev?.entries ?? [];
      if (!entries.length && attempt) {
        entries = await appendEntry(entries, { subject: `attempt:${attemptKey}`, value: attempt.score, by: attempt.updatedBy ?? 'hub', at: attempt.publishedAt ?? attempt.updatedAt ?? now, reason: 'published score' });
      }
      entries = await appendEntry(entries, {
        subject: `attempt:${attemptKey}`, value: b.correctedScore, by: s.personId, at: now,
        reason: b.reason ?? 'appeal upheld', ...(entries.length ? { corrects: entries[entries.length - 1].seq } : {}),
      });
      await store.put(db, { type: 'ledger', id: ledgerId, schema: ctx.schema, subject: `attempt:${attemptKey}`, entries, updatedAt: now, updatedBy: s.personId });
      if (attempt) await store.put(db, { ...attempt, originalScore: attempt.originalScore ?? attempt.score, score: b.correctedScore, updatedAt: now, updatedBy: s.personId });
    }
    return c.json({ ok: true, state: next.state });
  });

  // ---- AC-91 Doubts --------------------------------------------------------------------------
  const doubtBody = z.object({ text: z.string().trim().min(1, 'required'), anonymous: z.boolean().optional() });

  async function doubtsView(c: any) {
    const { db } = await myClass(c);
    const me = c.get('session').personId;
    const rows: any[] = [];
    for (const d of await store.list(db, 'doubt:')) {
      const anonymous = !d.personId;
      rows.push({
        id: ids.keyOf(d.id), text: d.text, votes: (d.votes ?? []).length, answered: !!d.answered, anonymous,
        author: anonymous ? null : await nameOf(d.personId), mine: !!d.personId && ids.keyOf(d.personId) === ids.keyOf(me),
        voted: (d.votes ?? []).some((v: string) => ids.keyOf(v) === ids.keyOf(me)), createdAt: d.createdAt ?? d.updatedAt,
      });
    }
    return rows.sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt);
  }

  app.get('/api/classroom/doubts', AUTH, async (c: any) => c.json({ doubts: await doubtsView(c) }));

  app.post('/api/classroom/doubts', L, async (c: any) => {
    const b = await http.validateBody(c, doubtBody);
    const { db } = await myClass(c);
    const s = c.get('session');
    const now = ctx.clock.now();
    const key = ids.randomKey();
    await store.put(db, {
      type: 'doubt', id: `doubt:${key}`, schema: ctx.schema, personId: b.anonymous ? null : s.personId, text: b.text,
      votes: [], answered: false, createdAt: now, updatedAt: now, updatedBy: b.anonymous ? 'anonymous' : s.personId,
    });
    return c.json({ id: key }, 201);
  });

  app.post('/api/classroom/doubts/:id/upvote', L, async (c: any) => {
    const { db } = await myClass(c);
    const s = c.get('session');
    const d = await store.get(db, `doubt:${ids.keyOf(c.req.param('id'))}`);
    if (!d) throw http.fieldError('id', 'unknown', 404);
    const votes: string[] = d.votes ?? [];
    if (!votes.some((v) => ids.keyOf(v) === ids.keyOf(s.personId))) votes.push(s.personId);
    await store.put(db, { ...d, votes, updatedAt: ctx.clock.now() });
    return c.json({ votes: votes.length });
  });

  app.post('/api/classroom/doubts/:id/answered', T, async (c: any) => {
    const { db } = await myClass(c);
    const d = await store.get(db, `doubt:${ids.keyOf(c.req.param('id'))}`);
    if (!d) throw http.fieldError('id', 'unknown', 404);
    await store.put(db, { ...d, answered: true, updatedAt: ctx.clock.now(), updatedBy: c.get('session').personId });
    return c.json({ ok: true });
  });

  // ---- AC-152 Drop switch --------------------------------------------------------------------
  async function classState(db: string, doc: any) {
    return { tickets: await store.list(db, 'ticket:'), reviews: await store.list(db, 'review:'), teams: doc.teams ?? {} };
  }

  app.get('/api/classroom/roster', TS, async (c: any) => {
    const { db, doc } = await myClass(c);
    const att = await store.list(db, 'attendance:');
    const rows: any[] = [];
    for (const e of [...await store.list(db, 'enrolment:'), ...await store.list(db, 'droppedEnrolment:')]) {
      const key = ids.keyOf(String(e.personId ?? e.id));
      const present = att.filter((a: any) => ids.keyOf(a.personId) === key);
      const verified = present.some((a: any) => a.verified);
      const state = e.status === 'dropped' ? 'dropped' : verified ? 'verified' : present.length ? 'present' : 'active';
      const team = Object.entries(doc.teams ?? {}).find(([, m]: any) => m.some((x: string) => ids.keyOf(x) === key))?.[0] ?? null;
      rows.push({ personId: `person:${key}`, name: await nameOf(key), status: e.status ?? 'active', state, team });
    }
    return c.json({ learners: rows.sort((a, b) => a.name.localeCompare(b.name)) });
  });

  app.get('/api/classroom/drop-plan', T, async (c: any) => {
    const { db, doc } = await myClass(c);
    const personId = `person:${ids.keyOf(String(c.req.query('personId') ?? ''))}`;
    const state = await classState(db, doc);
    const plan = dropPlan(state, personId);
    return c.json({
      plan, tickets: state.tickets.filter((t: any) => plan.unassignTickets.includes(t.id)).map((t: any) => ({ id: t.id, title: t.title })),
      reviews: state.reviews.filter((r: any) => plan.reassignReviews.includes(r.id)).map((r: any) => ({ id: r.id, title: r.title ?? r.prRef ?? r.id })),
    });
  });

  const personBody = z.object({ personId: z.string().min(1, 'required') });

  app.post('/api/classroom/drop', T, async (c: any) => {
    const b = await http.validateBody(c, personBody);
    const { db, doc, key } = await myClass(c);
    const s = c.get('session');
    const personId = `person:${ids.keyOf(b.personId)}`;
    const enrol = await enrolmentOf(db, ids.keyOf(personId));
    if (!enrol) throw http.fieldError('personId', 'not-enrolled', 404);
    if (enrol.status === 'dropped') throw http.fieldError('personId', 'already-dropped', 409);
    const now = ctx.clock.now();
    const state = await classState(db, doc);
    const plan = dropPlan(state, personId);
    for (const id of plan.unassignTickets) {
      const t = await store.get(db, id);
      if (t) await store.put(db, { ...t, assignee: null, unassignedFrom: personId, updatedAt: now, updatedBy: s.personId });
    }
    for (const id of plan.reassignReviews) {
      const r = await store.get(db, id);
      if (r) await store.put(db, { ...r, reviewer: null, needsReviewer: true, previousReviewer: personId, updatedAt: now, updatedBy: s.personId });
    }
    if (plan.removeFromTeam) {
      const teams = { ...(doc.teams ?? {}) };
      teams[plan.removeFromTeam] = (teams[plan.removeFromTeam] ?? []).filter((m: string) => m !== personId);
      await store.put(db, { ...doc, teams, updatedAt: now, updatedBy: s.personId });
    }
    await store.put(db, { ...enrol, id: `droppedEnrolment:${ids.keyOf(enrol.id)}`, status: 'dropped', droppedAt: now, dropPlan: plan, reposArchived: true, botsStopped: true, updatedAt: now, updatedBy: s.personId });
    await store.remove(db, enrol.id);
    return c.json({ ok: true, plan, classId: key });
  });

  app.post('/api/classroom/undrop', T, async (c: any) => {
    const b = await http.validateBody(c, personBody);
    const { db, doc } = await myClass(c);
    const s = c.get('session');
    const personId = `person:${ids.keyOf(b.personId)}`;
    const enrol = await enrolmentOf(db, ids.keyOf(personId));
    if (!enrol || enrol.status !== 'dropped') throw http.fieldError('personId', 'not-dropped', 409);
    const now = ctx.clock.now();
    const undo = undoDropPlan(enrol.dropPlan ?? dropPlan({ tickets: [], reviews: [], teams: {} }, personId));
    if (undo.restoreTeam) {
      const teams = { ...(doc.teams ?? {}) };
      const members: string[] = teams[undo.restoreTeam] ?? [];
      if (!members.includes(personId)) teams[undo.restoreTeam] = [...members, personId];
      await store.put(db, { ...doc, teams, updatedAt: now, updatedBy: s.personId });
    }
    // Tickets stay reassigned (AC-55); repos and bots come back.
    const { droppedAt: _d, dropPlan: _p, reposArchived: _r, botsStopped: _b, ...rest } = enrol;
    await store.put(db, { ...rest, id: `enrolment:${ids.keyOf(enrol.id)}`, status: 'active', updatedAt: now, updatedBy: s.personId });
    await store.remove(db, enrol.id);
    return c.json({ ok: true, undo, restoredTeam: undo.restoreTeam });
  });

  // ---- AC-153 Accommodations -----------------------------------------------------------------
  // Requests live in the private database (a learner's device never replicates it); approval writes
  // person.accommodations in the org database, which the Shift and exam timers read (effectiveLimitMs).
  const accBody = z.object({ timeMultiplier: z.number().finite(), reason: z.string().trim().min(1, 'required') });

  app.post('/api/classroom/accommodations', L, async (c: any) => {
    const b = await http.validateBody(c, accBody);
    const s = c.get('session');
    const now = ctx.clock.now();
    const key = ids.randomKey();
    const timeMultiplier = effectiveLimitMs(1000, { timeMultiplier: b.timeMultiplier }) / 1000; // clamped to 1-3
    await store.put(store.priv, {
      type: 'accommodationRequest', id: `accommodationRequest:${key}`, schema: ctx.schema, personId: s.personId,
      timeMultiplier, reason: b.reason, status: 'pending', createdAt: now, updatedAt: now, updatedBy: s.personId,
    });
    return c.json({ id: key, timeMultiplier, status: 'pending' }, 201);
  });

  app.get('/api/classroom/accommodations', L, async (c: any) => {
    const me = ids.keyOf(c.get('session').personId);
    const mine = (await store.list(store.priv, 'accommodationRequest:')).filter((r: any) => ids.keyOf(r.personId) === me);
    const person = await store.get('org', `person:${me}`);
    return c.json({
      requests: mine.map((r: any) => ({ id: ids.keyOf(r.id), timeMultiplier: r.timeMultiplier, reason: r.reason, status: r.status })),
      approved: person?.accommodations?.timeMultiplier ?? null,
    });
  });

  app.get('/api/admin/classroom/accommodations', A, async (c: any) => {
    const rows: any[] = [];
    for (const r of await store.list(store.priv, 'accommodationRequest:')) {
      rows.push({ id: ids.keyOf(r.id), personId: r.personId, name: await nameOf(r.personId), timeMultiplier: r.timeMultiplier, reason: r.reason, status: r.status, createdAt: r.createdAt });
    }
    return c.json({ requests: rows.sort((a, b) => a.createdAt - b.createdAt) });
  });

  app.post('/api/admin/classroom/accommodations/:id/approve', A, async (c: any) => {
    const s = c.get('session');
    const r = await store.get(store.priv, `accommodationRequest:${ids.keyOf(c.req.param('id'))}`);
    if (!r) throw http.fieldError('id', 'unknown', 404);
    const now = ctx.clock.now();
    const key = ids.keyOf(r.personId);
    const person = (await store.get('org', `person:${key}`)) ?? { type: 'person', id: `person:${key}`, schema: ctx.schema, name: key, roles: ['learner'], minor: false };
    await store.put('org', { ...person, accommodations: { timeMultiplier: r.timeMultiplier, approvedBy: s.personId, approvedAt: now }, updatedAt: now, updatedBy: s.personId });
    await store.put(store.priv, { ...r, status: 'approved', decidedBy: s.personId, decidedAt: now, updatedAt: now });
    return c.json({ ok: true });
  });

  // ---- AC-166 Content improvement ------------------------------------------------------------
  async function answerRows(db: string) {
    const rows: { personId: string; itemId: string; correct: boolean }[] = [];
    const wrong = new Map<string, Map<string, number>>();
    for (const a of await store.list(db, 'attempt:')) {
      if (!Array.isArray(a.answers)) continue;
      for (const x of a.answers) {
        if (!x || typeof x.itemId !== 'string') continue;
        rows.push({ personId: a.personId, itemId: x.itemId, correct: x.correct === true });
        if (x.correct !== true && typeof x.given === 'string') {
          const g = x.given.trim().toLowerCase();
          if (GENERIC_WRONG.has(g)) continue;
          const m = wrong.get(x.itemId) ?? new Map<string, number>();
          m.set(x.given.trim(), (m.get(x.given.trim()) ?? 0) + 1);
          wrong.set(x.itemId, m);
        }
      }
    }
    return { rows, wrong };
  }

  const dayOfItem = (itemId: string): number => {
    const m = /^day(\d+)/.exec(itemId);
    return m ? Number(m[1]) : 0;
  };

  app.get('/api/classroom/item-analysis', TS, async (c: any) => {
    const { db } = await myClass(c);
    const { rows } = await answerRows(db);
    const analysis = itemAnalysis(rows).sort((a, b) => a.itemId.localeCompare(b.itemId, undefined, { numeric: true }));
    return c.json({ analysis, learners: new Set(rows.map((r) => r.personId)).size });
  });

  // A wrong answer given by at least 3 learners and a quarter of them is suggested as a misconception.
  app.get('/api/classroom/misconceptions', TS, async (c: any) => {
    const { db } = await myClass(c);
    const { rows, wrong } = await answerRows(db);
    const learners = new Set(rows.map((r) => r.personId)).size || 1;
    const decided = new Map<string, any>();
    for (const d of await store.list(db, 'misconception:')) decided.set(d.id, d);
    const out: any[] = [];
    for (const [itemId, m] of wrong) {
      for (const [given, n] of m) {
        if (n < 3 || n / learners < 0.25) continue;
        const id = `misconception:${itemId}:${given.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const prior = decided.get(id);
        out.push({ id, itemId, dayIndex: dayOfItem(itemId), given, count: n, label: prior?.label ?? given, status: prior?.status ?? 'suggested' });
      }
    }
    return c.json({ suggestions: out.sort((a, b) => b.count - a.count) });
  });

  const miscBody = z.object({
    id: z.string().min(1), itemId: z.string().min(1), given: z.string().min(1),
    action: z.enum(['accept', 'reject']), label: z.string().trim().min(1).optional(),
  });
  app.post('/api/classroom/misconceptions/decide', T, async (c: any) => {
    const b = await http.validateBody(c, miscBody);
    const { db } = await myClass(c);
    const s = c.get('session');
    const now = ctx.clock.now();
    const label = b.label ?? b.given;
    await store.put(db, {
      type: 'misconception', id: b.id, schema: ctx.schema, itemId: b.itemId, given: b.given, label,
      status: b.action === 'accept' ? 'accepted' : 'rejected', decidedBy: s.personId, updatedAt: now, updatedBy: s.personId,
    });
    if (b.action === 'accept') {
      // Accepted misconceptions join the day's explain-it-back checklist (shape from Appendix E).
      const dayIndex = dayOfItem(b.itemId);
      const clId = `checklist:day${dayIndex}`;
      const cl = (await store.get(db, clId)) ?? { type: 'checklist', id: clId, schema: ctx.schema, dayIndex, concepts: [], misconceptions: [] };
      const list: any[] = cl.misconceptions ?? [];
      const at = list.findIndex((m) => m.source === b.id);
      const entry = { id: b.id, label, anyOf: [b.given.toLowerCase()], source: b.id };
      if (at >= 0) list[at] = entry; else list.push(entry);
      await store.put(db, { ...cl, misconceptions: list, updatedAt: now, updatedBy: s.personId });
    }
    return c.json({ ok: true });
  });

  // Package diff: which days and questions change if this archive replaces the published package.
  async function publishedFiles(classKey: string): Promise<Record<string, string> | null> {
    const pkgs = (await store.list(store.priv, 'package:')).filter((p: any) => p.status === 'published' && (!p.classId || ids.keyOf(p.classId) === classKey));
    pkgs.sort((a: any, b: any) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
    return pkgs[0]?.files ?? null;
  }

  const summarise = (files: Record<string, string>) => {
    const parsed = parsePackage(files);
    const days = new Map<number, { sections: Map<string, string>; questions: Map<string, string> }>();
    for (const d of parsed.days) {
      const e = days.get(d.index) ?? { sections: new Map(), questions: new Map() };
      for (const s of d.sections) e.sections.set(s.title, `${s.plannedSec}|${s.graded}`);
      for (const q of d.questions) e.questions.set(q.text, q.answer);
      days.set(d.index, e);
    }
    return days;
  };

  app.post('/api/classroom/package-diff', T, async (c: any) => {
    const { key } = await myClass(c);
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (!bytes.length) throw http.fieldError('body', 'empty-package');
    let entries: [string, string][];
    try { entries = tarUnpack(bytes).map((f) => [f.path.replace(/^(\.\/)+/, ''), dec(f.bytes)] as [string, string]).filter(([p]) => p && !p.endsWith('/')); }
    catch { throw http.fieldError('body', 'not-a-tar'); }
    if (!entries.length) throw http.fieldError('body', 'not-a-tar');
    const first = entries[0][0].split('/')[0];
    const wrapped = entries.every(([p]) => p.includes('/') && p.split('/')[0] === first);
    const next = Object.fromEntries(entries.map(([p, t]) => [wrapped ? p.slice(first.length + 1) : p, t]));
    const prevFiles = await publishedFiles(key);
    const before = prevFiles ? summarise(prevFiles) : new Map();
    const after = summarise(next);
    const days: any[] = [];
    for (const idx of [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a - b)) {
      const b = before.get(idx); const a = after.get(idx);
      if (!a) { days.push({ index: idx, change: 'removed', sections: [], questions: [] }); continue; }
      if (!b) { days.push({ index: idx, change: 'added', sections: [...a.sections.keys()].map((t) => ({ title: t, change: 'added' })), questions: [...a.questions.keys()].map((t) => ({ text: t, change: 'added' })) }); continue; }
      const sections: any[] = []; const questions: any[] = [];
      for (const [t, v] of a.sections) { if (!b.sections.has(t)) sections.push({ title: t, change: 'added' }); else if (b.sections.get(t) !== v) sections.push({ title: t, change: 'changed' }); }
      for (const t of b.sections.keys()) if (!a.sections.has(t)) sections.push({ title: t, change: 'removed' });
      for (const [t, v] of a.questions) { if (!b.questions.has(t)) questions.push({ text: t, change: 'added' }); else if (b.questions.get(t) !== v) questions.push({ text: t, change: 'changed' }); }
      for (const t of b.questions.keys()) if (!a.questions.has(t)) questions.push({ text: t, change: 'removed' });
      if (sections.length || questions.length) days.push({ index: idx, change: 'changed', sections, questions });
    }
    return c.json({ hasCurrent: !!prevFiles, days, unchanged: days.length === 0 });
  });
}
