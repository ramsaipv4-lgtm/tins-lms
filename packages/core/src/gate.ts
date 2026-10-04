// Package import and content gate (§4.29)
import { parseScriptSections, scriptTotalSec } from './pace.ts';
import type { ParsedSection } from './pace.ts';

export interface PkgDay {
  index: number;
  track: string;
  sections: ParsedSection[];
  questions: { text: string; answer: string }[];
  cards: { front: string; back: string }[];
}

export interface Waiver {
  check: string;
  reason: string;
  by: string;
  expiresAt: number;
}

export interface GateCheck {
  id: string;
  pass: boolean;
  waived: boolean;
  detail: string;
}

export interface GateResult {
  pass: boolean;
  checks: GateCheck[];
}

const WAIVER_CAP_MS = 7 * 24 * 3600 * 1000;

interface DayFiles {
  dir: string;
  track: string;
  index: number;
  files: Record<string, string>; // companion kind-ish key (base name) -> path
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

function baseOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? path : path.slice(i + 1);
}

// "quicklearn_day03.md" -> "quicklearn"; "recall.md" -> "recall"
function kindOf(fileName: string): string {
  return fileName.replace(/\.md$/i, '').replace(/[_-]?day0*\d+$/i, '').toLowerCase();
}

function trackOf(dir: string): string {
  return baseOf(dir);
}

// Group markdown companions into days, for both layouts.
function findDays(files: Record<string, string>): DayFiles[] {
  const days = new Map<string, DayFiles>();
  for (const path of Object.keys(files).sort()) {
    if (!/\.md$/i.test(path)) continue;
    const dir = dirOf(path);
    const name = baseOf(path);
    const folder = baseOf(dir);
    let key: string;
    let index: number;
    let trackDir: string;
    const folderMatch = folder.match(/^day0*(\d+)$/i);
    const nameMatch = name.match(/[_-]day0*(\d+)\.md$/i);
    if (folderMatch) {
      // v1.2: companions inside day{N}/
      index = parseInt(folderMatch[1], 10);
      trackDir = dirOf(dir);
      key = trackDir + '|' + index;
    } else if (nameMatch && isCompanionKind(kindOf(name))) {
      // v1.1: companions in the track root, *_dayNN.md
      index = parseInt(nameMatch[1], 10);
      trackDir = dir;
      key = trackDir + '|' + index;
    } else {
      continue;
    }
    let day = days.get(key);
    if (!day) {
      day = { dir, track: trackOf(trackDir), index, files: {} };
      days.set(key, day);
    }
    day.files[kindOf(name)] = path;
  }
  return [...days.values()].sort(
    (a, b) => a.track.localeCompare(b.track) || a.index - b.index || a.dir.localeCompare(b.dir),
  );
}

function findKind(day: DayFiles, pred: (kind: string) => boolean): string | undefined {
  for (const kind of Object.keys(day.files).sort()) {
    if (pred(kind)) return day.files[kind];
  }
  return undefined;
}

const REQUIRED: { label: string; pred: (kind: string) => boolean }[] = [
  { label: 'quicklearn.md', pred: (k) => k === 'quicklearn' },
  { label: 'deepdive.md', pred: (k) => k === 'deepdive' },
  { label: 'instructor_script.md', pred: (k) => k === 'instructor_script' },
  { label: 'printable_handout.md', pred: (k) => k === 'printable_handout' },
  { label: 'student guide', pred: (k) => /^student[_-]?guide/.test(k) },
];

const COMPANION_KINDS = ['quicklearn', 'deepdive', 'instructor_script', 'printable_handout', 'whiteboard', 'live_coding'];

function isCompanionKind(k: string): boolean {
  return COMPANION_KINDS.includes(k) || /^student[_-]?guide/.test(k) || isRecallKind(k);
}

function isRecallKind(k: string): boolean {
  return k === 'recall' || k === 'memory_recall' || k === 'memory-recall';
}

function dayLabel(day: DayFiles): string {
  return `${day.track || '.'}/day${day.index}`;
}

// ---- section helpers ----

// Text of the section that starts at a heading matching `re`, up to the next heading of the same or higher level.
function sectionBody(md: string, re: RegExp): string | null {
  const lines = md.split('\n');
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (m && re.test(m[2])) {
      start = i + 1;
      level = m[1].length;
      break;
    }
  }
  if (start < 0) return null;
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

