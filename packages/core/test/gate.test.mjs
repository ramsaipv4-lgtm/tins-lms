// AC-51, AC-52, AC-53, AC-54
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePackage, runGate } from '../src/index.ts';

const quick = (n = 8) =>
  '# Quick learn\n\n## 8-question diagnostic\n\n' +
  Array.from({ length: n }, (_, i) => `${i + 1}. Question ${i + 1}?`).join('\n') +
  '\n\n## Answer key\n\n' +
  Array.from({ length: 8 }, (_, i) => `${i + 1}. Answer ${i + 1}.`).join('\n') +
  '\n';

const script = (totalMin = 60) =>
  `# Script\n\n### Total runtime: **${totalMin / 60} hours**\n\n## Opening (0:00 — 0:20)\n\nSay hi.\n\n## Practice (0:20 — 1:00) [graded]\n\n\`\`\`js\nlet a = 1;\n\`\`\`\n`;

const recall = (withBack = true) =>
  '# Recall\n\n## Exercise 1 — Count apples (5 min)\n\n**What to do:** Count the apples.\n\n**The answer (check after):** Three.\n\n' +
  '## Exercise 2 — Name a pear (5 min)\n\n**What to do:** Name one pear.\n\n' +
  (withBack ? '**The answer (check after):** Conference.\n' : '');

function pkg(layout = 'v12', opts = {}) {
  const t = 'orchard';
  const dayFiles = {
    'quicklearn.md': quick(opts.diag),
    'deepdive.md': '# Deep dive\n\nSee the [index](README.md).\n',
    'instructor_script.md': script(opts.scriptMin ?? 60),
    'printable_handout.md': '# Handout\n',
    'student_guide_day01.md': '# Guide\n',
    'memory_recall_day01.md': recall(opts.cardBack ?? true),
  };
  if (opts.drop) delete dayFiles[opts.drop];
  const files = {};
  const names = [];
  for (const [name, text] of Object.entries(dayFiles)) {
    if (layout === 'v12') {
      files[`${t}/day1/${name}`] = text;
    } else {
      const v11 = name.includes('_day01') ? name : name.replace('.md', '_day01.md');
      files[`${t}/${v11}`] = text;
    }
  }
  const dirNames = (dir) =>
    Object.keys(files).filter((p) => p.slice(0, p.lastIndexOf('/')) === dir).map((p) => p.slice(p.lastIndexOf('/') + 1));
  const readmeFor = (dir) => {
    const list = [...dirNames(dir), 'README.md'].filter((n) => !(opts.readmeMissing === n));
    if (opts.readmeExtra && dir === `${t}/day1`) list.push(opts.readmeExtra);
    return '# Files\n\n| File | What |\n|---|---|\n' + list.map((n) => `| \`${n}\` | x |`).join('\n') + '\n';
  };
  const dirs = layout === 'v12' ? [`${t}/day1`] : [t];
  for (const d of dirs) files[`${d}/README.md`] = readmeFor(d);
  files[`${t}/shift/s1.json`] = JSON.stringify({
    id: 's1', durationMin: 10,
    tickets: [{ id: 'a', title: 'A', arrivesAtMin: 0, slaMin: 5, priority: 'p1', check: { kind: 'answer', expected: 'x' } }],
    rubric: [],
  });
  files[`${t}/exam/e1.json`] = JSON.stringify({ questions: [{ id: 'q1', text: 'T', answer: 'A' }] });
  return files;
}

const failing = (r) => r.checks.filter((c) => !c.pass).map((c) => c.id);

test('AC-51 clean package passes in both layouts with same days', () => {
  const a = pkg('v12');
  const b = pkg('v11');
  const ra = runGate(a);
  const rb = runGate(b);
  assert.deepEqual(failing(ra), [], JSON.stringify(ra));
  assert.deepEqual(failing(rb), [], JSON.stringify(rb));
  assert.equal(ra.pass && rb.pass, true);
  assert.deepEqual(parsePackage(a).days, parsePackage(b).days);
  assert.equal(parsePackage(a).days.length, 1);
});

