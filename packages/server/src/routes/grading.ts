// Grading, appeals and integrity log (SPEC §5.7, §4.9, §4.11, §4.12, §4.26, Appendix A). AC-72, AC-73.
import { z } from 'zod';
import { appendEntry, openAppeal, aiUsageSummary, gradedTiming, seedFor } from '../../../core/src/index.ts';

const num = z.number().finite();
const attemptSchema = z.object({
  itemId: z.string().min(1, 'required'),
  mode: z.enum(['live', 'recorded', 'emulated'], { message: 'must be live, recorded or emulated' }),
  answers: z.unknown().optional(),
  timing: z.object({
    hubStart: num.nullable().optional(), hubEnd: num.nullable().optional(),
    monotonicMs: num.optional(), deviceStart: num.optional(), deviceEnd: num.optional(),
  }).passthrough().optional(),
  aiUsage: z.array(z.unknown()).optional(),
  aiPolicy: z.enum(['off', 'allowed', 'explain-only']).optional(),
  rubricRows: z.array(z.unknown()).optional(),
});
const gradeSchema = z.object({ score: num, reason: z.string().optional() });
const appealSchema = z.object({ attemptId: z.string().min(1, 'required'), reason: z.string().min(1, 'required') });
const integritySchema = z.object({
  context: z.enum(['exam', 'practice'], { message: 'must be exam or practice' }),
  kind: z.string().min(1, 'required'),
  at: num,
});
const integrityQuery = z.object({ personId: z.string().optional() });

const eventsOf = (a: any): any[] => (Array.isArray(a?.aiUsage) ? a.aiUsage : []);
const unreadOf = (a: any): number =>
  eventsOf(a).filter((e) => e && typeof e === 'object' && e.confirmed === true && e.read !== true).length;

