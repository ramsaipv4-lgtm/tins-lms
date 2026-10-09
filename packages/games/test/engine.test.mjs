// Engine unit tests (task g-2): game clock, statuses, action validity, seeded determinism, scoring, arcade gating.
// SPEC §13.3. Sessions are driven with a fake game module; no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock, STEP_MS } from '../src/engine/clock.ts';
import { createSession } from '../src/engine/session.ts';
import { COMMON_ACTIONS, commonValid, keyClashes, resolveKey } from '../src/engine/actions.ts';
import { defaultSeed, resolveSeed, streamRng } from '../src/engine/seed.ts';
import { knowledgeStars, scoreOf, xpOf, coinsOf, masteryChecks } from '../src/engine/scoring.ts';
import { createRound } from '../src/engine/round.ts';
import { arcadeTiles, gameAvailable, arcadeOn, packReleased, packReleaseAt, sniperRank, levelLocked } from '../src/engine/arcade.ts';
import { createFrameStats } from '../src/engine/stats.ts';
import { emptyPlayer, patchPlayer } from '../src/engine/player.ts';
import { TUNING } from '../src/tuning.ts';

// ---- helpers ----
const pack = {
  game: 'fake', id: 'p1', title: 'Fake', day: 0, concepts: ['a.b'], language: 'en',
  levels: [{ id: '1', title: 'One', lesson: [] }, { id: '2', title: 'Two', lesson: [] }],
};
const SPECS = [
  { action: 'tap', label: 'x', keys: ['t'] },
  { action: 'strike', label: 'x', keys: ['1', '2'], keyAsArg: true, button: 'strike-1' },
  { action: 'calibrate', label: 'x', keys: ['c'], validIn: ['title', 'paused'] },
];
function fakeModule(log = []) {
  return {
    id: 'fake', actions: SPECS,
    mount(_el, ctx) {
      const st = { stepMs: 0, steps: 0 };
      ctx.clock.onStep((dt) => { st.stepMs += dt; st.steps++; });
      return {
        pause() { log.push('pause'); }, resume() { log.push('resume'); }, destroy() { log.push('destroy'); },
        act(a, arg) { log.push(`act:${a}`); if (a === 'tap') { ctx.round.addSkill(10); return true; } return a === 'start' || a === 'calibrate' || a === 'strike'; },
        state() { return { stage: 2, extra: { stepMs: st.stepMs, steps: st.steps } }; },
        render() { log.push('render'); },
        _ctx: ctx, _st: st,
      };
    },
  };
}
function playerStore(seen = {}) {
  let doc = emptyPlayer('l1', 0);
  doc = { ...doc, seen: { prologue: false, intro: {}, scenes: {}, ...seen } };
  return { doc: () => doc, patch(p) { doc = patchPlayer(doc, p, 1, 'l1'); }, raw: () => doc };
}
const scene = (ms) => ({ beats: [{ t: 'say', who: 'ada', key: 'story.k' }, { t: 'wait', ms }] });
function make(over = {}) {
  const log = [];
  const persisted = [];
  const player = over.player ?? playerStore();
  const s = createSession({
    module: over.module ?? fakeModule(log), pack, levelId: '1', seed: 7, el: {}, storyOn: over.storyOn ?? false,
    scenes: over.scenes ?? (() => null), player, strings: (k) => k, isLastLevel: over.isLastLevel ?? false,
    persist: async (p) => { persisted.push(p); }, onQuit: () => log.push('quit'), manual: true, ...over.opts,
  });
  return { s, log, persisted, player };
}

// ---- (1) game clock ----
test('clock: 1x while playing, advance moves it by exactly ms, fixed 60 Hz steps', () => {
  const c = createClock({ assistFactor: TUNING['common.assistFactor'] });
  const steps = [];
  c.onStep((dt) => steps.push(dt));
  c.setMode('play');
  c.advance(1000);
  assert.equal(c.now(), 1000);
  assert.equal(steps.length, 60);
  assert.ok(steps.every((dt) => dt <= STEP_MS + 1e-9));
  c.advance(40); // 2.4 steps: the remainder is a short step, not lost
  assert.equal(c.now(), 1040);
  assert.equal(c.sceneNow(), 0);
});
test('clock: assist runs the game clock at common.assistFactor (0.5x)', () => {
  const c = createClock({ assistFactor: TUNING['common.assistFactor'] });
  c.setMode('play'); c.setAssist(true);
  c.advance(1000);
  assert.equal(c.now(), 500);
  c.setAssist(false); c.advance(100);
  assert.equal(c.now(), 600);
});
test('clock: 0x while paused, on the title, after the round, and while the tab is hidden; story moves only the scene clock', () => {
  const c = createClock({ assistFactor: 0.5 });
  const scenes = [];
  c.onScene((ms) => scenes.push(ms));
  for (const mode of ['stopped']) { c.setMode(mode); c.advance(500); assert.equal(c.now(), 0); assert.equal(c.sceneNow(), 0); }
  c.setMode('play'); c.setHidden(true); c.advance(500);
  assert.equal(c.now(), 0, 'hidden tab: the game clock stands still');
  c.setHidden(false); c.setMode('story'); c.advance(250);
  assert.equal(c.now(), 0, 'story: the play clock is stopped');
  assert.equal(c.sceneNow(), 250);
  assert.ok(scenes.length > 0);
  c.setAssist(true); c.advance(100);
  assert.equal(c.sceneNow(), 350, 'assist never slows the scene clock');
});
test('clock: tick keeps the sub-step remainder, caps a long gap, and raw listeners see every advance', () => {
  const c = createClock({ assistFactor: 0.5 });
  const raw = [];
  c.onRaw((ms) => raw.push(ms));
  c.setMode('play');
  c.tick(10); assert.equal(c.now(), 0);
  c.tick(10); assert.ok(Math.abs(c.now() - STEP_MS) < 1e-6);
  c.tick(100000); assert.ok(c.now() < 400, 'a long gap is not replayed');
  c.setMode('stopped'); c.advance(120);
  assert.deepEqual(raw.slice(-1), [120], 'calibration sees time even when the game clock is stopped');
});

