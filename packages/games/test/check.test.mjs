// Pack schemas and the pack check for the four first-wave games, plus the `games` CLI core (task g-2).
// SPEC §13.5 "Pack-check rules (first wave)", AC-214, AC-216. Snek (task g-1) is replaced by a small stub that knows
// exactly the programs these tests use; an unregistered program throws so a mistake in a test is loud.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPack, loadSchema, FIRST_WAVE } from '../src/check/packs.ts';
import { checkPath, formatProblem } from '../src/check/index.ts';
import { validate } from '../src/check/jsonschema.ts';
import { starterPack, starterJson } from '../src/check/starter.ts';
import { failingTest, sameValue } from '../src/check/snek.ts';
import { gamesCore } from '../../cli/src/games.ts';

// ---- the Snek stub (SPEC §13.4 interface) ----
const err = (kind, line, message) => ({ kind, line, col: 1, message });
function stub(table) {
  const entry = (src) => { if (!(src in table)) throw new Error(`stub: unregistered program ${JSON.stringify(src)}`); return table[src]; };
  return {
    compile(src) { const e = entry(src); return e.syntax ? { ok: false, error: err('SyntaxError', 1, e.syntax) } : { ok: true, program: { src } }; },
    run(p) { const e = entry(p.src); return e.error ? { ok: false, error: err(e.error, 2, 'it broke.'), stdout: e.stdout ?? '', ops: 1, peakCells: 1 } : { ok: true, value: null, stdout: e.stdout ?? '', ops: 1, peakCells: 1 }; },
    callFunction(p, name, args) {
      const f = entry(p.src).fns?.[name];
      return f ? { ok: true, value: f(...args), stdout: '', ops: 1, peakCells: 1 } : { ok: false, error: err('NameError', 1, `name ${name} is not defined.`), stdout: '', ops: 1, peakCells: 1 };
    },
  };
}
const AREA = 'def area(w, h):\n    a = w\n    b = h\n    return a * b';
const AREA_ALT = 'def area(w, h):\n    b = h\n    a = w\n    return a * b';
const WHACK_BAD = 'total = 0\nfor i in range(1, 4):\n    total += i\nprint(total)';
const WHACK_GOOD = 'total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)';
const snek = stub({
  'print(2 + 3)': { stdout: '5\n' }, 'print(2 * 3)': { stdout: '6\n' }, 'print(2 ** 3)': { stdout: '8\n' },
  'print(1 + 5)': { stdout: '6\n' }, 'print(3 +': { syntax: 'invalid syntax.' }, 'print(5 / 0)': { error: 'ZeroDivisionError' },
  [AREA]: { fns: { area: (w, h) => w * h } }, [AREA_ALT]: { fns: { area: (w, h) => w * h } },
  'def area(w, h):\n    a = w\n    b = h\n    return a + b': { fns: { area: (w, h) => w + h } },
  'def area(w, h):\n    a = w\n    return a * b\n    b = h': { fns: { area: () => 0 } },
  'def area(w, h):\n    b = h\n    a = w\n    return a + b': { fns: { area: (w, h) => w + h } },
  [WHACK_BAD]: { stdout: '6\n' }, [WHACK_GOOD]: { stdout: '10\n' },
  'a = [1]\nprint(a[3])': { error: 'IndexError', stdout: '' },
  'print(1)\nprint(2)': { stdout: '1\n2\n' }, 'print(1)\nprint(3)': { stdout: '1\n3\n' },
  'print("hi")': { stdout: 'hi\n' }, 'print(1 + 1)': { stdout: '2\n' }, 'x = 2\nprint(x * 2)': { stdout: '4\n' }, 'x = 2\nprint(x * 3)': { stdout: '6\n' },
  'print("7")': { stdout: '7\n' },
});
const deep = (o) => structuredClone(o);
const lines = (problems) => problems.map((p) => `${p.where}: ${p.message}`).join('\n');
const level0 = (pack) => pack.levels[0];

