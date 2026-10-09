// Story system unit tests (task g-2): the scene runner for every beat type, next/skip, replay, seen flags, autoAdvance, the prologue,
// and the story check (SPEC §13.3 "Scene state and timing", §13.5 Beat and "Story-check rules"). Small test scenes only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSceneRunner, BEAT_TYPES, beatMs } from '../src/story/runner.ts';
import { checkGameStory, checkUniverse, sceneLengthMs, isStoryFile } from '../src/story/check.ts';
import { createSession } from '../src/engine/session.ts';
import { emptyPlayer, patchPlayer } from '../src/engine/player.ts';

const ALL = [
  { t: 'music', name: 'calm' },
  { t: 'fade', to: 'in', ms: 300 },
  { t: 'spawn', what: 'ada', at: [1, 2] },
  { t: 'move', target: 'ada', to: [3, 4], ms: 500 },
  { t: 'camera', to: [0, 1], ms: 200 },
  { t: 'say', who: 'ada', key: 'story.a' },
  { t: 'sfx', name: 'boom' },
  { t: 'shake', ms: 100, power: 2 },
  { t: 'wait', ms: 400 },
  { t: 'say', who: 'ada', key: 'story.b', holdMs: 1000 },
  { t: 'avatar' },
  { t: 'fade', to: 'out', ms: 100 },
];
function run(beats, opts = {}) {
  const events = [], ends = [];
  const r = createSceneRunner({ sayNominalMs: 4000, onBeat: (b, i, id) => events.push([i, b.t, id]), onEnd: (id, how) => ends.push([id, how]), ...opts });
  return { r, events, ends };
}
const stepMany = (r, ms, slice = 1000 / 60) => { for (let left = ms; left > 1e-9; left -= slice) r.advance(Math.min(slice, left)); };

test('runner: every beat type runs in order; timed beats take their ms; say and avatar wait for an action', () => {
  assert.deepEqual([...BEAT_TYPES].sort(), ['avatar', 'camera', 'fade', 'move', 'music', 'say', 'sfx', 'shake', 'spawn', 'wait']);
  const avatars = [];
  const { r, events, ends } = run(ALL, { onAvatar: (a) => avatars.push(a) });
  assert.equal(r.start('s.all', { beats: ALL }), true);
  // music, spawn: no time; fade in takes 300 ms
  assert.deepEqual(r.info(), { id: 's.all', beat: 1, line: null });
  stepMany(r, 299); assert.equal(r.info().beat, 1);
  stepMany(r, 1);   assert.equal(r.info().beat, 3, 'spawn took no time, move is running');
  stepMany(r, 500); assert.equal(r.info().beat, 4);
  stepMany(r, 200); assert.deepEqual(r.info(), { id: 's.all', beat: 5, line: 'story.a' });
  stepMany(r, 60000); assert.equal(r.info().beat, 5, 'a say never advances by itself');
  assert.equal(r.next(), true);
  assert.equal(r.info().beat, 7, 'sfx takes no time; the shake runs for its ms');
  assert.equal(r.beat().t, 'shake');
  stepMany(r, 100); assert.equal(r.beat().t, 'wait');
  stepMany(r, 400);
  assert.deepEqual(r.info(), { id: 's.all', beat: 9, line: 'story.b' });
  r.next();
  assert.equal(r.beat().t, 'avatar');
  assert.equal(r.next(), false, 'next does not confirm an avatar');
  stepMany(r, 5000); assert.equal(r.beat().t, 'avatar', 'the avatar beat waits for the avatar action');
  assert.equal(r.avatar(null), false);
  assert.equal(r.avatar({ look: 'block', color: 'red', nameTag: 'Zed' }), true);
  assert.deepEqual(avatars, [{ look: 'block', color: 'red', nameTag: 'Zed' }]);
  assert.equal(r.beat().t, 'fade');
  stepMany(r, 100);
  assert.equal(r.active(), false);
  assert.equal(r.info(), null);
  assert.deepEqual(ends, [['s.all', 'end']]);
  assert.deepEqual(events.map((e) => e[1]), ALL.map((b) => b.t));
});
test('runner: skip ends the scene at once and reports a skip; next after the end does nothing', () => {
  const { r, ends } = run(ALL);
  r.start('s.all', { beats: ALL });
  assert.equal(r.skip(), true);
  assert.deepEqual(ends, [['s.all', 'skip']]);
  assert.equal(r.skip(), false);
  assert.equal(r.next(), false);
  assert.equal(r.active(), false);
});
test('runner: next on a timed beat finishes it early; an empty scene ends at once; leftover time carries on', () => {
  const { r, ends } = run([{ t: 'wait', ms: 5000 }, { t: 'wait', ms: 100 }]);
  r.start('s', { beats: [{ t: 'wait', ms: 5000 }, { t: 'wait', ms: 100 }] });
  r.next(); assert.equal(r.info().beat, 1);
  r.advance(100); assert.equal(ends.length, 1);
  const empty = run([]);
  empty.r.start('e', { beats: [] });
  assert.deepEqual(empty.ends, [['e', 'end']]);
  const carry = run([]);
  carry.r.start('c', { beats: [{ t: 'wait', ms: 100 }, { t: 'wait', ms: 100 }, { t: 'say', who: 'a', key: 'k' }] });
  carry.r.advance(250);
  assert.deepEqual(carry.r.info(), { id: 'c', beat: 2, line: 'k' }, 'one big advance runs through two waits and stops at the say');
});
test('runner: autoAdvance (off by default) moves a say on after holdMs, else sayNominalMs of scene time', () => {
  let auto = false;
  const beats = [{ t: 'say', who: 'a', key: 'k1' }, { t: 'say', who: 'a', key: 'k2', holdMs: 1000 }];
  const { r } = run(beats, { autoAdvance: () => auto });
  r.start('s', { beats });
  stepMany(r, 10000); assert.equal(r.info().line, 'k1', 'off: nothing happens');
  auto = true;
  stepMany(r, 3999); assert.equal(r.info().line, 'k1');
  stepMany(r, 1);    assert.equal(r.info().line, 'k2', 'the nominal 4000 ms has passed');
  stepMany(r, 1000); assert.equal(r.active(), false, 'holdMs 1000');
});
test('beatMs: only move, camera, wait, shake and fade take time', () => {
  assert.equal(beatMs({ t: 'say', who: 'a', key: 'k', holdMs: 9 }), 0);
  assert.equal(beatMs({ t: 'sfx', name: 'x' }), 0);
  assert.equal(beatMs({ t: 'fade', to: 'in', ms: 70 }), 70);
});

