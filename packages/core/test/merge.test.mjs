// AC-28, AC-29: conflict merge (SPEC §4.13), property tests with a seeded generator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRevisions } from '../src/merge.ts';

// Small seeded generator (mulberry32); no Math.random.
function gen(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (n) => Math.floor(next() * n), pick: (a) => a[Math.floor(next() * a.length)] };
}

const STATUSES = ['todo', 'doing', 'review', 'done'];

// Revisions get distinct (updatedAt, updatedBy) pairs, as real revisions do.
function makeRevisions(g, type, n) {
  const revs = [];
  const used = new Set();
  for (let i = 0; i < n; i++) {
    let updatedAt, updatedBy, key;
    do {
      updatedAt = 1000 + g.int(5);
      updatedBy = g.pick(['hub:a', 'hub:b', 'u:ann', 'u:bob', 'u:zed']);
      key = `${updatedAt}|${updatedBy}`;
    } while (used.has(key));
    used.add(key);
    const d = { type, id: `${type}:1`, schema: 1, updatedAt, updatedBy };
    if (g.int(4) > 0) d.name = g.pick(['x', 'y', 'z']);
    if (g.int(3) > 0) {
      d.history = Array.from({ length: g.int(4) }, () => ({ id: `h${g.int(5)}`, v: g.int(3) }));
      d.history = d.history.filter((e, j, a) => a.findIndex((o) => o.id === e.id) === j);
    }
    if (type === 'ticket') d.status = g.pick(STATUSES);
    if (type === 'class') {
      if (g.int(2)) d.passMark = g.int(10);
      if (g.int(2)) d.schedule = [{ date: `d${g.int(3)}` }];
      if (g.int(2)) d.switches = { a: g.int(2) === 1 };
    }
    revs.push(d);
  }
  return revs;
}

function permutations(a) {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}

for (const type of ['person', 'ticket', 'class']) {
  test(`AC-28 order-independent, idempotent, associative (${type})`, () => {
    for (let seed = 1; seed <= 150; seed++) {
      const g = gen(seed * 7919);
      const revs = makeRevisions(g, type, 3 + g.int(2));
      const ref = mergeRevisions(type, revs);
      for (const p of permutations(revs)) {
        assert.deepEqual(mergeRevisions(type, p), ref, `seed ${seed}: permutation differs`);
      }
      // idempotent
      assert.deepEqual(mergeRevisions(type, [ref.doc, ref.doc]).doc, ref.doc, `seed ${seed}: not idempotent`);
      assert.deepEqual(mergeRevisions(type, [ref.doc]).doc, ref.doc, `seed ${seed}: single re-merge`);
      // merging a revision with a result that already contains it changes nothing
      assert.deepEqual(mergeRevisions(type, [ref.doc, ...revs]), ref, `seed ${seed}: absorb`);
      // associative: every split into a left group and a right group
      for (let cut = 1; cut < revs.length; cut++) {
        const left = mergeRevisions(type, revs.slice(0, cut)).doc;
        const right = mergeRevisions(type, revs.slice(cut)).doc;
        assert.deepEqual(mergeRevisions(type, [left, right]), ref, `seed ${seed}: split ${cut}`);
      }
      // (a+b)+c versus a+(b+c) on the first three, nested one at a time
      const [a, b, c] = revs;
      const ab_c = mergeRevisions(type, [mergeRevisions(type, [a, b]).doc, c]).doc;
      const a_bc = mergeRevisions(type, [a, mergeRevisions(type, [b, c]).doc]).doc;
      assert.deepEqual(ab_c, a_bc, `seed ${seed}: (a+b)+c != a+(b+c)`);
    }
  });
}

test('AC-28 profile documents: latest updatedAt wins, tie goes to larger updatedBy', () => {
  const a = { type: 'person', id: 'person:1', schema: 1, updatedAt: 5, updatedBy: 'u:a', name: 'Old' };
  const b = { type: 'person', id: 'person:1', schema: 1, updatedAt: 9, updatedBy: 'u:a', name: 'New' };
  assert.equal(mergeRevisions('person', [a, b]).doc.name, 'New');
  const c = { ...a, updatedAt: 9, updatedBy: 'u:b', name: 'Tie' };
  assert.equal(mergeRevisions('person', [b, c]).doc.name, 'Tie');
});

test('AC-29 ticket doing vs done merges to done with the badge', () => {
  const base = { type: 'ticket', id: 'ticket:1', schema: 1 };
  const a = { ...base, updatedAt: 2, updatedBy: 'u:a', status: 'done' };
  const b = { ...base, updatedAt: 3, updatedBy: 'u:b', status: 'doing' };
  const r = mergeRevisions('ticket', [a, b]);
  assert.equal(r.doc.status, 'done');
  assert.equal(r.conflictBadge, true);
  assert.equal(mergeRevisions('ticket', [a, { ...a, updatedBy: 'u:c' }]).conflictBadge, false);
  assert.equal(mergeRevisions('ticket', [a]).conflictBadge, false);
});

test('AC-29 arrays are unioned without duplicates, sorted by id, latest element kept', () => {
  const a = { type: 'appeal', id: 'appeal:1', schema: 1, updatedAt: 1, updatedBy: 'u:a', history: [{ id: 'b', v: 1 }, { id: 'a', v: 1 }] };
  const b = { type: 'appeal', id: 'appeal:1', schema: 1, updatedAt: 2, updatedBy: 'u:b', history: [{ id: 'c', v: 2 }, { id: 'a', v: 2 }] };
  const r = mergeRevisions('appeal', [b, a]).doc;
  assert.deepEqual(r.history.map((e) => e.id), ['a', 'b', 'c']);
  assert.equal(r.history[0].v, 2);
});

test('AC-29 a learner change to passMark is ignored; hubFields records the hub source', () => {
  const hub = { type: 'class', id: 'class:1', schema: 1, updatedAt: 10, updatedBy: 'hub:main', passMark: 6, schedule: [], switches: {} };
  const learner = { type: 'class', id: 'class:1', schema: 1, updatedAt: 20, updatedBy: 'u:ann', passMark: 1 };
  const r = mergeRevisions('class', [hub, learner]).doc;
  assert.equal(r.passMark, 6);
  assert.deepEqual(r.hubFields.passMark, { value: 6, updatedAt: 10 });
  assert.equal(r.updatedBy, 'u:ann');
  const later = { ...hub, updatedAt: 15, passMark: 7 };
  assert.equal(mergeRevisions('class', [r, later]).doc.passMark, 7);
});

test('inputs are not mutated and empty input throws', () => {
  const a = { type: 'person', id: 'person:1', schema: 1, updatedAt: 1, updatedBy: 'u:a', history: [{ id: 'x' }] };
  const snap = JSON.stringify(a);
  mergeRevisions('person', [a]);
  assert.equal(JSON.stringify(a), snap);
  assert.throws(() => mergeRevisions('person', []));
});