// ---- (9) schemas ----
test('schemas: one JSON Schema 2020-12 file per first-wave game, with the common required fields and the level fields of §13.7', () => {
  for (const g of FIRST_WAVE) {
    const s = loadSchema(g);
    assert.equal(s.$schema, 'https://json-schema.org/draft/2020-12/schema', g);
    assert.deepEqual(s.required, ['game', 'id', 'title', 'day', 'concepts', 'language', 'levels'], g);
    assert.equal(s.properties.game.const, g);
    assert.deepEqual(s.$defs.level.required.slice(0, 3), ['id', 'title', 'lesson'], g);
    assert.equal(existsSync(new URL(`../schema/${g}.schema.json`, import.meta.url)), true);
  }
  const fields = (g) => Object.keys(loadSchema(g).$defs.level.properties);
  for (const f of ['mode', 'renderer', 'template', 'slots', 'pieces', 'stages', 'speed', 'piecesPerStage']) assert.ok(fields('syntax-drop').includes(f), `syntax-drop ${f}`);
  for (const f of ['bounties', 'snippets', 'monsters', 'speed', 'slack', 'plates', 'callouts']) assert.ok(fields('sniper').includes(f), `sniper ${f}`);
  for (const f of ['program', 'bugs', 'upTimeMs', 'hint', 'molesAtOnce']) assert.ok(fields('whack-a-bug').includes(f), `whack-a-bug ${f}`);
  for (const f of ['lines', 'decoys', 'tests', 'shockSec', 'fallSpeed', 'altOrders', 'entry', 'concept']) assert.ok(fields('aftershock').includes(f), `aftershock ${f}`);
});
test('schema validator: types, required, pattern, enum, bounds, additionalProperties, anyOf, $ref', () => {
  const s = { type: 'object', required: ['a'], additionalProperties: false, properties: { a: { type: 'integer', minimum: 1 }, b: { enum: ['x', 'y'] }, c: { type: 'array', items: { $ref: '#/$defs/d' }, minItems: 1 }, e: { type: 'string', pattern: '^[a-z]+$', maxLength: 3 } }, $defs: { d: { anyOf: [{ type: 'string' }, { type: 'null' }] } } };
  assert.deepEqual(validate(s, { a: 1, b: 'x', c: ['q', null], e: 'abc' }), []);
  const bad = validate(s, { a: 0, b: 'z', c: [], e: 'ABCD', f: 1 });
  assert.equal(bad.length, 6);
  assert.match(JSON.stringify(validate(s, {})), /missing required field \\"a\\"/);
  assert.match(JSON.stringify(validate(s, { a: 1.5 })), /must be integer/);
  assert.match(JSON.stringify(validate(s, { a: 1, c: [3] })), /does not match any allowed shape/);
});

// ---- (9) good packs ----
test('good packs: the starter pack of every first-wave game passes the check (with Snek where the game needs it)', () => {
  for (const g of FIRST_WAVE) assert.deepEqual(checkPack(starterPack(g, 'x'), snek), [], g);
  assert.deepEqual(checkPack(starterPack('syntax-drop', 'x'), null), [], 'a fill/html pack needs no Snek');
  assert.match(lines(checkPack(starterPack('sniper', 'x'), null)), /Snek is not available/);
});

