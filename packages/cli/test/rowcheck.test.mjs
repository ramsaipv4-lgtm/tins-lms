// Unit tests for scripts/rowcheck.mjs (SPEC D-66). They use a small fixture repo (a SPEC.md and a few
// test files under acceptance/) made in a temp directory, never the real acceptance suite.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'rowcheck.mjs');
let root;

const SPEC = [
  '# fixture',
  '| ID | Behaviour | Check |',
  '|---|---|---|',
  '| AC-1 | passes | `acceptance/core/pass.test.mjs` |',
  '| AC-2 | parts of a cross-game row | `acceptance/games/parts.test.mjs` |',
  '| AC-3 | fails with detail | `acceptance/core/fail.test.mjs` |',
  '| AC-4 | needs a person | manual: owner plays it |',
  '| AC-5 | points outside | `packages/core/test/x.test.mjs` |',
  '| AC-6 | two files | acceptance/core/pass.test.mjs, acceptance/core/parts2.test.mjs |',
  '| AC-7 | only a skipped test | `acceptance/core/skip.test.mjs` |',
  '| AC-11 | prefix of nothing | `acceptance/core/pass.test.mjs` |',
  '| AC-8 | escapes upward | `acceptance/../secret.test.mjs` |',
  '| AC-9 | file is missing | `acceptance/core/missing.test.mjs` |',
  '| AC-10 | file does not load | `acceptance/core/broken.test.mjs` |',
  '',
].join('\n');

const FILES = {
  'acceptance/core/pass.test.mjs': `import { test } from 'node:test';
test('AC-1 ordinary row', () => {});
test('AC-1 second test', () => {});
test('AC-11 another row in the same file', () => {});
test('AC-111 not this one', () => {});
test('unrelated name', () => { throw new Error('must never run'); });
`,
  'acceptance/games/parts.test.mjs': `import { test } from 'node:test';
test('AC-2 shared: shape', () => {});
test('AC-2 syntax-drop: plays', () => {});
test('AC-2 syntax-drop: scores', () => {});
test('AC-2 snek: plays', () => { throw new Error('snek part is broken'); });
test('AC-2 journey syntax-drop: x', () => {});
`,
  'acceptance/core/parts2.test.mjs': `import { test } from 'node:test';
test('AC-6 shared: second file', () => {});
`,
  'acceptance/core/fail.test.mjs': `import { test } from 'node:test';
import assert from 'node:assert/strict';
test('AC-3 assertion fails', () => { assert.equal(1, 2, 'one is not two'); });
test('AC-3 journey fails [phone]', () => {
  throw new Error('screen did not show Save\\nartifacts: ' + process.cwd() + '/acceptance/.artifacts/run1\\n    at step (file://' + process.cwd() + '/acceptance/helpers/j.mjs:10:5)\\nlast message line');
});
`,
  'acceptance/core/skip.test.mjs': `import { test } from 'node:test';
test('AC-7 skipped only', { skip: true }, () => {});
`,
  'acceptance/core/broken.test.mjs': `import { test } from 'node:test';
import './does-not-exist.mjs';
test('AC-10 never registered', () => {});
`,
  'secret.test.mjs': `import { test } from 'node:test';
test('AC-8 outside', () => {});
`,
};

before(() => {
  root = mkdtempSync(join(tmpdir(), 'rowcheck-fixture-'));
  writeFileSync(join(root, 'SPEC.md'), SPEC);
  for (const [f, body] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
});
after(() => { if (root) rmSync(root, { recursive: true, force: true }); });

function run(...args) {
  const r = spawnSync(process.execPath, [script, '--root', root, ...args], { encoding: 'utf8', env: { ...process.env, NODE_TEST_CONTEXT: 'child-v8' } });
  return { code: r.status, out: r.stdout, err: r.stderr, all: r.stdout + r.stderr };
}

test('all selected tests pass: exit 0, per-test ok lines and a count', () => {
  const r = run('AC-1');
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /^ok - AC-1 ordinary row$/m);
  assert.match(r.out, /^ok - AC-1 second test$/m);
  assert.match(r.out, /^AC-1: 2 passed, 0 failed$/m);
  assert.doesNotMatch(r.out, /AC-11|AC-111|unrelated/); // the id match is exact, other names never run
  assert.ok(existsSync(join(root, '.tins', 'state-rowcheck-last.tap')));
  assert.match(readFileSync(join(root, '.tins', 'state-rowcheck-last.tap'), 'utf8'), /^TAP version/m);
});

test('an id that is a prefix of another id selects only its own tests', () => {
  const r = run('AC-11');
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /^AC-11: 1 passed, 0 failed$/m);
});

test('without --part every part of the row runs, and a failing part fails the run', () => {
  const r = run('AC-2');
  assert.equal(r.code, 1, r.all);
  assert.match(r.out, /^ok - AC-2 shared: shape$/m);
  assert.match(r.out, /^ok - AC-2 syntax-drop: plays$/m);
  assert.match(r.out, /^not ok - AC-2 snek: plays$/m);
  assert.match(r.out, /snek part is broken/);
  assert.match(r.out, /^AC-2: 4 passed, 1 failed$/m); // the journey-style name has no part, so it belongs to the row as a whole
});

