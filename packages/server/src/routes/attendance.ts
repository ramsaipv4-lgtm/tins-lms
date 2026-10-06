// Attendance (SPEC 5.4, AC-66). Each class has a random secret (private database, never replicated). The rotating
// 6-digit code comes from core; the printed fallback is an 8-digit code per class day, which marks verified: false.
import { z } from 'zod';
import { attendanceCode, verifyAttendanceCode } from '../../../core/src/index.ts';

const PERIOD_SEC = 60;
const markSchema = z.object({
  code: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).pipe(z.string().min(1, 'required')),
  day: z.number().int().min(0).optional(),
});

const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

export function register(app: any, ctx: any): void {
  const { store, ids, http } = ctx;

  async function classOr404(id: string) {
    const key = ids.keyOf(id);
    if (!store.names().includes(`class-${key}`)) throw http.fieldError('id', 'unknown-class', 404);
    const doc = await store.get(`class-${key}`, `class:${key}`);
    if (!doc) throw http.fieldError('id', 'unknown-class', 404);
    return { key, db: `class-${key}`, doc };
  }

  async function secretOf(classKey: string): Promise<Uint8Array> {
    const id = `attsecret:${classKey}`;
    let rec = await store.get(store.priv, id);
    if (!rec) {
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
      rec = await store.put(store.priv, { id, type: 'attendanceSecret', secret: b64(bytes), createdAt: ctx.clock.now() });
    }
    return new Uint8Array(Buffer.from(rec.secret, 'base64'));
  }

  async function printedCode(classKey: string, day: number): Promise<string> {
    const hex = await ids.sha256Hex(`printed:${classKey}:${day}:${b64(await secretOf(classKey))}`);
    return String(parseInt(hex.slice(0, 8), 16) % 100000000).padStart(8, '0');
  }

  // Enrolment documents are found by their personId field, not by id: seeds use ids like `enrolment:c1-l1`.
  async function enrolmentOf(db: string, personKey: string) {
    return (await store.list(db, 'enrolment:')).find((e: any) => ids.keyOf(String(e.personId ?? e.id)) === personKey) ?? null;
  }

  // The class day for "today" (UTC date): the schedule entry whose date is today, even when no package content exists
  // for that day; otherwise the last day (schedule or package) not after today, else 0.
  async function todayIndex(db: string, classKey: string, now: number): Promise<number> {
    const today = new Date(now).toISOString().slice(0, 10);
    const sched: any[] = (await store.get(db, `class:${classKey}`))?.schedule ?? [];
    const exact = sched.findIndex((d: any) => String(d?.date) === today);
    if (exact >= 0) return exact;
    let idx = 0;
    sched.forEach((d: any, i: number) => { if (String(d?.date) <= today) idx = Math.max(idx, i); });
    for (const d of await store.list(db, 'day:')) if (String(d.date) <= today) idx = Math.max(idx, d.index);
    return idx;
  }

  app.get('/api/classes/:id/attendance-code', ctx.guard.role('trainer', 'substitute'), async (c: any) => {
    const { key } = await classOr404(c.req.param('id'));
    const now = ctx.clock.now();
    const code = await attendanceCode(await secretOf(key), now, PERIOD_SEC);
    const secondsLeft = PERIOD_SEC - (Math.floor(now / 1000) % PERIOD_SEC);
    return c.json({ code, secondsLeft, periodSec: PERIOD_SEC });
  });

  app.get('/api/classes/:id/printed-code', ctx.guard.role('trainer', 'substitute'), async (c: any) => {
    const { key, db } = await classOr404(c.req.param('id'));
    const q = c.req.query('day');
    let day = await todayIndex(db, key, ctx.clock.now());
    if (q !== undefined) {
      if (!/^\d+$/.test(q)) throw http.fieldError('day', 'invalid');
      day = Number(q);
    }
    return c.json({ code: await printedCode(key, day), day });
  });

  app.post('/api/classes/:id/attendance', ctx.guard.role('learner'), async (c: any) => {
    const b = await http.validateBody(c, markSchema);
    const { key, db } = await classOr404(c.req.param('id'));
    const s = c.get('session');
    const enrol = await enrolmentOf(db, s.personId);
    if (!enrol || enrol.status === 'dropped') throw new http.ApiError(403, { error: { class: 'not-enrolled' } });
    const now = ctx.clock.now();
    const secret = await secretOf(key);

    let method: 'rotating' | 'printed' | null = null;
    let dayIndex = await todayIndex(db, key, now);
    if (/^\d{6}$/.test(b.code) && await verifyAttendanceCode(b.code, secret, now, PERIOD_SEC)) {
      method = 'rotating';
    } else if (/^\d{8}$/.test(b.code)) {
      const candidates = b.day !== undefined ? [b.day] : [dayIndex];
      for (const d of candidates) if (b.code === await printedCode(key, d)) { method = 'printed'; dayIndex = d; }
    }
    if (!method) throw http.fieldError('code', 'invalid', 400);

    const id = `attendance:${s.personId}-${dayIndex}`;
    const prev = await store.get(db, id);
    const verified = method === 'rotating' || prev?.verified === true;
    const doc = await store.put(db, {
      type: 'attendance', id, schema: ctx.schema, personId: s.personId, dayIndex,
      method: method === 'printed' && prev?.verified ? prev.method : method, verified,
      at: now, updatedAt: now, updatedBy: s.personId,
    });
    return c.json({ ok: true, id: doc.id, personId: s.personId, dayIndex, method: doc.method, verified: doc.verified, present: true });
  });
}