function numberedItems(body: string): string[] {
  const items: string[] = [];
  let cur: string[] | null = null;
  for (const line of body.split('\n')) {
    const m = line.match(/^\s{0,3}\d+[.)]\s+(.*)$/);
    if (m) {
      if (cur) items.push(cur.join('\n').trim());
      cur = [m[1]];
    } else if (cur) {
      if (line.trim() === '') continue;
      if (/^\s+/.test(line) || !/^[#>|]/.test(line)) cur.push(line.trim());
    }
  }
  if (cur) items.push(cur.join('\n').trim());
  return items;
}

function parseDiagnostic(md: string): { questions: string[]; answers: string[]; found: boolean } {
  const q = sectionBody(md, /8[- ]question diagnostic/i);
  const a = sectionBody(md, /answer key/i);
  return {
    found: q !== null,
    questions: q ? numberedItems(q) : [],
    answers: a ? numberedItems(a) : [],
  };
}

interface RecallParse {
  cards: { front: string; back: string }[];
  bad: string[];
}

function parseRecall(md: string): RecallParse {
  const lines = md.split('\n');
  const starts: { i: number; n: string; title: string }[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) inFence = !inFence;
    if (inFence) continue;
    const m = lines[i].match(/^##\s+Exercise\s+(\d+)\s*[—–-]\s*(.+?)\s*$/);
    if (m) starts.push({ i, n: m[1], title: m[2] });
  }
  const cards: { front: string; back: string }[] = [];
  const bad: string[] = [];
  for (let s = 0; s < starts.length; s++) {
    const end = s + 1 < starts.length ? starts[s + 1].i : lines.length;
    const body = lines.slice(starts[s].i + 1, end);
    const whatIdx = body.findIndex((l) => /\*\*What to do:?\*\*/i.test(l));
    const ansIdx = body.findIndex((l) => /^\s*\*\*The answer/i.test(l));
    if (whatIdx < 0 || ansIdx < 0 || ansIdx < whatIdx) {
      bad.push(`Exercise ${starts[s].n}`);
      continue;
    }
    const what = body
      .slice(whatIdx, ansIdx)
      .join('\n')
      .replace(/\*\*What to do:?\*\*:?/i, '')
      .trim();
    const back = body.slice(ansIdx).join('\n').trim();
    const afterAnswer = back.replace(/^\*\*The answer[^*\n]*\*\*:?/i, '').trim();
    if (what === '' || afterAnswer === '') {
      bad.push(`Exercise ${starts[s].n}`);
      continue;
    }
    cards.push({ front: `${starts[s].title}\n\n${what}`, back });
  }
  return { cards, bad };
}

// ---- parsePackage ----

export function parsePackage(files: Record<string, string>): { days: PkgDay[]; problems: string[] } {
  const problems: string[] = [];
  const days: PkgDay[] = [];
  const found = findDays(files);
  if (found.length === 0) problems.push('no days found');
  for (const day of found) {
    const label = dayLabel(day);
    const script = findKind(day, (k) => k === 'instructor_script');
    const quick = findKind(day, (k) => k === 'quicklearn');
    const recall = findKind(day, isRecallKind);
    const sections = script ? parseScriptSections(files[script]) : [];
    if (script && sections.length === 0) problems.push(`${label}: instructor script has no timed sections`);
    const questions: { text: string; answer: string }[] = [];
    if (quick) {
      const d = parseDiagnostic(files[quick]);
      if (!d.found) problems.push(`${label}: quicklearn has no 8-question diagnostic`);
      for (let i = 0; i < d.questions.length; i++) {
        questions.push({ text: d.questions[i], answer: d.answers[i] ?? '' });
      }
    }
    let cards: { front: string; back: string }[] = [];
    if (recall) {
      const r = parseRecall(files[recall]);
      cards = r.cards;
      for (const b of r.bad) problems.push(`${label}: ${b} is missing its task or its answer`);
    }
    days.push({ index: day.index, track: day.track, sections, questions, cards });
  }
  return { days, problems };
}

// ---- checks ----

function result(id: string, problems: string[], okDetail: string): GateCheck {
  return {
    id,
    pass: problems.length === 0,
    waived: false,
    detail: problems.length === 0 ? okDetail : problems.join('; '),
  };
}

function g1(files: Record<string, string>, days: DayFiles[]): GateCheck {
  const problems: string[] = [];
  if (days.length === 0) problems.push('no days found');
  for (const day of days) {
    for (const req of REQUIRED) {
      if (!findKind(day, req.pred)) problems.push(`${dayLabel(day)} is missing ${req.label}`);
    }
  }
  void files;
  return result('G1-files', problems, `${days.length} day(s) have the required files`);
}

function readmeCell(row: string): string | null {
  const cells = row.split('|');
  if (cells.length < 3) return null;
  let c = cells[1].trim();
  const link = c.match(/^\[([^\]]*)\]\([^)]*\)/);
  if (link) c = link[1];
  c = c.replace(/[`*]/g, '').trim();
  if (/\//.test(c)) return null;
  if (!/^[^\s|]+\.[A-Za-z][A-Za-z0-9]*$/.test(c)) return null;
  return c;
}

function g2(files: Record<string, string>): GateCheck {
  const problems: string[] = [];
  const paths = Object.keys(files);
  const readmes = paths.filter((p) => baseOf(p) === 'README.md').sort();
  for (const readme of readmes) {
    const dir = dirOf(readme);
    const actual = new Set(paths.filter((p) => dirOf(p) === dir).map(baseOf));
    const listed = new Set<string>();
    let inFence = false;
    for (const line of files[readme].split('\n')) {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      if (inFence || !/^\s*\|/.test(line)) continue;
      const name = readmeCell(line.trim());
      if (name) listed.add(name);
    }
    const where = dir || '.';
    for (const n of [...listed].sort()) if (!actual.has(n)) problems.push(`${where}/README.md lists ${n} which does not exist`);
    for (const n of [...actual].sort()) if (!listed.has(n)) problems.push(`${where}/README.md does not list ${n}`);
  }
  return result('G2-readme', problems, `${readmes.length} README(s) match their folders`);
}

function g3(files: Record<string, string>, days: DayFiles[]): GateCheck {
  const problems: string[] = [];
  for (const day of days) {
    const quick = findKind(day, (k) => k === 'quicklearn');
    if (!quick) continue; // reported by G1
    const d = parseDiagnostic(files[quick]);
    if (!d.found) problems.push(`${dayLabel(day)}: no 8-question diagnostic`);
    else if (d.questions.length !== 8) problems.push(`${dayLabel(day)}: diagnostic has ${d.questions.length} questions, need 8`);
    if (d.found && d.answers.length !== 8) problems.push(`${dayLabel(day)}: answer key has ${d.answers.length} answers, need 8`);
  }
  return result('G3-diagnostic', problems, 'every quick-learn has 8 questions and 8 answers');
}

function g4(files: Record<string, string>, days: DayFiles[]): GateCheck {
  const problems: string[] = [];
  for (const day of days) {
    const script = findKind(day, (k) => k === 'instructor_script');
    if (!script) continue;
    const md = files[script];
    const sections = parseScriptSections(md);
    if (sections.length === 0) {
      problems.push(`${dayLabel(day)}: instructor script has no timed sections`);
      continue;
    }
    const sum = sections.reduce((t, s) => t + s.plannedSec, 0);
    const total = scriptTotalSec(md);
    if (total === null) {
      problems.push(`${dayLabel(day)}: instructor script has no Total runtime line`);
    } else if (Math.abs(sum - total) > total * 0.1) {
      problems.push(`${dayLabel(day)}: sections total ${sum}s but Total runtime says ${total}s (more than 10% apart)`);
    }
  }
  return result('G4-script-times', problems, 'section times match each Total runtime');
}

function resolvePath(fromDir: string, target: string): string {
  const parts = fromDir === '' ? [] : fromDir.split('/');
  for (const seg of target.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

function stripFences(md: string): string {
  const out: string[] = [];
  let inFence = false;
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      out.push('');
      continue;
    }
    out.push(inFence ? '' : line);
  }
  return out.join('\n');
}

function g5(files: Record<string, string>): GateCheck {
  const problems: string[] = [];
  const paths = Object.keys(files);
  const exists = (p: string): boolean => p in files || paths.some((q) => q.startsWith(p + '/'));
  for (const path of paths.filter((p) => /\.md$/i.test(p)).sort()) {
    const text = stripFences(files[path]).replace(/`[^`\n]*`/g, '');
    for (const m of text.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      let target = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('//')) continue;
      target = target.replace(/[#?].*$/, '');
      if (target === '') continue;
      try {
        target = decodeURIComponent(target);
      } catch {
        // keep raw
      }
      const resolved = resolvePath(dirOf(path), target.replace(/\/$/, ''));
      if (!exists(resolved)) problems.push(`${path} links to missing ${target}`);
    }
  }
  return result('G5-links', problems, 'no broken relative links');
}

function g6(files: Record<string, string>): GateCheck {
  const problems: string[] = [];
  for (const path of Object.keys(files).filter((p) => /\.md$/i.test(p)).sort()) {
    let open: { marker: string; len: number } | null = null;
    const lines = files[path].split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
      if (!m) continue;
      if (open === null) {
        open = { marker: m[1][0], len: m[1].length };
        if (m[2].trim() === '') problems.push(`${path}:${i + 1} code block has no language`);
      } else if (m[1][0] === open.marker && m[1].length >= open.len && m[2].trim() === '') {
        open = null;
      }
    }
  }
  return result('G6-code-lang', problems, 'every code block has a language');
}

