// Server routes for the web feature group "shift" (b7-6): the Shift engine (AC-86), sprint rituals (AC-87),
// corporate practice (AC-164), peer review and pair programming (AC-161) and the practice forge (AC-170).
// All routes resolve the caller's class from the session; elapsed Shift time always comes from ctx.clock.
import { z } from 'zod';
import {
  startShift, applyShiftEvent, slaReport, scoreShift, pokerRound, parseStandup, effectiveLimitMs, isOn,
} from '../../../../core/src/index.ts';
import { createForgejoAdapter } from '../../../../adapters/src/forgejo.ts';

const MIN = 60_000;
const PAIR_SWAP_MS = 15 * MIN;
const CARDS = [1, 2, 3, 5, 8, 13];

export function register(app: any, ctx: any): void {
  const store = ctx.store;
  const { fieldError, ApiError } = ctx.http;
  const now = () => ctx.clock.now();
  const sid = (c: any): string => c.get('session').personId;
  const stamp = (doc: any, by: string) => ({ schema: ctx.schema, updatedAt: now(), updatedBy: by, ...doc });
  const body = async <T>(c: any, schema: z.ZodType<T>): Promise<T> => ctx.http.validateBody(c, schema);
  const rid = (n = 4): string => ctx.ids.randomKey().slice(0, n);

  // Writes that read-modify-write one document run one at a time, so two quick requests never lose an event.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };

  // ---- class resolution ---------------------------------------------------------------------------
  async function classFor(c: any): Promise<{ key: string; db: string; cls: any; me: string; isStaff: boolean }> {
    const s = c.get('session');
    const me = s.personId as string;
    const isStaff = s.roles.some((r: string) => r === 'trainer' || r === 'admin' || r === 'substitute');
    const names: string[] = store.names().filter((n: string) => /^class-[^/]+$/.test(n)).sort();
    let fallback: any = null;
    for (const db of names) {
      const key = db.slice('class-'.length);
      const cls = await store.get(db, `class:${key}`);
      if (!cls) continue;
      fallback ??= { key, db, cls };
      if (isStaff) {
        if ((cls.trainerIds ?? []).includes(`person:${me}`)) return { key, db, cls, me, isStaff };
      } else {
        const en = (await store.list(db, 'enrolment:')).find((e: any) => e.personId === `person:${me}` && e.status !== 'dropped');
        if (en) return { key, db, cls, me, isStaff };
      }
    }
    if (fallback && isStaff) return { ...fallback, me, isStaff };
    throw new ApiError(404, { error: { class: 'no-class' } });
  }
  const teamOf = (cls: any, me: string): string => {
    for (const [team, members] of Object.entries<string[]>(cls.teams ?? {})) if (members.includes(`person:${me}`)) return team;
    return `solo-${me}`;
  };
  const nameOf = async (personId: string): Promise<string> => {
    const p = await store.get('org', personId);
    return p?.name ?? personId.replace(/^person:/, '');
  };

  // ---- Shift (AC-86) ------------------------------------------------------------------------------
  async function loadPack(classKey: string, packId?: string): Promise<any> {
    const pkgs = await store.list(store.priv, 'package:');
    for (const pkg of pkgs.sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0))) {
      if (pkg.classId && pkg.classId !== classKey) continue;
      for (const [path, text] of Object.entries<string>(pkg.files ?? {})) {
        if (!/\.json$/.test(path) || !/shift/i.test(path)) continue;
        try {
          const p = JSON.parse(text);
          if (Array.isArray(p?.tickets) && Array.isArray(p?.rubric) && (!packId || p.id === packId)) return p;
        } catch { /* not a pack */ }
      }
    }
    return null;
  }

  async function runsOf(db: string, team: string): Promise<any[]> {
    const all = await store.list(db, 'shiftRun:');
    return all.filter((r: any) => r.teamId === team && r.state?.startedAt)
      .sort((a: any, b: any) => a.state.startedAt - b.state.startedAt);
  }

  function replay(pack: any, run: any) {
    let st = startShift(pack, run.seed, run.state.startedAt);
    for (const e of run.state.events ?? []) st = applyShiftEvent(st, e);
    return st;
  }

  async function limitFor(pack: any, me: string): Promise<number> {
    const p = await store.get('org', `person:${me}`);
    const acc = p?.accommodations;
    const mult = Array.isArray(acc) ? acc.find((a: any) => a?.timeMultiplier)?.timeMultiplier : acc?.timeMultiplier;
    return effectiveLimitMs(pack.durationMin * MIN, mult ? { timeMultiplier: Number(mult) } : null);
  }

  async function shiftView(c: any) {
    const { key, db, cls, me } = await classFor(c);
    const team = teamOf(cls, me);
    const runs = await runsOf(db, team);
    const run = runs[runs.length - 1];
    const pack = await loadPack(key, run?.packId);
    if (!run || !pack) {
      // No run yet: still tell the learner the (accommodated) limit so the Shift screen can show it before the start.
      const any = pack ?? (await loadPack(key));
      return { status: 'none', hasPack: !!any, team, ...(any ? { limitMs: await limitFor(any, me), durationMin: any.durationMin } : {}) };
    }
    const limitMs = await limitFor(pack, me);
    const finished = !!run.state.finished;
    const eff = finished ? (run.state.finishedAtMs ?? 0) : Math.min(Math.max(0, now() - run.state.startedAt), limitMs);
    const st = replay(pack, run);
    const sla = slaReport(st, eff);
    const byId = new Map<string, any>(pack.tickets.map((t: any) => [t.id, t]));
    const tickets = sla.map((r: any) => {
      const spec = byId.get(r.ticketId);
      const stt = st.tickets.find((x: any) => x.id === r.ticketId);
      const deadline = (spec.arrivesAtMin + spec.slaMin) * MIN;
      return {
        id: r.ticketId, title: spec.title, detail: stt?.variant ?? null, priority: spec.priority,
        kind: spec.check.kind, status: r.status, minutesLeft: r.minutesLeft,
        msLeft: Math.max(0, deadline - eff), slaMin: spec.slaMin,
        acked: st.progress[r.ticketId]?.ackedAtMs !== null,
      };
    });
    const out: any = {
      status: finished ? 'finished' : 'running', team, runId: run.id, mode: run.mode ?? pack.rubric[0].mode,
      elapsedMs: eff, limitMs, durationMin: pack.durationMin, tickets,
    };
    if (finished) {
      const sc = scoreShift(st, out.mode);
      out.score = { ...sc, pct: sc.max ? Math.round((sc.score / sc.max) * 100) : 0 };
    }
    return out;
  }

  app.get('/api/shift/state', ctx.guard.auth, async (c: any) => c.json(await shiftView(c)));

  const startSchema = z.object({ mode: z.enum(['live', 'recorded', 'emulated']).optional() });
  app.post('/api/shift/start', ctx.guard.auth, async (c: any) => {
    const b = await body(c, startSchema);
    const { key, db, cls, me } = await classFor(c);
    const team = teamOf(cls, me);
    const runs = await runsOf(db, team);
    if (runs.some((r) => !r.state.finished)) return c.json(await shiftView(c));
    const pack = await loadPack(key);
    if (!pack) throw fieldError('pack', 'no-shift-pack', 404);
    const members = (cls.teams?.[team] ?? [`person:${me}`]) as string[];
    const n = runs.length + 1;
    await store.put(db, stamp({
      type: 'shiftRun', id: `shiftRun:${key}-${team}-${rid(6)}-${n}`, packId: pack.id,
      seed: `${cls.seedSalt ?? key}:${team}:${n}`, teamId: team, mode: b.mode ?? pack.rubric[0].mode,
      state: { startedAt: now(), events: [], finished: false }, personIds: members,
    }, `person:${me}`));
    return c.json(await shiftView(c));
  });

  const eventSchema = z.object({ kind: z.enum(['ack', 'resolve', 'escalate']), ticketId: z.string().min(1), answer: z.string().optional() });
  app.post('/api/shift/events', ctx.guard.auth, (c: any) => serial(async () => {
    const b = await body(c, eventSchema);
    const { key, db, cls, me } = await classFor(c);
    const run = (await runsOf(db, teamOf(cls, me))).filter((r) => !r.state.finished).pop();
    if (!run) throw fieldError('shift', 'not-started', 409);
    const pack = await loadPack(key, run.packId);
    const limitMs = await limitFor(pack, me);
    const atMs = now() - run.state.startedAt;
    if (atMs > limitMs) throw fieldError('shift', 'time-up', 409);
    const before = replay(pack, run);
    const ev: any = { kind: b.kind, ticketId: b.ticketId, atMs };
    if (b.answer !== undefined) ev.answer = b.answer;
    const after = applyShiftEvent(before, ev);
    const accepted = b.kind !== 'resolve'
      || (before.progress[b.ticketId]?.resolvedAtMs === null && after.progress[b.ticketId]?.resolvedAtMs !== null);
    if (accepted) await store.put(db, { ...run, state: { ...run.state, events: [...(run.state.events ?? []), ev] }, updatedAt: now() });
    return c.json({ accepted, ...(await shiftView(c)) });
  }));

  app.post('/api/shift/finish', ctx.guard.auth, async (c: any) => {
    const { key, db, cls, me } = await classFor(c);
    const run = (await runsOf(db, teamOf(cls, me))).filter((r) => !r.state.finished).pop();
    if (!run) return c.json(await shiftView(c));
    const pack = await loadPack(key, run.packId);
    const sc = scoreShift(replay(pack, run), run.mode ?? pack.rubric[0].mode);
    await store.put(db, {
      ...run, scorePct: sc.max ? Math.round((sc.score / sc.max) * 100) : 0, finishedAt: now(), updatedAt: now(),
      state: { ...run.state, finished: true, finishedAtMs: Math.min(now() - run.state.startedAt, await limitFor(pack, me)) },
    });
    return c.json(await shiftView(c));
  });

  // ---- class context, switches, pair programming (AC-161) --------------------------------------------
  app.get('/api/shift/context', ctx.guard.auth, async (c: any) => {
    const { key, cls, me } = await classFor(c);
    const org = await store.get('org', 'org:main');
    const layers = { class: cls.switches ?? {}, org: org?.switches ?? {} };
    const team = teamOf(cls, me);
    const members = await Promise.all((cls.teams?.[team] ?? [`person:${me}`]).map(async (p: string) => ({ id: p, name: await nameOf(p) })));
    return c.json({ classKey: key, team, members, me, pairProgramming: isOn('pairProgramming', layers), githubPass: isOn('githubPass', layers) });
  });

  const settingsSchema = z.object({ pairProgramming: z.boolean() });
  app.post('/api/shift/settings', ctx.guard.role('trainer'), async (c: any) => {
    const b = await body(c, settingsSchema);
    const { db, key, cls } = await classFor(c);
    const next = await store.put(db, { ...cls, switches: { ...(cls.switches ?? {}), pairProgramming: b.pairProgramming }, updatedAt: now() });
    return c.json({ classKey: key, switches: next.switches });
  });

  app.get('/api/shift/pair', ctx.guard.auth, async (c: any) => {
    const { db, cls, me } = await classFor(c);
    const team = teamOf(cls, me);
    const id = `pairSession:${team}`;
    let doc = await store.get(db, id);
    if (!doc) doc = await store.put(db, stamp({ type: 'pairSession', id, teamId: team, startedAt: now(), swaps: 0 }, `person:${me}`));
    const members = await Promise.all((cls.teams?.[team] ?? [`person:${me}`]).map((p: string) => nameOf(p)));
    const n = members.length || 1;
    return c.json({
      team, members, driver: members[doc.swaps % n], navigator: members[(doc.swaps + 1) % n] ?? members[0],
      swaps: doc.swaps, leftMs: Math.max(0, doc.startedAt + PAIR_SWAP_MS - now()), swapMs: PAIR_SWAP_MS,
    });
  });
  app.post('/api/shift/pair/swap', ctx.guard.auth, async (c: any) => {
    const { db, cls, me } = await classFor(c);
    const doc = await store.get(db, `pairSession:${teamOf(cls, me)}`);
    if (doc) await store.put(db, { ...doc, startedAt: now(), swaps: (doc.swaps ?? 0) + 1, updatedAt: now() });
    return c.json({ ok: true });
  });

  // ---- peer review (AC-161) ------------------------------------------------------------------------
  app.get('/api/peer/reviews', ctx.guard.auth, async (c: any) => {
    const { db, me } = await classFor(c);
    const list = (await store.list(db, 'review:')).filter((r: any) => r.reviewer === `person:${me}`);
    return c.json(await Promise.all(list.map(async (r: any) => ({
      id: r.id, title: r.title, prRef: r.prRef, author: await nameOf(r.author), checklist: r.checklist ?? [],
      submitted: !!r.submittedAt, score: r.score ?? null, checked: r.checked ?? [], comment: r.comment ?? '',
    }))));
  });
  const reviewSchema = z.object({ checked: z.array(z.string()), comment: z.string().max(2000).default('') });
  app.post('/api/peer/reviews/:id', ctx.guard.auth, async (c: any) => {
    const b = await body(c, reviewSchema);
    const { db, me } = await classFor(c);
    const raw = c.req.param('id');
    const r = await store.get(db, raw.startsWith('review:') ? raw : `review:${raw}`);
    if (!r || r.reviewer !== `person:${me}`) throw fieldError('review', 'not-found', 404);
    const ids = new Set<string>((r.checklist ?? []).map((x: any) => x.id));
    const checked = b.checked.filter((x) => ids.has(x));
    const score = { points: checked.length, total: ids.size, pct: Math.round((checked.length / (ids.size || 1)) * 100) };
    await store.put(db, { ...r, checked, comment: b.comment, score, submittedAt: now(), updatedAt: now() });
    return c.json({ score });
  });

  // ---- sprint rituals (AC-87) ----------------------------------------------------------------------
  const standupSchema = z.object({ yesterday: z.string().max(1000).default(''), today: z.string().max(1000).default(''), blockers: z.string().max(1000).default('') });
  const dayOf = () => new Date(now()).toISOString().slice(0, 10);
  app.post('/api/rituals/standup', ctx.guard.auth, async (c: any) => {
    const b = await body(c, standupSchema);
    if (!b.yesterday.trim() && !b.today.trim() && !b.blockers.trim()) throw fieldError('today', 'required');
    const { db, me } = await classFor(c);
    const r = parseStandup(b);
    await store.put(db, stamp({
      type: 'standup', id: `standup:${dayOf()}-${me}`, personId: `person:${me}`, day: dayOf(), ...b,
      blocked: r.blocked, blockerText: r.blockerText,
    }, `person:${me}`));
    return c.json({ blocked: r.blocked });
  });
  app.get('/api/rituals/standup', ctx.guard.auth, async (c: any) => {
    const { db } = await classFor(c);
    const list = (await store.list(db, 'standup:')).filter((s: any) => s.day === dayOf());
    return c.json(await Promise.all(list.map(async (s: any) => ({
      id: s.id, name: await nameOf(s.personId), yesterday: s.yesterday, today: s.today, blockers: s.blockers, blocked: !!s.blocked,
    }))));
  });

  const latestRound = async (db: string) =>
    (await store.list(db, 'pokerRound:')).sort((a: any, b: any) => b.startedAt - a.startedAt)[0];
  async function pokerView(c: any) {
    const { db, me } = await classFor(c);
    const round = await latestRound(db);
    if (!round) return { round: null };
    const votes: Record<string, number> = round.votes ?? {};
    const out: any = { round: { id: round.id, title: round.title, revealed: !!round.revealed, voted: Object.keys(votes).length, mine: votes[`person:${me}`] ?? null, cards: CARDS } };
    if (round.revealed) {
      const res = pokerRound(votes);
      const named = (ids: string[]) => Promise.all(ids.map(nameOf));
      out.round.votes = await Promise.all(Object.entries(votes).map(async ([p, v]) => ({ name: await nameOf(p), value: v })));
      out.round.result = res.result === 'consensus'
        ? { result: 'consensus', points: res.points }
        : { result: 'discuss', low: await named(res.low), high: await named(res.high) };
    }
    return out;
  }
  app.get('/api/rituals/poker', ctx.guard.auth, async (c: any) => c.json(await pokerView(c)));
  const pokerStart = z.object({ title: z.string().max(200).default('') });
  app.post('/api/rituals/poker/start', ctx.guard.auth, async (c: any) => {
    const b = await body(c, pokerStart);
    const { db, me } = await classFor(c);
    await store.put(db, stamp({ type: 'pokerRound', id: `pokerRound:${now()}-${rid()}`, title: b.title, startedAt: now(), votes: {}, revealed: false }, `person:${me}`));
    return c.json(await pokerView(c));
  });
  const voteSchema = z.object({ points: z.number().int() });
  app.post('/api/rituals/poker/vote', ctx.guard.auth, async (c: any) => {
    const b = await body(c, voteSchema);
    if (!CARDS.includes(b.points)) throw fieldError('points', 'invalid-card');
    const { db, me } = await classFor(c);
    const round = await latestRound(db);
    if (!round) throw fieldError('round', 'not-started', 409);
    if (round.revealed) throw fieldError('round', 'already-revealed', 409);
    await store.put(db, { ...round, votes: { ...round.votes, [`person:${me}`]: b.points }, updatedAt: now() });
    return c.json(await pokerView(c));
  });
  app.post('/api/rituals/poker/reveal', ctx.guard.auth, async (c: any) => {
    const { db } = await classFor(c);
    const round = await latestRound(db);
    if (!round) throw fieldError('round', 'not-started', 409);
    if (Object.keys(round.votes ?? {}).length === 0) throw fieldError('round', 'no-votes', 409);
    await store.put(db, { ...round, revealed: true, updatedAt: now() });
    return c.json(await pokerView(c));
  });

  const retroSchema = z.object({ text: z.string().trim().min(1).max(500), column: z.enum(['well', 'improve']).default('well') });
  app.get('/api/rituals/retro', ctx.guard.auth, async (c: any) => {
    const { db } = await classFor(c);
    return c.json((await store.list(db, 'retroItem:')).sort((a: any, b: any) => a.createdAt - b.createdAt)
      .map((r: any) => ({ id: r.id, text: r.text, column: r.column, ticketId: r.ticketId ?? null })));
  });
  app.post('/api/rituals/retro', ctx.guard.auth, async (c: any) => {
    const b = await body(c, retroSchema);
    const { db, me } = await classFor(c);
    const id = `retroItem:${now()}-${rid()}`;
    await store.put(db, stamp({ type: 'retroItem', id, text: b.text, column: b.column, createdAt: now(), ticketId: null }, `person:${me}`));
    return c.json({ id });
  });
  app.post('/api/rituals/retro/:id/ticket', ctx.guard.auth, async (c: any) => {
    const { db, me } = await classFor(c);
    const raw = c.req.param('id');
    const item = await store.get(db, raw.startsWith('retroItem:') ? raw : `retroItem:${raw}`);
    if (!item) throw fieldError('item', 'not-found', 404);
    if (item.ticketId) return c.json({ ticketId: item.ticketId });
    const tid = `ticket:${rid(8)}`;
    await store.put(db, stamp({ type: 'ticket', id: tid, title: item.text, status: 'todo', points: null, iteration: null, acceptance: `Done when: ${item.text}`, source: item.id }, `person:${me}`));
    await store.put(db, { ...item, ticketId: tid, updatedAt: now() });
    return c.json({ ticketId: tid });
  });

  // ---- tickets with acceptance criteria (C-5) ---------------------------------------------------------
  app.get('/api/corp/tickets', ctx.guard.auth, async (c: any) => {
    const { db } = await classFor(c);
    return c.json((await store.list(db, 'ticket:')).map((t: any) => ({ id: t.id, title: t.title, status: t.status, points: t.points ?? null, acceptance: t.acceptance ?? '' })));
  });
  const ticketSchema = z.object({ title: z.string().trim().min(1).max(200), acceptance: z.string().trim().min(1, 'required').max(1000) });
  app.post('/api/corp/tickets', ctx.guard.auth, async (c: any) => {
    const b = await body(c, ticketSchema);
    const { db, me } = await classFor(c);
    const id = `ticket:${rid(8)}`;
    await store.put(db, stamp({ type: 'ticket', id, title: b.title, status: 'todo', points: null, iteration: null, acceptance: b.acceptance, assignee: `person:${me}` }, `person:${me}`));
    return c.json({ id });
  });

  // ---- change requests and deploys (C-4) ----------------------------------------------------------------
  const crSchema = z.object({ summary: z.string().trim().min(1).max(300), rollback: z.string().trim().min(1).max(500) });
  const crOut = async (r: any) => ({ id: r.id, summary: r.summary, rollback: r.rollback, status: r.status, by: await nameOf(r.requestedBy), used: !!r.usedBy });
  app.get('/api/corp/change-requests', ctx.guard.auth, async (c: any) => {
    const { db } = await classFor(c);
    return c.json(await Promise.all((await store.list(db, 'changeRequest:')).sort((a: any, b: any) => a.createdAt - b.createdAt).map(crOut)));
  });
  app.post('/api/corp/change-requests', ctx.guard.auth, async (c: any) => {
    const b = await body(c, crSchema);
    const { db, me } = await classFor(c);
    const id = `changeRequest:${now()}-${rid()}`;
    const doc = await store.put(db, stamp({ type: 'changeRequest', id, ...b, status: 'pending', requestedBy: `person:${me}`, createdAt: now() }, `person:${me}`));
    return c.json(await crOut(doc));
  });
  const decideSchema = z.object({ approve: z.boolean() });
  app.post('/api/corp/change-requests/:id/decide', ctx.guard.role('trainer'), async (c: any) => {
    const b = await body(c, decideSchema);
    const { db, me } = await classFor(c);
    const raw = c.req.param('id');
    const r = await store.get(db, raw.startsWith('changeRequest:') ? raw : `changeRequest:${raw}`);
    if (!r) throw fieldError('changeRequest', 'not-found', 404);
    const doc = await store.put(db, { ...r, status: b.approve ? 'approved' : 'rejected', decidedBy: `person:${me}`, updatedAt: now() });
    return c.json(await crOut(doc));
  });
  const deploySchema = z.object({ environment: z.enum(['staging', 'prod']) });
  app.get('/api/corp/deploys', ctx.guard.auth, async (c: any) => {
    const { db } = await classFor(c);
    const list = (await store.list(db, 'deploy:')).sort((a: any, b: any) => a.at - b.at);
    return c.json(list.map((d: any) => ({ id: d.id, environment: d.environment, changeRequestId: d.changeRequestId ?? null, at: d.at })));
  });
  app.post('/api/corp/deploys', ctx.guard.auth, async (c: any) => {
    const b = await body(c, deploySchema);
    const { db, me } = await classFor(c);
    let crId: string | null = null;
    if (b.environment === 'prod') {
      const cr = (await store.list(db, 'changeRequest:')).sort((a: any, z2: any) => a.createdAt - z2.createdAt)
        .find((r: any) => r.status === 'approved' && !r.usedBy);
      if (!cr) throw fieldError('changeRequest', 'approval-required', 403);
      await store.put(db, { ...cr, usedBy: `person:${me}`, updatedAt: now() });
      crId = cr.id;
    }
    const id = `deploy:${now()}-${rid()}`;
    await store.put(db, stamp({ type: 'deploy', id, environment: b.environment, changeRequestId: crId, at: now() }, `person:${me}`));
    return c.json({ id, environment: b.environment });
  });

  // ---- runbook / ADR templates graded by rubric (C-8) -----------------------------------------------------
  const RUBRICS: Record<string, { id: string; re: RegExp }[]> = {
    runbook: [
      { id: 'trigger', re: /\b(when|trigger|alert|symptom)/i }, { id: 'steps', re: /\b(step|1\.|first|then)/i },
      { id: 'rollback', re: /\b(rollback|roll back|revert)/i }, { id: 'contact', re: /\b(contact|escalat|on-?call|owner)/i },
    ],
    adr: [
      { id: 'context', re: /\bcontext/i }, { id: 'decision', re: /\bdecision|we will|we chose/i },
      { id: 'options', re: /\boption|alternative/i }, { id: 'consequences', re: /\bconsequence|trade-?off/i },
    ],
  };
  const gradeSchema = z.object({ kind: z.enum(['runbook', 'adr']), text: z.string().max(5000) });
  app.post('/api/corp/templates/grade', ctx.guard.auth, async (c: any) => {
    const b = await body(c, gradeSchema);
    const { db, me } = await classFor(c);
    const rows = RUBRICS[b.kind].map((r) => ({ id: r.id, pass: r.re.test(b.text) }));
    const earned = rows.filter((r) => r.pass).length;
    await store.put(db, stamp({ type: 'templateDoc', id: `templateDoc:${b.kind}-${me}`, kind: b.kind, text: b.text, rows, earned, max: rows.length }, `person:${me}`));
    return c.json({ kind: b.kind, rows, earned, max: rows.length });
  });

  // ---- demo day (C-9) and the leaked-key drill (C-12) ---------------------------------------------------------
  const SLOTS = ['14:00', '14:15', '14:30', '14:45', '15:00'];
  app.get('/api/corp/demo', ctx.guard.auth, async (c: any) => {
    const { db, cls, me } = await classFor(c);
    const team = teamOf(cls, me);
    const booked = await store.list(db, 'demoSlot:');
    return c.json({ team, slots: SLOTS.map((s) => ({ slot: s, team: booked.find((b: any) => b.slot === s)?.teamId ?? null })), mine: booked.find((b: any) => b.teamId === team)?.slot ?? null });
  });
  const bookSchema = z.object({ slot: z.string().refine((s) => SLOTS.includes(s), 'invalid-slot') });
  app.post('/api/corp/demo', ctx.guard.auth, async (c: any) => {
    const b = await body(c, bookSchema);
    const { db, cls, me } = await classFor(c);
    const team = teamOf(cls, me);
    const booked = await store.list(db, 'demoSlot:');
    if (booked.some((x: any) => x.slot === b.slot && x.teamId !== team)) throw fieldError('slot', 'taken', 409);
    for (const x of booked) if (x.teamId === team) await store.remove(db, x.id);
    await store.put(db, stamp({ type: 'demoSlot', id: `demoSlot:${b.slot.replace(':', '')}`, slot: b.slot, teamId: team }, `person:${me}`));
    return c.json({ ok: true });
  });

  const DRILL = ['revoke', 'rotate', 'scrub', 'report'];
  const drillOf = async (db: string, team: string) => (await store.get(db, `keyDrill:${team}`)) ?? { done: [] as string[] };
  app.get('/api/corp/drill', ctx.guard.auth, async (c: any) => {
    const { db, cls, me } = await classFor(c);
    const d = await drillOf(db, teamOf(cls, me));
    return c.json({ started: await drillStarted(db), steps: DRILL, done: d.done, complete: DRILL.every((s) => d.done.includes(s)) });
  });
  async function drillStarted(db: string) { return !!(await store.get(db, 'drillRun:current')); }
  app.post('/api/corp/drill/start', ctx.guard.role('trainer'), async (c: any) => {
    const { db, me } = await classFor(c);
    await store.put(db, stamp({ type: 'drillRun', id: 'drillRun:current', startedAt: now() }, `person:${me}`));
    return c.json({ started: true });
  });
  app.get('/api/corp/drill/overview', ctx.guard.role('trainer'), async (c: any) => {
    const { db, cls } = await classFor(c);
    const teams = await Promise.all(Object.keys(cls.teams ?? {}).map(async (team) => ({ team, done: (await drillOf(db, team)).done.length })));
    return c.json({ started: await drillStarted(db), total: DRILL.length, teams });
  });
  const drillSchema = z.object({ step: z.string().refine((s) => DRILL.includes(s), 'invalid-step') });
  app.post('/api/corp/drill', ctx.guard.auth, async (c: any) => {
    const b = await body(c, drillSchema);
    const { db, cls, me } = await classFor(c);
    const team = teamOf(cls, me);
    if (!(await drillStarted(db))) throw fieldError('drill', 'not-started', 409);
    const d = await drillOf(db, team);
    const need = DRILL[d.done.length];
    if (b.step !== need && !d.done.includes(b.step)) throw fieldError('step', `next-is-${need}`, 409);
    const done = d.done.includes(b.step) ? d.done : [...d.done, b.step];
    await store.put(db, stamp({ type: 'keyDrill', id: `keyDrill:${team}`, teamId: team, done }, `person:${me}`));
    return c.json({ started: true, steps: DRILL, done, complete: DRILL.every((s) => done.includes(s)) });
  });

  // ---- practice forge (AC-170, §20.1) ------------------------------------------------------------------------
  const forgeId = (me: string) => `forge:${me}`;
  async function accounts(c: any) {
    const me = sid(c);
    const person = await store.get('org', `person:${me}`);
    const f = await store.get(store.priv, forgeId(me));
    const cls = await classFor(c).then((x) => x.cls).catch(() => null);
    const org = await store.get('org', 'org:main');
    return {
      githubUser: person?.githubUser ?? null, forgeUser: person?.forgeUser ?? f?.username ?? null,
      done: !!f?.done, repos: f?.repos ?? [], moved: !!f?.movedAt,
      githubPass: isOn('githubPass', { class: cls?.switches ?? {}, org: org?.switches ?? {} }),
    };
  }
  app.get('/api/forge/state', ctx.guard.auth, async (c: any) => c.json(await accounts(c)));
  app.post('/api/forge/check', ctx.guard.auth, async (c: any) => {
    const me = sid(c);
    const existing = await store.get(store.priv, forgeId(me));
    if (!existing?.done) {
      const username = `learner-${me}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const repo = `practice-${username}`;
      const url = process.env.LMS_FORGEJO_URL;
      const org = process.env.LMS_FORGEJO_ORG || 'tins-practice';
      if (url) {
        const adapter = createForgejoAdapter({ apiUrl: url, token: process.env.LMS_FORGEJO_TOKEN || 'practice-admin', org });
        try {
          await adapter.provisionLearner({ username, email: `${username}@practice.invalid`, team: 'learners', template: `${org}/practice-template`, repo });
        } catch {
          throw fieldError('forge', 'forge-unreachable', 502);
        }
      }
      await store.put(store.priv, { id: forgeId(me), type: 'forgeState', username, done: true, repos: [`${org}/${repo}`], simulated: !url, doneAt: now() });
      await ctx.people.savePerson(ctx, me, { forgeUser: username });
    }
    return c.json(await accounts(c));
  });
  const linkSchema = z.object({ githubUser: z.string().trim().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, 'invalid-username') });
  app.post('/api/forge/link', ctx.guard.auth, async (c: any) => {
    const b = await body(c, linkSchema);
    await ctx.people.savePerson(ctx, sid(c), { githubUser: b.githubUser });
    return c.json(await accounts(c));
  });
  app.post('/api/forge/move', ctx.guard.auth, async (c: any) => {
    const me = sid(c);
    const person = await store.get('org', `person:${me}`);
    if (!person?.githubUser) throw fieldError('githubUser', 'link-first', 409);
    const f = await store.get(store.priv, forgeId(me));
    if (!f?.done) throw fieldError('forge', 'exercise-first', 409);
    await store.put(store.priv, { ...f, movedAt: now(), movedTo: person.githubUser });
    return c.json(await accounts(c));
  });
}
