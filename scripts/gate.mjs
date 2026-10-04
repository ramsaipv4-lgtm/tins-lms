#!/usr/bin/env node
// Project gate (run by `kit gate` via tins.json). Staged: only acceptance rows listed in
// build/progress/<task>.json must pass, and that list may only grow (checked against the last commit).
// Steps: 1 acceptance link, 2 dependency pins, 3 builder unit tests, 4 progress monotonic,
// 5 acceptance rows, 6 course steps (skill-template gate).
import { existsSync, readFileSync, readdirSync, symlinkSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

const root = resolve(process.cwd());
const fail = (m) => { console.error(`gate: ${m}`); process.exitCode = 1; };
const env = { ...process.env, FORCE_COLOR: '0' };
for (const k of Object.keys(env)) if (k.startsWith('NODE_TEST_')) delete env[k];

// 1. acceptance suite present (a link to the tests repo; never committed here)
const acc = join(root, 'acceptance');
if (!existsSync(acc)) {
  const src = process.env.LMS_ACCEPTANCE_DIR || resolve(root, '..', 'tins-lms-tests', 'acceptance');
  if (!existsSync(src)) { fail(`acceptance suite not found; clone https://github.com/ramsaipv4-lgtm/tins-lms-tests next to this repo or set LMS_ACCEPTANCE_DIR`); process.exit(1); }
  symlinkSync(src, acc, 'dir');
}
// worktrees (parallel tasks) share the main checkout's installed dependencies
if (!existsSync(join(root, 'node_modules')) && process.env.LMS_NODE_MODULES) symlinkSync(process.env.LMS_NODE_MODULES, join(root, 'node_modules'), 'dir');

// 2. every workspace dependency pinned exactly and named in a locked D-row of SPEC.md
const spec = readFileSync(join(root, 'SPEC.md'), 'utf8');
const locked = spec.split('\n').filter((l) => /^\| D-\d+ \|/.test(l) && /\|\s*locked\s*\|/.test(l)).join('\n');
const pkgFiles = ['package.json', ...(existsSync(join(root, 'packages')) ? readdirSync(join(root, 'packages')).map((p) => `packages/${p}/package.json`) : [])];
for (const pf of pkgFiles.filter((p) => existsSync(join(root, p)))) {
  const pkg = JSON.parse(readFileSync(join(root, pf), 'utf8'));
  for (const [name, ver] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies })) {
    if (ver.startsWith('workspace:') || ver === '*' && name.startsWith('@lms/')) continue;
    if (!/^\d+\.\d+\.\d+$/.test(ver)) fail(`${pf}: ${name}@${ver} is not pinned to an exact version (D-14)`);
    if (!locked.includes(`\`${name}\``) && !locked.includes(` ${name} `)) fail(`${pf}: ${name} is not named in a locked D-row (D-14)`);
    else if (!locked.includes(ver)) fail(`${pf}: ${name}@${ver} differs from the version in SPEC (D-14)`);
  }
}

// 3. builder unit tests
const unit = [];
for (const p of existsSync(join(root, 'packages')) ? readdirSync(join(root, 'packages')) : []) {
  const d = join(root, 'packages', p, 'test');
  if (existsSync(d)) for (const f of readdirSync(d)) if (f.endsWith('.test.mjs') || f.endsWith('.test.ts')) unit.push(join(d, f));
}
if (unit.length) {
  const r = spawnSync(process.execPath, ['--test', ...unit], { cwd: root, env, encoding: 'utf8' });
  if (r.status !== 0) { console.error((r.stdout + r.stderr).split('\n').slice(-30).join('\n')); fail('builder unit tests fail'); }
}

// 4. progress list only grows. One file per task (build/progress/<task>.json, {"green": [...]})
// so parallel tasks never conflict; the gate checks the union.
const progDir = join(root, 'build', 'progress');
const prog = { green: [] };
if (existsSync(progDir)) for (const f of readdirSync(progDir).filter((x) => x.endsWith('.json'))) prog.green.push(...JSON.parse(readFileSync(join(progDir, f), 'utf8')).green);
const before = { green: [] };
try {
  const names = execFileSync('git', ['ls-tree', '--name-only', 'HEAD:build/progress'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter((x) => x.endsWith('.json'));
  for (const n of names) before.green.push(...JSON.parse(execFileSync('git', ['show', `HEAD:build/progress/${n}`], { cwd: root, encoding: 'utf8' })).green);
} catch {}
const dropped = before.green.filter((x) => !prog.green.includes(x));
if (dropped.length) fail(`build/progress/ removed rows that were green before: ${dropped.join(', ')}`);

// 5. acceptance rows listed as green must pass (parts derived from the Check column)
const want = new Set(prog.green);
const rowFiles = new Map();
for (const l of spec.split('\n')) {
  const m = l.match(/^\| (AC-\d+) \|.*\|\s*`?(acceptance\/[^`|]+?)`?\s*\|\s*$/);
  if (m && want.has(m[1])) for (const f of m[2].split(/[,\s]+/).map((x) => x.replace(/`/g, '')).filter(Boolean)) rowFiles.set(f, [...(rowFiles.get(f) || []), m[1]]);
}
for (const id of want) if (![...rowFiles.values()].flat().includes(id)) fail(`${id} is listed in build/progress/ but has no automated check in SPEC.md`);
if (rowFiles.size) {
  const files = [...rowFiles.keys()];
  const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap', ...files], { cwd: root, env, encoding: 'utf8', timeout: 1800000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const seen = new Map(); // AC -> {pass, fail}
  for (const line of out.split('\n')) {
    const m = line.match(/^\s*(not ok|ok) \d+ - (.*)$/); if (!m) continue;
    for (const id of m[2].match(/AC-\d+/g) || []) { const s = seen.get(id) || { pass: 0, fail: 0 }; m[1] === 'ok' ? s.pass++ : s.fail++; seen.set(id, s); }
  }
  for (const id of want) {
    const s = seen.get(id);
    if (!s) fail(`${id}: no test ran for it`);
    else if (s.fail) fail(`${id}: ${s.fail} failing test(s)`);
  }
  if (process.exitCode) console.error(out.split('\n').filter((l) => /not ok|Error|expected|actual/.test(l)).slice(0, 40).join('\n'));
  else console.log(`gate: ${want.size} acceptance rows green`);
}

// 6. course steps written so far pass the skill-template gate (per-step checks during the build;
// the full manifest, README and chain checks run once the course is assembled after v1)
if (existsSync(join(root, 'course'))) {
  const full = existsSync(join(root, 'course', 'manifest.json'));
  const r = spawnSync(process.execPath, [join(root, 'skill-template', 'checks', 'check.mjs'), join(root, 'course'), '--repo', root, ...(full ? [] : ['--steps-only'])], { cwd: root, env, encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stdout); fail('course steps fail the skill-template gate'); }
}
if (!process.exitCode) console.log('gate: project checks pass');