// ---- the session plays scenes, sets seen flags, replays, and mounts the prologue ----
function sessionFor(over = {}) {
  let doc = emptyPlayer('l1', 0);
  const player = { doc: () => doc, patch: (p) => { doc = patchPlayer(doc, p, 1, 'l1'); }, raw: () => doc };
  const scenes = over.scenes ?? { prologue: { beats: [{ t: 'say', who: 'ada', key: 'story.p1' }, { t: 'avatar' }] } };
  const mod = { id: over.id ?? 'prologue', mount: () => ({ pause() {}, resume() {}, destroy() {}, act: () => false, state: () => ({}) }) };
  const done = [];
  const s = createSession({
    module: mod, pack: { game: 'prologue', id: 'prologue', title: '', day: 0, concepts: [], language: 'en', levels: [{ id: 'prologue', title: '', lesson: [] }] }, levelId: 'prologue', seed: 1,
    el: {}, storyOn: true, scenes: (id) => scenes[id] ?? null, player, strings: (k) => k, isLastLevel: false,
    persist: async () => {}, onQuit: () => done.push('quit'), manual: true, prologue: over.noPrologue ? undefined : { onDone: () => done.push('done') },
  });
  return { s, player, done };
}
test('prologue: mounted like a game (status story, id prologue); the avatar beat saves player.avatar; the end sets seen.prologue', () => {
  const { s, player, done } = sessionFor();
  assert.equal(s.id, 'prologue');
  assert.equal(s.state().status, 'story');
  assert.deepEqual(s.state().extra.scene, { id: 'prologue', beat: 0, line: 'story.p1' });
  assert.equal(s.act('avatar', { look: 'block', color: 'teal', nameTag: 'x' }), false, 'not on the avatar beat yet');
  assert.equal(s.act('next'), true);
  assert.deepEqual(s.buttons().map((b) => b.testId).sort(), ['act-avatar', 'act-pause', 'act-skip'], 'on the avatar beat: avatar, skip, pause');
  assert.equal(s.act('avatar', { look: 'block', color: 'teal', nameTag: 'Zed' }), true);
  assert.deepEqual(player.raw().avatar, { look: 'block', color: 'teal', nameTag: 'Zed' });
  assert.equal(player.raw().seen.prologue, true);
  assert.deepEqual(done, ['done']);
});
test('prologue: skip sets seen.prologue without an avatar and runs onDone', () => {
  const { s, player, done } = sessionFor();
  assert.equal(s.act('skip'), true);
  assert.equal(player.raw().seen.prologue, true);
  assert.equal(player.raw().avatar, undefined);
  assert.deepEqual(done, ['done']);
  assert.equal(s.clock.now(), 0, 'the play clock never moved');
});
test('seen flags: a scene is marked when it ends or is skipped, not before; next on a say advances extra.scene.line', () => {
  const scenes = { 'g.intro': { beats: [{ t: 'say', who: 'a', key: 'story.one' }, { t: 'say', who: 'a', key: 'story.two' }] } };
  const { s, player } = sessionFor({ id: 'g', scenes, noPrologue: true });
  assert.equal(s.state().status, 'story');
  assert.equal(s.state().extra.scene.line, 'story.one');
  assert.equal(player.raw().seen.scenes['g.intro'], undefined);
  s.act('next');
  assert.equal(s.state().extra.scene.line, 'story.two');
  assert.equal(player.raw().seen.intro.g, undefined);
  s.act('skip');
  assert.equal(player.raw().seen.intro.g, true);
  assert.equal(player.raw().seen.scenes['g.intro'], true);
  assert.equal(s.state().extra.scene, null);
  assert.equal(s.state().status, 'title');
});
test('seen flags: advance() in story moves the scene clock, not clockMs', () => {
  const scenes = { 'g.intro': { beats: [{ t: 'wait', ms: 2000 }] } };
  const { s, player } = sessionFor({ id: 'g', scenes, noPrologue: true });
  s.advance(1000);
  assert.equal(s.state().clockMs, 0);
  assert.equal(s.state().status, 'story');
  s.advance(1000);
  assert.equal(s.state().status, 'title');
  assert.equal(player.raw().seen.scenes['g.intro'], true);
});

