// Results and the player document (task g-2): gameResult writing, card / errorNote / mastery upserts for Knowledge mistakes
// only, XP and coins as caches over results and purchases, merge-safety. SPEC §13.3 "Finishing a round", §13.6, §13.11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordRound, loadResults, refreshPlayer, lastByGame, scoreRound } from '../src/engine/results.ts';
import { emptyPlayer, mergePlayers, normalizePlayer, patchPlayer, totals, withCaches } from '../src/engine/player.ts';
import { masteryMap } from '../../core/src/mastery.ts';
import { createRound } from '../src/engine/round.ts';
import { TUNING } from '../src/tuning.ts';

function memStore() {
  const dbs = new Map();
  const db = (n) => { if (!dbs.has(n)) dbs.set(n, new Map()); return dbs.get(n); };
  return {
    dbs,
    async get(n, id) { const d = db(n).get(id); return d ? structuredClone(d) : null; },
    async put(n, doc) { db(n).set(doc.id, structuredClone(doc)); return structuredClone(doc); },
    async list(n, prefix = '') { return [...db(n).values()].filter((d) => d.id.startsWith(prefix)).map((d) => structuredClone(d)); },
  };
}
const pack = { game: 'syntax-drop', id: 'sd-strike', title: 'Strike', day: 1, concepts: ['html.headings', 'html.text-size'], language: 'en', levels: [{ id: '1', title: 'a', lesson: [] }] };
const base = (over = {}) => ({ personKey: 'l1', classKey: 'c1', pack, levelId: '1', assist: false, seed: 7, now: 1000, schema: 1, tuning: TUNING, ...over });
const cleanRound = () => {
  const r = createRound(TUNING, 4);
  r.addSkill(255);
  for (const [i, c] of [['a', 'html.headings'], ['b', 'html.headings'], ['c', 'html.text-size'], ['d', 'html.text-size']]) r.socketCorrect(i, c);
  return r;
};

