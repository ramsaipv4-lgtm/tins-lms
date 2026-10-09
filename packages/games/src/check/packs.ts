// The pack check (SPEC §13.5 "Pack-check rules (first wave)", D-46, D-55). Node-only (reads the schema files).
// checkPack(pack, snek) returns one problem per fault; the CLI prints `<file>: <where>: <message>`, where `where`
// is `pack` or `level <id>`. Snek is passed in so tests can use a stub and so the package gate can load it lazily.
import { readFileSync } from 'node:fs';
import { TUNING } from '../tuning.ts';
import { validate, type SchemaError } from './jsonschema.ts';
import { failingTest, runSource, trimOut, type SnekApi, type PackTest } from './snek.ts';

export interface PackProblem { where: string; message: string }

export const FIRST_WAVE = ['syntax-drop', 'sniper', 'whack-a-bug', 'aftershock'] as const;
const LATER = ['maze-coder', 'breakout', 'raid', 'garage'];
export const RENDERERS = ['html', 'chart', 'console', 'pattern', 'regex'];
export const LESSON_MAX = 280;

const schemaCache = new Map<string, any>();
export function loadSchema(gameId: string): any {
  if (!schemaCache.has(gameId)) {
    schemaCache.set(gameId, JSON.parse(readFileSync(new URL(`../../schema/${gameId}.schema.json`, import.meta.url), 'utf8')));
  }
  return schemaCache.get(gameId);
}

// '/levels/0/slots/1/accepts' -> { level: 0, rest: 'slots[1].accepts' }; '/concepts/0' -> { level: null, rest: 'concepts[0]' }
function locate(path: string): { level: number | null; rest: string } {
  const parts = path.split('/').filter(Boolean);
  let level: number | null = null;
  if (parts[0] === 'levels' && parts.length >= 2) { level = Number(parts[1]); parts.splice(0, 2); }
  let rest = '';
  for (const p of parts) rest += /^\d+$/.test(p) ? `[${p}]` : rest ? `.${p}` : p;
  return { level, rest };
}

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function checkPack(pack: unknown, snek: SnekApi | null): PackProblem[] {
  const out: PackProblem[] = [];
  if (!isObj(pack)) return [{ where: 'pack', message: 'a pack is a JSON object.' }];
  const gameId = str(pack.game);
  if (!gameId) return [{ where: 'pack', message: 'missing required field "game".' }];
  if (!(FIRST_WAVE as readonly string[]).includes(gameId)) {
    return [{ where: 'pack', message: LATER.includes(gameId) ? `the pack check for ${gameId} is not available yet.` : `unknown game "${gameId}".` }];
  }
  const levelIds = arr(pack.levels).map((l) => (isObj(l) ? str(l.id) : ''));
  const levelWhere = (i: number | null) => (i === null ? 'pack' : `level ${levelIds[i] || i + 1}`);

  // 1. the schema
  const schemaErrors: SchemaError[] = validate(loadSchema(gameId), pack);
  for (const e of schemaErrors) {
    const { level, rest } = locate(e.path);
    out.push({ where: levelWhere(level), message: rest ? `${rest}: ${e.message}.` : `${e.message}.` });
  }

  // 2. common rules
  const concepts = new Set(arr(pack.concepts).map(String));
  const seen = new Set<string>();
  arr(pack.levels).forEach((lvl, i) => {
    if (!isObj(lvl)) return;
    const id = str(lvl.id);
    if (id && seen.has(id)) out.push({ where: levelWhere(i), message: `level id "${id}" appears more than once; ids must be unique within a pack.` });
    seen.add(id);
    for (const [j, card] of arr(lvl.lesson).entries()) {
      if (isObj(card) && typeof card.text === 'string' && [...card.text].length > LESSON_MAX) {
        out.push({ where: levelWhere(i), message: `lesson[${j}].text has ${[...card.text].length} characters; the most allowed is ${LESSON_MAX}.` });
      }
    }
    for (const c of conceptsOf(gameId, lvl)) {
      if (c.value && !concepts.has(c.value)) out.push({ where: levelWhere(i), message: `${c.at}: concept "${c.value}" is not listed in the pack's concepts.` });
    }
  });

  // 3. game rules (skipped for a level the schema already rejected at the top: they would only repeat the fault)
  const rules: Record<string, (lvl: any, snek: SnekApi | null, say: (m: string) => void) => void> = {
    'syntax-drop': checkSyntaxDrop, sniper: checkSniper, 'whack-a-bug': checkWhack, aftershock: checkAftershock,
  };
  arr(pack.levels).forEach((lvl, i) => {
    if (!isObj(lvl)) return;
    try { rules[gameId](lvl, snek, (message) => out.push({ where: levelWhere(i), message })); }
    catch (e: any) { out.push({ where: levelWhere(i), message: `this level could not be checked (${String(e?.message ?? e).slice(0, 120)}).` }); }
  });
  return out;
}

