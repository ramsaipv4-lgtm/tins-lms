// b11-2 unit tests: the shell's navigation rules (per-role home, switch-gated nav), kiosk flag, and scripts/navcheck.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { homeRoute, navEntries } from '../src/app/nav.ts';
import { switchOn } from '../src/app/switches.ts';

const ROOT = join(new URL('..', import.meta.url).pathname, '..', '..');
const label = (k) => ({ 'a.one': 'Alpha', 'a.two': 'Beta', 'a.three': 'Gamma', 'a.strike': 'Heading Strike', 'a.wall': 'Wall', 'a.batch': 'Batch', 'a.plan': 'Plan', 'a.sched': 'Schedule' }[k] ?? k);
const R = (path, space, key, extra = {}) => ({ path, space, label: key, load: async () => ({ default: () => null }), ...extra });

test('switchOn: unknown switches never hide, an off switch hides, a list needs one on', () => {
  assert.equal(switchOn(null, 'headingStrike'), true);
  assert.equal(switchOn({ headingStrike: false }, undefined), true);
  assert.equal(switchOn({ headingStrike: false }, 'headingStrike'), false);
  assert.equal(switchOn({ headingStrike: true }, 'headingStrike'), true);
  assert.equal(switchOn({ teamBadges: false, celebrationWall: false }, ['teamBadges', 'celebrationWall']), false);
  assert.equal(switchOn({ teamBadges: false, celebrationWall: true }, ['teamBadges', 'celebrationWall']), true);
  assert.equal(switchOn({}, 'storyMode'), true, 'a switch the hub does not report is not hidden');
});

test('navEntries: by order then label; roles narrow; nav:false and an off switch hide', () => {
  const routes = [
    R('/learn/b', 'learn', 'a.two', { order: 5 }),
    R('/learn/a', 'learn', 'a.one', { order: 5 }),
    R('/learn/c', 'learn', 'a.three', { order: 1 }),
    R('/learn/h', 'learn', 'a.one', { nav: false }),
    R('/learn/t', 'learn', 'a.sched', { roles: ['trainer'] }),
    R('/learn/s', 'learn', 'a.strike', { order: 9, switch: 'headingStrike' }),
    R('/teach/x', 'teach', 'a.one'),
  ];
  assert.deepEqual(navEntries(routes, 'learn', ['learner'], null, label).map((r) => r.path), ['/learn/c', '/learn/a', '/learn/b', '/learn/s']);
  assert.deepEqual(navEntries(routes, 'learn', ['learner'], { headingStrike: false }, label).map((r) => r.path), ['/learn/c', '/learn/a', '/learn/b']);
  assert.ok(navEntries(routes, 'learn', ['trainer'], null, label).some((r) => r.path === '/learn/t'));
});

test('homeRoute: a role-specific home applies only when it covers every role the person holds in the space', () => {
  const routes = [
    R('/teach/schedule', 'teach', 'a.sched', { order: 30 }),
    R('/teach/batch', 'teach', 'a.batch', { order: 33, home: ['coordinator'] }),
    R('/coach/plan', 'coach', 'a.plan', { order: 10, home: ['learner'] }),
  ];
  assert.equal(homeRoute(routes, 'teach', ['coordinator'], label)?.path, '/teach/batch');
  assert.equal(homeRoute(routes, 'teach', ['trainer'], label), null);
  assert.equal(homeRoute(routes, 'teach', ['trainer', 'coordinator'], label), null, 'a trainer who is also coordinator keeps the generic home');
  assert.equal(homeRoute(routes, 'coach', ['learner'], label)?.path, '/coach/plan');
  assert.equal(homeRoute(routes, 'admin', ['admin'], label), null);
  assert.equal(homeRoute(routes, 'coach', ['admin'], label), null, 'no role in the space, no home');
});

test('kiosk flag: stored per device, listeners hear changes, a broken storage reads as off', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { kioskOn, setKiosk, onKiosk } = await import('../src/app/kiosk.ts');
  let heard = 0;
  const off = onKiosk(() => heard++);
  assert.equal(kioskOn(), false);
  setKiosk(true);
  assert.equal(kioskOn(), true);
  assert.equal(store.get('lms.kiosk'), '1');
  setKiosk(false);
  assert.equal(kioskOn(), false);
  assert.equal(heard, 2);
  off(); setKiosk(true); assert.equal(heard, 2);
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(kioskOn(), false);
  delete globalThis.localStorage;
});

function fakeRepo(labels, spec) {
  const dir = mkdtempSync(join(tmpdir(), 'navcheck-'));
  mkdirSync(join(dir, 'packages/web/src/strings'), { recursive: true });
  mkdirSync(join(dir, 'packages/web/src/features/g'), { recursive: true });
  writeFileSync(join(dir, 'packages/web/src/strings/en.json'), JSON.stringify({ 'nav.home': 'Home', 'nav.setup': 'Setup check', 'space.admin': 'Admin', 'space.teach': 'Teach', 'space.learn': 'Learn', 'space.coach': 'Coach' }));
  writeFileSync(join(dir, 'packages/web/src/features/g/strings.en.json'), JSON.stringify(Object.fromEntries(labels.map(([k, text]) => [k, text]))));
  writeFileSync(join(dir, 'packages/web/src/features/g/index.tsx'), `export const routes = [\n${labels.map(([k, , o, roles], i) => `  { path: '/learn/p${i}', space: 'learn', label: '${k}', order: ${o}, roles: [${roles ?? "'learner'"}], load: () => import('./x.tsx') },`).join('\n')}\n];\n`);
  writeFileSync(join(dir, 'SPEC.md'), `## Appendix D\n### demo.journey.mjs\nAccessible names used: learner nav ${spec}.\n## Appendix E\n`);
  return dir;
}
const navcheck = (dir) => spawnSync(process.execPath, [join(ROOT, 'scripts/navcheck.mjs'), dir], { encoding: 'utf8' });

test('navcheck: a pattern matching two labels one role sees is a collision and names the winner by order', () => {
  const dir = fakeRepo([['g.a', 'Daily review', 7], ['g.b', 'Review cards', 3]], '/review/');
  try {
    const r = navcheck(dir);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /COLLISION demo\.journey\.mjs learner nav \/review\/ in learn.*WINS "Review cards" .*over "Daily review"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('navcheck: roles are taken into account, and one match per space is fine', () => {
  const dir = fakeRepo([['g.a', 'Daily review', 7, "'trainer'"], ['g.b', 'Review cards', 3]], '/review/');
  try {
    const r = navcheck(dir);
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /0 new collision/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('navcheck on this repository: every collision is reviewed (the gate runs this before the unit tests)', () => {
  const r = navcheck(ROOT);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /0 new collision/);
});