function g7(files: Record<string, string>): GateCheck {
  const problems: string[] = [];
  let count = 0;
  for (const path of Object.keys(files).sort()) {
    const shift = /(^|\/)shift\/[^/]+\.json$/.test(path);
    const exam = /(^|\/)exam\/[^/]+\.json$/.test(path);
    if (!shift && !exam) continue;
    count++;
    let data: unknown;
    try {
      data = JSON.parse(files[path]);
    } catch {
      problems.push(`${path} is not valid JSON`);
      continue;
    }
    const obj = (data ?? {}) as Record<string, unknown>;
    if (shift) {
      const tickets = Array.isArray(obj.tickets) ? (obj.tickets as Record<string, unknown>[]) : null;
      if (!tickets || tickets.length === 0) {
        problems.push(`${path} has no tickets`);
        continue;
      }
      tickets.forEach((t, i) => {
        const check = (t ?? {}).check as Record<string, unknown> | undefined;
        const ok =
          check &&
          typeof check === 'object' &&
          ['answer', 'command', 'file'].includes(check.kind as string) &&
          typeof check.expected === 'string' &&
          check.expected.trim() !== '';
        if (!ok) problems.push(`${path} ticket ${(t ?? {}).id ?? i + 1} has no check`);
      });
    } else {
      const qs = Array.isArray(obj.questions) ? (obj.questions as Record<string, unknown>[]) : null;
      if (!qs || qs.length === 0) {
        problems.push(`${path} has no questions`);
        continue;
      }
      qs.forEach((q, i) => {
        const a = (q ?? {}).answer;
        if (a === undefined || a === null || String(a).trim() === '') {
          problems.push(`${path} question ${(q ?? {}).id ?? i + 1} has no answer`);
        }
      });
    }
  }
  return result('G7-graded', problems, `${count} graded file(s) have answers or checks`);
}