test('AC-52 each planted defect fails exactly its check', () => {
  const cases = [
    ['G1-files', pkg('v12', { drop: 'printable_handout.md' }), (f) => f],
    ['G2-readme', pkg('v12', { readmeExtra: 'gone.md' }), (f) => f],
    ['G2-readme', pkg('v12', { readmeMissing: 'README.md' }), (f) => f],
    ['G3-diagnostic', pkg('v12', { diag: 7 }), (f) => f],
    ['G4-script-times', pkg('v12', { scriptMin: 120 }), (f) => f],
    ['G5-links', (() => { const f = pkg('v12'); f['orchard/day1/deepdive.md'] += '\n[x](missing.md)\n'; return f; })(), (f) => f],
    ['G6-code-lang', (() => { const f = pkg('v12'); f['orchard/day1/deepdive.md'] += '\n```\nplain\n```\n'; return f; })(), (f) => f],
    ['G7-graded', (() => { const f = pkg('v12'); f['orchard/shift/s1.json'] = f['orchard/shift/s1.json'].replace(/"check":\{[^}]*\}/, '"x":1'); return f; })(), (f) => f],
    ['G7-graded', (() => { const f = pkg('v12'); f['orchard/exam/e1.json'] = '{"questions":[{"id":"q","text":"t"}]}'; return f; })(), (f) => f],
    ['G8-cards', pkg('v12', { cardBack: false }), (f) => f],
  ];
  for (const [id, files] of cases) {
    // README for the dropped-file case is rebuilt from what exists, so only G1 trips
    assert.deepEqual(failing(runGate(files)), [id], id);
  }
});

test('AC-53 waivers: G1-G6/G8 waivable until expiry, G7 never', () => {
  const now = 1_000_000;
  const f = pkg('v12', { diag: 7 });
  const w = { check: 'G3-diagnostic', reason: 'fixing', by: 'ann', expiresAt: now + 1000 };
  const ok = runGate(f, [w], now);
  assert.equal(ok.pass, true);
  assert.equal(ok.checks.find((c) => c.id === 'G3-diagnostic').waived, true);
  assert.equal(runGate(f, [{ ...w, expiresAt: now - 1 }], now).pass, false);
  assert.equal(runGate(f, [{ ...w, expiresAt: now }], now).pass, false);
  // 7-day cap
  const long = { ...w, expiresAt: now + 30 * 86400_000 };
  assert.equal(runGate(f, [long], now).pass, true);
  // missing reason / by
  assert.equal(runGate(f, [{ ...w, reason: '' }], now).pass, false);
  assert.equal(runGate(f, [{ ...w, by: '' }], now).pass, false);
  // G7
  const g = pkg('v12');
  g['orchard/exam/e1.json'] = '{"questions":[{"id":"q","text":"t"}]}';
  const r = runGate(g, [{ check: 'G7-graded', reason: 'r', by: 'b', expiresAt: now + 1000 }], now);
  assert.equal(r.pass, false);
  assert.equal(r.checks.find((c) => c.id === 'G7-graded').waived, false);
});

test('AC-54 parsePackage extracts sections, diagnostic and cards', () => {
  const { days, problems } = parsePackage(pkg('v12'));
  assert.deepEqual(problems, []);
  const d = days[0];
  assert.equal(d.index, 1);
  assert.equal(d.track, 'orchard');
  assert.deepEqual(d.sections.map((s) => [s.id, s.plannedSec, s.graded]), [['opening', 1200, false], ['practice', 2400, true]]);
  assert.equal(d.questions.length, 8);
  assert.deepEqual(d.questions[2], { text: 'Question 3?', answer: 'Answer 3.' });
  assert.equal(d.cards.length, 2);
  assert.match(d.cards[0].front, /Count apples/);
  assert.match(d.cards[0].front, /Count the apples/);
  assert.match(d.cards[0].back, /Three/);
  const bad = parsePackage(pkg('v12', { cardBack: false }));
  assert.equal(bad.days[0].cards.length, 1);
  assert.equal(bad.problems.length, 1);
});

test('AC-51 a leftover day folder beside v1.1 companions does not duplicate the day', () => {
  const f = pkg('v11');
  f['orchard/day1/README.md'] = '# Files\n\n| File | What |\n|---|---|\n| `README.md` | x |\n';
  assert.equal(parsePackage(f).days.length, 1);
});
