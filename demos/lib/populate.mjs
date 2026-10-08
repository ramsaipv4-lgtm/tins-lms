// Fills the demo hub through the app's own HTTP API, acting as the demo people, so no screen is empty.
// Every call is made as a real signed-in person (test-mode login), exactly as their browser would.
import { P, at, LEARNERS } from './people.mjs';

const C = 'c1';
const DAY0_ANSWERS = ['kettle init', 'kettle.toml', 'public', 'kettle build', '--version', 'pages', 'kettle clean', '.md'];

/** n of the 8 day-0 diagnostic questions answered right, the rest wrong. */
export function diagAnswers(correct) {
  return DAY0_ANSWERS.map((a, i) => ({ n: i + 1, answer: i < correct ? a : 'not sure' }));
}

export async function attendanceCode(hub) {
  const r = await hub.api(P.trainer, `/api/classes/${C}/attendance-code`);
  return r.json.code;
}

/** Learners enter the trainer's rotating code. */
export async function markAttendance(hub, who) {
  const code = await attendanceCode(hub);
  for (const k of who) await hub.api(P[k], '/api/attend/mark', 'POST', { code });
}

let _n = 0;
const el = (type, x, y, w, h, extra = {}) => ({
  id: `demo-${++_n}`, type, x, y, width: w, height: h, angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'solid',
  strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [], frameId: null, index: `a${(_n - 1) % 10}`, roundness: type === 'rectangle' ? { type: 3 } : null,
  seed: 1000 + _n, version: 1, versionNonce: 2000 + _n, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, ...extra,
});
const text = (x, y, t) => el('text', x, y, t.length * 11, 24, { text: t, originalText: t, fontSize: 20, fontFamily: 5, textAlign: 'left', verticalAlign: 'top', containerId: null, lineHeight: 1.25, autoResize: true });

/** Two board pages the trainer drew on day 0 (kept in the class, so the handover pack and the board screen are not empty). */
export async function populateBoard(hub) {
  _n = 0;
  const page1 = [el('rectangle', 80, 80, 200, 90, { backgroundColor: '#a5d8ff' }), text(110, 112, 'kettle init'), el('rectangle', 380, 80, 200, 90, { backgroundColor: '#b2f2bb' }), text(410, 112, 'kettle build'), text(80, 220, 'Source pages in /pages, output in /public')];
  const page2 = [el('ellipse', 120, 90, 180, 90, { backgroundColor: '#ffec99' }), text(160, 122, 'Theme'), el('rectangle', 420, 90, 200, 90), text(450, 122, 'Template')];
  await hub.api(P.trainer, '/api/board/classes/c1/pages/day0-build', 'PUT', { title: 'Day 0: build', order: 0, dayIndex: 0, elements: page1 });
  await hub.api(P.trainer, '/api/board/classes/c1/pages/day0-themes', 'PUT', { title: 'Day 0: themes', order: 1, dayIndex: 0, elements: page2 });
}

