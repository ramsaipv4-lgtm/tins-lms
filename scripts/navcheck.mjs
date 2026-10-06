#!/usr/bin/env node
// navcheck.mjs [repo]: which navigation labels does each SPEC Appendix D `nav /pattern/` match?
//
// Nine feature groups pick their nav labels independently, but a journey finds a screen by an accessible-name pattern
// and clicks the first link that matches (case-insensitive substring, as the harness matches). When a pattern matches
// two labels that one role sees in one space, the journey gets whichever sorts first (the shell sorts by `order`, then
// by the label text) and may open the wrong screen (integration I-1, I-2, I-5, I-6, I-7). This script lists those cases
// and exits 1 when it finds one that is not on the reviewed list below (or whose winner changed).
//
// Inputs: every packages/web/src/features/<group>/index.tsx (routes with nav !== false: space, label, order, roles,
// switch), the strings (src/strings/en.json and each group's strings.en.json), and the "nav /pattern/" phrases in
// SPEC.md Appendix D (a phrase such as `nav /a/, /b/` or `learner nav /x/` or `nav /y/ (trainer)` counts each pattern).
// The shell's own entries are included: "Home" in each space nav, "Setup check" in Learn, and the Spaces bar links.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2] || join(fileURLToPath(new URL('.', import.meta.url)), '..');
const F = join(root, 'packages/web/src/features');
const strings = JSON.parse(readFileSync(join(root, 'packages/web/src/strings/en.json'), 'utf8'));

// Which role spaces a role can open (packages/web/src/app/session.tsx spacesFor).
const SPACES_OF = {
  admin: ['admin'], trainer: ['teach'], substitute: ['teach'], coordinator: ['teach'], learner: ['learn', 'coach'],
};
const ROLES = Object.keys(SPACES_OF);

// Collisions reviewed by hand. Each entry is `${journey}|${pattern}|${space}` -> the label that wins today. The journey
// that uses the pattern is green with that winner (it is claimed in build/progress and passes in the gate), so the
// substring match is a hazard, not a failure: the harness does not click the first substring match in every case (it
// anchors some patterns, e.g. /^(shift|the shift)$/ for nav /shift/). The pin makes a NEW collision, or a change of
// the winner, fail the gate until someone looks at the journey again. AC-153 was the one case where the winner was
// wrong (Settings beat Accommodations; fixed by order 1.5 on the classroom entry, I-10 in b11-2's journal).
// Pins for the shift group's entries (cards, forge, offline, peer) were added after shift merged; those journeys
// (AC-85, AC-170, AC-95, AC-161) passed in that merge's gate with these winners.
const REVIEWED = Object.fromEntries([
  'accommodations.journey.mjs|settings|profile|accommodations?|learn|Accommodations',
  'appeal.journey.mjs|grades|results|scores|learn|Lab results',
  'audio.journey.mjs|today|day 0|learn|Day 0',
  'cards.journey.mjs|cards|review|daily cards|learn|Peer review',
  'catchup.journey.mjs|catch.?up|today|my days|learn|Catch-up',
  'coach.journey.mjs|today|day 0|learn|Day 0',
  'content-improve.journey.mjs|library|packages|teach|Packages',
  'digest.journey.mjs|lab|results|feedback|learn|Lab results',
  'drop.journey.mjs|roster|learners|class|teach|Roster',
  'export.journey.mjs|settings|my data|profile|privacy|learn|Settings',
  'files.journey.mjs|packages?|files|file exchange|teach|File exchange',
  'forge.journey.mjs|settings|profile|accounts|learn|Accounts',
  'offline.journey.mjs|cards|review|learn|Peer review',
  'offline.journey.mjs|diagnostic|quick.?learn|quiz|learn|Diagnostic',
  'offline.journey.mjs|today|day 0|learn|Day 0',
  'teleprompter.journey.mjs|today|day 0|class|learn|Day 0',
  'peer.journey.mjs|reviews?|peer review|learn|Peer review',
  'peer.journey.mjs|lab|learn|Lab results',
  'trainer-notes.journey.mjs|profile|settings|my profile|learn|Settings',
  'trainer-notes.journey.mjs|roster|learners|teach|Roster',
  'trainer-pack.journey.mjs|library|package library|packages|teach|Packages',
  'wrapup.journey.mjs|teleprompter|today|class|teach|Today',
  'wrapup.journey.mjs|today|day 0|learn|Day 0',
].map((e) => { const p = e.split('|'); const win = p.pop(); const space = p.pop(); return [`${p.join('|')}|${space}`, win]; }));

