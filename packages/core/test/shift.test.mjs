// AC-22, AC-23, AC-24
import test from 'node:test';
import assert from 'node:assert/strict';
import { startShift, applyShiftEvent, slaReport, scoreShift } from '../src/index.ts';

const pack = {
  id: 'p1',
  durationMin: 60,
  tickets: [
    { id: 't1', title: 'A', arrivesAtMin: 0, slaMin: 10, priority: 'p1', variants: ['a', 'b', 'c', 'd'], check: { kind: 'answer', expected: '42' } },
    { id: 't2', title: 'B', arrivesAtMin: 5, slaMin: 20, priority: 'p2', check: { kind: 'command', expected: 'ls' } },
    { id: 't3', title: 'C', arrivesAtMin: 30, slaMin: 10, priority: 'p3', variants: ['x', 'y'], check: { kind: 'file', expected: 'f' } },
  ],
  rubric: [
    { mode: 'live', rows: [{ id: 't1', weight: 3 }, { id: 't2', weight: 2 }, { id: 't3', weight: 1 }] },
    { mode: 'recorded', rows: [{ id: 't1', weight: 1 }, { id: 't2', weight: 1 }] },
  ],
};
const m = (min) => min * 60_000;

test('AC-22 same seed same variants; tickets appear on time', () => {
  const a = startShift(pack, 'seed-1', 1000);
  const b = startShift(pack, 'seed-1', 1000);
  assert.deepEqual(a.tickets, b.tickets);
  assert.deepEqual(a.tickets.map((t) => t.id), ['t1', 't2', 't3']);
  assert.ok(['x', 'y'].includes(a.tickets[2].variant));
  assert.deepEqual(slaReport(a, 0).map((r) => r.ticketId), ['t1']);
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(startShift(pack, 'seed-' + i, 0).tickets[0].variant);
  assert.ok(seen.size > 1, 'different seeds can choose different variants');
  const later = applyShiftEvent(a, { kind: 'ack', ticketId: 't1', atMs: m(5) });
  assert.deepEqual(slaReport(later, m(5)).map((r) => r.ticketId), ['t1', 't2']);
  assert.equal(later.tickets[1].variant, null);
  const early = applyShiftEvent(a, { kind: 'resolve', ticketId: 't3', atMs: m(10) });
  assert.equal(slaReport(early, m(31))[2].status, 'waiting', 'a ticket that has not arrived cannot be resolved');
});

test('AC-23 breached, resolved, waiting with minutes left', () => {
  let s = startShift(pack, 's', 0);
  s = applyShiftEvent(s, { kind: 'resolve', ticketId: 't1', atMs: m(11) });
  s = applyShiftEvent(s, { kind: 'resolve', ticketId: 't2', atMs: m(10) });
  const r = slaReport(s, m(12));
  assert.deepEqual(r.map((x) => x.status), ['breached', 'resolved']);
  assert.equal(r[0].minutesLeft, null);
  const w = slaReport(startShift(pack, 's', 0), m(4));
  assert.deepEqual(w, [{ ticketId: 't1', status: 'waiting', minutesLeft: 6 }]);
  const unresolved = slaReport(startShift(pack, 's', 0), m(11));
  assert.equal(unresolved[0].status, 'breached');
});

test('AC-24 score by mode, wrong answer earns nothing, modeFlag', () => {
  let s = startShift(pack, 's', 0);
  s = applyShiftEvent(s, { kind: 'resolve', ticketId: 't1', atMs: m(2), answer: 'wrong' });
  s = applyShiftEvent(s, { kind: 'resolve', ticketId: 't2', atMs: m(6), answer: 'ls' });
  let live = scoreShift(s, 'live');
  assert.deepEqual(live, { score: 2, max: 6, rows: [{ id: 't1', earned: 0 }, { id: 't2', earned: 2 }, { id: 't3', earned: 0 }], modeFlag: false });
  s = applyShiftEvent(s, { kind: 'resolve', ticketId: 't1', atMs: m(3), answer: '42' });
  const rec = scoreShift(s, 'recorded');
  assert.equal(rec.max, 2);
  assert.equal(rec.score, 2);
  assert.equal(rec.modeFlag, true);
  assert.ok(scoreShift(s, 'live').score <= scoreShift(s, 'live').max);
});