/** Everything that happened on day 0 (Mon 2 Nov), ending with the trainer's wrap-up at 13:00. Leaves the clock at 18:00. */
export async function populateDay0(hub) {
  // 09:03 attendance: nine present, three absent (l4, s7, s8). Day-0 attendance comes from the seed 'demo-att-d0'
  // (documents in the person:<key> form that the coordinator's batch view counts); the demos mark later days live.
  await hub.clock(at(0, '09:03'));

  // 09:25 doubts: one named, one anonymous with votes, one answered
  await hub.clock(at(0, '09:25'));
  const ask = async (who, text, anonymous = false) => {
    const r = await hub.api(P[who], '/api/classroom/doubts', 'POST', { text, anonymous });
    return r.json;
  };
  await ask('s1', 'How do I preview the site before publishing?');
  const d2 = await ask('s3', 'Why does kettle build skip my drafts folder?', true);
  const d3 = await ask('l3', 'Is kettle.toml the only place to set the site title?');
  const listed = (await hub.api(P.trainer, '/api/classroom/doubts')).json.doubts;
  const idOf = (txt) => listed.find((d) => d.text === txt)?.id;
  const anon = idOf('Why does kettle build skip my drafts folder?');
  if (anon) for (const k of ['l2', 'l3', 's5']) await hub.api(P[k], `/api/classroom/doubts/${encodeURIComponent(anon)}/upvote`, 'POST', {}, { allowFail: true });
  const done = idOf('Is kettle.toml the only place to set the site title?');
  if (done) await hub.api(P.trainer, `/api/classroom/doubts/${encodeURIComponent(done)}/answered`, 'POST', {}, { allowFail: true });

  // 10:45 the day-0 diagnostic: a spread of scores
  await hub.clock(at(0, '10:45'));
  const scores = { l1: 6, l2: 8, l3: 5, s1: 7, s2: 8, s3: 4, s4: 7, s5: 6, s6: 8 };
  for (const [k, n] of Object.entries(scores)) await hub.api(P[k], '/api/learn/diagnostic', 'POST', { day: 0, answers: diagAnswers(n) });

  await hub.clock(at(0, '11:10'));
  await populateBoard(hub);

  // 11:30 trainer notes (trainers only)
  await hub.clock(at(0, '11:30'));
  await hub.api(P.trainer, `/api/classes/${C}/notes`, 'POST', { personId: 'person:s3', text: 'Needed help with the build folder; check in again tomorrow.' });
  await hub.api(P.trainer, `/api/classes/${C}/notes`, 'POST', { personId: 'person:l2', text: 'Very quick today. Could pair with Mira on the lab.' });

  // 12:50 exit tickets
  await hub.clock(at(0, '12:50'));
  const et = (await hub.api(P.l1, '/api/learn/exit-ticket')).json;
  const unclear = et.choices.filter((c) => c.kind === 'unclear').map((c) => c.id);
  const picks = { l1: [unclear[1], 'pace-fast'], l2: ['all-clear'], l3: [unclear[1]], s1: [unclear[1]], s3: [unclear[0], unclear[1]], s4: ['all-clear'], s5: ['pace-slow'] };
  const free = { l1: 'Still unsure about the clean command', s3: 'Could we repeat how the public folder is built?' };
  for (const [k, ids] of Object.entries(picks)) await hub.api(P[k], '/api/learn/exit-ticket', 'POST', { choiceIds: ids.filter(Boolean), text: free[k] });

  // 12:58 the trainer wraps up the day: board PDF, quick-learn and cards go out, a draft delivery report is created
  await hub.clock(at(0, '12:58'));
  await hub.api(P.trainer, `/api/classes/${C}/wrap-up`, 'POST', { day: 0 });

  // 18:00 evening: some learners review their cards (a mix of ratings)
  await hub.clock(at(0, '18:00'));
  const ratings = ['good', 'good', 'easy', 'again', 'good'];
  let r = 0;
  for (const k of ['l2', 'l3', 's1', 's2', 's4', 's5', 's6']) {
    const cards = (await hub.api(P[k], '/api/learn/cards')).json.cards || [];
    for (const c of cards.slice(0, 2)) await hub.api(P[k], '/api/learn/cards/review', 'POST', { id: c.id, rating: ratings[r++ % ratings.length] });
  }
}

/** A few more things for the class days after day 0: stand-ups, a poker round, a retro item, feedback, a Shift run. */
export async function populateRituals(hub) {
  await hub.clock(at(1, '09:12'));
  const su = [
    ['l2', 'Built the home page', 'Add the about page', ''],
    ['s1', 'Set up the Kettle site', 'Write the README', 'Waiting on the theme folder from Aarav'],
    ['s2', 'Read the deep dive', 'Pair on the build step', ''],
    ['s5', 'Fixed the kettle.toml title', 'Try a custom theme', ''],
  ];
  for (const [k, y, t, b] of su) await hub.api(P[k], '/api/rituals/standup', 'POST', { yesterday: y, today: t, blockers: b });
  await hub.api(P.l3, '/api/rituals/retro', 'POST', { text: 'Pairing on the build step worked well', column: 'well' });
  await hub.api(P.s6, '/api/rituals/retro', 'POST', { text: 'The theme folder layout is confusing', column: 'improve' });
  await hub.api(P.trainer, '/api/rituals/poker/start', 'POST', { title: 'Add a health endpoint' });
  for (const [k, v] of [['l2', 3], ['s1', 3], ['s2', 5], ['s5', 3]]) await hub.api(P[k], '/api/rituals/poker/vote', 'POST', { points: v });
  await hub.api(P.trainer, '/api/rituals/poker/reveal', 'POST', {});
  // an appeal against a published score (needs the 'appeal' seed): the trainer will find it in the inbox
  await hub.api(P.l1, '/api/classroom/appeals', 'POST', { attemptId: 'attempt:c1-l1-day0-quiz', reason: 'Question 4 answer matches the key' }, { allowFail: true });
  for (const [k, t] of [['s1', 'Great pace; more lab time on publishing please.'], ['s4', 'The handout was really clear.']]) await hub.api(P[k], '/api/feedback', 'POST', { classId: C, text: t });
}