// ---- common rules ----
test('common rules: missing title, bad concept format, repeated level id, long lesson, unlisted concept, bad ids', () => {
  const p = starterPack('syntax-drop', 'x');
  const noTitle = deep(p); delete noTitle.title;
  assert.match(lines(checkPack(noTitle, snek)), /^pack: .*title/m);
  const badConcept = deep(p); badConcept.concepts[0] = 'HTML Headings';
  assert.match(lines(checkPack(badConcept, snek)), /HTML Headings/);
  const twice = deep(p); twice.levels.push(deep(twice.levels[0]));
  const out = lines(checkPack(twice, snek));
  assert.match(out, /level 1: level id "1" appears more than once/);
  const long = deep(p); level0(long).lesson[0].text = 'x'.repeat(281);
  assert.match(lines(checkPack(long, snek)), /281 characters/);
  const ok280 = deep(p); level0(ok280).lesson[0].text = 'x'.repeat(280);
  assert.deepEqual(checkPack(ok280, snek), []);
  const unlisted = deep(p); level0(unlisted).pieces[0].concept = 'css.other';
  assert.match(lines(checkPack(unlisted, snek)), /css\.other.*not listed in the pack's concepts/);
  const badId = deep(p); badId.id = 'Bad_Id';
  assert.match(lines(checkPack(badId, snek)), /pack id/);
  const extra = deep(p); extra.surprise = 1;
  assert.match(lines(checkPack(extra, snek)), /unknown field "surprise"/);
  const comment = deep(p); comment.$comment = 'ok'; level0(comment).$comment = 'ok';
  assert.deepEqual(checkPack(comment, snek), [], '$comment is allowed in any object and ignored');
  assert.match(lines(checkPack([], snek)), /JSON object/);
  assert.match(lines(checkPack({}, snek)), /"game"/);
  assert.match(lines(checkPack({ game: 'maze-coder' }, snek)), /not available yet/);
  assert.match(lines(checkPack({ game: 'tetris' }, snek)), /unknown game/);
});

// ---- syntax-drop ----
test('syntax-drop: a slot with no correct piece, a template without its slot, bad keys, unknown renderer, a template that does not run', () => {
  const p = starterPack('syntax-drop', 'x');
  const noPiece = deep(p); level0(noPiece).slots[1].accepts = ['p-middle'];
  assert.match(lines(checkPack(noPiece, snek)), /level 1: slot s2 accepts no correct piece/);
  const ghost = deep(p); level0(ghost).slots[1].accepts = ['p-nothing'];
  assert.match(lines(checkPack(ghost, snek)), /slot s2 accepts no correct piece/);
  const noTemplate = deep(p); level0(noTemplate).template = '<div>{{s1}}</div>';
  assert.match(lines(checkPack(noTemplate, snek)), /does not contain \{\{s2\}\}/);
  const renderer = deep(p); level0(renderer).renderer = 'hologram';
  assert.match(lines(checkPack(renderer, snek)), /hologram/);
  const noSlots = deep(p); level0(noSlots).slots = [];
  assert.match(lines(checkPack(noSlots, snek)), /fill level needs at least one slot/);

  const strike = deep(p);
  Object.assign(level0(strike), { mode: 'strike', slots: [], template: '<h1>A</h1>', piecesPerStage: 2 });
  level0(strike).pieces = [{ id: 'a', text: '<h1>', key: '1', concept: 'css.display' }, { id: 'b', text: '<h2>', key: '1', concept: 'css.display' }, { id: 'c', text: '<h3>', key: '0', concept: 'css.display' }, { id: 'd', text: '<h4>', concept: 'css.display' }];
  const out = lines(checkPack(strike, snek));
  assert.match(out, /strike key 1 is used by both a and b/);
  assert.match(out, /piece c has key "0"/);
  assert.match(out, /piece d needs a strike key/);
  level0(strike).pieces = [{ id: 'a', text: '<h1>', key: '1', concept: 'css.display' }, { id: 'b', text: '<h2>', key: '9', concept: 'css.display', decoy: true }];
  assert.deepEqual(checkPack(strike, snek), []);

  const consolePack = deep(p);
  Object.assign(level0(consolePack), { renderer: 'console', template: 'print({{s1}})', slots: [{ id: 's1', accepts: ['n'] }], pieces: [{ id: 'n', text: '2 + 3', concept: 'css.display' }, { id: 'd', text: '2 +', concept: 'css.display', decoy: true }], stages: 1 });
  assert.deepEqual(checkPack(consolePack, snek), []);
  level0(consolePack).pieces[0].text = '3 +'; level0(consolePack).template = 'print({{s1}}';
  consolePack.levels[0].template = 'print({{s1}}'; // compiles to the registered syntax error 'print(3 +'? no: 'print(3 +' is registered
  consolePack.levels[0].template = 'print({{s1}}'; level0(consolePack).pieces[0].text = '3 +';
  assert.match(lines(checkPack(consolePack, snek)), /does not run \(SyntaxError on line 1/);
  const pattern = deep(consolePack); level0(pattern).renderer = 'pattern';
  assert.match(lines(checkPack(pattern, snek)), /does not run/);
});

// ---- whack-a-bug ----
test('whack-a-bug: line limit, bug line inside the program, fixed and buggy outputs must differ, both must run', () => {
  const p = starterPack('whack-a-bug', 'x');
  const long = deep(p); level0(long).program = Array.from({ length: 10 }, (_, i) => `print(${i})`).join('\n');
  assert.match(lines(checkPack(long, snek)), /10 lines; the most allowed is 9/);
  const outside = deep(p); level0(outside).bugs[0].line = 9;
  assert.match(lines(checkPack(outside, snek)), /bug line 9 is outside the program \(lines 1 to 4\)/);
  const same = deep(p); level0(same).bugs[0].fix = 'for i in range(1, 4):';
  assert.match(lines(checkPack(same, snek)), /same as the buggy line/);
  const noEffect = deep(p); level0(noEffect).program = 'print(1)\nprint(2)'; level0(noEffect).bugs[0] = { line: 2, fix: 'print(2)', concept: 'loops.range', why: 'x' };
  assert.match(lines(checkPack(noEffect, snek)), /same as the buggy line/);
  const invisible = deep(p); level0(invisible).program = 'x = 2\nprint(x * 2)'; level0(invisible).bugs[0] = { line: 1, fix: 'x = 2', concept: 'loops.range', why: 'x' };
  assert.match(lines(checkPack(invisible, snek)), /same as the buggy line/);
  const hidden = deep(p); level0(hidden).program = 'x = 2\nprint(x * 3)'; level0(hidden).bugs[0] = { line: 2, fix: 'print(x * 2)', concept: 'loops.range', why: 'x' };
  assert.deepEqual(checkPack(hidden, snek), [], 'differing outputs pass');
  const dup = deep(p); level0(dup).bugs.push({ ...level0(dup).bugs[0] });
  assert.match(lines(checkPack(dup, snek)), /line 2 has more than one bug/);
  const crash = deep(p); level0(crash).program = 'a = [1]\nprint(a[3])'; level0(crash).bugs[0] = { line: 2, fix: 'print(a[0])', concept: 'loops.range', why: 'x' };
  assert.match(lines(checkPack(crash, stub({ ...{}, 'a = [1]\nprint(a[3])': { error: 'IndexError' }, 'a = [1]\nprint(a[0])': { stdout: '1\n' } }))), /^$/, 'a buggy program that raises is a visible bug, not a pack fault');
  const good = deep(p);
  assert.deepEqual(checkPack(good, snek), []);
  const hintBad = deep(p); level0(hintBad).hint = 'rainbow';
  assert.match(lines(checkPack(hintBad, snek)), /rainbow/);
});

// ---- aftershock ----
test('aftershock: lines in order and every altOrders entry must pass the tests; the message names the failing test', () => {
  const p = starterPack('aftershock', 'x');
  assert.deepEqual(checkPack(p, snek), []);
  const wrong = deep(p); level0(wrong).lines[3].text = 'return a + b';
  const out = lines(checkPack(wrong, snek));
  assert.match(out, /the lines in order: fails the tests \(test 1 failed: area\(2, 3\) gave 5, expected 6\)/);
  assert.match(out, /test/);
  const altBad = deep(p); level0(altBad).altOrders = [[0, 2, 1, 3], [0, 1, 3, 2]];
  assert.match(lines(checkPack(altBad, snek)), /altOrders\[1\]: fails the tests \(test 1 failed/);
  const perm = deep(p); level0(perm).altOrders = [[0, 1, 1, 3], [0, 1]];
  const permOut = lines(checkPack(perm, snek));
  assert.match(permOut, /altOrders\[0\] must be a permutation/);
  assert.match(permOut, /altOrders\[1\] must be a permutation/);
  const noEntry = deep(p); delete level0(noEntry).entry;
  assert.match(lines(checkPack(noEntry, snek)), /no "entry"/);
  const sig = deep(p); delete level0(sig).entry; level0(sig).signature = 'area(w, h)';
  assert.deepEqual(checkPack(sig, snek), [], 'signature names the function too');
  const noTests = deep(p); level0(noTests).tests = [];
  assert.match(lines(checkPack(noTests, snek)), /tests: must have at least 1 item/);
});
test('pack tests: stdout tests, float tolerance 1e-9, stdout compared after trailing whitespace is removed', () => {
  assert.equal(failingTest(snek, 'print(1)\nprint(2)', null, [{ stdout: '1\n2' }, { input: ['a'], stdout: '1\n2\n\n' }]), null);
  assert.match(failingTest(snek, 'print(1)\nprint(2)', null, [{ stdout: '1\n3' }]), /test 1 failed: printed/);
  assert.match(failingTest(snek, 'print(3 +', null, [{ stdout: '' }]), /does not compile/);
  assert.equal(sameValue(0.1 + 0.2, 0.3), true);
  assert.equal(sameValue(1, 1.001), false);
  assert.equal(sameValue([1, { a: 2 }], [1, { a: 2 }]), true);
  assert.equal(sameValue({ $tuple: [1, 2] }, { $tuple: [1, 3] }), false);
});

// ---- sniper ----
test('sniper: every snippet runs; each bounty output is printed by exactly one monster; plates and callouts name real snippets', () => {
  const p = starterPack('sniper', 'x');
  assert.deepEqual(checkPack(p, snek), []);
  const broken = deep(p); level0(broken).snippets[0].code = 'print(5 / 0)'; 
  assert.match(lines(checkPack(broken, snek)), /snippet s-add does not run \(ZeroDivisionError/);
  const twin = deep(p); level0(twin).snippets.push({ id: 's-six', code: 'print(1 + 5)', concept: 'python.arithmetic' }); level0(twin).monsters.push('s-six');
  assert.match(lines(checkPack(twin, snek)), /"6" must be printed by exactly one monster snippet, but 2 print it \(s-mul, s-six\)/);
  const wrongOut = deep(p); level0(wrongOut).bounties[0].output = '99';
  assert.match(lines(checkPack(wrongOut, snek)), /says it prints "99" but the snippet prints "5"/);
  const rightOut = deep(p); level0(rightOut).bounties[0].output = '5';
  assert.deepEqual(checkPack(rightOut, snek), []);
  const notMonster = deep(p); level0(notMonster).monsters = ['s-mul', 's-pow'];
  assert.match(lines(checkPack(notMonster, snek)), /bounty snippet "s-add" is not among the level's monsters/);
  const ghost = deep(p); level0(ghost).monsters.push('s-ghost'); level0(ghost).bounties.push({ snippetId: 's-none' });
  const ghostOut = lines(checkPack(ghost, snek));
  assert.match(ghostOut, /monster "s-ghost"/);
  assert.match(ghostOut, /bounty snippet "s-none"/);
  const boss = deep(p);
  Object.assign(level0(boss), { monsters: [], bounties: [], plates: [{ snippetId: 's-add' }, { snippetId: 's-mul' }], callouts: ['s-mul', 's-add'] });
  assert.deepEqual(checkPack(boss, snek), []);
  level0(boss).callouts = ['s-pow', 's-nowhere'];
  const bossOut = lines(checkPack(boss, snek));
  assert.match(bossOut, /callout "s-pow" names a snippet that is not a plate/);
  assert.match(bossOut, /callout "s-nowhere" is not one of the level's snippets/);
  level0(boss).plates.push({ snippetId: 's-ghost' });
  assert.match(lines(checkPack(boss, snek)), /plate snippet "s-ghost"/);
  const empty = deep(p); Object.assign(level0(empty), { bounties: [], monsters: [] });
  assert.match(lines(checkPack(empty, snek)), /needs bounties/);
});

// ---- checkPath and the CLI core ----
function temp() { return mkdtempSync(join(tmpdir(), 'g2-check-')); }
const write = (file, data) => { mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2)); };

test('checkPath: files are packs or story files, index.json is skipped, bad JSON is a problem line, a missing path throws', async () => {
  const dir = temp();
  write(join(dir, 'a.json'), starterPack('syntax-drop', 'a'));
  write(join(dir, 'sub', 'b.json'), (() => { const p = starterPack('syntax-drop', 'b'); delete p.title; return p; })());
  write(join(dir, 'index.json'), { cases: {} });
  write(join(dir, 'c.json'), '{ nope');
  write(join(dir, 'story.json'), { gameId: 'sniper', front: { nameKey: 'story.f' }, cast: [], scenes: { intro: { beats: [{ t: 'wait', ms: 31000 }] } } });
  const r = await checkPath(dir, { snek, enKeys: new Set(), universeCast: [] });
  assert.equal(r.files, 4);
  const out = r.problems.map(formatProblem);
  assert.ok(out.some((l) => l.endsWith('b.json: pack: missing required field "title".')), out.join('\n'));
  assert.ok(out.some((l) => /c\.json: file: not valid JSON/.test(l)));
  assert.ok(out.some((l) => /story\.json: scene sniper\.chapter-end: the required scene chapter-end is missing\./.test(l)));
  assert.ok(!out.some((l) => l.startsWith(join(dir, 'a.json'))), 'the good pack has no problem');
  await assert.rejects(() => checkPath(join(dir, 'missing'), { snek }), /no such file/);
});
test('CLI games check: exit 0 with "ok: <n> file(s)", exit 1 with one line per problem, exit 2 on a usage error', async () => {
  const dir = temp();
  write(join(dir, 'ok.json'), starterPack('syntax-drop', 'ok'));
  const ok = await gamesCore(['check', join(dir, 'ok.json')], { cwd: dir, snek });
  assert.deepEqual(ok, { code: 0, stdout: 'ok: 1 file(s)\n', stderr: '' });
  const bad = starterPack('syntax-drop', 'bad'); bad.levels[0].slots[1].accepts = ['p-middle'];
  write(join(dir, 'bad.json'), bad);
  const fail = await gamesCore(['check', '.'], { cwd: dir, snek });
  assert.equal(fail.code, 1);
  assert.match(fail.stdout, /^\.[\\/]bad\.json: level 1: slot s2 accepts no correct piece/m);
  assert.equal(fail.stdout.trim().split('\n').length, 1, 'one line per problem');
  for (const args of [[], ['check'], ['check', 'a', 'b'], ['check', 'x', '--bad'], ['nope'], ['new'], ['new', 'sniper'], ['new', 'tetris', 'x'], ['new', 'sniper', 'Bad_Id'], ['new', 'sniper', 'x', '--what'], ['check', join(dir, 'gone')]]) {
    const r = await gamesCore(args, { cwd: dir, snek });
    assert.equal(r.code, 2, JSON.stringify(args));
    assert.match(r.stderr, /usage: lms games check/);
  }
});

// ---- AC-216: games new writes a starter pack that passes games check, for every first-wave game ----
test('AC-216 games new <gameId> x writes games/<gameId>/x.json, prints its path, passes games check; it refuses to overwrite (exit 1)', async () => {
  for (const g of FIRST_WAVE) {
    const dir = temp();
    const made = await gamesCore(['new', g, 'x'], { cwd: dir, snek });
    assert.equal(made.code, 0, g);
    const file = join(dir, 'games', g, 'x.json');
    assert.equal(made.stdout, `${file}\n`);
    assert.equal(readFileSync(file, 'utf8'), starterJson(g, 'x'));
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(parsed.game, g);
    assert.equal(parsed.id, 'x');
    assert.ok(typeof parsed.$comment === 'string', 'a commented starter pack');
    const checked = await gamesCore(['check', join(dir, 'games')], { cwd: dir, snek });
    assert.deepEqual(checked, { code: 0, stdout: 'ok: 1 file(s)\n', stderr: '' }, g);
    const again = await gamesCore(['new', g, 'x'], { cwd: dir, snek });
    assert.equal(again.code, 1);
    assert.match(again.stderr, /refusing to overwrite/);
    assert.equal(readdirSync(join(dir, 'games', g)).length, 1, 'no temp file is left behind');
  }
  const dir = temp(); const other = temp();
  const viaDir = await gamesCore(['new', 'aftershock', 'loops', '--dir', other], { cwd: dir, snek });
  assert.equal(viaDir.stdout, `${join(other, 'games', 'aftershock', 'loops.json')}\n`);
  assert.equal(existsSync(join(dir, 'games')), false);
});