// ---- (2) statuses ----
test('statuses: launch order title -> playing -> paused -> playing -> paused(lesson) -> continue -> quit', () => {
  const { s, log } = make();
  assert.equal(s.state().status, 'title');
  assert.equal(s.act('start'), true);
  assert.equal(s.state().status, 'playing');
  s.advance(1000);
  assert.equal(s.state().clockMs, 1000);
  assert.equal(s.act('pause'), true);
  assert.equal(s.state().status, 'paused');
  s.advance(1000);
  assert.equal(s.state().clockMs, 1000, 'both clocks are stopped while paused');
  assert.equal(s.act('resume'), true);
  assert.equal(s.state().status, 'playing');
  s.ctx.lesson([{ concept: 'a.b', text: 'hi' }]);
  assert.equal(s.state().status, 'paused');
  assert.equal(s.overlay(), 'lesson');
  assert.equal(s.act('resume'), false, 'the lesson card is closed by continue, not resume');
  assert.equal(s.act('continue'), true);
  assert.equal(s.state().status, 'playing');
  s.act('pause');
  assert.equal(s.act('quit'), true);
  assert.ok(log.includes('quit') && log.includes('destroy'));
  assert.equal(s.destroyed(), true);
});
test('statuses: assist is set in title or paused only, toggles with no argument, and is recorded on the state', () => {
  const { s } = make();
  assert.equal(s.act('assist'), true);
  assert.equal(s.state().assist, true);
  assert.equal(s.act('assist', false), true);
  assert.equal(s.state().assist, false);
  s.act('start');
  assert.equal(s.act('assist'), false, 'not valid while playing');
  s.act('pause'); assert.equal(s.act('assist', true), true);
  s.act('resume'); s.advance(1000);
  assert.equal(s.state().clockMs, 500, 'assist halves speed');
});
test('statuses: assist used at any moment of play is recorded on the result even if it is switched off again', async () => {
  const { s, persisted } = make();
  s.act('assist', true); s.act('start'); s.advance(200);
  s.act('pause'); s.act('assist', false); s.act('resume');
  s.ctx.finish(s.ctx.round.result('lost', 1));
  await new Promise((r) => setImmediate(r));
  assert.equal(persisted[0].assist, true);
  assert.equal(s.results().assist, true);
  const clean = make();
  clean.s.act('start'); clean.s.ctx.finish(clean.s.ctx.round.result('lost', 1));
  await new Promise((r) => setImmediate(r));
  assert.equal(clean.persisted[0].assist, false);
});
test('statuses: a finished round writes once, status becomes won, quit is valid; a lost round likewise', async () => {
  const { s, persisted } = make();
  s.act('start');
  s.ctx.round.setSocketsTotal(2);
  s.ctx.round.socketCorrect('a', 'a.b'); s.ctx.round.socketCorrect('b', 'a.b'); s.ctx.round.addSkill(100);
  s.advance(500);
  s.ctx.finish(s.ctx.round.result('won', s.state().clockMs));
  s.ctx.finish(s.ctx.round.result('won', 1)); // a second finish is ignored
  assert.equal(s.state().status, 'won');
  await new Promise((r) => setImmediate(r));
  assert.equal(persisted.length, 1);
  assert.equal(s.results().knowledgeStars, 3);
  assert.equal(s.results().saved, 'saved');
  assert.equal(s.act('start'), false);
  assert.equal(s.act('quit'), true);
});
test('statuses: the intro scene plays on a first launch, then the title; story=off plays nothing and sets no flag', () => {
  const player = playerStore();
  const a = make({ storyOn: true, scenes: (id) => (id === 'fake.intro' ? scene(1000) : null), player });
  assert.equal(a.s.state().status, 'story');
  assert.deepEqual(a.s.state().extra.scene, { id: 'fake.intro', beat: 0, line: 'story.k' });
  a.s.advance(5000);
  assert.equal(a.s.state().status, 'story', 'a say line waits for next');
  assert.equal(a.s.state().clockMs, 0, 'clockMs does not move during a scene');
  a.s.act('next'); a.s.advance(1000);
  assert.equal(a.s.state().status, 'title');
  assert.equal(player.raw().seen.intro['fake'], true);
  assert.equal(player.raw().seen.scenes['fake.intro'], true);
  const again = make({ storyOn: true, scenes: (id) => (id === 'fake.intro' ? scene(1000) : null), player });
  assert.equal(again.s.state().status, 'title', 'the second launch skips the intro');
  const off = make({ storyOn: false, scenes: () => scene(1000), player: playerStore() });
  assert.equal(off.s.state().status, 'title');
  assert.deepEqual(off.player.raw().seen.scenes, {});
});
test('statuses: pause works in a scene and resumes into the scene; chapter-end follows the result of the last level', async () => {
  const player = playerStore({ intro: { fake: true } });
  const { s, persisted } = make({ storyOn: true, isLastLevel: true, scenes: (id) => (id === 'fake.chapter-end' ? scene(1000) : null), player });
  s.act('start');
  s.ctx.round.setSocketsTotal(1); s.ctx.round.socketCorrect('x', 'a.b');
  s.ctx.finish(s.ctx.round.result('won', 100));
  assert.equal(persisted.length, 1, 'the result is written before the chapter-end scene');
  assert.equal(s.state().status, 'story');
  assert.equal(s.state().extra.scene.id, 'fake.chapter-end');
  assert.equal(s.act('pause'), true);
  assert.equal(s.state().status, 'paused');
  assert.equal(s.act('resume'), true);
  assert.equal(s.state().status, 'story');
  s.act('skip');
  assert.equal(s.state().status, 'won');
  assert.equal(player.raw().seen.scenes['fake.chapter-end'], true);
});
test('statuses: replay plays a seen scene again and returns to where it was', () => {
  const player = playerStore({ intro: { fake: true }, scenes: { 'fake.intro': true } });
  const { s } = make({ storyOn: true, scenes: (id) => (id === 'fake.intro' ? scene(500) : null), player });
  assert.equal(s.act('replay', 'fake.nope'), false);
  assert.equal(s.act('replay'), true, 'no argument replays the most recent seen scene');
  assert.equal(s.state().status, 'story');
  s.act('skip');
  assert.equal(s.state().status, 'title');
  s.act('start'); assert.equal(s.act('replay'), false, 'not while playing');
});