// ---- (6) gameResult writing and the card / error note upserts ----
test('results: one gameResult with every field of §13.11, stars equal to knowledgeStars, numbers from the Tuning formulas', async () => {
  const store = memStore();
  const { gameResult, player } = await recordRound(store, base({ result: cleanRound().result('won', 61234.4) }));
  const stored = await store.get('person-l1', gameResult.id);
  assert.deepEqual(stored, gameResult);
  for (const f of ['personId', 'classId', 'gameId', 'packId', 'levelId', 'score', 'stars', 'skill', 'knowledgeStars', 'xp', 'coins', 'outcome', 'mistakes', 'assist', 'durationMs', 'at', 'seed', 'claimed', 'assisted']) assert.ok(f in stored, f);
  assert.equal(stored.personId, 'person:l1');
  assert.equal(stored.classId, 'class:c1');
  assert.equal(stored.knowledgeStars, 3);
  assert.equal(stored.stars, stored.knowledgeStars);
  assert.equal(stored.skill, 255);
  assert.equal(stored.score, 255 + 400);
  assert.equal(stored.xp, Math.round(255 / 10) + 20 * 3);
  assert.equal(stored.coins, 5 * 3 + Math.floor(255 / 100));
  assert.equal(stored.durationMs, 61234);
  assert.deepEqual(stored.mistakes, []);
  assert.equal(player.xp, stored.xp);
  assert.equal(player.coins, stored.coins);
});
test('results: action misses only: mistakes [], 3 knowledge stars, and no card, no error note, no mastery change beyond the concepts played', async () => {
  const store = memStore();
  const r = cleanRound();
  r.actionMiss(); r.actionMiss(); r.actionMiss(); r.addSkill(-30);
  await recordRound(store, base({ result: r.result('won', 1000) }));
  const names = [...store.dbs.get('person-l1').keys()];
  assert.equal(names.filter((n) => n.startsWith('card:')).length, 0);
  assert.equal(names.filter((n) => n.startsWith('errorNote:')).length, 0);
  const checks = await store.list('person-l1', 'masteryCheck:');
  assert.deepEqual(checks.map((c) => [c.skill, c.score]).sort(), [['html.headings', 1], ['html.text-size', 1]], 'full marks on the concepts played; nothing lowered by misses');
});
test('results: exactly one Knowledge mistake makes exactly one card, one error note and the matching mastery score', async () => {
  const store = memStore();
  const r = createRound(TUNING, 4);
  r.addSkill(200);
  r.knowledgeMistake({ itemId: 'p-h7', concept: 'html.headings', question: 'What does <h7> do?', given: 'p-h7 in slot s1', correct: 'Nothing: there is no <h7>.' });
  for (const [i, c] of [['a', 'html.headings'], ['b', 'html.headings'], ['c', 'html.text-size'], ['d', 'html.text-size']]) r.socketCorrect(i, c);
  const { gameResult } = await recordRound(store, base({ result: r.result('won', 5000) }));
  assert.deepEqual(gameResult.mistakes, [{ itemId: 'p-h7', concept: 'html.headings' }], 'only itemId and concept are stored');
  assert.equal(gameResult.knowledgeStars, 2);
  const cards = await store.list('person-l1', 'card:');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, 'card:game-syntax-drop-sd-strike-p-h7');
  assert.equal(cards[0].concept, 'html.headings');
  assert.equal(cards[0].deck, 'games');
  assert.equal(cards[0].sourceRef, `${gameResult.id}#p-h7`);
  assert.equal(cards[0].front, 'What does <h7> do?');
  assert.equal(cards[0].back, 'Nothing: there is no <h7>.');
  assert.equal(cards[0].fsrs.due, 1000);
  const notes = await store.list('person-l1', 'errorNote:');
  assert.equal(notes.length, 1);
  assert.deepEqual([notes[0].dayIndex, notes[0].subtopic, notes[0].question, notes[0].given, notes[0].correct], [1, 'html.headings', 'What does <h7> do?', 'p-h7 in slot s1', 'Nothing: there is no <h7>.']);
  const checks = Object.fromEntries((await store.list('person-l1', 'masteryCheck:')).map((c) => [c.skill, c]));
  assert.equal(checks['html.headings'].score, 0.5, '1 - 1 mistake / 2 sockets');
  assert.equal(checks['html.text-size'].score, 1);
  assert.equal(checks['html.headings'].at, gameResult.at);
});
test('results: repeating a mistake upserts the same card and note (no duplicate); the card keeps its review history and is due again', async () => {
  const store = memStore();
  const mistake = (q) => { const r = createRound(TUNING, 1); r.knowledgeMistake({ itemId: 'p-h7', concept: 'html.headings', question: q, correct: 'x' }); r.socketCorrect('a', 'html.headings'); return r.result('won', 1); };
  await recordRound(store, base({ result: mistake('Q1'), now: 1000 }));
  const card = await store.get('person-l1', 'card:game-syntax-drop-sd-strike-p-h7');
  await store.put('person-l1', { ...card, fsrs: { ...card.fsrs, reps: 3, due: 99999 } });
  await recordRound(store, base({ result: mistake('Q1 again'), now: 2000 }));
  assert.equal((await store.list('person-l1', 'card:')).length, 1);
  assert.equal((await store.list('person-l1', 'errorNote:')).length, 1);
  assert.equal((await store.list('person-l1', 'gameResult:')).length, 2);
  const again = await store.get('person-l1', 'card:game-syntax-drop-sd-strike-p-h7');
  assert.equal(again.fsrs.reps, 3);
  assert.equal(again.fsrs.due, 2000, 'a repeated mistake is due now');
  assert.equal(again.front, 'Q1 again');
});
test('results: mastery checks feed the §4.4 map; two good rounds 25 h apart master a concept', async () => {
  const store = memStore();
  const round = () => cleanRound().result('won', 1);
  await recordRound(store, base({ result: round(), now: 1000 }));
  const map = async () => masteryMap((await store.list('person-l1', 'masteryCheck:')).map((c) => ({ skill: c.skill, score: c.score, at: c.at })));
  assert.equal((await map())['html.headings'], 'not-yet');
  await recordRound(store, base({ result: round(), now: 1000 + 25 * 3600 * 1000 }));
  assert.equal((await map())['html.headings'], 'mastered');
});
test('results: two rounds in one millisecond (a frozen test clock) stay two results; the same clientKey writes once', async () => {
  const store = memStore();
  await recordRound(store, base({ result: cleanRound().result('won', 1) }));
  await recordRound(store, base({ result: cleanRound().result('won', 1) }));
  assert.equal((await loadResults(store, 'l1')).length, 2);
  const s2 = memStore();
  await recordRound(s2, base({ result: cleanRound().result('won', 1), clientKey: 'k1' }));
  await recordRound(s2, base({ result: cleanRound().result('won', 1), clientKey: 'k1', now: 5000 }));
  assert.equal((await loadResults(s2, 'l1')).length, 1);
});
test('results: lost rounds are written too; assist and the sniper / whack extras are carried', async () => {
  const store = memStore();
  const r = createRound(TUNING, 3); r.addSkill(40); r.setClaimed(4); r.addAssisted(2); r.addGoldenCoins(10);
  const { gameResult } = await recordRound(store, base({ result: r.result('lost', 9000), assist: true }));
  assert.deepEqual([gameResult.outcome, gameResult.assist, gameResult.claimed, gameResult.assisted, gameResult.knowledgeStars], ['lost', true, 4, 2, 0]);
  assert.equal(gameResult.coins, 10 + 0 + 0);
  assert.equal(scoreRound(r.result('lost', 1), TUNING).xp, 4);
  const last = lastByGame(await loadResults(store, 'l1'));
  assert.deepEqual(last['syntax-drop'], { score: 40, stars: 0 });
});