function g8(files: Record<string, string>, days: DayFiles[]): GateCheck {
  const problems: string[] = [];
  for (const day of days) {
    const recall = findKind(day, isRecallKind);
    if (!recall) continue;
    const r = parseRecall(files[recall]);
    for (const b of r.bad) problems.push(`${dayLabel(day)}: ${b} is missing its task or its answer`);
  }
  return result('G8-cards', problems, 'memory-recall files parse into cards');
}

export function runGate(
  files: Record<string, string>,
  waivers: readonly Waiver[] = [],
  now: number = 0,
): GateResult {
  const days = findDays(files);
  const raw: GateCheck[] = [
    g1(files, days),
    g2(files),
    g3(files, days),
    g4(files, days),
    g5(files),
    g6(files),
    g7(files),
    g8(files, days),
  ];
  const checks = raw.map((c) => {
    if (c.pass || c.id === 'G7-graded') return c;
    const w = waivers.find((x) => {
      if (x.check !== c.id) return false;
      if (typeof x.reason !== 'string' || x.reason.trim() === '') return false;
      if (typeof x.by !== 'string' || x.by.trim() === '') return false;
      const expires = Math.min(x.expiresAt, now + WAIVER_CAP_MS);
      return now < expires;
    });
    return w ? { ...c, waived: true, detail: `${c.detail} (waived by ${w.by}: ${w.reason})` } : c;
  });
  return { pass: checks.every((c) => c.pass || c.waived), checks };
}