// ---- (3) the action-validity table ----
test('action validity: the table of common actions by status (SPEC §13.3)', () => {
  const view = (status, extra = {}) => ({ status, overlay: status === 'paused' ? 'menu' : null, avatarBeat: false, hasSeenScene: true, storyOn: true, ...extra });
  const table = {
    start: ['title'],
    pause: ['playing', 'story'],
    resume: ['paused'],
    continue: [],             // paused only with the lesson overlay (below)
    quit: ['paused', 'won', 'lost'],
    assist: ['title', 'paused'],
    next: ['story'],
    skip: ['story'],
    replay: ['title', 'paused'],
    avatar: [],               // story only on the avatar beat (below)
  };
  assert.deepEqual(Object.keys(table).sort(), [...COMMON_ACTIONS].sort());
  for (const [action, ok] of Object.entries(table)) {
    for (const status of ['story', 'title', 'playing', 'paused', 'won', 'lost']) {
      assert.equal(commonValid(action, view(status)), ok.includes(status), `${action} in ${status}`);
    }
  }
  assert.equal(commonValid('continue', view('paused', { overlay: 'lesson' })), true);
  assert.equal(commonValid('resume', view('paused', { overlay: 'lesson' })), false);
  assert.equal(commonValid('avatar', view('story', { avatarBeat: true })), true);
  assert.equal(commonValid('next', view('story', { avatarBeat: true })), false);
  assert.equal(commonValid('replay', view('title', { hasSeenScene: false })), false);
  assert.equal(commonValid('replay', view('title', { storyOn: false })), false);
});
test('action validity: an unknown action throws, a game action outside its status is false, keyed actions resolve', () => {
  const { s } = make();
  assert.throws(() => s.act('dance'), /unknown action/);
  assert.equal(s.act('tap'), false, 'tap is valid only while playing');
  assert.equal(s.act('calibrate'), true, 'calibrate is valid on the title');
  s.act('start');
  assert.equal(s.act('tap'), true);
  assert.equal(s.state().skill, 10);
  assert.equal(s.act('calibrate'), false);
  const v = (status) => ({ status, overlay: null, avatarBeat: false, hasSeenScene: false, storyOn: true });
  assert.deepEqual(resolveKey('Enter', v('title'), SPECS), { action: 'start' });
  assert.deepEqual(resolveKey('Escape', v('playing'), SPECS), { action: 'pause' });
  assert.equal(resolveKey('T', v('playing'), SPECS).action, 'tap');
  const strike = resolveKey('2', v('playing'), SPECS);
  assert.deepEqual([strike.action, strike.arg], ['strike', '2']);
  assert.equal(resolveKey('t', v('title'), SPECS), null);
  assert.deepEqual(resolveKey('q', { ...v('paused'), overlay: 'menu' }, SPECS), { action: 'quit' });
  assert.deepEqual(keyClashes(SPECS), []);
  assert.ok(keyClashes([{ action: 'x', label: 'x', keys: ['p'] }]).length > 0, 'a game key that clashes with pause is reported');
});
test('buttons: every valid action has an act-<action> button; spec buttons use the button name', () => {
  const { s } = make();
  const ids = () => s.buttons().map((b) => b.testId);
  assert.ok(ids().includes('act-start') && ids().includes('act-assist') && ids().includes('act-calibrate'));
  assert.ok(!ids().includes('act-pause'));
  s.act('start');
  assert.ok(ids().includes('act-pause') && ids().includes('act-tap') && ids().includes('act-strike-1'));
  assert.ok(!ids().includes('act-start'));
});

// ---- (4) seeded determinism ----
test('seed: the default seed is seedFor(class.seedSalt, game:<gameId>:<packId>:<levelId>); ?seed= wins; streams repeat', () => {
  const a = defaultSeed('salt-c1', 'syntax-drop', 'p', '1');
  assert.equal(a, defaultSeed('salt-c1', 'syntax-drop', 'p', '1'));
  assert.notEqual(a, defaultSeed('salt-c2', 'syntax-drop', 'p', '1'));
  assert.notEqual(a, defaultSeed('salt-c1', 'syntax-drop', 'p', '2'));
  assert.equal(resolveSeed('42', a), 42);
  assert.equal(resolveSeed('-3', a), -3);
  assert.equal(resolveSeed('abc', a), a);
  assert.equal(resolveSeed(null, a), a);
  const r1 = streamRng(7, 'debris'), r2 = streamRng(7, 'debris'), r3 = streamRng(7, 'other'), r4 = streamRng(8, 'debris');
  const seq = (r) => Array.from({ length: 50 }, () => r());
  assert.deepEqual(seq(r1), seq(r2));
  assert.notDeepEqual(seq(streamRng(7, 'debris')), seq(r3));
  assert.notDeepEqual(seq(streamRng(7, 'debris')), seq(r4));
  assert.ok(seq(streamRng(7, 'x')).every((x) => x >= 0 && x < 1));
});
test('seed: two sessions with the same seed and the same driver calls give identical states', () => {
  const run = () => {
    const { s } = make();
    s.act('start');
    const rng = s.ctx.rng('wind');
    const draws = [rng(), rng(), rng()];
    for (let i = 0; i < 7; i++) s.advance(37);
    s.act('tap');
    return { draws, state: s.state() };
  };
  assert.deepEqual(run(), run());
});

