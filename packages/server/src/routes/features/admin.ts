// Server routes for the web feature group "admin": class setup, verbal syllabus, college outputs,
// certificates, feature switches and the Google opt-in (SPEC 6.3 AC-80, AC-154, AC-165, AC-169).
// Every decision calls core (D-22); this file only stores, reads and shapes data.
import { z } from 'zod';
import { certificateId, verifyCertificateId, isOn, switchDefaults, parsePackage } from '../../../../core/src/index.ts';
import { createGoogleAdapter } from '../../../../adapters/src/google.ts';

const ORG = 'org';
const dayMs = 24 * 3600 * 1000;

const setupSchema = z.object({
  program: z.string().trim().min(1, 'required'),
  cohort: z.string().trim().min(1, 'required'),
  className: z.string().trim().min(1, 'required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid-date'),
});

// Rule-based syllabus draft (no AI needed, P-3): one topic per line / bullet / semicolon, three topics a day.
export function draftSyllabus(notes: string): { days: { day: number; topics: string[] }[]; topics: string[] } {
  const topics = notes.split(/\r?\n|;/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((l) => l.length > 0);
  const days: { day: number; topics: string[] }[] = [];
  for (let i = 0; i < topics.length; i += 3) days.push({ day: days.length + 1, topics: topics.slice(i, i + 3) });
  return { days, topics };
}

function isoDate(ms: number): string { return new Date(ms).toISOString().slice(0, 10); }

// Weekday dates from a start date (Mon-Fri), `count` of them.
function scheduleFrom(startDate: string, count: number): { date: string; start: string; end: string }[] {
  const out: { date: string; start: string; end: string }[] = [];
  let t = Date.parse(`${startDate}T00:00:00Z`);
  while (out.length < count) {
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) out.push({ date: isoDate(t), start: '09:00', end: '13:00' });
    t += dayMs;
  }
  return out;
}

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

