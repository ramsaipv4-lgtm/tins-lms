#!/usr/bin/env node
// Gate for course packages made with skill-template v2 (variant: case-study). Zero dependencies.
// Usage: node check.mjs <package-dir> [--repo <git-dir>] [--write-readme] [--json]
// Exit 0 = all checks pass; 1 = failures (listed); 2 = usage error.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const STEP_FILES = ['lesson.md', 'instructor_script.md', 'recall.md', 'activity_key.md', 'trainer_prep.md'];
export const SECTIONS = ['Prerequisites', 'You already understand this', 'The detective question', 'Learning objectives',
  'Conceptual understanding', 'Walkthrough of the real code', 'Your turn: faulty first', 'Technical glossary',
  'Common questions', 'Reinforcement activity', 'Check yourself', 'Quick reference', 'Connection to the bigger picture', 'Next'];
export const DETECTIVE = ['Problem', 'Options considered', 'Choice', 'Why'];

function walk(dir, base = dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, base, out); else out.push(relative(base, p).split('\\').join('/'));
  }
  return out;
}

/** Minimal front matter: `key: value`, arrays `[a, b]`, and source_refs as `[{ path: x, commit: y }, …]`. */
export function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/); if (!kv) continue;
    const [, k, v] = kv;
    if (k === 'source_refs') {
      fm[k] = [...v.matchAll(/\{\s*path:\s*([^,}]+),\s*commit:\s*([^}\s]+)\s*\}/g)].map((x) => ({ path: x[1].trim(), commit: x[2].trim() }));
    } else if (/^\[.*\]$/.test(v)) fm[k] = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    else if (/^\d+$/.test(v)) fm[k] = Number(v);
    else fm[k] = v.trim();
  }
  return fm;
}