/** Team-b already ran a Shift earlier in the day (so score history exists); the demo learners run their own live. */
export async function populateShiftRun(hub, who = 'l3', day = 1) {
  await hub.clock(at(day, '10:00'));
  await hub.api(P[who], '/api/shift/start', 'POST', { mode: 'live' });
  await hub.api(P[who], '/api/shift/events', 'POST', { kind: 'ack', ticketId: 'T1' }, { allowFail: true });
  await hub.clock(at(day, '10:09'));
  await hub.api(P[who], '/api/shift/events', 'POST', { kind: 'resolve', ticketId: 'T1', answer: 'missing build step' }, { allowFail: true });
  await hub.clock(at(day, '10:40'));
  await hub.api(P[who], '/api/shift/finish', 'POST', {});
}

/** Twelve learners answer the day-0 diagnostic. Item 8 is answered right by everyone (a planted too-easy question) and
 *  "kettle make" is the wrong answer many give on item 4, so item analysis and misconception suggestions have something to show. */
export async function populateDiagnosticMatrix(hub) {
  await hub.clock(at(0, '10:45'));
  const wrong = {
    l1: { 3: 'build', 7: 'kettle reset' }, l2: { 4: 'kettle make' }, l3: { 2: 'kettle.json', 4: 'kettle make', 6: 'src', 7: 'kettle reset' },
    l4: { 3: 'dist', 4: 'kettle make', 5: '-v', 6: 'src', 7: 'kettle reset' }, s1: { 4: 'kettle make' }, s2: {}, s3: { 3: 'build', 4: 'kettle make', 6: 'src' },
    s4: { 5: '-v' }, s5: { 4: 'kettle make', 7: 'kettle reset' }, s6: {}, s7: { 2: 'kettle.json', 5: '-v', 6: 'src' }, s8: { 4: 'kettle make', 7: 'kettle reset' },
  };
  for (const k of LEARNERS.filter((x) => x !== 'l4')) { // l4 joins later in the course
    const answers = DAY0_ANSWERS.map((a, i) => ({ n: i + 1, answer: wrong[k]?.[i + 1] ?? a }));
    await hub.api(P[k], '/api/learn/diagnostic', 'POST', { day: 0, answers });
  }
}

/** Graded work with the trimmings the trainer's screens can show: l3 sat a quiz offline (no hub-signed times) with the AI
 *  policy "explain-only" and two confirmed AI suggestions that were never read; the trainer signed off the score. */
export async function populateGradedWork(hub) {
  await hub.clock(at(1, '11:30'));
  const t0 = at(1, '10:30');
  const r = await hub.api(P.l3, '/api/classes/c1/attempts', 'POST', {
    itemId: 'day1:quiz', mode: 'live', aiPolicy: 'explain-only',
    answers: [{ itemId: 'day1:quiz:1', given: 'single.html', correct: true }, { itemId: 'day1:quiz:2', given: 'list.html', correct: false }],
    timing: { hubStart: null, hubEnd: null, monotonicMs: 1_500_000, deviceStart: t0, deviceEnd: t0 + 1_500_000 },
    aiUsage: [{ at: t0 + 300_000, toolKind: 'chat', confirmed: true, read: false }, { at: t0 + 900_000, toolKind: 'chat', confirmed: true, read: false }],
  });
  await hub.api(P.trainer, `/api/classes/c1/attempts/${r.json.id}/grade`, 'POST', { score: 4 });
  await hub.api(P.l3, '/api/classroom/appeals', 'POST', { attemptId: `attempt:${r.json.id}`, reason: 'The AI suggestions were applied before I could read them' });
  return r.json.id;
}