export function register(app: any, ctx: any): void {
  const store = ctx.store;
  const { fieldError, ApiError } = ctx.http;
  const keyOf = ctx.ids.keyOf;
  const stamp = (by: string) => ({ schema: ctx.schema, updatedAt: ctx.clock.now(), updatedBy: by });
  const who = (c: any): string => c.get('session')?.personId ?? 'unknown';

  async function org(): Promise<any> { return (await store.get(ORG, 'org:main')) ?? { name: 'Coach LMS', brand: {}, switches: {} }; }

  async function allCohorts(): Promise<any[]> { return store.list(ORG, 'cohort:'); }

  // Every class the caller may see: admin and coordinator all of them, others the classes they train.
  async function visibleClasses(c: any): Promise<any[]> {
    const s = c.get('session');
    const cohorts = await allCohorts();
    const programs = new Map<string, any>((await store.list(ORG, 'program:')).map((p: any) => [p.id, p]));
    const out: any[] = [];
    for (const co of cohorts) {
      for (const cid of co.classIds ?? []) {
        const cls = await store.get(`class-${keyOf(cid)}`, cid);
        if (!cls) continue;
        const staffAll = s.roles.includes('admin') || s.roles.includes('coordinator');
        if (!staffAll && !(cls.trainerIds ?? []).includes(`person:${s.personId}`)) continue;
        out.push({ id: cls.id, key: keyOf(cls.id), name: cls.name, cohortId: co.id, cohortName: co.name, programId: co.programId, programName: programs.get(co.programId)?.name ?? '' });
      }
    }
    return out;
  }

  async function classContext(classKey: string): Promise<{ cls: any; cohort: any; program: any }> {
    const cls = await store.get(`class-${classKey}`, `class:${classKey}`);
    if (!cls) throw fieldError('class', 'unknown-class', 404);
    const cohort = await store.get(ORG, cls.cohortId);
    const program = cohort ? await store.get(ORG, cohort.programId) : null;
    return { cls, cohort, program };
  }

  async function effectiveSwitches(classKey: string | null): Promise<Record<string, boolean>> {
    const o = await org();
    let layers: any = { org: o.switches ?? {} };
    if (classKey) {
      const { cls, program } = await classContext(classKey);
      layers = { class: cls.switches ?? {}, program: program?.switches ?? {}, org: o.switches ?? {} };
    }
    const out: Record<string, boolean> = {};
    for (const k of Object.keys(switchDefaults())) out[k] = isOn(k, layers);
    return out;
  }

  // ---- AC-80: create program, cohort and class; fit the schedule to the package; show the schedule ----

  app.post('/api/admin/setup-class', async (c: any) => {
    const b = await ctx.http.validateBody(c, setupSchema);
    const by = who(c);
    const pKey = ctx.ids.randomKey(), kKey = ctx.ids.randomKey(), cKey = ctx.ids.randomKey();
    await store.put(ORG, { type: 'program', id: `program:${pKey}`, name: b.program, timezone: 'Asia/Kolkata', packageRef: '', switches: {}, ...stamp(by) });
    await store.put(ORG, { type: 'cohort', id: `cohort:${kKey}`, programId: `program:${pKey}`, name: b.cohort, classIds: [`class:${cKey}`], ...stamp(by) });
    await store.put(`class-${cKey}`, {
      type: 'class', id: `class:${cKey}`, cohortId: `cohort:${kKey}`, name: b.className, trainerIds: [],
      schedule: scheduleFrom(b.startDate, 5), seedSalt: ctx.ids.randomKey(), switches: {}, passMark: 6, startDate: b.startDate, ...stamp(by),
    });
    return c.json({ classId: `class:${cKey}`, key: cKey, cohortId: `cohort:${kKey}`, programId: `program:${pKey}` });
  });

  app.post('/api/admin/classes/:id/fit-schedule', async (c: any) => {
    const key = keyOf(c.req.param('id'));
    const b = await ctx.http.validateBody(c, z.object({ packageId: z.string().min(1) }));
    const pkg = await store.get(store.priv, `package:${b.packageId}`);
    if (!pkg) throw fieldError('packageId', 'unknown-package', 404);
    const { cls } = await classContext(key);
    const days = new Set(parsePackage(pkg.files).days.map((d: any) => d.index));
    const count = Math.max(days.size, 1);
    const start = cls.startDate ?? cls.schedule?.[0]?.date ?? isoDate(ctx.clock.now());
    await store.put(`class-${key}`, { ...cls, schedule: scheduleFrom(start, count), ...stamp(who(c)) });
    return c.json({ days: count });
  });

  app.get('/api/admin/cohorts', async (c: any) => {
    const programs = new Map<string, any>((await store.list(ORG, 'program:')).map((p: any) => [p.id, p]));
    const cohorts = (await allCohorts()).map((k: any) => ({ id: k.id, name: k.name, programName: programs.get(k.programId)?.name ?? '' }));
    return c.json({ cohorts });
  });

  // Staff screens: classes the caller may see.
  app.get('/api/staff/classes', ctx.guard.role('trainer', 'substitute', 'coordinator'), async (c: any) => c.json({ classes: await visibleClasses(c) }));
  app.get('/api/admin/classes', async (c: any) => c.json({ classes: await visibleClasses(c) }));

  app.get('/api/staff/classes/:id/schedule', ctx.guard.role('trainer', 'substitute', 'coordinator'), async (c: any) => {
    const key = keyOf(c.req.param('id'));
    const { cls, cohort } = await classContext(key);
    const days = (await store.list(`class-${key}`, 'day:')).filter((d: any) => Array.isArray(d.sections));
    const byIndex = new Map<number, any>(days.map((d: any) => [d.index, d]));
    const schedule = (cls.schedule ?? []).map((s: any, index: number) => ({
      index, date: s.date, start: s.start, end: s.end,
      sections: (byIndex.get(index)?.sections ?? []).map((x: any) => ({ id: x.id, title: x.title, graded: !!x.graded })),
    }));
    return c.json({ classId: cls.id, name: cls.name, cohortName: cohort?.name ?? '', schedule });
  });

  // ---- AC-154: verbal syllabus ----

  app.post('/api/syllabus/draft', async (c: any) => {
    const b = await ctx.http.validateBody(c, z.object({ notes: z.string().min(1, 'required') }));
    return c.json(draftSyllabus(b.notes));
  });

  app.get('/api/syllabus', async (c: any) => {
    const cohortId = c.req.query('cohortId');
    if (!cohortId) throw fieldError('cohortId', 'required');
    const doc = await store.get(ORG, `syllabus:${keyOf(cohortId)}`);
    const cohort = await store.get(ORG, `cohort:${keyOf(cohortId)}`);
    if (!cohort) throw fieldError('cohortId', 'unknown-cohort', 404);
    const program = await store.get(ORG, cohort.programId);
    const o = await org();
    return c.json({
      cohort: { id: cohort.id, name: cohort.name }, program: { name: program?.name ?? '' }, org: { name: o.name, brand: o.brand ?? {} },
      syllabus: doc ? { notes: doc.notes, days: doc.days, version: doc.version, confirmedAt: doc.confirmedAt } : null,
      changeLog: doc?.changeLog ?? [],
    });
  });

  app.post('/api/syllabus', async (c: any) => {
    const b = await ctx.http.validateBody(c, z.object({ cohortId: z.string().min(1), notes: z.string().min(1, 'required') }));
    const key = keyOf(b.cohortId);
    const cohort = await store.get(ORG, `cohort:${key}`);
    if (!cohort) throw fieldError('cohortId', 'unknown-cohort', 404);
    const draft = draftSyllabus(b.notes);
    if (draft.topics.length === 0) throw fieldError('notes', 'required');
    const prev = await store.get(ORG, `syllabus:${key}`);
    const now = ctx.clock.now();
    const before = new Set<string>(prev ? prev.days.flatMap((d: any) => d.topics) : []);
    const after = new Set<string>(draft.topics);
    const added = draft.topics.filter((x) => !before.has(x));
    const removed = [...before].filter((x) => !after.has(x));
    let summary: string;
    if (!prev) summary = `Initial syllabus confirmed with ${draft.topics.length} topics`;
    else if (!added.length && !removed.length) summary = 'Confirmed again, no change to topics';
    else summary = [added.length ? `Added: ${added.join(', ')}` : '', removed.length ? `Removed: ${removed.join(', ')}` : ''].filter(Boolean).join('. ');
    const entry = { at: now, date: isoDate(now), by: who(c), summary, added, removed };
    const doc = await store.put(ORG, {
      type: 'syllabus', id: `syllabus:${key}`, cohortId: cohort.id, notes: b.notes, days: draft.days,
      version: (prev?.version ?? 0) + 1, confirmedAt: now, changeLog: [...(prev?.changeLog ?? []), entry], ...stamp(who(c)),
    });
    return c.json({ version: doc.version, changeLog: doc.changeLog });
  });

  // ---- AC-165: college outputs ----

  app.get('/api/admin/reports/:id', async (c: any) => {
    const key = keyOf(c.req.param('id'));
    const { cls, cohort, program } = await classContext(key);
    const o = await org();
    const dbName = `class-${key}`;
    const enrolments = await store.list(dbName, 'enrolment:');
    const attendanceDocs = await store.list(dbName, 'attendance:');
    const attempts = await store.list(dbName, 'attempt:');
    const passMark = cls.passMark ?? 6;
    const learners: any[] = [];
    for (const e of enrolments) {
      const person = await store.get(ORG, e.personId);
      learners.push({ personId: e.personId, name: person?.name ?? e.personId, rollNumber: e.rollNumber ?? '', status: e.status });
    }
    const days = (cls.schedule ?? []).map((s: any, index: number) => ({ index, date: s.date }));
    const attendance: Record<string, Record<number, { present: boolean; verified: boolean }>> = {};
    for (const a of attendanceDocs) {
      (attendance[a.personId] ??= {})[a.dayIndex] = { present: true, verified: !!a.verified };
    }
    const results: Record<string, { attempts: number; best: number | null; passed: boolean }> = {};
    const attain = new Map<number, { attempts: number; attained: number }>();
    for (const t of attempts) {
      if (typeof t.score !== 'number') continue;
      const r = (results[t.personId] ??= { attempts: 0, best: null, passed: false });
      r.attempts++;
      r.best = r.best === null ? t.score : Math.max(r.best, t.score);
      if (t.score >= passMark) r.passed = true;
      const m = /day-?0*(\d+)/i.exec(String(t.itemId ?? ''));
      const dayIndex = m ? Number(m[1]) : -1;
      const a = attain.get(dayIndex) ?? { attempts: 0, attained: 0 };
      a.attempts++; if (t.score >= passMark) a.attained++;
      attain.set(dayIndex, a);
    }
    const attainment = [...attain.entries()].sort((x, y) => x[0] - y[0]).map(([dayIndex, a]) => ({
      co: dayIndex >= 0 ? `CO${dayIndex + 1}` : 'CO-other', dayIndex, po: 'PO1', attempts: a.attempts, attained: a.attained,
      pct: a.attempts ? Math.round((a.attained / a.attempts) * 100) : 0,
    }));
    return c.json({
      org: { name: o.name, brand: o.brand ?? {} }, program: program?.name ?? '', cohort: cohort?.name ?? '', className: cls.name,
      passMark, days, learners, attendance, results, attainment, generatedAt: ctx.clock.now(),
    });
  });

  // Anonymous weekly feedback: stored in the private database with no person id (nothing replicates it).
  const isoWeek = (ms: number): string => {
    const d = new Date(ms); d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const y = d.getUTCFullYear();
    const week = Math.ceil(((d.getTime() - Date.UTC(y, 0, 1)) / dayMs + 1) / 7);
    return `${y}-W${String(week).padStart(2, '0')}`;
  };

  app.get('/api/me/classes', ctx.guard.role('learner'), async (c: any) => {
    const s = c.get('session');
    const out: any[] = [];
    for (const co of await allCohorts()) {
      for (const cid of co.classIds ?? []) {
        const enrolled = (await store.list(`class-${keyOf(cid)}`, 'enrolment:')).find((e: any) => e.personId === `person:${s.personId}`);
        const cls = enrolled ? await store.get(`class-${keyOf(cid)}`, cid) : null;
        if (cls) out.push({ id: cls.id, key: keyOf(cls.id), name: cls.name });
      }
    }
    return c.json({ classes: out });
  });

  app.post('/api/feedback', ctx.guard.role('learner'), async (c: any) => {
    const b = await ctx.http.validateBody(c, z.object({ classId: z.string().min(1), text: z.string().trim().min(1, 'required').max(2000) }));
    const key = keyOf(b.classId);
    const cls = await store.get(`class-${key}`, `class:${key}`);
    if (!cls) throw fieldError('classId', 'unknown-class', 404);
    const now = ctx.clock.now();
    await store.put(store.priv, { type: 'feedback', id: `feedback:${key}:${ctx.ids.randomKey()}`, classKey: key, week: isoWeek(now), at: now, text: b.text });
    return c.json({ ok: true });
  });

  app.get('/api/classes/:id/feedback', ctx.guard.role('trainer', 'coordinator'), async (c: any) => {
    const key = keyOf(c.req.param('id'));
    const items = (await store.list(store.priv, `feedback:${key}:`)).sort((a: any, b: any) => b.at - a.at);
    const weeks = new Map<string, string[]>();
    for (const f of items) weeks.set(f.week, [...(weeks.get(f.week) ?? []), f.text]);
    return c.json({ weeks: [...weeks.entries()].map(([week, texts]) => ({ week, texts })) });
  });

  // Coordinator (and trainer) read-only batch view.
  app.get('/api/batch/:id', ctx.guard.role('trainer', 'substitute', 'coordinator'), async (c: any) => {
    const key = keyOf(c.req.param('id'));
    const { cls, cohort, program } = await classContext(key);
    const dbName = `class-${key}`;
    const enrolments = await store.list(dbName, 'enrolment:');
    const attendanceDocs = await store.list(dbName, 'attendance:');
    const total = (cls.schedule ?? []).length;
    const rows: any[] = [];
    for (const e of enrolments) {
      const person = await store.get(ORG, e.personId);
      const present = attendanceDocs.filter((a: any) => a.personId === e.personId).length;
      rows.push({ personId: e.personId, name: person?.name ?? e.personId, status: e.status, present, total });
    }
    return c.json({ className: cls.name, cohort: cohort?.name ?? '', program: program?.name ?? '', rows });
  });

  // ---- Certificates (D-3, AC-58) ----

  async function certSecret(): Promise<Uint8Array> {
    const id = 'secret:certificates';
    const doc = await store.get(store.priv, id);
    if (doc) return new Uint8Array(Buffer.from(doc.key, 'base64'));
    const raw = crypto.getRandomValues(new Uint8Array(32));
    await store.put(store.priv, { id, type: 'secret', key: Buffer.from(raw).toString('base64') });
    return raw;
  }

  app.get('/api/admin/certificates', async (c: any) => {
    const learners: any[] = [];
    const programs = new Map<string, any>((await store.list(ORG, 'program:')).map((p: any) => [p.id, p]));
    for (const co of await allCohorts()) {
      for (const cid of co.classIds ?? []) {
        for (const e of await store.list(`class-${keyOf(cid)}`, 'enrolment:')) {
          if (e.status === 'dropped') continue;
          if (learners.some((l) => l.personId === e.personId && l.programId === co.programId)) continue;
          const person = await store.get(ORG, e.personId);
          learners.push({ personId: e.personId, name: person?.name ?? e.personId, programId: co.programId, programName: programs.get(co.programId)?.name ?? '' });
        }
      }
    }
    const issued = [];
    for (const d of await store.list(ORG, 'certificate:')) {
      const person = await store.get(ORG, d.personId);
      issued.push({ certId: d.certId, personId: d.personId, name: person?.name ?? d.personId, programId: d.programId, programName: programs.get(d.programId)?.name ?? '', issuedAt: d.issuedAt });
    }
    const o = await org();
    return c.json({ learners, issued, org: { name: o.name, brand: o.brand ?? {} }, enabled: (await effectiveSwitches(null)).certificates });
  });

  app.post('/api/admin/certificates', async (c: any) => {
    const b = await ctx.http.validateBody(c, z.object({ personId: z.string().min(1), programId: z.string().min(1) }));
    if (!(await effectiveSwitches(null)).certificates) throw fieldError('certificates', 'switched-off', 409);
    const personKey = keyOf(b.personId);
    const programKey = keyOf(b.programId);
    if (!(await store.get(ORG, `person:${personKey}`))) throw fieldError('personId', 'unknown-person', 404);
    if (!(await store.get(ORG, `program:${programKey}`))) throw fieldError('programId', 'unknown-program', 404);
    const existing = (await store.list(ORG, 'certificate:')).find((d: any) => d.personId === `person:${personKey}` && d.programId === `program:${programKey}`);
    if (existing) return c.json({ certId: existing.certId, issuedAt: existing.issuedAt });
    const issuedAt = ctx.clock.now();
    const certId = await certificateId(await certSecret(), `person:${personKey}`, `program:${programKey}`, issuedAt);
    await store.put(ORG, { type: 'certificate', id: `certificate:${certId}`, personId: `person:${personKey}`, programId: `program:${programKey}`, issuedAt, certId, ...stamp(who(c)) });
    return c.json({ certId, issuedAt });
  });

  // Public check page (valid or invalid); no session needed.
  app.get('/verify/:certId', async (c: any) => {
    const id = String(c.req.param('certId') ?? '').toUpperCase();
    const doc = /^[0-9A-Z]{12}$/.test(id) ? await store.get(ORG, `certificate:${id}`) : null;
    const valid = !!doc && await verifyCertificateId(id, await certSecret(), doc.personId, doc.programId, doc.issuedAt);
    let body = '<h1>Certificate is not valid</h1><p>No certificate with this id was issued by this organisation.</p>';
    if (valid) {
      const person = await store.get(ORG, doc.personId);
      const program = await store.get(ORG, doc.programId);
      const o = await org();
      body = `<h1>Certificate is valid</h1><p>Issued to <strong>${esc(person?.name)}</strong> for <strong>${esc(program?.name)}</strong> by ${esc(o.name)} on ${esc(isoDate(doc.issuedAt))}.</p><p>Certificate id <code>${esc(id)}</code></p>`;
    }
    return c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificate check</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:16px;color:#1a1a1a;background:#fff}main{max-width:640px;margin:0 auto}h1{font-size:1.5rem}</style></head><body><main data-testid="app-ready" data-valid="${valid}" id="verify-result" >${body}</main></body></html>`);
  });

  // ---- Feature switches (P-14) and the Google opt-in (AC-169) ----

  app.get('/api/switches', async (c: any) => {
    const classId = c.req.query('classId');
    return c.json({ switches: await effectiveSwitches(classId ? keyOf(classId) : null) });
  });

  app.get('/api/admin/switches', async (c: any) => c.json({ switches: await effectiveSwitches(null) }));

  app.put('/api/admin/switches', async (c: any) => {
    const b = await ctx.http.validateBody(c, z.object({ name: z.string().min(1), on: z.boolean() }));
    if (!(b.name in switchDefaults())) throw fieldError('name', 'unknown-switch');
    const o = await org();
    await store.put(ORG, { ...o, switches: { ...(o.switches ?? {}), [b.name]: b.on }, ...stamp(who(c)) });
    return c.json({ name: b.name, on: b.on });
  });

  function googleAdapter(switches: Record<string, boolean>) {
    const token = process.env.LMS_GOOGLE_ACCESS_TOKEN;
    if (!token) throw new ApiError(501, { error: { code: 'not-configured' } });
    return createGoogleAdapter({
      baseUrls: {
        meet: process.env.LMS_GOOGLE_MEET_URL ?? 'https://meet.googleapis.com',
        calendar: process.env.LMS_GOOGLE_CALENDAR_URL ?? 'https://www.googleapis.com',
        forms: process.env.LMS_GOOGLE_FORMS_URL ?? 'https://forms.googleapis.com',
      },
      accessToken: token, switches,
    });
  }

  async function classEvents(key: string) {
    const { cls, program } = await classContext(key);
    const tz = program?.timezone ?? 'Asia/Kolkata';
    return (cls.schedule ?? []).map((s: any, i: number) => ({
      id: `${key}day${i}`.toLowerCase().replace(/[^a-v0-9]/g, 'a'), title: `${cls.name}: day ${i}`,
      start: Date.parse(`${s.date}T${s.start}:00+05:30`), end: Date.parse(`${s.date}T${s.end}:00+05:30`), timezone: tz,
    }));
  }

  app.post('/api/google/calendar-sync', ctx.guard.role('trainer'), async (c: any) => {
    const b = await ctx.http.validateBody(c, z.object({ classId: z.string().min(1) }));
    const key = keyOf(b.classId);
    const sw = await effectiveSwitches(key);
    if (!sw.calendarSync) throw fieldError('calendarSync', 'switched-off', 409);
    const adapter = googleAdapter(sw);
    try {
      return c.json(await adapter.syncCalendar({ calendarId: process.env.LMS_GOOGLE_CALENDAR_ID ?? 'primary', events: await classEvents(key) }));
    } catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(502, { error: { google: 'calendar-failed' } }); }
  });

  async function classQuizzes(key: string): Promise<{ title: string; questions: { text: string; choices: string[]; answerIndex: number }[] }[]> {
    const out: any[] = [];
    for (const pkg of await store.list(store.priv, 'package:')) {
      if (pkg.classId !== key || pkg.status !== 'published') continue;
      for (const [path, text] of Object.entries<string>(pkg.files ?? {})) {
        if (!/(^|\/)bank\.json$/.test(path)) continue;
        try {
          const bank = JSON.parse(text);
          out.push({
            title: String(bank.title ?? bank.id ?? path),
            questions: (bank.questions ?? []).map((q: any) => ({ text: String(q.text), choices: (q.choices ?? []).map(String), answerIndex: Math.max(0, 'ABCDEFGH'.indexOf(String(q.answer))) })),
          });
        } catch { /* ignore a malformed bank */ }
      }
    }
    return out;
  }

  app.get('/api/staff/classes/:id/quizzes', ctx.guard.role('trainer', 'substitute'), async (c: any) => {
    const quizzes = await classQuizzes(keyOf(c.req.param('id')));
    return c.json({ quizzes: quizzes.map((q, index) => ({ index, title: q.title, questions: q.questions.length })) });
  });

  app.post('/api/google/forms-export', ctx.guard.role('trainer'), async (c: any) => {
    const b = await ctx.http.validateBody(c, z.object({ classId: z.string().min(1), quizIndex: z.number().int().min(0).default(0) }));
    const key = keyOf(b.classId);
    const sw = await effectiveSwitches(key);
    if (!sw.googleForms) throw fieldError('googleForms', 'switched-off', 409);
    const quiz = (await classQuizzes(key))[b.quizIndex];
    if (!quiz) throw fieldError('quizIndex', 'unknown-quiz', 404);
    const adapter = googleAdapter(sw);
    try { return c.json(await adapter.exportQuiz(quiz)); }
    catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(502, { error: { google: 'forms-failed' } }); }
  });
}