// ---- scoring (§13.3 Stars, scores and mistakes; §13.6 Earnings) ----
test('scoring: stars, score, xp and coins follow the Tuning table', () => {
  const T = TUNING;
  assert.equal(knowledgeStars(4, 4, 0, T), 3);
  assert.equal(knowledgeStars(4, 4, 2, T), 2);
  assert.equal(knowledgeStars(4, 4, 3, T), 1);
  assert.equal(knowledgeStars(4, 3, 0, T), 1, 'an unanswered (or assisted) socket caps at 1 star');
  assert.equal(knowledgeStars(4, 0, 5, T), 0);
  assert.equal(scoreOf(250, 3, T), 250 + 3 * 100);
  assert.equal(xpOf(255, 3, T), Math.round(255 / 10) + 20 * 3);
  assert.equal(coinsOf(250, 3, 10, T), 5 * 3 + 2 + 10);
  const m = masteryChecks({ 'a.b': 4, 'c.d': 2 }, [{ itemId: 'x', concept: 'a.b' }, { itemId: 'y', concept: 'e.f' }]);
  assert.deepEqual(m, [{ skill: 'a.b', score: 0.75 }, { skill: 'c.d', score: 1 }, { skill: 'e.f', score: 0 }]);
});
test('round: Skill and Knowledge are separate; an action miss never creates a mistake; sockets count once', () => {
  const r = createRound(TUNING, 3);
  r.addSkill(50); r.addSkill(-80); r.actionMiss(); r.actionMiss();
  r.socketCorrect('a', 'x.y'); r.socketCorrect('a', 'x.y'); r.socketAssisted('b'); r.socketCorrect('b', 'x.y');
  const snap = r.snapshot();
  assert.deepEqual([snap.skill, snap.actionMisses, snap.knowledgeMistakes, snap.socketsCorrect], [0, 2, 0, 1]);
  assert.equal(snap.knowledgeStars, 1, 'an assisted socket stays closed and is not correct');
  const res = r.result('won', 1234.6);
  assert.deepEqual(res.mistakes, []);
  assert.equal(res.durationMs, 1235);
});
test('frame stats: null under 30 frames, percentiles over the last 20 s', () => {
  const f = createFrameStats();
  const q = { tier: 'low', pixelRatio: 1, shadows: false };
  for (let i = 0; i < 10; i++) f.frame(i * 16);
  assert.equal(f.snapshot(q, null).frameP50, null);
  assert.equal(f.snapshot(q, null).frames, 10);
  for (let i = 10; i < 100; i++) f.frame(i * 16);
  const snap = f.snapshot(q, 12);
  assert.equal(snap.frameP50, 16);
  assert.equal(snap.frameP95, 16);
  assert.equal(snap.heapMB, 12);
  assert.equal(snap.drawCalls, null);
});

