#!/usr/bin/env node
// rowcheck: the builders' per-row feedback tool (SPEC D-66). It runs the acceptance file(s) of
// one or more AC rows, only the tests that belong to those rows, and prints what scripts/gate.mjs
// would print for a failure, without the stack lines that point into acceptance/.
//
//   node scripts/rowcheck.mjs AC-217 [AC-218 ...] [--part <gameId or shared>] [--no-build]
//
// Builders run it under the shared lock (one heavy command at a time on this machine):
//   flock ~/tins-orch/gate.lock node scripts/rowcheck.mjs AC-217 --part syntax-drop
//
// Test names in the suite start with the AC id; per-game parts are "<AC-id> <gameId>: ...", shared
// parts "<AC-id> shared: ...", and journeys append " [desktop]" or " [phone]". --part X keeps only
// names that start "<AC-id> X:".
//
// Exit codes: 0 every selected test passed and every id (and part) matched at least one test;
// 1 a selected test failed, nothing matched (a filter that matches nothing is never green), or the
// check file could not run; 2 usage error (unknown id, manual row, check file outside acceptance/,
// bad flags). Full TAP goes to .tins/state-rowcheck-last.tap.
// Testability: the repo root is the current directory, or --root <dir>, or env ROWCHECK_ROOT.
import { existsSync, readFileSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { join, resolve, sep, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const USAGE = 'usage: node scripts/rowcheck.mjs AC-217 [AC-218 ...] [--part <gameId or shared>] [--no-build] [--root <dir>]';
const usageError = (m) => { console.error(`rowcheck: ${m}`); process.exit(2); };
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- arguments ----
const args = process.argv.slice(2);
const ids = [];
let part = null;
let noBuild = false;
let rootArg = process.env.ROWCHECK_ROOT || null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--help' || a === '-h') { console.log(USAGE); process.exit(0); }
  else if (a === '--no-build') noBuild = true;
  else if (a === '--part') { part = args[++i]; if (!part || part.startsWith('--')) usageError(`--part needs a value\n${USAGE}`); }
  else if (a.startsWith('--part=')) { part = a.slice(7); if (!part) usageError(`--part needs a value\n${USAGE}`); }
  else if (a === '--root') { rootArg = args[++i]; if (!rootArg) usageError(`--root needs a value\n${USAGE}`); }
  else if (a.startsWith('--')) usageError(`unknown option ${a}\n${USAGE}`);
  else if (/^AC-\d+$/.test(a)) { if (!ids.includes(a)) ids.push(a); }
  else usageError(`${a} is not an AC id like AC-217\n${USAGE}`);
}
if (!ids.length) usageError(`give at least one AC id\n${USAGE}`);
if (part !== null && /[:\s]/.test(part)) usageError(`--part takes a game id or "shared", not "${part}"`);

const root = resolve(rootArg || process.cwd());
const specPath = join(root, 'SPEC.md');
if (!existsSync(specPath)) usageError(`no SPEC.md in ${root}`);
const specLines = readFileSync(specPath, 'utf8').split('\n');

// ---- id -> check files (the same row shape scripts/gate.mjs reads), claimed or not ----
const accDir = join(root, 'acceptance');
const files = [];
for (const id of ids) {
  const row = specLines.find((l) => l.startsWith(`| ${id} |`));
  if (!row) usageError(`${id} is not an acceptance row in SPEC.md`);
  const cell = row.replace(/\|\s*$/, '').split('|').pop().trim().replace(/`/g, '');
  if (/^manual\b/i.test(cell)) usageError(`${id} is a manual row (${cell}); there is no automated check to run`);
  // gate.mjs: /^\| (AC-\d+) \|.*\|\s*`?(acceptance\/[^`|]+?)`?\s*\|\s*$/, then split on commas and spaces
  const m = row.match(/^\| (AC-\d+) \|.*\|\s*`?(acceptance\/[^`|]+?)`?\s*\|\s*$/);
  if (!m) usageError(cell.includes('acceptance/')
    ? `${id}: its Check column is not in a shape scripts/gate.mjs reads (one backticked file, or several separated by commas or spaces and no backticks): ${cell}`
    : `${id}: its Check column is not a file under acceptance/ (${cell})`);
  for (const f of m[2].split(/[,\s]+/).map((x) => x.replace(/`/g, '')).filter(Boolean)) {
    const abs = resolve(root, f);
    if (!abs.startsWith(accDir + sep)) usageError(`${id}: check file ${f} is outside acceptance/`);
    if (!existsSync(abs)) usageError(`${id}: check file ${f} does not exist (is acceptance/ linked? try: node scripts/setup.mjs)`);
    if (!files.includes(f)) files.push(f);
  }
}

// ---- build once if a journey is selected ----
const env = { ...process.env, FORCE_COLOR: '0' };
for (const k of Object.keys(env)) if (k.startsWith('NODE_TEST_')) delete env[k];
if (!noBuild && files.some((f) => f.endsWith('.journey.mjs'))) {
  console.log('rowcheck: building the web app once (npm run build -w packages/web); use --no-build to skip');
  const b = spawnSync('npm', ['run', 'build', '-w', 'packages/web'], { cwd: root, env, encoding: 'utf8' });
  if (b.status !== 0) {
    console.error(((b.stdout || '') + (b.stderr || '')).split('\n').slice(-30).join('\n'));
    console.error('rowcheck: web build fails');
    process.exit(1);
  }
}