const labels = []; // { group, path, space, text, roles, order }
for (const g of readdirSync(F).sort()) {
  const idx = join(F, g, 'index.tsx');
  if (!existsSync(idx)) continue;
  const sp = join(F, g, 'strings.en.json');
  if (existsSync(sp)) Object.assign(strings, JSON.parse(readFileSync(sp, 'utf8')));
}
for (const g of readdirSync(F).sort()) {
  const idx = join(F, g, 'index.tsx');
  if (!existsSync(idx)) continue;
  const src = readFileSync(idx, 'utf8');
  for (const m of src.matchAll(/^\s*\{\s*path:\s*'([^']+)'[^\n]*$/gm)) {
    const e = m[0];
    if (/nav:\s*false/.test(e)) continue;
    const space = (e.match(/space:\s*'(\w+)'/) || [])[1];
    const key = (e.match(/label:\s*'([^']+)'/) || [])[1];
    const roles = (e.match(/roles:\s*\[([^\]]*)\]/) || [, ''])[1].replace(/['\s]/g, '').split(',').filter(Boolean);
    const order = Number((e.match(/order:\s*(-?[\d.]+)/) || [, 100])[1]);
    if (!space || !key) continue;
    if (!(key in strings)) { console.log(`MISSING-STRING ${g} ${m[1]} label ${key}`); process.exitCode = 1; continue; }
    labels.push({ group: g, path: m[1], space, text: strings[key], roles, order });
  }
}
// The shell's own links (packages/web/src/app/shell.tsx): Home first in every space nav, Setup check last in Learn,
// and the Spaces bar, which every signed-in page shows next to the space nav.
for (const s of ['admin', 'teach', 'learn', 'coach']) labels.push({ group: 'shell', path: `/${s}`, space: s, text: strings['nav.home'], roles: [], order: -1e9 });
labels.push({ group: 'shell', path: '/setup', space: 'learn', text: strings['nav.setup'], roles: [], order: 1e9 });
for (const s of ['admin', 'teach', 'learn', 'coach']) labels.push({ group: 'shell', path: `/${s}`, space: '*spaces*', text: strings[`space.${s}`], roles: [], order: ['admin', 'teach', 'learn', 'coach'].indexOf(s), spaceTarget: s });

const visibleTo = (l, role) => (l.space === '*spaces*' ? SPACES_OF[role].includes(l.spaceTarget) : SPACES_OF[role].includes(l.space) && (!l.roles.length || l.roles.includes(role)));

// ---- Appendix D patterns ----
const spec = readFileSync(join(root, 'SPEC.md'), 'utf8');
const a = spec.indexOf('## Appendix D'), b = spec.indexOf('## Appendix E');
const app = spec.slice(a, b);
const found = [];
let journey = '';
for (const line of app.split('\n')) {
  const j = line.match(/^### (\S+\.journey\.mjs)/);
  if (j) { journey = j[1]; continue; }
  if (!/nav\s*\//.test(line) && !/nav\b/.test(line)) continue;
  // tokens in order: a role word, a kind word, a /pattern/ with an optional "(role)" after it
  const tok = /\b(learner|trainer|admin|coordinator|substitute)\b|\b(nav|buttons?|fields?|checkbox(?:es)?|options?|text|links?|result|answers?|controls?|items?)\b|\/((?:[^/\n\\]|\\.)+)\/(?:\s*\((learner|trainer|admin|coordinator|substitute)\))?/gi;
  let kind = '', who = '', m;
  while ((m = tok.exec(line))) {
    if (m[1]) { who = m[1].toLowerCase(); kind = ''; }
    else if (m[2]) { kind = m[2].toLowerCase(); }
    else if (m[3]) {
      if (kind === 'nav') found.push({ journey, pattern: m[3], who: (m[4] || who || '').toLowerCase() });
      if (line[tok.lastIndex] === ';' || line[tok.lastIndex] === '.') who = '';
    }
  }
}

let bad = 0, unmatched = 0, reviewedCount = 0;
const reported = new Set();
for (const f of found) {
  let re;
  try { re = new RegExp(f.pattern, 'i'); } catch { console.log(`BAD-PATTERN ${f.journey} /${f.pattern}/`); bad++; continue; }
  const roles = f.who && ROLES.includes(f.who) ? [f.who] : ROLES;
  let matchedAny = false;
  const bySpace = new Map(); // space -> Map(message -> roles)
  for (const role of roles) {
    for (const space of SPACES_OF[role]) {
      const hits = labels.filter((l) => re.test(l.text) && visibleTo(l, role) && (l.space === space || l.space === '*spaces*'));
      // a space nav and the Spaces bar are both on the page; the journey sees both, so they are compared together
      if (hits.length) matchedAny = true;
      const uniq = [];
      for (const h of hits.sort((x, y) => (x.space === '*spaces*') - (y.space === '*spaces*') || x.order - y.order || x.text.localeCompare(y.text))) {
        if (!uniq.some((u) => u.text === h.text && u.path === h.path)) uniq.push(h);
      }
      if (uniq.length > 1) {
        const msg = `WINS "${uniq[0].text}" (${uniq[0].group} ${uniq[0].path} order ${uniq[0].order}) over ${uniq.slice(1).map((h) => `"${h.text}" (${h.group} ${h.path} order ${h.order})`).join(' | ')}`;
        if (!bySpace.has(space)) bySpace.set(space, new Map());
        const mm = bySpace.get(space);
        mm.set(msg, [...(mm.get(msg) || []), role]);
        uniq.winner = uniq[0];
      }
    }
  }
  for (const [space, mm] of bySpace) for (const [msg, rs] of mm) {
    const id = `${f.journey}|${f.pattern}|${space}|${msg}`;
    if (reported.has(id)) continue;
    reported.add(id);
    const winText = msg.match(/^WINS "([^"]*)"/)[1];
    if (REVIEWED[`${f.journey}|${f.pattern}|${space}`] === winText) { reviewedCount++; continue; }
    bad++;
    console.log(`COLLISION ${f.journey} ${f.who || '(any role)'} nav /${f.pattern}/ in ${space} [${rs.join(',')}]: ${msg}`);
  }
  // A pattern no label matches is information, not a failure: the screen may belong to a group that is not merged yet.
  if (!matchedAny) { unmatched++; console.log(`UNMATCHED ${f.journey} ${f.who || '(any role)'} nav /${f.pattern}/ (no group registers it yet)`); }
}
console.log(`navcheck: ${labels.length} nav labels, ${found.length} Appendix D nav patterns; ${bad} new collision(s), ${reviewedCount} reviewed, ${unmatched} unmatched`);
if (bad) process.exitCode = 1;