// ---- (10) arcade routes and switch gating ----
const stored = (gameId, packId, day, levels = [{ id: '1', title: 'One', lesson: [] }]) => ({ gameId, packId, day, pack: { game: gameId, id: packId, title: packId, day, concepts: ['a.b'], language: 'en', levels } });
const schedule = [{ date: '2026-11-02', start: '09:00' }, { date: '2026-11-03', start: '09:00' }, { date: '2026-11-04', start: '09:00' }];
const NOW = Date.parse('2026-11-03T10:00:00+05:30');
test('arcade: tiles only for available games with a released pack', () => {
  const packs = [stored('syntax-drop', 'sd', 0), stored('syntax-drop', 'later', 2), stored('sniper', 'sn', 1), stored('whack-a-bug', 'wb', 5)];
  const tiles = (switches, extra = {}) => arcadeTiles({ switches, packs, results: [], schedule, now: NOW, ...extra });
  assert.deepEqual(tiles({}).map((t) => t.gameId), ['syntax-drop', 'sniper'], 'wb has no released pack; the aftershock has no pack');
  assert.deepEqual(tiles({}).find((t) => t.gameId === 'syntax-drop').packs.map((p) => p.id), ['sd'], 'the day-2 pack is not released yet');
  assert.deepEqual(tiles({ games: false }), [], 'games off removes every tile');
  assert.deepEqual(tiles({ 'game.syntaxDrop': false }).map((t) => t.gameId), ['sniper'], 'one game off removes just its tile');
  assert.equal(tiles({}, { now: Date.parse('2026-11-04T09:00:00+05:30') }).find((t) => t.gameId === 'syntax-drop').packs.length, 2, 'released at the start of the class day');
  assert.equal(tiles({}, { now: Date.parse('2026-11-04T08:59:00+05:30') }).find((t) => t.gameId === 'syntax-drop').packs.length, 1);
});
test('arcade: gating helpers (D-49), release times in the program zone, last score from own results only', () => {
  assert.equal(arcadeOn({}), true);
  assert.equal(arcadeOn({ games: false }), false);
  assert.equal(gameAvailable('sniper', { games: true, 'game.sniper': true }), true);
  assert.equal(gameAvailable('sniper', { 'game.sniper': false }), false);
  assert.equal(gameAvailable('sniper', { games: false }), false);
  assert.equal(gameAvailable('nope', {}), false);
  assert.equal(packReleaseAt(schedule, 0, 'Asia/Kolkata'), Date.parse('2026-11-02T09:00:00+05:30'));
  assert.equal(packReleaseAt(schedule, 0, 'UTC'), Date.parse('2026-11-02T09:00:00Z'));
  assert.equal(packReleaseAt(schedule, 9), null);
  assert.equal(packReleased(schedule, 9, NOW), false);
  const results = [{ gameId: 'syntax-drop', packId: 'sd', at: 5, score: 120, stars: 2 }, { gameId: 'syntax-drop', packId: 'sd', at: 9, score: 300, stars: 3 }];
  const [tile] = arcadeTiles({ switches: {}, packs: [stored('syntax-drop', 'sd', 0)], results, schedule, now: NOW });
  assert.deepEqual([tile.lastScore, tile.stars], [300, 3]);
  const [fresh] = arcadeTiles({ switches: {}, packs: [stored('syntax-drop', 'sd', 0)], results: [], schedule, now: NOW });
  assert.equal('lastScore' in fresh, false, 'data-last-score is absent until the learner has played');
});
test('arcade: the sniper boss level is locked below Sharpshooter (claimed sums per pack)', () => {
  const p = stored('sniper', 'sn', 0, [{ id: '1', title: 'a', lesson: [] }, { id: '2', title: 'b', lesson: [], plates: [{ snippetId: 's' }] }]).pack;
  const boss = p.levels[1];
  assert.equal(levelLocked(p, p.levels[0], []), false);
  assert.equal(levelLocked(p, boss, []), true);
  assert.equal(levelLocked(p, boss, [{ gameId: 'sniper', packId: 'sn', claimed: 3 }, { gameId: 'sniper', packId: 'sn', claimed: 2 }]), true);
  assert.equal(levelLocked(p, boss, [{ gameId: 'sniper', packId: 'sn', claimed: 3 }, { gameId: 'sniper', packId: 'sn', claimed: 3 }]), false);
  assert.equal(levelLocked(p, boss, [{ gameId: 'sniper', packId: 'other', claimed: 9 }]), true, 'another pack does not count');
  assert.deepEqual([0, 3, 6, 10].map(sniperRank), ['Recruit', 'Marksman', 'Sharpshooter', 'Ghost']);
});