export function register(app: any, ctx: any): void {
  const dbOf = (c: any) => `class-${ctx.ids.keyOf(c.req.param('id'))}`;

  app.post('/api/classes/:id/attempts', ctx.guard.role('learner'), async (c: any) => {
    const b = await ctx.http.validateBody(c, attemptSchema);
    const db = dbOf(c);
    const s = c.get('session');
    const cls = await ctx.store.get(db, `class:${ctx.ids.keyOf(c.req.param('id'))}`);
    const events = (b.aiUsage ?? []).filter((e: any) => e && typeof e === 'object') as { at: number; toolKind: string }[];
    const aiPolicy = b.aiPolicy ?? cls?.switches?.aiPolicy ?? (events.length ? 'allowed' : 'off');
    const t: any = b.timing ?? {};
    const timing: any = { ...t };
    if (typeof t.monotonicMs === 'number' && typeof t.deviceStart === 'number' && typeof t.deviceEnd === 'number') {
      const g = gradedTiming({ hubStart: t.hubStart ?? null, hubEnd: t.hubEnd ?? null, monotonicMs: t.monotonicMs, deviceStart: t.deviceStart, deviceEnd: t.deviceEnd });
      timing.durationMs = g.durationMs;
      timing.flags = g.flags;
    } else {
      timing.flags = [];
    }
    const key = ctx.ids.randomKey();
    const now = ctx.clock.now();
    await ctx.store.put(db, {
      type: 'attempt', id: `attempt:${key}`, schema: ctx.schema, personId: s.personId, itemId: b.itemId,
      seed: seedFor(cls?.seedSalt ?? '', b.itemId), mode: b.mode, answers: b.answers ?? null, timing,
      aiPolicy, aiUsage: b.aiUsage ?? [], aiUsageSummary: aiUsageSummary(aiPolicy, events),
      rubricRows: b.rubricRows ?? [], submittedAt: now, updatedAt: now, updatedBy: s.personId,
    });
    return c.json({ id: key }, 201);
  });

  // Sign-off: first call appends a ledger entry, later calls append a correction that keeps the original (P-10).
  app.post('/api/classes/:id/attempts/:attemptId/grade', ctx.guard.role('trainer'), async (c: any) => {
    const b = await ctx.http.validateBody(c, gradeSchema);
    const db = dbOf(c);
    const attemptId = ctx.ids.keyOf(c.req.param('attemptId'));
    const attempt = await ctx.store.get(db, `attempt:${attemptId}`);
    if (!attempt) throw ctx.http.fieldError('attemptId', 'unknown', 404);
    const by = c.get('session').personId;
    const now = ctx.clock.now();
    const ledgerId = `ledger:attempt-${attemptId}`;
    const prev = await ctx.store.get(db, ledgerId);
    const entries = prev?.entries ?? [];
    const next = await appendEntry(entries, {
      subject: `attempt:${attemptId}`, value: b.score, by, at: now, reason: b.reason,
      ...(entries.length ? { corrects: entries[entries.length - 1].seq } : {}),
    });
    await ctx.store.put(db, { type: 'ledger', id: ledgerId, schema: ctx.schema, subject: `attempt:${attemptId}`, entries: next, updatedAt: now, updatedBy: by });
    await ctx.store.put(db, { ...attempt, score: b.score, updatedAt: now, updatedBy: by });
    return c.json({ ok: true, seq: next.length - 1 });
  });

  app.post('/api/classes/:id/appeals', ctx.guard.role('learner'), async (c: any) => {
    const b = await ctx.http.validateBody(c, appealSchema);
    const db = dbOf(c);
    const s = c.get('session');
    const attemptId = ctx.ids.keyOf(b.attemptId);
    const attempt = await ctx.store.get(db, `attempt:${attemptId}`);
    if (!attempt || attempt.personId !== s.personId) throw ctx.http.fieldError('attemptId', 'unknown', 404);
    if (await ctx.store.get(db, `appeal:${attemptId}`)) throw ctx.http.fieldError('attemptId', 'already-appealed', 409);
    const ledger = await ctx.store.get(db, `ledger:attempt-${attemptId}`);
    const publishedAt = ledger?.entries?.[0]?.at ?? attempt.submittedAt ?? attempt.updatedAt;
    const now = ctx.clock.now();
    const r = openAppeal({ id: attemptId, publishedAt, unreadConfirmations: unreadOf(attempt) }, now);
    if (!r.ok) throw ctx.http.fieldError('attemptId', r.reason, 409);
    await ctx.store.put(db, {
      type: 'appeal', id: `appeal:${attemptId}`, schema: ctx.schema, attemptId, personId: s.personId, learnerReason: b.reason,
      state: r.appeal.state, reason: r.appeal.reason, openedAt: r.appeal.openedAt, history: r.appeal.history,
      updatedAt: now, updatedBy: s.personId,
    });
    return c.json({ id: attemptId, state: r.appeal.state }, 201);
  });

  // Trainer inbox: each appeal carries its evidence pack.
  app.get('/api/classes/:id/appeals', ctx.guard.role('trainer', 'substitute'), async (c: any) => {
    const db = dbOf(c);
    const appeals = await ctx.store.list(db, 'appeal:');
    const out = [];
    for (const a of appeals) {
      const attempt = await ctx.store.get(db, `attempt:${a.attemptId}`);
      const integrity = (await ctx.store.list(db, 'integrity:')).filter((e: any) => e.personId === a.personId);
      out.push({
        id: a.attemptId, attemptId: a.attemptId, personId: a.personId, state: a.state, reason: a.reason,
        learnerReason: a.learnerReason, openedAt: a.openedAt, history: a.history,
        evidence: {
          seed: attempt?.seed ?? null, mode: attempt?.mode ?? null,
          events: [...eventsOf(attempt), ...integrity.map((e: any) => ({ context: e.context, kind: e.kind, at: e.at }))],
          rubricRows: attempt?.rubricRows ?? [], unreadConfirmations: unreadOf(attempt),
        },
      });
    }
    return c.json(out);
  });

  app.post('/api/classes/:id/integrity', ctx.guard.role('learner'), async (c: any) => {
    const b = await ctx.http.validateBody(c, integritySchema);
    const s = c.get('session');
    const key = ctx.ids.randomKey();
    await ctx.store.put(dbOf(c), {
      type: 'integrity', id: `integrity:${key}`, schema: ctx.schema, personId: s.personId,
      context: b.context, kind: b.kind, at: b.at, updatedAt: ctx.clock.now(), updatedBy: s.personId,
    });
    return c.json({ id: key }, 201);
  });

  app.get('/api/classes/:id/integrity', ctx.guard.role('trainer', 'substitute'), async (c: any) => {
    const q = ctx.http.validateQuery(c, integrityQuery);
    const all = await ctx.store.list(dbOf(c), 'integrity:');
    const events = all.filter((e: any) => !q.personId || e.personId === ctx.ids.keyOf(q.personId))
      .map((e: any) => ({ personId: e.personId, context: e.context, kind: e.kind, at: e.at }))
      .sort((a: any, b: any) => a.at - b.at);
    return c.json(events);
  });
}
