// Tests for the skill-template gate: a valid two-step package passes; each planted defect fails its check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { check, generateReadme } from './check.mjs';

function lesson(id, n, N, next, extra = {}) {
  const fm = { est_minutes: 30, objectives: 2, new_terms: 3, ...extra };
  return `---\nid: ${id}\ntitle: Step ${n}\nmodule: 0\nest_minutes: ${fm.est_minutes}\nprereqs: []\nobjectives: ${fm.objectives}\nnew_terms: ${fm.new_terms}\nskills: [s${n}]\nsource_refs: ${fm.refs || '[]'}\nnext: ${next}\n---\n` +
    `# MS 0.${n} — Step ${n}\n*Step ${n} of ${N}*\n\n## Prerequisites\nNone.\n## You already understand this\nLists.\n## The detective question\n` +
    `**Problem:** p\n**Options considered:** a, b\n**Choice:** a\n**Why:** simpler\n## Learning objectives\n- one\n## Conceptual understanding\nText.\n` +
    `## Walkthrough of the real code\n${fm.code || 'See the file in the repository.'}\n## Your turn: faulty first\nRun it broken.\n## Technical glossary\n- term\n## Common questions\nQ.\n` +
    `## Reinforcement activity\nDo it.\n## Check yourself\n1. a?\n<details>yes</details>\n2. b?\n<details>yes</details>\n3. c?\n<details>yes</details>\n` +
    `## Quick reference\nx.\n## Connection to the bigger picture\ny.\n## Next\n[next](../${next === 'end' ? id : next}/lesson.md)\n`;
}
function makePkg(mut = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'skt-'));
  const manifest = { title: 'Fixture course', steps: [{ id: 'ms-00.01', title: 'Step 1', est_minutes: 30 }, { id: 'ms-00.02', title: 'Step 2', est_minutes: 30 }], checkpoints: [{ id: 'checkpoint-1', after: 'ms-00.02' }] };
  const files = {
    'steps/ms-00.01/lesson.md': lesson('ms-00.01', 1, 2, 'ms-00.02'),
    'steps/ms-00.02/lesson.md': lesson('ms-00.02', 2, 2, 'end'),
    'checkpoints/checkpoint-1/checkpoint.md': '# Checkpoint 1\nBuild it.\n',
    'checkpoints/checkpoint-1/rubric.md': '# Rubric\n- works\n',
  };
  for (const id of ['ms-00.01', 'ms-00.02']) {
    files[`steps/${id}/instructor_script.md`] = '# Script\n## Intro (0:00 — 0:30)\n[SAY] hello\n';
    files[`steps/${id}/recall.md`] = '# Recall\n**Q:** a\n**A:** b\n**Q:** c\n**A:** d\n**Q:** e\n**A:** f\n';
    files[`steps/${id}/activity_key.md`] = '# Key\nThe answer is to run the command and compare outputs.\n';
    files[`steps/${id}/trainer_prep.md`] = '# Prep\nRead it first.\n';
  }
  mut(files, manifest);
  for (const [p, t] of Object.entries(files)) { mkdirSync(join(dir, p, '..'), { recursive: true }); writeFileSync(join(dir, p), t); }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(dir, 'README.md'), generateReadme(manifest));
  return dir;
}
const checksOf = (dir, o) => [...new Set(check(dir, o).map((f) => f.check))].sort((a, b) => a - b);

