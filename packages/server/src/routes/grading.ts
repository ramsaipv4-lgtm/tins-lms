// Grading (AC-72, AC-73) is built by b6-5. Only a minimal attempt intake lives here for now, because AC-62
// needs a learner to submit an attempt and a trainer to sign it off before a substitute is refused. b6-5 replaces both.
import { z } from 'zod';
import { appendEntry } from '../../../core/src/index.ts';

const attemptSchema = z.object({
  itemId: z.string().min(1, 'required'),
  mode: z.string().min(1, 'required'),
  answers: z.unknown().optional(),
  timing: z.record(z.string(), z.unknown()).optional(),
  aiUsage: z.unknown().optional(),
});

export function register(app: any, ctx: any): void {
  app.post('/api/classes/:id/attempts', ctx.guard.role('learner'), async (c: any) => {
    const b = await ctx.http.validateBody(c, attemptSchema);
    const classId = ctx.ids.keyOf(c.req.param('id'));
    const s = c.get('session');
    const key = ctx.ids.randomKey();
    await ctx.store.put(`class-${classId}`, {
      type: 'attempt', id: `attempt:${key}`, schema: ctx.schema, personId: s.personId, itemId: b.itemId, mode: b.mode,
      answers: b.answers ?? null, timing: b.timing ?? {}, aiUsage: b.aiUsage ?? [], updatedAt: ctx.clock.now(), updatedBy: s.personId,
    });
    return c.json({ id: key }, 201);
  });

  // Sign-off: first call appends a ledger entry, later calls append a correction (substitute is refused by ctx.policy).
  app.post('/api/classes/:id/attempts/:attemptId/grade', ctx.guard.role('trainer'), async (c: any) => {
    const b = await ctx.http.validateBody(c, z.object({ score: z.number().finite(), reason: z.string().optional() }));
    const classId = ctx.ids.keyOf(c.req.param('id'));
    const attemptId = ctx.ids.keyOf(c.req.param('attemptId'));
    const db = `class-${classId}`;
    const attempt = await ctx.store.get(db, `attempt:${attemptId}`);
    if (!attempt) throw ctx.http.fieldError('attemptId', 'unknown', 404);
    const ledgerId = `ledger:attempt-${attemptId}`;
    const prev = await ctx.store.get(db, ledgerId);
    const entries = prev?.entries ?? [];
    const next = await appendEntry(entries, {
      subject: `attempt:${attemptId}`, value: b.score, by: c.get('session').personId, at: ctx.clock.now(), reason: b.reason,
      ...(entries.length ? { corrects: entries[entries.length - 1].seq } : {}),
    });
    await ctx.store.put(db, { type: 'ledger', id: ledgerId, schema: ctx.schema, subject: `attempt:${attemptId}`, entries: next, updatedAt: ctx.clock.now(), updatedBy: c.get('session').personId });
    return c.json({ ok: true, seq: next.length - 1 });
  });
}