// ---- (7) the player document ----
test('player: xp and coins equal the sums over gameResults and purchases and survive a reload (re-read from the store)', async () => {
  const store = memStore();
  await recordRound(store, base({ result: cleanRound().result('won', 1), now: 1000 }));
  const second = createRound(TUNING, 2); second.addSkill(120); second.socketCorrect('a', 'html.headings');
  await recordRound(store, base({ result: second.result('won', 1), now: 2000, levelId: '1' }));
  const results = await loadResults(store, 'l1');
  const want = totals(results, []);
  const stored = await store.get('person-l1', 'player:l1');
  assert.deepEqual([stored.xp, stored.coins], [want.xp, want.coins]);
  const reloaded = await refreshPlayer(store, 'l1', 3000, 1);
  assert.deepEqual([reloaded.xp, reloaded.coins], [want.xp, want.coins]);
  // purchases lower coins, not xp
  await store.put('person-l1', { ...stored, purchases: [{ itemId: 'scope-zoom', price: 7, at: 5 }] });
  const afterBuy = await refreshPlayer(store, 'l1', 3000, 1);
  assert.deepEqual([afterBuy.xp, afterBuy.coins], [want.xp, want.coins - 7]);
});
test('player: a seeded player whose caches disagree with the results is corrected on the next write; a missing player is created', async () => {
  const store = memStore();
  await store.put('person-l1', { type: 'gameResult', id: 'gameResult:l1-p-1', xp: 120, coins: 40 });
  await store.put('person-l1', { type: 'gameResult', id: 'gameResult:l1-p-2', xp: 80, coins: 25 });
  const made = await refreshPlayer(store, 'l1', 10, 1);
  assert.deepEqual([made.xp, made.coins], [200, 65]);
  await store.put('person-l1', { ...made, xp: 5, coins: 5 });
  const fixed = await refreshPlayer(store, 'l1', 11, 1);
  assert.deepEqual([fixed.xp, fixed.coins], [200, 65]);
  assert.equal((await store.get('person-l1', 'player:l1')).xp, 200);
});
test('player: defaults and a patch (seen flags only grow; offset clamped to +-150; xp, coins, gear and purchases are not settable)', () => {
  const p = emptyPlayer('l1', 5);
  assert.deepEqual([p.timingOffsetMs, p.settings, p.seen, p.cosmetics, p.gear, p.purchases], [0, { autoAdvance: false }, { prologue: false, intro: {}, scenes: {} }, [], [], []]);
  const a = patchPlayer(p, { seen: { prologue: true, intro: { 'syntax-drop': true } }, avatar: { look: 'block', color: 'teal', nameTag: 'Zed' }, timingOffsetMs: 400, settings: { autoAdvance: true }, xp: 9999, gear: ['dash'], purchases: [{ itemId: 'x', price: 1, at: 1 }] }, 6, 'l1');
  assert.equal(a.seen.prologue, true);
  assert.deepEqual(a.seen.intro, { 'syntax-drop': true });
  assert.equal(a.timingOffsetMs, 150);
  assert.equal(patchPlayer(a, { timingOffsetMs: -999 }, 7, 'l1').timingOffsetMs, -150);
  assert.equal(a.settings.autoAdvance, true);
  assert.deepEqual([a.xp, a.gear, a.purchases], [0, [], []]);
  const b = patchPlayer(a, { seen: { prologue: false, intro: { 'syntax-drop': false } } }, 8, 'l1');
  assert.deepEqual([b.seen.prologue, b.seen.intro['syntax-drop']], [true, true], 'a flag is never cleared');
  assert.deepEqual(normalizePlayer({ timingOffsetMs: 7000, seen: { intro: { a: true, b: false } } }, 'l1').seen.intro, { a: true });
});
function rand(seed) { let x = seed; return () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; }
function randomPlayer(r, i) {
  const pick = (xs) => xs.filter(() => r() < 0.5);
  const p = emptyPlayer('l1', 0);
  return {
    ...p, updatedAt: Math.floor(r() * 5), updatedBy: ['l1', 'l1-b'][Math.floor(r() * 2)] + i, xp: Math.floor(r() * 9), coins: Math.floor(r() * 9),
    cosmetics: pick(['hat', 'cape', 'fox']), gear: pick(['dash', 'boots', 'wide']),
    purchases: pick([{ itemId: 'hat', price: 3, at: 1 }, { itemId: 'dash', price: 5, at: 2 }, { itemId: 'boots', price: 4, at: 3 }]),
    seen: { prologue: r() < 0.5, intro: Object.fromEntries(pick(['syntax-drop', 'sniper']).map((g) => [g, true])), scenes: Object.fromEntries(pick(['a', 'b', 'c']).map((g) => [g, true])) },
    timingOffsetMs: Math.floor(r() * 300) - 150, settings: { autoAdvance: r() < 0.5 },
    ...(r() < 0.5 ? { avatar: { look: 'block', color: 'red', nameTag: 'n' + Math.floor(r() * 9) } } : {}),
  };
}
test('player: merging revisions is commutative, associative and idempotent, never loses a flag or a purchase (generated)', () => {
  const r = rand(11);
  for (let i = 0; i < 200; i++) {
    const a = randomPlayer(r, 1), b = randomPlayer(r, 2), c = randomPlayer(r, 3);
    // unique stamps so latest-wins is decided without ties
    a.updatedAt = 1; b.updatedAt = 2; c.updatedAt = 3;
    assert.deepEqual(mergePlayers(a, b), mergePlayers(b, a));
    assert.deepEqual(mergePlayers(mergePlayers(a, b), c), mergePlayers(a, mergePlayers(b, c)));
    assert.deepEqual(mergePlayers(a, a), mergePlayers(mergePlayers(a, a), a));
    const m = mergePlayers(mergePlayers(a, b), c);
    for (const x of [a, b, c]) {
      assert.ok(x.gear.every((g) => m.gear.includes(g)) && x.cosmetics.every((g) => m.cosmetics.includes(g)));
      assert.ok(x.purchases.every((p) => m.purchases.some((q) => q.itemId === p.itemId && q.at === p.at)));
      assert.ok(!x.seen.prologue || m.seen.prologue);
      assert.ok(Object.keys(x.seen.intro).every((g) => m.seen.intro[g]) && Object.keys(x.seen.scenes).every((g) => m.seen.scenes[g]));
    }
  }
});
test('player: after a merge the caches are recomputed from the results, so two devices agree (merge-safe XP and coins)', () => {
  const results = [{ xp: 120, coins: 40 }, { xp: 80, coins: 25 }, { xp: 20, coins: 5 }];
  const a = { ...emptyPlayer('l1', 1), xp: 200, coins: 65 };            // device A has seen the first two results
  const b = { ...emptyPlayer('l1', 2), xp: 220, coins: 70, purchases: [{ itemId: 'hat', price: 10, at: 9 }] }; // device B saw all three and bought a hat
  const merged = withCaches(mergePlayers(a, b), results);
  assert.deepEqual([merged.xp, merged.coins], [220, 60]);
  assert.deepEqual(withCaches(mergePlayers(b, a), results), merged);
});