test('valid package passes every check', () => { const d = makePkg(); assert.deepEqual(check(d), []); rmSync(d, { recursive: true }); });
test('check 1: missing step file', () => assert.deepEqual(checksOf(makePkg((f) => delete f['steps/ms-00.01/trainer_prep.md'])), [1]));
test('check 2: README edited by hand', () => { const d = makePkg(); writeFileSync(join(d, 'README.md'), '# hand\n'); assert.deepEqual(checksOf(d), [2]); });
test('check 2: file not in manifest', () => assert.deepEqual(checksOf(makePkg((f) => { f['steps/ms-00.01/notes.md'] = '# extra\n'; })), [2]));
test('check 3: too few check-yourself answers', () => assert.deepEqual(checksOf(makePkg((f) => { f['steps/ms-00.01/lesson.md'] = f['steps/ms-00.01/lesson.md'].replace('3. c?\n<details>yes</details>', '3. c?'); })), [3]));
test('check 5: broken link', () => assert.deepEqual(checksOf(makePkg((f) => { f['steps/ms-00.02/trainer_prep.md'] += '[x](missing.md)\n'; })), [5]));
test('check 6: code block without language', () => assert.deepEqual(checksOf(makePkg((f) => { f['steps/ms-00.01/activity_key.md'] += '```\nls\n```\n'; })), [6]));
test('check 8: recall cards unbalanced', () => assert.deepEqual(checksOf(makePkg((f) => { f['steps/ms-00.02/recall.md'] += '**Q:** orphan\n'; })), [8]));
test('check 9: detective label renamed', () => assert.deepEqual(checksOf(makePkg((f) => { f['steps/ms-00.01/lesson.md'] = f['steps/ms-00.01/lesson.md'].replace('**Choice:**', '**Solution selected:**'); })), [9]));
test('check 10: next chain wrong', () => assert.deepEqual(checksOf(makePkg((f) => { f['steps/ms-00.01/lesson.md'] = f['steps/ms-00.01/lesson.md'].replace('next: ms-00.02', 'next: end'); })), [10]));
test('check 11: over budget', () => assert.deepEqual(checksOf(makePkg((f) => { f['steps/ms-00.02/lesson.md'] = lesson('ms-00.02', 2, 2, 'end', { est_minutes: 1 }); })), [11]));
test('check 12: checkpoint rubric missing', () => assert.deepEqual(checksOf(makePkg((f) => delete f['checkpoints/checkpoint-1/rubric.md'])), [12]));
test('check 14: dated claim without as-of', () => assert.deepEqual(checksOf(makePkg((f) => { f['steps/ms-00.01/trainer_prep.md'] += 'The free tier is 10 GB.\n'; })), [14]));
test('check 13: code excerpt must match the repo at the cited commit', () => {
  const repo = mkdtempSync(join(tmpdir(), 'skt-repo-'));
  execFileSync('git', ['init', '-q', repo]); writeFileSync(join(repo, 'a.js'), 'const x = 1;\nconst y = 2;\n');
  execFileSync('git', ['-C', repo, '-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.']);
  execFileSync('git', ['-C', repo, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x']);
  const sha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const good = makePkg((f) => { f['steps/ms-00.01/lesson.md'] = lesson('ms-00.01', 1, 2, 'ms-00.02', { refs: `[{ path: a.js, commit: ${sha} }]`, code: '```js a.js\nconst y = 2;\n```' }); f['steps/ms-00.02/lesson.md'] = lesson('ms-00.02', 2, 2, 'end', { refs: `[{ path: a.js, commit: ${sha} }]`, code: '```js a.js\nconst x = 1;\n```' }); });
  assert.deepEqual(check(good, { repo }), []);
  const bad = makePkg((f) => { f['steps/ms-00.01/lesson.md'] = lesson('ms-00.01', 1, 2, 'ms-00.02', { refs: `[{ path: a.js, commit: ${sha} }]`, code: '```js a.js\nconst y = 3;\n```' }); f['steps/ms-00.02/lesson.md'] = lesson('ms-00.02', 2, 2, 'end', { refs: `[{ path: a.js, commit: ${sha} }]`, code: '```js a.js\nconst x = 1;\n```' }); });
  assert.deepEqual(checksOf(bad, { repo }), [13]);
});
test('--steps-only: skips manifest, README and chain checks but keeps per-step checks', () => {
  const d = makePkg(); rmSync(join(d, 'manifest.json')); rmSync(join(d, 'README.md'));
  assert.deepEqual(check(d, { stepsOnly: true }), []);
  writeFileSync(join(d, 'steps/ms-00.01/recall.md'), '# Recall\n**Q:** only one\n**A:** x\n');
  assert.deepEqual(checksOf(d, { stepsOnly: true }), [8]);
});
test('check 13: walkthrough code must name its file and be cited (no quietly dropped source_refs)', () => {
  assert.deepEqual(checksOf(makePkg((f) => { f['steps/ms-00.01/lesson.md'] = lesson('ms-00.01', 1, 2, 'ms-00.02', { code: '```js\nconst x = 1;\n```' }); })), [13]);
  assert.deepEqual(checksOf(makePkg((f) => { f['steps/ms-00.01/lesson.md'] = lesson('ms-00.01', 1, 2, 'ms-00.02', { code: '```js a.js\nconst x = 1;\n```' }); })), [13]);
});