// ---- run just those files, just those tests ----
const selectors = ids.map((id) => ({ id, part, re: new RegExp(`^${id}(?![0-9])${part ? ` ${escapeRe(part)}:` : ''}`) }));
const nodeArgs = ['--test', '--test-concurrency=1', '--test-reporter=tap'];
for (const s of selectors) nodeArgs.push('--test-name-pattern', s.re.source);
const r = spawnSync(process.execPath, [...nodeArgs, ...files], { cwd: root, env, encoding: 'utf8', timeout: 3300000, maxBuffer: 256 * 1024 * 1024 });
const out = (r.stdout || '') + (r.stderr || '');
try { mkdirSync(join(root, '.tins'), { recursive: true }); writeFileSync(join(root, '.tins', 'state-rowcheck-last.tap'), out); } catch { /* read-only checkout */ }

// ---- parse the TAP into a tree (a parent's line comes after its children's lines) ----
const resultRe = /^(\s*)(not ok|ok) \d+ - (.*)$/;
const lines = out.split('\n');
let pending = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(resultRe);
  if (!m) continue;
  const indent = m[1].length;
  const skipped = /\s#\s*(SKIP|TODO)\b/i.test(m[3]);
  const name = m[3].replace(/\s+#\s*(SKIP|TODO)\b.*$/i, '');
  let end = i + 1;
  while (end < lines.length && !resultRe.test(lines[end]) && !/^\s*# Subtest:/.test(lines[end]) && !/^\s*1\.\.\d+/.test(lines[end])) end++;
  const node = { indent, name, ok: m[2] === 'ok', skipped, block: lines.slice(i + 1, end), children: pending.filter((c) => c.indent > indent) };
  pending = pending.filter((c) => c.indent <= indent);
  pending.push(node);
}
const top = pending;

// ---- stack lines that point into acceptance/ are never shown ----
let accReal = null;
try { accReal = dirname(realpathSync(accDir)) + sep; } catch { /* not linked */ }
const isStackIntoAcceptance = (l) => (/^\s*at\s/.test(l) || /:\d+:\d+\)?\s*$/.test(l) || /\(file:\/\//.test(l)) && (l.includes('acceptance/') || (accReal !== null && l.includes(accReal)));

// first lines of a test's `error:` block, as scripts/gate.mjs prints them, then its expected/actual lines
function errorLines(node) {
  const b = node.block;
  const shown = [];
  for (let j = 0; j < b.length; j++) {
    if (!/^\s*error: /.test(b[j])) continue;
    const base = b[j].match(/^\s*/)[0].length;
    for (let k = j; k < b.length && shown.length < 10; k++) {
      if (k > j && (b[k].match(/^\s*/)[0].length <= base || /^\s*code: /.test(b[k]))) break;
      if (isStackIntoAcceptance(b[k])) continue;
      shown.push('    ' + b[k].trim());
    }
    break;
  }
  // expected: and actual: (the gate prints only their first line; a multi-line value `|-` is shown here, up to 8 lines each)
  const ea = [];
  for (let j = 0; j < b.length; j++) {
    if (!/^\s*(expected|actual):/.test(b[j]) || isStackIntoAcceptance(b[j])) continue;
    ea.push('    ' + b[j].trim());
    const base = b[j].match(/^\s*/)[0].length;
    for (let k = j + 1, n = 0; k < b.length && n < 8 && b[k].match(/^\s*/)[0].length > base; k++, n++) if (!isStackIntoAcceptance(b[k])) ea.push('      ' + b[k].trim());
  }
  return [...shown, ...ea];
}
function printFailure(node, depth) {
  const pad = '  '.repeat(depth);
  console.log(`${pad}not ok - ${node.name}`);
  for (const l of errorLines(node)) console.log(pad + l);
  for (const c of node.children) if (!c.ok && !c.skipped) printFailure(c, depth + 1);
}

// ---- select (outermost match only, so a suite and its tests are not counted twice) ----
const counts = new Map(); // selector -> {label, pass, fail, skip}
for (const s of selectors) counts.set(s, { label: `${s.id}${s.part ? ' ' + s.part : ''}`, pass: 0, fail: 0, skip: 0 });
const foreign = []; // top-level failures that match no selector: a check file that did not load or run
function walk(node, isTop) {
  const s = selectors.find((x) => x.re.test(node.name));
  if (s) {
    const c = counts.get(s);
    if (node.skipped) { c.skip++; console.log(`skip - ${node.name}`); }
    else if (node.ok) { c.pass++; console.log(`ok - ${node.name}`); }
    else { c.fail++; printFailure(node, 0); }
    return true;
  }
  let matched = false;
  for (const c of node.children) if (walk(c, false)) matched = true;
  if (!node.ok && isTop && !matched) foreign.push(node);
  return matched;
}
for (const n of top) walk(n, true);

let code = 0;
for (const n of foreign) {
  code = 1;
  console.log(`not ok - a check file did not run cleanly: ${n.name.replace(root + sep, '')}`);
  for (const l of errorLines(n)) console.log(l);
}
console.log('');
for (const c of counts.values()) {
  if (c.fail) code = 1;
  if (c.pass + c.fail === 0) { console.log(`no tests matched ${c.label}`); code = 1; }
  else console.log(`${c.label}: ${c.pass} passed, ${c.fail} failed${c.skip ? `, ${c.skip} skipped` : ''}`);
}
if (r.error || r.signal) { console.log(`rowcheck: the test run did not finish (${r.error ? r.error.message : r.signal})`); code = 1; }
else if (r.status !== 0 && code === 0) { console.log(`rowcheck: node --test exited ${r.status} although every selected test passed; see .tins/state-rowcheck-last.tap`); code = 1; }
console.log(code === 0 ? 'rowcheck: pass' : 'rowcheck: FAIL (full TAP in .tins/state-rowcheck-last.tap)');
process.exit(code);