const headings = (t) => [...t.matchAll(/^##\s+(.+?)\s*$/gm)].map((x) => x[1].replace(/\*\*/g, '').trim());
const words = (t) => (t.replace(/```[\s\S]*?```/g, ' ').match(/\S+/g) || []).length;
const codeLines = (t) => [...t.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].reduce((n, x) => n + x[1].split('\n').filter((l) => l.trim()).length, 0);

export function generateReadme(manifest) {
  const rows = manifest.steps.map((s, i) => `| ${i + 1} | \`${s.id}\` | ${s.title} | ${s.est_minutes} min |`);
  return `# ${manifest.title}\n\n_Generated from manifest.json by skill-template/checks/check.mjs. Do not edit by hand._\n\n` +
    `| # | Step | Title | Time |\n|---|---|---|---|\n${rows.join('\n')}\n\n` +
    `Checkpoints: ${(manifest.checkpoints || []).map((c) => `\`${c.id}\` after \`${c.after}\``).join(', ') || 'none'}\n`;
}

export function check(dir, { repo = null, stepsOnly = false } = {}) {
  const fails = []; const fail = (n, msg) => { if (!(stepsOnly && (n === 2 || n === 10))) fails.push({ check: n, msg }); };
  const mpath = join(dir, 'manifest.json');
  let manifest;
  if (stepsOnly) { // during a build: every step folder written so far, without the assembled manifest
    const ids = existsSync(join(dir, 'steps')) ? readdirSync(join(dir, 'steps')).filter((n) => statSync(join(dir, 'steps', n)).isDirectory()).sort() : [];
    manifest = { title: '(build)', steps: ids.map((id) => ({ id, title: id, est_minutes: 0 })), checkpoints: [] };
  } else {
    if (!existsSync(mpath)) return [{ check: 2, msg: 'manifest.json missing' }];
    try { manifest = JSON.parse(readFileSync(mpath, 'utf8')); } catch (e) { return [{ check: 2, msg: `manifest.json invalid: ${e.message}` }]; }
  }
  const steps = manifest.steps || []; const N = steps.length;
  const files = walk(dir);
  const listed = new Set(['manifest.json', 'README.md', ...(manifest.extra_files || [])]);
  // 2: README is the generated one
  const readme = stepsOnly ? generateReadme(manifest) : existsSync(join(dir, 'README.md')) ? readFileSync(join(dir, 'README.md'), 'utf8') : '';
  if (!stepsOnly && readme !== generateReadme(manifest)) fail(2, 'README.md differs from the one generated from manifest.json (run with --write-readme)');
  steps.forEach((s, i) => {
    const sd = `steps/${s.id}`;
    // 1: required files
    for (const f of STEP_FILES) { listed.add(`${sd}/${f}`); if (!existsSync(join(dir, sd, f))) fail(1, `${s.id}: missing ${f}`); }
    const lp = join(dir, sd, 'lesson.md'); if (!existsSync(lp)) return;
    const t = readFileSync(lp, 'utf8'); const fm = frontMatter(t) || {};
    if (fm.id !== s.id) fail(2, `${s.id}: lesson front matter id is "${fm.id}"`);
    // 9: sections + detective labels
    const hs = headings(t);
    for (const sec of SECTIONS) if (!hs.includes(sec)) fail(9, `${s.id}: missing section "## ${sec}"`);
    const det = (t.split(/^## The detective question\s*$/m)[1] || '').split(/^## /m)[0];
    for (const lab of DETECTIVE) if (!new RegExp(`^\\*\\*${lab}:\\*\\*`, 'm').test(det)) fail(9, `${s.id}: detective label "**${lab}:**" missing`);
    // 10: chain and step numbering
    const expectNext = i + 1 < N ? steps[i + 1].id : 'end';
    if ((fm.next || 'end') !== expectNext) fail(10, `${s.id}: next is "${fm.next}", manifest order says "${expectNext}"`);
    if (!t.includes(`*Step ${i + 1} of ${N}*`)) fail(10, `${s.id}: missing "*Step ${i + 1} of ${N}*"`);
    // 11: load budget
    const budget = words(t) / 100 + codeLines(t) / 8 + (Number(fm.activity_minutes) || 0);
    if (!fm.est_minutes || budget > fm.est_minutes) fail(11, `${s.id}: load ${budget.toFixed(1)} min exceeds est_minutes ${fm.est_minutes}`);
    if ((fm.objectives || 0) > 4) fail(11, `${s.id}: ${fm.objectives} objectives (max 4)`);
    if ((fm.new_terms || 0) > 8) fail(11, `${s.id}: ${fm.new_terms} new terms (max 8)`);
    // 3: check yourself has 3-5 questions and answers
    const cy = (t.split(/^## Check yourself\s*$/m)[1] || '').split(/^## /m)[0];
    const qs = (cy.match(/^\d+\.\s/gm) || []).length; const as = (cy.match(/<details>|^\s*\*\*Answer/gm) || []).length;
    if (qs < 3 || qs > 5 || as < qs) fail(3, `${s.id}: "Check yourself" needs 3–5 numbered questions, each with an answer (got ${qs} questions, ${as} answers)`);
    // 8: recall cards
    const rp = join(dir, sd, 'recall.md');
    if (existsSync(rp)) {
      const r = readFileSync(rp, 'utf8'); const q = (r.match(/^\*\*Q:\*\*/gm) || []).length; const a = (r.match(/^\*\*A:\*\*/gm) || []).length;
      if (q < 3 || q !== a) fail(8, `${s.id}: recall.md needs ≥3 cards with matching **Q:**/**A:** (got ${q}/${a})`);
    }
    // 12: activity key covers activity
    const kp = join(dir, sd, 'activity_key.md');
    if (existsSync(kp) && /^## Reinforcement activity\s*$/m.test(t) && readFileSync(kp, 'utf8').trim().length < 40) fail(12, `${s.id}: activity_key.md is empty`);
    // 13: the walkthrough shows real code, so every code block there names its file and is cited
    const walk = (t.split(/^## Walkthrough of the real code\s*$/m)[1] || '').split(/^## /m)[0];
    const walkFences = [...walk.matchAll(/^```([a-z]+)(?: (\S+))?$/gm)].filter((_, k) => k % 2 === 0);
    for (const f of walkFences) {
      if (!f[2]) fail(13, `${s.id}: walkthrough code block has no file path (use \`\`\`${f[1]} <path>)`);
      else if (!(fm.source_refs || []).some((r) => r.path === f[2])) fail(13, `${s.id}: walkthrough cites ${f[2]} but source_refs has no entry for it`);
    }
    // 13: code fidelity
    if (repo) for (const ref of fm.source_refs || []) {
      let src; try { src = execFileSync('git', ['-C', repo, 'show', `${ref.commit}:${ref.path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
      catch { fail(13, `${s.id}: cannot read ${ref.path}@${ref.commit}`); continue; }
      const blocks = [...t.matchAll(new RegExp('```[a-z]+ ' + ref.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n([\\s\\S]*?)```', 'g'))].map((x) => x[1]);
      for (const b of blocks) if (!src.includes(b.trimEnd())) fail(13, `${s.id}: excerpt from ${ref.path} does not match ${ref.commit}`);
    }
  });
  // 12: checkpoints
  for (const c of manifest.checkpoints || []) for (const f of ['checkpoint.md', 'rubric.md']) {
    listed.add(`checkpoints/${c.id}/${f}`); if (!existsSync(join(dir, 'checkpoints', c.id, f))) fail(12, `checkpoint ${c.id}: missing ${f}`);
  }
  // 2: no unlisted content files
  for (const f of files) if (/\.(md|txt|json)$/.test(f) && !listed.has(f)) fail(2, `file not in manifest: ${f}`);
  // 5, 6, 14 on every markdown file
  for (const f of files.filter((x) => x.endsWith('.md'))) {
    const t = readFileSync(join(dir, f), 'utf8');
    for (const [, target] of t.matchAll(/\]\((?!https?:|mailto:|#)([^)#\s]+)/g))
      if (!existsSync(resolve(dir, dirname(f), target))) fail(5, `${f}: broken link ${target}`);
    const fences = [...t.matchAll(/^```(.*)$/gm)].map((x) => x[1].trim());
    for (let k = 0; k < fences.length; k += 2) if (!fences[k]) fail(6, `${f}: code block without a language tag`);
    for (const line of t.split('\n')) if (/\b(free tier|price|pricing|retired|deprecated|latest version)\b/i.test(line) && !/as of/i.test(line))
      fail(14, `${f}: dated claim without "as of": ${line.trim().slice(0, 80)}`);
  }
  return fails;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2); const dir = a.find((x, i) => !x.startsWith('--') && a[i - 1] !== '--repo');
  if (!dir) { console.error('usage: node check.mjs <package-dir> [--repo <git-dir>] [--write-readme] [--json]'); process.exit(2); }
  const repo = a.includes('--repo') ? a[a.indexOf('--repo') + 1] : null;
  if (a.includes('--write-readme')) writeFileSync(join(dir, 'README.md'), generateReadme(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))));
  const fails = check(dir, { repo, stepsOnly: a.includes('--steps-only') });
  if (a.includes('--json')) console.log(JSON.stringify(fails, null, 2));
  else { for (const f of fails) console.log(`FAIL check ${f.check}: ${f.msg}`); console.log(fails.length ? `${fails.length} failure(s)` : 'all checks pass'); }
  process.exit(fails.length ? 1 : 0);
}