test('--part keeps only names that start "<id> <part>:"', () => {
  const r = run('AC-2', '--part', 'syntax-drop');
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /^AC-2 syntax-drop: 2 passed, 0 failed$/m);
  assert.doesNotMatch(r.out, /shape|snek|journey/);
  const s = run('AC-2', '--part=shared');
  assert.equal(s.code, 0, s.all);
  assert.match(s.out, /^AC-2 shared: 1 passed, 0 failed$/m);
  // a part that is the failing game fails
  assert.equal(run('AC-2', '--part', 'snek').code, 1);
});

test('zero matches is a failure: exit 1 and the message', () => {
  const r = run('AC-2', '--part', 'nosuchgame');
  assert.equal(r.code, 1, r.all);
  assert.match(r.out, /^no tests matched AC-2 nosuchgame$/m);
  // the part is matched as text, not as a pattern, and not as a prefix of a longer word
  assert.equal(run('AC-2', '--part', 'syntax').code, 1);
  assert.equal(run('AC-2', '--part', '.*').code, 1);
});

test('one id that matches nothing makes the whole run fail even when another passes', () => {
  const r = run('AC-1', 'AC-6', '--part', 'shared');
  assert.equal(r.code, 1, r.all);
  assert.match(r.out, /^no tests matched AC-1 shared$/m);
  assert.match(r.out, /^AC-6 shared: 1 passed, 0 failed$/m);
});

test('a row with two check files runs both', () => {
  const r = run('AC-6');
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /^AC-6: 1 passed, 0 failed$/m); // pass.test.mjs has no AC-6 test; only the one in parts2.test.mjs is selected
  assert.match(readFileSync(join(root, '.tins', 'state-rowcheck-last.tap'), 'utf8'), /pass\.test\.mjs/); // both files were run
});

test('skipped tests do not count as a match', () => {
  const r = run('AC-7');
  assert.equal(r.code, 1, r.all);
  assert.match(r.out, /^no tests matched AC-7$/m);
});

test('a check file that cannot load is a failure, not a silent zero', () => {
  const r = run('AC-10');
  assert.equal(r.code, 1, r.all);
  assert.match(r.out, /a check file did not run cleanly/);
  assert.match(r.out, /^no tests matched AC-10$/m);
});

test('unknown id exits 2', () => {
  const r = run('AC-999');
  assert.equal(r.code, 2, r.all);
  assert.match(r.err, /AC-999 is not an acceptance row/);
});

test('a manual row exits 2', () => {
  const r = run('AC-4');
  assert.equal(r.code, 2, r.all);
  assert.match(r.err, /AC-4 is a manual row/);
});

test('a check file outside acceptance/ exits 2', () => {
  for (const id of ['AC-5', 'AC-8']) {
    const r = run(id);
    assert.equal(r.code, 2, r.all);
    assert.match(r.err, new RegExp(`${id}: (check file .* is outside acceptance/|its Check column is not a file under acceptance/)`));
  }
});

test('a check file that does not exist exits 2', () => {
  const r = run('AC-9');
  assert.equal(r.code, 2, r.all);
  assert.match(r.err, /does not exist/);
});

test('bad arguments exit 2', () => {
  assert.equal(run().code, 2);
  assert.equal(run('AC-1', '--bogus').code, 2);
  assert.equal(run('banana').code, 2);
  assert.equal(run('AC-1', '--part').code, 2);
});

test('failure detail is printed like the gate, but stack lines into acceptance/ are stripped', () => {
  const r = run('AC-3');
  assert.equal(r.code, 1, r.all);
  assert.match(r.out, /^not ok - AC-3 assertion fails$/m);
  assert.match(r.out, /one is not two/);
  assert.match(r.out, /expected: 2/);
  assert.match(r.out, /actual: 1/);
  assert.match(r.out, /^not ok - AC-3 journey fails \[phone\]$/m);
  assert.match(r.out, /screen did not show Save/);
  assert.match(r.out, /artifacts: .*acceptance\/\.artifacts\/run1/); // the artifacts folder is kept
  assert.match(r.out, /last message line/);
  assert.doesNotMatch(r.out, /j\.mjs/);                      // the stack line into acceptance/ is gone
  assert.doesNotMatch(r.out, /fail\.test\.mjs/);              // no test file paths
  assert.doesNotMatch(r.out, /:\d+:\d+/);                     // no line numbers
  assert.match(r.out, /^AC-3: 0 passed, 2 failed$/m);
  // the full, unstripped TAP is kept for the person who may read it
  assert.match(readFileSync(join(root, '.tins', 'state-rowcheck-last.tap'), 'utf8'), /fail\.test\.mjs/);
});

test('NODE_TEST_* variables of the parent do not leak into the child run', () => {
  // run() sets NODE_TEST_CONTEXT=child-v8; if it leaked, node --test would print raw v8 output instead of TAP
  const r = run('AC-1');
  assert.equal(r.code, 0, r.all);
});
