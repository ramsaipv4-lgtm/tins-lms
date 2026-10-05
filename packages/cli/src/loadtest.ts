// `lms loadtest` (SPEC Appendix B, AC-103): simulated learners sign in, mark attendance, answer a live quiz and
// sync against a LOCAL hub started in test mode. It uses /__test/login, so it only ever talks to loopback hosts.
import { percentile, withinPct } from './stats.ts';

export type Summary = {
  learners: number; requests: number; within1sPct: number; p95Ms: number;
  quizAnswers: number; quizWindowMs: number; lostWrites: number; pass: boolean;
};

/** Requests in flight at once. All learners act in the same phase, but a phone network and a browser never open 200 sockets together. */
export const CONCURRENCY = 40;

export const LIMITS = { within1sPct: 95, quizWindowMs: 10_000, requestMs: 1000 };

/** The load test refuses anything but a loopback target: it logs in through /__test/*, which only a test hub has. */
export function assertLocalTarget(target: string): URL {
  let u: URL;
  try { u = new URL(target); } catch { throw new Error(`invalid --target: ${target}`); }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`refusing non-local target ${u.hostname}: the load test only runs against a local hub in test mode`);
  }
  return u;
}

type Client = { name: string; cookie: string };

export async function runLoadTest(opts: { target: string; learners: number; fetchImpl?: typeof fetch }): Promise<Summary> {
  const base = assertLocalTarget(opts.target).origin;
  const doFetch = opts.fetchImpl ?? fetch;
  const n = opts.learners;
  // Runs one task per learner with at most CONCURRENCY in flight; each request is timed from the moment it is sent.
  async function eachLearner<T>(list: Client[], task: (l: Client) => Promise<T>): Promise<T[]> {
    const out: T[] = new Array(list.length);
    let next = 0;
    const worker = async () => { while (next < list.length) { const i = next++; out[i] = await task(list[i]); } };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
    return out;
  }
  const durations: number[] = [];
  let failures = 0;

  // One timed request. A non-2xx answer or a thrown error counts as slow-and-failed: it is in the sample, never dropped.
  async function call(client: Client | null, path: string, method: string, body?: unknown): Promise<{ status: number; json: any }> {
    const headers: Record<string, string> = {};
    if (client?.cookie) headers.cookie = client.cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const t0 = performance.now();
    try {
      const r = await doFetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const set = r.headers.get('set-cookie');
      if (client && set) client.cookie = set.split(';')[0];
      const text = await r.text();
      let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
      durations.push(performance.now() - t0);
      if (r.status >= 300) failures++;
      return { status: r.status, json };
    } catch {
      durations.push(Infinity);
      failures++;
      return { status: 0, json: null };
    }
  }

  const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const classKey = `lt${run}`;
  const db = `class-${classKey}`;
  const today = new Date().toISOString().slice(0, 10);
  const stamp = Date.now();
  const doc = (type: string, key: string, extra: Record<string, unknown>) =>
    ({ _id: `${type}:${key}`, id: `${type}:${key}`, type, schema: 1, updatedAt: stamp, updatedBy: 'loadtest', ...extra });

  // Staff session and a synthetic class: one day today, n enrolments.
  const staff: Client = { name: 'lt-trainer', cookie: '' };
  await call(staff, '/__test/login', 'POST', { personId: staff.name, roles: ['admin', 'trainer'] });
  const learners: Client[] = Array.from({ length: n }, (_, i) => ({ name: `lt-l${i + 1}`, cookie: '' }));
  const setupDocs = [
    doc('class', classKey, { cohortId: 'cohort:lt', name: 'Load test', trainerIds: [staff.name], schedule: [{ date: today, start: '09:00', end: '13:00' }], seedSalt: `salt-${run}`, switches: {}, passMark: 6 }),
    doc('day', `${classKey}-0`, { index: 0, date: today, sections: [], released: [] }),
    ...learners.map((l) => doc('enrolment', l.name, { personId: l.name, joinedAt: stamp, status: 'active', profile: 'phone' })),
  ];
  const setup = await call(staff, `/db/${db}/_bulk_docs`, 'POST', { docs: setupDocs });
  if (setup.status >= 300) throw new Error(`class setup failed (${setup.status}); is the target a hub started with LMS_TEST_MODE=1?`);
  durations.length = 0; failures = 0; // setup is not part of the learner traffic being measured

  // 1. Sign in.
  await eachLearner(learners, (l) => call(l, '/__test/login', 'POST', { personId: l.name, roles: ['learner'] }));

  // 2. Attendance with the rotating code.
  const code = await call(staff, `/api/classes/${classKey}/attendance-code`, 'GET');
  await eachLearner(learners, (l) => call(l, `/api/classes/${classKey}/attendance`, 'POST', { code: code.json?.code }));

  // 3. Live quiz: answers in bursts of CONCURRENCY; the window runs from the first send to the last response.
  const quizStart = performance.now();
  const answers = await eachLearner(learners, (l) => call(l, `/api/classes/${classKey}/attempts`, 'POST', {
    itemId: 'day0:quiz:1', mode: 'live', answers: [{ itemId: 'q1', given: 'a' }], aiUsage: [],
    timing: { hubStart: stamp, hubEnd: stamp + 1000, monotonicMs: 1000, deviceStart: stamp, deviceEnd: stamp + 1000 },
  }));
  const quizWindowMs = Math.round(performance.now() - quizStart);
  const quizAnswers = answers.filter((a) => a.status === 201).length;

  // 4. Sync: each learner writes a document into the class database over the replication endpoint.
  await eachLearner(learners, (l) => call(l, `/db/${db}/_bulk_docs`, 'POST', {
    docs: [doc('exitTicket', `${l.name}-0`, { personId: l.name, dayIndex: 0, choiceIds: [], text: 'ok' })],
  }));

  // 5. Count what the hub kept. A write is lost when its acknowledged document is not there afterwards.
  const kept = async (prefix: string): Promise<number> => {
    const r = await call(staff, `/db/${db}/_all_docs?startkey=%22${prefix}%3A%22&endkey=%22${prefix}%3A%EF%BF%B0%22`, 'GET');
    return Array.isArray(r.json?.rows) ? r.json.rows.length : 0;
  };
  const [att, attempts, tickets] = [await kept('attendance'), await kept('attempt'), await kept('exitTicket')];
  const lostWrites = Math.max(0, n - att) + Math.max(0, n - attempts) + Math.max(0, n - tickets);

  const within1sPct = withinPct(durations, LIMITS.requestMs);
  const p95Ms = Math.round(percentile(durations.filter(Number.isFinite), 95));
  const pass = within1sPct >= LIMITS.within1sPct && quizAnswers === n && quizWindowMs <= LIMITS.quizWindowMs && lostWrites === 0;
  return { learners: n, requests: durations.length, within1sPct, p95Ms, quizAnswers, quizWindowMs, lostWrites, pass };
}
