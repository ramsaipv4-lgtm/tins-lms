// Server routes for the web feature group "attend": roster, absentees, wrap-up, trainer notes, digest, lab clusters.
// Uses ctx only (routes/index.ts). Core logic (atRisk, clusterSubmissions) comes from packages/core.
import { z } from 'zod';
import { atRisk } from '../../../../core/src/atrisk.ts';
import { clusterSubmissions } from '../../../../core/src/cluster.ts';
import { verifyAttendanceCode } from '../../../../core/src/attendance.ts';

export function register(app: any, ctx: any): void {
  const { store, ids, http } = ctx;
  const TS = ctx.guard.role('trainer', 'substitute');
  const T = ctx.guard.role('trainer');
  const L = ctx.guard.role('learner');

  const classKeys = (): string[] => store.names().filter((n: string) => n.startsWith('class-')).map((n: string) => n.slice(6));

  async function classOr404(id: string) {
    const key = ids.keyOf(id);
    if (!classKeys().includes(key)) throw http.fieldError('id', 'unknown-class', 404);
    const doc = await store.get(`class-${key}`, `class:${key}`);
    if (!doc) throw http.fieldError('id', 'unknown-class', 404);
    return { key, db: `class-${key}`, doc };
  }

  // The class a signed-in person works in: trainer lists, learner enrolled, else the first class.
  async function myClass(c: any) {
    const s = c.get('session');
    const me = ids.keyOf(s.personId);
    const keys = classKeys();
    for (const key of keys) {
      const doc = await store.get(`class-${key}`, `class:${key}`);
      if (!doc) continue;
      const staff = (doc.trainerIds ?? []).map((x: string) => ids.keyOf(x));
      if (staff.includes(me)) return { key, db: `class-${key}`, doc };
      if (await enrolmentOf(`class-${key}`, me)) return { key, db: `class-${key}`, doc };
    }
    for (const key of keys) {
      const doc = await store.get(`class-${key}`, `class:${key}`);
      if (doc) return { key, db: `class-${key}`, doc };
    }
    throw http.fieldError('class', 'none', 404);
  }

  // Enrolment documents may be stored as enrolment:<key> or enrolment:person:<key>; match on the person key.
  async function enrolmentOf(db: string, personKey: string) {
    return (await store.list(db, 'enrolment:')).find((e: any) => ids.keyOf(String(e.personId ?? e.id)) === personKey) ?? null;
  }

  async function todayIndex(db: string, now: number): Promise<number> {
    const today = new Date(now).toISOString().slice(0, 10);
    const days = (await store.list(db, 'day:')).sort((a: any, b: any) => a.index - b.index);
    let idx = 0;
    for (const d of days) if (String(d.date) <= today) idx = d.index;
    return idx;
  }

  async function dayParam(c: any, db: string): Promise<number> {
    const q = c.req.query('day');
    if (q === undefined || q === '') return todayIndex(db, ctx.clock.now());
    if (!/^\d+$/.test(q)) throw http.fieldError('day', 'invalid');
    return Number(q);
  }

  async function dayDocOf(db: string, day: number) {
    return (await store.list(db, 'day:')).find((d: any) => d.index === day) ?? null;
  }

  async function learners(db: string) {
    const out: any[] = [];
    for (const e of await store.list(db, 'enrolment:')) {
      const key = ids.keyOf(e.personId ?? e.id);
      const p = await store.get('org', `person:${key}`);
      out.push({ key, personId: `person:${key}`, name: p?.name || key, phone: p?.phone ?? '', status: e.status ?? 'active' });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  const presence = (att: any[], key: string, day: number) =>
    att.find((a) => ids.keyOf(a.personId) === key && a.dayIndex === day);

  // Where am I: class id, the day index, whether the day was wrapped up (attendance closed).
  app.get('/api/attend/context', ctx.guard.auth, async (c: any) => {
    const { key, db, doc } = await myClass(c);
    const day = await dayParam(c, db);
    const wrap = await store.get(db, `wrapup:day${day}`);
    const days = (await store.list(db, 'day:')).map((d: any) => d.index).sort((a: number, b: number) => a - b);
    return c.json({ classId: key, className: doc.name ?? key, day, days, closed: !!wrap, wrapup: wrap });
  });

  // Learner marks attendance (rotating 6-digit or printed 8-digit code). Same documents and secret as POST /attendance,
  // but the enrolment lookup is tolerant and a wrapped-up day is closed (AC-82, AC-89).
  const markSchema = z.object({ code: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).pipe(z.string().min(1, 'required')) });
  app.post('/api/attend/mark', L, async (c: any) => {
    const b = await http.validateBody(c, markSchema);
    const { key, db } = await myClass(c);
    const s = c.get('session');
    const me = ids.keyOf(s.personId);
    const enrol = await enrolmentOf(db, me);
    if (!enrol || enrol.status === 'dropped') throw new http.ApiError(403, { error: { class: 'not-enrolled' } });
    const now = ctx.clock.now();
    const day = await todayIndex(db, now);
    if (await store.get(db, `wrapup:day${day}`)) throw new http.ApiError(409, { error: { day: 'closed' } });
    const sid = `attsecret:${key}`;
    let rec = await store.get(store.priv, sid);
    if (!rec) {
      rec = await store.put(store.priv, { id: sid, type: 'attendanceSecret', secret: Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(32))).toString('base64'), createdAt: now });
    }
    const secretBytes = new Uint8Array(Buffer.from(rec.secret, 'base64'));
    let method: 'rotating' | 'printed' | null = null;
    if (/^\d{6}$/.test(b.code) && await verifyAttendanceCode(b.code, secretBytes, now, 60)) method = 'rotating';
    else if (/^\d{8}$/.test(b.code)) {
      const hex = await ids.sha256Hex(`printed:${key}:${day}:${rec.secret}`);
      if (b.code === String(parseInt(hex.slice(0, 8), 16) % 100000000).padStart(8, '0')) method = 'printed';
    }
    if (!method) throw http.fieldError('code', 'invalid', 400);
    const id = `attendance:${s.personId}-${day}`;
    const prev = await store.get(db, id);
    const verified = method === 'rotating' || prev?.verified === true;
    const doc = await store.put(db, {
      type: 'attendance', id, schema: ctx.schema, personId: s.personId, dayIndex: day,
      method: method === 'printed' && prev?.verified ? prev.method : method, verified,
      at: now, updatedAt: now, updatedBy: s.personId,
    });
    return c.json({ ok: true, id: doc.id, dayIndex: day, method: doc.method, verified: doc.verified, present: true });
  });

  // Roster with attendance state for one day.
  app.get('/api/classes/:id/roster', TS, async (c: any) => {
    const { db } = await classOr404(c.req.param('id'));
    const day = await dayParam(c, db);
    const att = await store.list(db, 'attendance:');
    const rows = (await learners(db)).map((l) => {
      const a = presence(att, l.key, day);
      const state = l.status === 'dropped' ? 'dropped' : a ? (a.verified ? 'verified' : 'present') : 'active';
      return { personId: l.personId, name: l.name, status: l.status, state, method: a?.method ?? null };
    });
    const wrap = await store.get(db, `wrapup:day${day}`);
    return c.json({ day, closed: !!wrap, learners: rows });
  });

  // Absentees for a day with the data a prefilled message needs (phone, name).
  app.get('/api/classes/:id/absentees', TS, async (c: any) => {
    const { db, doc } = await classOr404(c.req.param('id'));
    const day = await dayParam(c, db);
    const att = await store.list(db, 'attendance:');
    const list = (await learners(db))
      .filter((l) => l.status !== 'dropped' && !presence(att, l.key, day))
      .map((l) => ({ personId: l.personId, name: l.name, phone: l.phone }));
    return c.json({ day, className: doc.name ?? '', absentees: list });
  });

  // Wrap-up (A-1): publish board PDF + quick-learn + cards, close attendance, draft the delivery report.
  const wrapSchema = z.object({ day: z.number().int().min(0).optional() });
  app.post('/api/classes/:id/wrap-up', T, async (c: any) => {
    const body = await http.validateBody(c, wrapSchema);
    const { key, db } = await classOr404(c.req.param('id'));
    const s = c.get('session');
    const now = ctx.clock.now();
    const day = body.day ?? (await todayIndex(db, now));
    const sections: any[] = (await dayDocOf(db, day))?.sections ?? [];
    const base = `/api/classes/${key}/days/${day}`;

    const wrap = (await store.get(db, `wrapup:day${day}`)) ?? await store.put(db, {
      type: 'wrapup', id: `wrapup:day${day}`, schema: ctx.schema, dayIndex: day,
      boardPdf: `${base}/board-pdf`, quickLearn: `${base}/quick-learn`, attendanceClosed: true,
      publishedAt: now, updatedAt: now, updatedBy: s.personId,
    });

    const people = (await learners(db)).filter((l) => l.status !== 'dropped');
    let cards = 0;
    for (const l of people) {
      let i = 0;
      for (const sec of sections.length ? sections : [{ title: `Day ${day}` }]) {
        const id = `card:day${day}-${i++}`;
        if (await store.get(`person-${l.key}`, id)) continue;
        await store.put(`person-${l.key}`, {
          type: 'card', id, schema: ctx.schema, deck: `day-${day}`, front: `Recall: ${sec.title ?? 'section'}`,
          back: String(sec.title ?? ''), sourceRef: `day:${day}`,
          fsrs: { difficulty: 0, due: now, elapsed_days: 0, lapses: 0, last_review: null, learning_steps: 0, reps: 0, scheduled_days: 0, stability: 0, state: 0 },
          updatedAt: now, updatedBy: s.personId,
        });
        cards++;
      }
    }

    const att = (await store.list(db, 'attendance:')).filter((a: any) => a.dayIndex === day);
    const report = (await store.get(db, `report:day${day}`)) ?? await store.put(db, {
      type: 'report', id: `report:day${day}`, schema: ctx.schema, dayIndex: day, status: 'draft', taughtBy: s.personId,
      present: att.length, enrolled: people.length, sections: sections.length, createdAt: now, updatedAt: now, updatedBy: s.personId,
    });
    return c.json({ ok: true, day, wrapup: wrap, report, cardsCreated: cards });
  });

  app.get('/api/classes/:id/reports', TS, async (c: any) => {
    const { db } = await classOr404(c.req.param('id'));
    const reports = (await store.list(db, 'report:')).sort((a: any, b: any) => a.dayIndex - b.dayIndex);
    const out: any[] = [];
    for (const r of reports) {
      const p = await store.get('org', `person:${ids.keyOf(r.taughtBy ?? '')}`);
      out.push({ ...r, taughtByName: p?.name ?? r.taughtBy ?? '' });
    }
    return c.json({ reports: out });
  });

  // Learner side of wrap-up: what was published, plus cards due now.
  app.get('/api/classes/:id/today', L, async (c: any) => {
    const { key, db } = await classOr404(c.req.param('id'));
    const day = await dayParam(c, db);
    const wrap = await store.get(db, `wrapup:day${day}`);
    const me = ids.keyOf(c.get('session').personId);
    const cards = await store.list(`person-${me}`, 'card:');
    const now = ctx.clock.now();
    return c.json({ classId: key, day, wrapup: wrap, cardsDue: cards.filter((x: any) => (x.fsrs?.due ?? 0) <= now).length });
  });

  const gated = async (c: any) => {
    const { db } = await classOr404(c.req.param('id'));
    const day = Number(c.req.param('index'));
    const wrap = await store.get(db, `wrapup:day${day}`);
    const staff = c.get('session').roles.some((r: string) => ['trainer', 'substitute', 'admin'].includes(r));
    if (!wrap && !staff) throw http.fieldError('day', 'not-published', 404);
    return { day, sections: ((await dayDocOf(db, day))?.sections ?? []) as any[] };
  };

  app.get('/api/classes/:id/days/:index/quick-learn', ctx.guard.auth, async (c: any) => {
    const { day, sections } = await gated(c);
    const items = sections.map((s) => `<li>${esc(String(s.title ?? ''))}</li>`).join('');
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Quick-learn day ${day}</title><h1>Quick-learn day ${day}</h1><ul>${items}</ul></html>`,
      { headers: { 'content-type': 'text/html; charset=utf-8' } });
  });

  app.get('/api/classes/:id/days/:index/board-pdf', ctx.guard.auth, async (c: any) => {
    const { day, sections } = await gated(c);
    const lines = [`Board day ${day}`, ...sections.map((s) => String(s.title ?? ''))];
    return new Response(miniPdf(lines), { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="board-day-${day}.pdf"` } });
  });

  // Trainer notes (A-7): kept in the private database, so they never replicate to learners.
  const noteSchema = z.object({ personId: z.string().min(1, 'required'), text: z.string().trim().min(1, 'required').max(4000) });
  app.post('/api/classes/:id/notes', T, async (c: any) => {
    const b = await http.validateBody(c, noteSchema);
    const { key, db } = await classOr404(c.req.param('id'));
    const learner = ids.keyOf(b.personId);
    if (!(await enrolmentOf(db, learner))) throw http.fieldError('personId', 'unknown-learner', 404);
    const now = ctx.clock.now();
    const doc = await store.put(store.priv, {
      type: 'trainerNote', id: `tnote:${key}:${learner}:${now}-${ids.randomCode(4)}`, classKey: key, personId: `person:${learner}`,
      text: b.text, by: c.get('session').personId, at: now,
    });
    return c.json({ ok: true, id: doc.id });
  });

  app.get('/api/classes/:id/notes', TS, async (c: any) => {
    const { key } = await classOr404(c.req.param('id'));
    const all = (await store.list(store.priv, `tnote:${key}:`)).sort((a: any, b: any) => a.at - b.at);
    return c.json({ notes: all.map((n: any) => ({ id: n.id, personId: n.personId, text: n.text, at: n.at, by: n.by })) });
  });

  // Friday digest (A-3): atRisk per learner.
  app.get('/api/classes/:id/digest', TS, async (c: any) => {
    const { db, doc } = await classOr404(c.req.param('id'));
    const now = ctx.clock.now();
    const sched: any[] = Array.isArray(doc.schedule) ? doc.schedule : [];
    const todayDate = new Date(now).toISOString().slice(0, 10);
    const today = sched.length ? sched.filter((d: any) => String(d.date) <= todayDate).length : await todayIndex(db, now);
    const days = Array.from({ length: today }, (_, i) => i);
    const att = await store.list(db, 'attendance:');
    const runs = await store.list(db, 'shiftrun:').then(async (a: any[]) => a.concat(await store.list(db, 'shiftRun:')));
    const teams: Record<string, string[]> = doc.teams ?? {};
    const rows: any[] = [];
    for (const l of await learners(db)) {
      if (l.status === 'dropped') continue;
      const missed = days.filter((d: number) => !presence(att, l.key, d)).length;
      const cards = await store.list(`person-${l.key}`, 'card:');
      const overdue = cards.filter((x: any) => (x.fsrs?.due ?? now) < now).length;
      const teamIds = Object.entries(teams).filter(([, m]) => m.map((x) => ids.keyOf(x)).includes(l.key)).map(([t]) => t);
      const mine = runs
        .filter((r: any) => (r.personIds ?? []).map((x: string) => ids.keyOf(x)).includes(l.key) || teamIds.includes(r.teamId))
        .filter((r: any) => typeof r.scorePct === 'number')
        .sort((a: any, b: any) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
      const pct = mine[0]?.scorePct ?? null;
      const r = atRisk({ lockedMissedDays: missed, overdueCards: overdue, daysSinceCommit: null, lastShiftScorePct: pct });
      rows.push({ personId: l.personId, name: l.name, phone: l.phone, level: r.level, reasons: r.reasons, missed, overdue, shiftPct: pct });
    }
    const order: Record<string, number> = { risk: 0, watch: 1, ok: 2 };
    rows.sort((a, b) => order[a.level] - order[b.level] || a.name.localeCompare(b.name));
    return c.json({ today, learners: rows });
  });

  // Lab results (A-4): attempts with failing checks grouped by clusterSubmissions.
  app.get('/api/classes/:id/lab-clusters', TS, async (c: any) => {
    const { db } = await classOr404(c.req.param('id'));
    const attempts = (await store.list(db, 'attempt:'))
      .filter((a: any) => Array.isArray(a.failing) && (a.failing.length > 0 || /lab/i.test(String(a.itemId ?? ''))));
    const byId = new Map<string, any>(attempts.map((a: any) => [a.id, a]));
    const nameOf: Record<string, string> = {};
    for (const l of await learners(db)) nameOf[l.key] = l.name;
    const clusters = clusterSubmissions(attempts.map((a: any) => ({ id: a.id, failing: a.failing }))).map((cl, i) => ({
      index: i, signature: cl.signature,
      members: cl.ids.map((id) => {
        const a = byId.get(id); const k = ids.keyOf(a.personId);
        return { attemptId: id, personId: `person:${k}`, name: nameOf[k] ?? k, itemId: a.itemId ?? '' };
      }),
    }));
    return c.json({ clusters });
  });

  const commentSchema = z.object({ attemptIds: z.array(z.string()).min(1, 'required'), text: z.string().trim().min(1, 'required').max(2000) });
  app.post('/api/classes/:id/lab-comments', TS, async (c: any) => {
    const b = await http.validateBody(c, commentSchema);
    const { key, db } = await classOr404(c.req.param('id'));
    const now = ctx.clock.now();
    let n = 0;
    for (const aid of b.attemptIds) {
      const a = await store.get(db, aid);
      if (!a) continue;
      await store.put(store.priv, {
        type: 'labComment', id: `labcomment:${key}:${aid}:${now}`, classKey: key, attemptId: aid, personId: `person:${ids.keyOf(a.personId)}`,
        text: b.text, by: c.get('session').personId, at: now,
      });
      n++;
    }
    return c.json({ ok: true, sent: n });
  });

  app.get('/api/classes/:id/my-lab-feedback', L, async (c: any) => {
    const { key, db } = await classOr404(c.req.param('id'));
    const me = ids.keyOf(c.get('session').personId);
    const all = (await store.list(store.priv, `labcomment:${key}:`)).filter((x: any) => ids.keyOf(x.personId) === me);
    const out: any[] = [];
    for (const x of all.sort((a: any, b: any) => b.at - a.at)) {
      const a = await store.get(db, x.attemptId);
      out.push({ id: x.id, text: x.text, at: x.at, itemId: a?.itemId ?? '', failing: a?.failing ?? [] });
    }
    return c.json({ feedback: out });
  });

  app.get('/api/attend/my-profile', L, async (c: any) => {
    const me = ids.keyOf(c.get('session').personId);
    const p = await store.get('org', `person:${me}`);
    return c.json({ personId: `person:${me}`, name: p?.name ?? me });
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
}

// A one-page text PDF (no dependency): enough for a published board handout.
function miniPdf(lines: string[]): Uint8Array {
  const clean = (s: string) => s.replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');
  const stream = 'BT /F1 14 Tf 50 780 Td 20 TL ' + lines.map((l) => `(${clean(l)}) Tj T*`).join(' ') + ' ET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