// ---- the story check ----
const ctx = { enKeys: new Set(['story.a', 'story.b']), universeCast: new Set(['ada']) };
const good = () => ({
  gameId: 'syntax-drop', front: { nameKey: 'story.f' }, cast: [{ id: 'guild', nameKey: 'story.g' }],
  scenes: {
    intro: { beats: [{ t: 'say', who: 'guild', key: 'story.a' }, { t: 'wait', ms: 31000 }] },
    'chapter-end': { beats: [{ t: 'say', who: 'ada', key: 'story.b' }, { t: 'wait', ms: 16000 }] },
  },
});
const says = (problems) => problems.map((p) => `${p.where}: ${p.message}`).join('\n');
test('story check: a good game story passes; length counts ms plus each say (holdMs or sayNominalMs)', () => {
  assert.deepEqual(checkGameStory(good(), ctx), []);
  assert.equal(sceneLengthMs([{ t: 'say', who: 'a', key: 'k' }, { t: 'say', who: 'a', key: 'k', holdMs: 1000 }, { t: 'wait', ms: 500 }, { t: 'sfx', name: 'x' }]), 4000 + 1000 + 500);
  assert.equal(isStoryFile(good()), true);
  assert.equal(isStoryFile({ game: 'x' }), false);
});
test('story check: each broken case names its keyword (unknown beat, missing key, unknown speaker, missing scene, short intro)', () => {
  const dance = good(); dance.scenes.intro.beats = [{ t: 'dance', ms: 35000 }];
  assert.match(says(checkGameStory(dance, ctx)), /dance/);
  const key = good(); key.scenes.intro.beats[0].key = 'story.x.missing';
  assert.match(says(checkGameStory(key, ctx)), /story\.x\.missing/);
  const who = good(); who.scenes.intro.beats[0].who = 'ghost';
  assert.match(says(checkGameStory(who, ctx)), /ghost/);
  const miss = good(); delete miss.scenes['chapter-end'];
  assert.match(says(checkGameStory(miss, ctx)), /chapter-end/);
  const short = good(); short.scenes.intro.beats = [{ t: 'wait', ms: 12000 }];
  assert.match(says(checkGameStory(short, ctx)), /intro/);
  const long = good(); long.scenes['chapter-end'].beats = [{ t: 'wait', ms: 31000 }];
  assert.match(says(checkGameStory(long, ctx)), /chapter-end length/);
  const noIntro = good(); delete noIntro.scenes.intro;
  assert.match(says(checkGameStory(noIntro, ctx)), /intro/);
});
test('story check: avatar only in the prologue and exactly once there; prologue length 60 to 90 s; universe needs a prologue', () => {
  const av = good(); av.scenes.intro.beats.push({ t: 'avatar' });
  assert.match(says(checkGameStory(av, ctx)), /avatar beat is allowed only in the prologue/);
  const uni = (beats) => ({ cast: [{ id: 'ada', nameKey: 'story.ada' }], scenes: { prologue: { beats } } });
  assert.deepEqual(checkUniverse(uni([{ t: 'say', who: 'ada', key: 'story.a' }, { t: 'avatar' }, { t: 'wait', ms: 70000 }]), ctx), []);
  assert.match(says(checkUniverse(uni([{ t: 'wait', ms: 70000 }]), ctx)), /exactly one avatar/);
  assert.match(says(checkUniverse(uni([{ t: 'avatar' }, { t: 'avatar' }, { t: 'wait', ms: 70000 }]), ctx)), /exactly one avatar/);
  assert.match(says(checkUniverse(uni([{ t: 'avatar' }, { t: 'wait', ms: 5000 }]), ctx)), /prologue length/);
  assert.match(says(checkUniverse({ cast: [], scenes: {} }, ctx)), /no prologue/);
  assert.match(says(checkUniverse({ scenes: {} }, ctx)), /cast/);
});
test('story check: beats need their fields', () => {
  const g = good();
  g.scenes.intro.beats = [{ t: 'move', target: 'ada' }, { t: 'camera' }, { t: 'fade', to: 'sideways', ms: 1 }, { t: 'shake', ms: 5 }, { t: 'spawn', what: 'x' }, { t: 'sfx' }, { t: 'say', who: 'guild' }];
  const out = says(checkGameStory(g, ctx));
  for (const t of ['move', 'camera', 'fade', 'shake', 'spawn', 'sfx', 'say']) assert.match(out, new RegExp(`${t} beat needs`));
});