function conceptsOf(gameId: string, lvl: Record<string, any>): { at: string; value: string }[] {
  const list: { at: string; value: string }[] = [];
  arr(lvl.lesson).forEach((c, j) => isObj(c) && list.push({ at: `lesson[${j}].concept`, value: str(c.concept) }));
  if (typeof lvl.concept === 'string') list.push({ at: 'concept', value: lvl.concept });
  const collect = (key: string) => arr(lvl[key]).forEach((x, j) => isObj(x) && typeof x.concept === 'string' && list.push({ at: `${key}[${j}].concept`, value: x.concept }));
  collect('pieces'); collect('snippets'); collect('bugs'); collect('decoys');
  return list;
}

const needSnek = (snek: SnekApi | null, say: (m: string) => void, what: string): snek is SnekApi => {
  if (!snek) { say(`${what} cannot be checked because Snek is not available in this build.`); return false; }
  return true;
};

// ---- syntax-drop ----
function checkSyntaxDrop(lvl: any, snek: SnekApi | null, say: (m: string) => void): void {
  const pieces = arr(lvl.pieces).filter(isObj);
  const byId = new Map(pieces.map((p) => [str(p.id), p]));
  const slots = arr(lvl.slots).filter(isObj);
  const template = str(lvl.template);
  if (!RENDERERS.includes(str(lvl.renderer)) && lvl.renderer !== undefined) say(`renderer "${lvl.renderer}" is not a known renderer (${RENDERERS.join(', ')}).`);
  for (const s of slots) {
    const id = str(s.id);
    const ok = arr(s.accepts).some((pid) => byId.has(String(pid)) && !byId.get(String(pid))!.decoy);
    if (!ok) say(`slot ${id} accepts no correct piece: "accepts" must name at least one existing piece that is not a decoy.`);
    if (!template.includes(`{{${id}}}`)) say(`the template does not contain {{${id}}} for slot ${id}.`);
  }
  if (lvl.mode === 'fill' && slots.length === 0) say('a fill level needs at least one slot.');
  const slotIds = slots.map((s) => str(s.id));
  slotIds.forEach((id, i) => { if (slotIds.indexOf(id) !== i) say(`slot id ${id} appears more than once.`); });
  const keys = new Map<string, string>();
  for (const p of pieces) {
    if (p.key === undefined) { if (lvl.mode === 'strike') say(`piece ${p.id} needs a strike key (a digit from 1 to 9) in strike mode.`); continue; }
    const k = String(p.key);
    if (!/^[1-9]$/.test(k)) say(`piece ${p.id} has key "${k}"; strike keys are the digits 1 to 9.`);
    else if (keys.has(k)) say(`strike key ${k} is used by both ${keys.get(k)} and ${p.id}; keys must be unique within a level.`);
    else keys.set(k, str(p.id));
  }
  const pieceIds = pieces.map((p) => str(p.id));
  pieceIds.forEach((id, i) => { if (pieceIds.indexOf(id) !== i) say(`piece id ${id} appears more than once.`); });
  if (lvl.renderer === 'console' || lvl.renderer === 'pattern') {
    if (!needSnek(snek, say, `the ${lvl.renderer} renderer's filled template`)) return;
    let code = template;
    for (const s of slots) {
      const first = byId.get(String(arr(s.accepts)[0]));
      code = code.split(`{{${str(s.id)}}}`).join(first ? str(first.text) : '');
    }
    const r = runSource(snek, code);
    if (!r.ok) say(`the template filled with each slot's first accepted piece does not run (${r.kind} on line ${r.line}: ${r.message}).`);
  }
}