// ---- (10) the games routes on a running hub: arcade, release on the class day, switches, results, player, team score, gate G9-games ----
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = new URL('../../../', import.meta.url).pathname;
const SD_FILL = {
  game: 'syntax-drop', id: 'sd-x', title: 'Flex row', day: 0, concepts: ['css.display', 'css.flexbox'], language: 'en',
  levels: [{
    id: '1', title: 'Row', lesson: [{ concept: 'css.display', text: 'display: flex puts children in a row.' }],
    mode: 'fill', renderer: 'html', template: '<div style="display: {{s1}}">A</div>',
    slots: [{ id: 's1', accepts: ['p-flex'] }],
    pieces: [{ id: 'p-flex', text: 'flex', concept: 'css.display' }, { id: 'p-block', text: 'block', concept: 'css.display', decoy: true }], stages: 1,
  }],
};
function launchHub(extraPacks) {
  const dir = mkdtempSync(join(tmpdir(), 'lms-games-'));
  const acc = join(dir, 'acc', 'fixtures');
  mkdirSync(acc, { recursive: true });
  const mkPkg = (name, packs) => {
    cpSync(join(REPO, 'acceptance/fixtures/package'), join(acc, name), { recursive: true });
    for (const [path, pack] of Object.entries(packs)) { mkdirSync(join(acc, name, path, '..'), { recursive: true }); writeFileSync(join(acc, name, path), JSON.stringify(pack)); }
  };
  mkPkg('pkg-good', { 'track1/games/syntax-drop/sd-x.json': SD_FILL, 'track1/games/syntax-drop/sd-later.json': { ...SD_FILL, id: 'sd-later', day: 2 } });
  mkPkg('pkg-bad', { 'track1/games/syntax-drop/sd-bad.json': { ...SD_FILL, id: 'sd-bad', title: undefined } });
  const base = JSON.parse(readFileSync(join(REPO, 'acceptance/fixtures/games/seeds/games-base.json'), 'utf8'));
  const seed = (extra) => ({ ...base, packages: [], joinCodes: [], ...extra });
  const klass = (sw) => base.databases['class-c1'].map((d) => (d.type === 'class' ? { ...d, switches: sw } : d));
  writeFileSync(join(acc, 'good.json'), JSON.stringify(seed({ packages: [{ path: 'pkg-good', classId: 'class:c1', publish: true }] })));
  writeFileSync(join(acc, 'bad.json'), JSON.stringify(seed({ packages: [{ path: 'pkg-bad', classId: 'class:c1', publish: true }] })));
  writeFileSync(join(acc, 'off.json'), JSON.stringify({ databases: { 'class-c1': klass({ games: false }) } }));
  writeFileSync(join(acc, 'one-off.json'), JSON.stringify({ databases: { 'class-c1': klass({ 'game.syntaxDrop': false }) } }));
  const env = { ...process.env, PORT: '0', LMS_PROFILE: 'hub', LMS_DATA_DIR: dir, LMS_TLS: 'off', LMS_TEST_MODE: '1', LMS_ACCEPTANCE_DIR: join(dir, 'acc'), LMS_GAMES_PLAYABLE: 'syntax-drop,sniper,whack-a-bug,aftershock' };
  const child = spawn(process.execPath, [join(REPO, 'packages/server/src/main.ts')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stderr.on('data', (d) => { err += d; });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no LISTENING: ' + err)), 30000);
    child.stdout.on('data', (d) => {
      out += d; const m = /LISTENING (\d+)/.exec(out); if (!m) return;
      clearTimeout(timer);
      const url = `http://127.0.0.1:${m[1]}`; let cookie = '';
      const req = async (path, { method = 'GET', body } = {}) => {
        const r = await fetch(url + path, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
        const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
        return { status: r.status, json, text };
      };
      const login = async (personId, roles) => { cookie = ''; const r = await fetch(url + '/__test/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId, roles }) }); cookie = r.headers.get('set-cookie').split(';')[0]; };
      const clock = (iso) => req('/__test/clock', { method: 'POST', body: { now: Date.parse(iso) } });
      const raw = async (path, bytes) => { // an upload of raw bytes with the same session
        const r = await fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/octet-stream', ...(cookie ? { cookie } : {}) }, body: bytes });
        const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
        return { status: r.status, json, text };
      };
      resolve({ req, raw, login, clock, stop: () => new Promise((r) => { child.on('exit', r); child.kill('SIGTERM'); }) });
    });
    child.on('exit', (c) => reject(new Error(`hub exited ${c}: ${err}`)));
  });
}
const roundBody = (over = {}) => ({
  gameId: 'syntax-drop', packId: 'sd-x', levelId: '1', assist: false, seed: 5,
  result: { outcome: 'won', skill: 255, socketsTotal: 1, socketsCorrect: 1, socketsByConcept: { 'css.display': 1 }, durationMs: 4000, mistakes: [] }, ...over,
});

test('hub: a good pack is released on its class day and appears in the arcade only from then; G9-games passes', async () => {
  const hub = await launchHub();
  try {
    await hub.login('person:admin1', ['admin']);
    await hub.clock('2026-11-01T10:00:00+05:30');
    const seeded = await hub.req('/__test/seed', { method: 'POST', body: { fixture: 'good.json' } });
    assert.equal(seeded.status, 200, seeded.text);
    await hub.login('person:l1', ['learner']);
    const before = await hub.req('/api/games/arcade');
    assert.deepEqual(before.json.tiles, [], 'class day 0 has not started');
    assert.equal((await hub.req('/api/games/pack/syntax-drop/sd-x')).status, 404, 'a pack that is not released cannot be fetched');
    await hub.clock('2026-11-02T09:00:00+05:30');
    const day0 = (await hub.req('/api/games/arcade')).json;
    assert.deepEqual(day0.tiles.map((t) => [t.gameId, t.packs.map((p) => p.id)]), [['syntax-drop', ['sd-x']]], 'sd-later (day 2) is not out yet');
    await hub.clock('2026-11-04T09:00:00+05:30');
    assert.deepEqual((await hub.req('/api/games/arcade')).json.tiles[0].packs.map((p) => p.id), ['sd-x', 'sd-later']);
    const pack = await hub.req('/api/games/pack/syntax-drop/sd-x');
    assert.equal(pack.status, 200);
    assert.equal(pack.json.pack.id, 'sd-x');
    assert.equal(pack.json.seedSalt, 'salt-c1-synthetic');
  } finally { await hub.stop(); }
});
test('hub: a broken game pack fails the content gate with the pack check message and cannot be published (G9-games, never waivable)', async () => {
  const hub = await launchHub();
  try {
    await hub.login('person:admin1', ['admin']);
    await hub.clock('2026-11-02T10:00:00+05:30');
    await hub.req('/__test/seed', { method: 'POST', body: { fixture: 'bad.json' } });
    await hub.login('person:l1', ['learner']);
    assert.deepEqual((await hub.req('/api/games/arcade')).json.tiles, [], 'the broken pack was not released');
    // the same package through the upload route: tar the folder
    const { tarPack } = await import('../../core/src/index.ts');
    const { readdirSync, statSync } = await import('node:fs');
    const root = join(REPO, 'acceptance/fixtures/package');
    const files = [];
    const walk = (abs, rel) => { for (const n of readdirSync(abs).sort()) { const a = join(abs, n), r = rel ? `${rel}/${n}` : n; if (statSync(a).isDirectory()) walk(a, r); else files.push({ path: r, bytes: new Uint8Array(readFileSync(a)) }); } };
    walk(root, '');
    files.push({ path: 'track1/games/syntax-drop/sd-bad.json', bytes: new TextEncoder().encode(JSON.stringify({ ...SD_FILL, id: 'sd-bad', title: undefined })) });
    await hub.login('person:tr1', ['trainer']);
    const up = await hub.raw('/api/packages?classId=class:c1', tarPack(files));
    assert.equal(up.status, 200);
    assert.equal(up.json.status, 'draft');
    const g9 = up.json.checks.find((c) => c.id === 'G9-games');
    assert.equal(g9.pass, false);
    assert.match(g9.detail, /sd-bad\.json: pack: missing required field "title"/);
    assert.deepEqual(up.json.checks.filter((c) => !c.pass && c.id !== 'G9-games'), [], 'only G9-games fails');
    const waived = await hub.req(`/api/packages/${up.json.id}/publish`, { method: 'POST', body: { waivers: [{ check: 'G9-games', reason: 'please', by: 'person:tr1', expiresAt: Date.now() + 1000 }] } });
    assert.equal(waived.status, 409, 'a waiver for G9-games is ignored');
    assert.ok(waived.json.checks.some((c) => c.id === 'G9-games'));
  } finally { await hub.stop(); }
});
test('hub: switches gate the arcade and its packs (games off, one game off); the switch comes from the class layer', async () => {
  const hub = await launchHub();
  try {
    await hub.login('person:admin1', ['admin']);
    await hub.clock('2026-11-02T10:00:00+05:30');
    await hub.req('/__test/seed', { method: 'POST', body: { fixture: 'good.json' } });
    await hub.login('person:l1', ['learner']);
    assert.equal((await hub.req('/api/games/arcade')).json.tiles.length, 1);
    await hub.login('person:admin1', ['admin']);
    await hub.req('/__test/seed', { method: 'POST', body: { fixture: 'one-off.json' } });
    await hub.login('person:l1', ['learner']);
    const one = await hub.req('/api/games/arcade');
    assert.equal(one.json.arcadeOn, true);
    assert.deepEqual(one.json.tiles, [], 'game.syntaxDrop off removes the tile');
    assert.equal(one.json.switches['game.syntaxDrop'], false);
    assert.equal((await hub.req('/api/games/pack/syntax-drop/sd-x')).status, 404, 'and its deep link is unavailable');
    assert.equal((await hub.req('/api/games/results', { method: 'POST', body: roundBody() })).status, 403);
    await hub.login('person:admin1', ['admin']);
    await hub.req('/__test/seed', { method: 'POST', body: { fixture: 'off.json' } });
    await hub.login('person:l1', ['learner']);
    const off = await hub.req('/api/games/arcade');
    assert.equal(off.json.arcadeOn, false, 'games off');
    assert.deepEqual(off.json.tiles, []);
    assert.equal((await hub.req('/api/games/pack/syntax-drop/sd-x')).status, 404);
    assert.deepEqual((await hub.req('/api/games/teams')).json.teams, []);
  } finally { await hub.stop(); }
});
test('hub: a finished round is stored with its cards, XP and coins persist across sign-in, and teamScore follows within 5 s', async () => {
  const hub = await launchHub();
  try {
    await hub.login('person:admin1', ['admin']);
    await hub.clock('2026-11-02T10:00:00+05:30');
    await hub.req('/__test/seed', { method: 'POST', body: { fixture: 'good.json' } });
    await hub.login('person:l1', ['learner']);
    const bad = roundBody({ result: { ...roundBody().result, socketsCorrect: 1, mistakes: [{ itemId: 'p-block', concept: 'css.display', question: 'What does block do?', correct: 'It stacks boxes.' }] } });
    const res = await hub.req('/api/games/results', { method: 'POST', body: bad });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.gameResult.knowledgeStars, 2);
    assert.deepEqual(res.json.gameResult.mistakes, [{ itemId: 'p-block', concept: 'css.display' }]);
    const xp = res.json.player.xp;
    assert.equal(xp, Math.round(255 / 10) + 20 * 2);
    assert.equal((await hub.req('/api/games/results', { method: 'POST', body: roundBody({ levelId: '99' }) })).status, 404);
    assert.equal((await hub.req('/api/games/results', { method: 'POST', body: roundBody({ gameId: 'sniper' }) })).status, 404);
    const cards = await hub.req('/api/learn/cards');
    assert.equal(cards.json.cards[0].id, 'card:game-syntax-drop-sd-x-p-block');
    const notes = await hub.req('/api/learn/errors');
    assert.equal(notes.json.subtopics[0].subtopic, 'css.display');
    // sign out and in again: the same totals
    await hub.login('person:l1', ['learner']);
    const again = (await hub.req('/api/games/arcade')).json;
    assert.deepEqual([again.player.xp, again.player.coins], [xp, res.json.player.coins]);
    assert.deepEqual([again.tiles[0].lastScore, again.tiles[0].stars], [res.json.gameResult.score, 2]);
    // the player document: seen flags and avatar
    const put = await hub.req('/api/games/player', { method: 'PUT', body: { seen: { prologue: true, intro: { 'syntax-drop': true } }, avatar: { look: 'block', color: 'teal', nameTag: 'Zed' }, timingOffsetMs: 80 } });
    assert.equal(put.status, 200);
    const reread = (await hub.req('/api/games/arcade')).json.player;
    assert.deepEqual([reread.seen.prologue, reread.seen.intro, reread.avatar.nameTag, reread.timingOffsetMs], [true, { 'syntax-drop': true }, 'Zed', 80]);
    assert.deepEqual([reread.xp, reread.coins], [xp, res.json.player.coins], 'a profile write does not disturb the caches');
    // team-a = l1 + l2: average XP over the current members, within 5 s
    const t0 = Date.now();
    let teams = [];
    while (Date.now() - t0 < 5000) {
      teams = (await hub.req('/api/games/teams')).json.teams;
      if (teams.find((t) => t.teamId === 'team-a')?.xp === Math.round(xp / 2)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.deepEqual(teams, [{ teamId: 'team-a', xp: Math.round(xp / 2) }, { teamId: 'team-b', xp: 0 }]);
    // another learner sees the team figure but nothing of l1's own score
    await hub.login('person:l3', ['learner']);
    const l3 = await hub.req('/api/games/arcade');
    assert.equal(l3.json.player.xp, 0);
    assert.equal('lastScore' in l3.json.tiles[0], false);
    assert.doesNotMatch(l3.text, new RegExp(`"score":${res.json.gameResult.score}`));
  } finally { await hub.stop(); }
});

// ---- registry, test hooks and the D-51 flags ----
import { registerGame, loadGame, hasGame, knownGames } from '../src/engine/registry.ts';
import { testModeOn, testFlags, installTestGame, hookFor } from '../src/engine/testhooks.ts';
import { detectQuality } from '../src/engine/audio.ts';

test('registry: games load lazily by id (D-57); an unknown id and a module without mount are errors', async () => {
  let loaded = 0;
  registerGame('fake', async () => { loaded++; return { default: fakeModule() }; });
  registerGame('broken', async () => ({ default: {} }));
  assert.equal(loaded, 0, 'registering does not load');
  assert.equal(hasGame('fake'), true);
  assert.ok(knownGames().includes('fake'));
  const m = await loadGame('fake');
  assert.equal(m.id, 'fake');
  assert.equal(loaded, 1);
  await assert.rejects(() => loadGame('nope'), /no game module "nope"/);
  await assert.rejects(() => loadGame('broken'), /does not export a GameModule/);
});
test('test hooks: window.__game exists only in test mode, shows state/act/advance/stats, and is removed on unmount', () => {
  const meta = (content) => ({ querySelector: (sel) => (sel === 'meta[name="lms-test-mode"]' && content !== null ? { getAttribute: () => content } : null) });
  assert.equal(testModeOn(meta('1')), true);
  assert.equal(testModeOn(meta('0')), false);
  assert.equal(testModeOn(meta(null)), false);
  const { s } = make();
  const win = {};
  assert.equal(typeof installTestGame(win, s, false), 'function');
  assert.equal('__game' in win, false, 'no hook outside test mode');
  const off = installTestGame(win, s, true);
  assert.equal(win.__game.id, 'fake');
  assert.equal(win.__game.state().status, 'title');
  assert.equal(win.__game.act('start'), true);
  assert.equal(win.__game.advance(500).clockMs, 500);
  assert.equal(win.__game.stats().frames >= 1, true);
  assert.deepEqual(Object.keys(win.__game).sort(), ['act', 'advance', 'id', 'state', 'stats']);
  assert.deepEqual(Object.keys(win.__game.state()).sort(), ['actionMisses', 'assist', 'clockMs', 'extra', 'knowledgeMistakes', 'levelId', 'lives', 'score', 'skill', 'stage', 'status']);
  assert.deepEqual(Object.keys(win.__game.stats()).sort(), ['drawCalls', 'fps50', 'frameP50', 'frameP95', 'frames', 'heapMB', 'pixelRatio', 'shadows', 'textures', 'tier', 'triangles']);
  off();
  assert.equal('__game' in win, false);
  assert.equal(typeof hookFor(s).advance, 'function');
});
test('test flags: ?seed, ?clock=manual and ?story=off count only in test mode', () => {
  assert.deepEqual(testFlags('?seed=7&clock=manual&story=off', true), { seed: '7', manual: true, storyOff: true });
  assert.deepEqual(testFlags('?seed=7&clock=manual&story=off', false), { seed: null, manual: false, storyOff: false });
  assert.deepEqual(testFlags('', true), { seed: null, manual: false, storyOff: false });
});
test('quality: low on weak devices, high only on strong ones; shadows only on high (§13.2)', () => {
  assert.deepEqual(detectQuality({ hardwareConcurrency: 2, devicePixelRatio: 3 }), { tier: 'low', pixelRatio: 1, shadows: false });
  assert.deepEqual(detectQuality({ hardwareConcurrency: 4, deviceMemory: 4, devicePixelRatio: 3 }), { tier: 'medium', pixelRatio: 2, shadows: false });
  assert.equal(detectQuality({ hardwareConcurrency: 16, deviceMemory: 8 }).shadows, true);
});

// ---- more session behaviour: hidden tab, held actions and buttons, input subscribers ----
test('session: a hidden tab stops the game clock (and the scene clock) and the clock resumes when it is visible', () => {
  const { s } = make();
  s.act('start');
  s.advance(100);
  s.setHidden(true);
  s.advance(1000);
  assert.equal(s.state().clockMs, 100);
  s.setHidden(false);
  s.advance(50);
  assert.equal(s.state().clockMs, 150);
});
test('session: held actions list a held button; setHeld shows in ctx.input.held; game actions are announced to input subscribers', () => {
  const log = [];
  const mod = fakeModule(log);
  mod.actions = [...SPECS, { action: 'run', label: 'x', keys: ['ArrowRight'], arg: 1, held: true, releaseArg: 0, button: 'run-right' }];
  const real = mod.mount;
  let inst;
  mod.mount = (el, ctx) => { inst = real(el, ctx); return { ...inst, act: (a, arg) => { log.push(`act:${a}:${arg}`); return a === 'run' || inst.act(a, arg); } }; };
  const { s } = make({ module: mod });
  s.act('start');
  const seen = [];
  s.ctx.input.on((a, arg) => seen.push([a, arg]));
  const run = s.buttons().find((b) => b.testId === 'act-run-right');
  assert.ok(run && run.held && run.held.releaseArg === 0, 'a held action has its button with the release argument');
  s.setHeld('run', true);
  assert.equal(s.ctx.input.held('run'), true);
  assert.equal(s.act('run', 1), true);
  assert.equal(s.act('run', 0), true);
  s.setHeld('run', false);
  assert.equal(s.ctx.input.held('run'), false);
  assert.deepEqual(seen, [['run', 1], ['run', 0]]);
  assert.ok(log.includes('act:run:1') && log.includes('act:run:0'));
});
test('session: a game that throws in state() does not break the hook; a wrong level id is an error', () => {
  const mod = fakeModule();
  const real = mod.mount;
  mod.mount = (el, ctx) => ({ ...real(el, ctx), state() { throw new Error('boom'); } });
  const { s } = make({ module: mod });
  assert.equal(s.state().status, 'title');
  assert.deepEqual(s.state().extra, { scene: null });
  assert.throws(() => createSession({ module: fakeModule(), pack, levelId: 'nope', seed: 1, el: {}, storyOn: false, scenes: () => null, player: playerStore(), strings: (k) => k, isLastLevel: false, persist: async () => {}, onQuit() {} }), /no level nope/);
});