// ---- sniper ----
function checkSniper(lvl: any, snek: SnekApi | null, say: (m: string) => void): void {
  const snippets = arr(lvl.snippets).filter(isObj);
  const ids = snippets.map((s) => str(s.id));
  ids.forEach((id, i) => { if (ids.indexOf(id) !== i) say(`snippet id ${id} appears more than once.`); });
  if (!needSnek(snek, say, 'the snippets')) return;
  const outputs = new Map<string, string>();
  for (const s of snippets) {
    const r = runSource(snek, str(s.code));
    if (!r.ok) say(`snippet ${s.id} does not run (${r.kind} on line ${r.line}: ${r.message}).`);
    else outputs.set(str(s.id), trimOut(r.stdout));
  }
  const monsters = arr(lvl.monsters).map(String);
  for (const m of monsters) if (!ids.includes(m)) say(`monster "${m}" is not one of the level's snippets.`);
  const printedBy = (out: string, among: string[]) => among.filter((id) => outputs.get(id) === out);
  const bounties = arr(lvl.bounties).filter(isObj);
  for (const b of bounties) {
    const sid = str(b.snippetId);
    if (!outputs.has(sid)) { if (!ids.includes(sid)) say(`bounty snippet "${sid}" is not one of the level's snippets.`); continue; }
    const real = outputs.get(sid)!;
    if (typeof b.output === 'string' && trimOut(b.output) !== real) say(`bounty for ${sid} says it prints ${JSON.stringify(trimOut(b.output))} but the snippet prints ${JSON.stringify(real)}.`);
    if (!monsters.includes(sid)) say(`bounty snippet "${sid}" is not among the level's monsters.`);
    const hits = printedBy(real, monsters);
    if (hits.length !== 1) say(`the bounty output ${JSON.stringify(real)} must be printed by exactly one monster snippet, but ${hits.length} print it${hits.length ? ` (${hits.join(', ')})` : ''}.`);
  }
  const plates = arr(lvl.plates).filter(isObj).map((p) => str(p.snippetId));
  for (const p of plates) if (!ids.includes(p)) say(`plate snippet "${p}" is not one of the level's snippets.`);
  for (const c of arr(lvl.callouts).map(String)) {
    if (!ids.includes(c)) { say(`callout "${c}" is not one of the level's snippets.`); continue; }
    if (!plates.includes(c)) { say(`callout "${c}" names a snippet that is not a plate.`); continue; }
    const real = outputs.get(c);
    const hits = real === undefined ? [] : printedBy(real, plates);
    if (hits.length > 1) say(`callout "${c}" prints ${JSON.stringify(real)}, which more than one plate prints (${hits.join(', ')}).`);
  }
  if (bounties.length === 0 && plates.length === 0) say('a level needs bounties (or plates and callouts for the boss).');
}

// ---- whack-a-bug ----
function indentOf(line: string): string { return /^\s*/.exec(line)![0]; }
function checkWhack(lvl: any, snek: SnekApi | null, say: (m: string) => void): void {
  const program = str(lvl.program);
  const lines = program.split('\n');
  const max = TUNING['whack.maxProgramLines'];
  if (lines.length > max) say(`the program has ${lines.length} lines; the most allowed is ${max}.`);
  const fixed = [...lines];
  const bugLines = new Set<number>();
  let inside = true;
  for (const b of arr(lvl.bugs).filter(isObj)) {
    const n = Number(b.line);
    if (!Number.isInteger(n) || n < 1 || n > lines.length) { say(`bug line ${b.line} is outside the program (lines 1 to ${lines.length}).`); inside = false; continue; }
    if (bugLines.has(n)) say(`line ${n} has more than one bug.`);
    bugLines.add(n);
    const fix = str(b.fix);
    fixed[n - 1] = /^\s/.test(fix) ? fix : indentOf(lines[n - 1]) + fix;
    if (fixed[n - 1] === lines[n - 1]) say(`the fix for line ${n} is the same as the buggy line.`);
  }
  if (!inside) return;
  if (!needSnek(snek, say, 'the programs')) return;
  const good = runSource(snek, fixed.join('\n'));
  if (!good.ok) { say(`the fixed program does not run (${good.kind} on line ${good.line}: ${good.message}).`); return; }
  const bad = runSource(snek, program);
  const badOut = bad.ok ? trimOut(bad.stdout) : `${trimOut(bad.stdout)}\nError: ${bad.kind}`.replace(/^\n/, '');
  if (!bad.ok && bad.phase === 'compile') say(`the buggy program does not compile (${bad.kind} on line ${bad.line}: ${bad.message}).`);
  else if (badOut === trimOut(good.stdout)) say('the fixed and the buggy programs print the same output, so the bug cannot be seen.');
}

// ---- aftershock ----
function stackSource(lines: any[], order: number[]): string {
  return order.map((i) => '    '.repeat(Number(lines[i].indent) || 0) + str(lines[i].text)).join('\n');
}
function checkAftershock(lvl: any, snek: SnekApi | null, say: (m: string) => void): void {
  const lines = arr(lvl.lines).filter(isObj);
  const tests = arr(lvl.tests).filter(isObj) as PackTest[];
  const entry = typeof lvl.entry === 'string' ? lvl.entry : typeof lvl.signature === 'string' ? lvl.signature.split('(')[0].trim() : null;
  const orders: { name: string; order: number[] }[] = [{ name: 'the lines in order', order: lines.map((_, i) => i) }];
  arr(lvl.altOrders).forEach((o, k) => {
    const ok = Array.isArray(o) && o.length === lines.length && new Set(o).size === o.length && o.every((i: any) => Number.isInteger(i) && i >= 0 && i < lines.length);
    if (!ok) say(`altOrders[${k}] must be a permutation of the line indexes 0 to ${lines.length - 1}.`);
    else orders.push({ name: `the order altOrders[${k}]`, order: o });
  });
  if (!needSnek(snek, say, 'the tests')) return;
  for (const { name, order } of orders) {
    const bad = failingTest(snek, stackSource(lines, order), entry, tests);
    if (bad) say(`${name}: fails the tests (${bad}).`);
  }
}
