// `games check <dir-or-file>` (SPEC §13.5): packs and story files. Node-only.
//   checkPath(target)  -> { files, problems: [{ file, where, message }] }
//   formatProblem(p)   -> `<file>: <pack, level <id> or scene <id>>: <message>`
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPack } from './packs.ts';
import { loadSnek, type SnekApi } from './snek.ts';
import { checkGameStory, checkUniverse, isStoryFile, type Problem, type StoryContext } from '../story/check.ts';

export { checkPack } from './packs.ts';
export { checkGameStory, checkUniverse } from '../story/check.ts';

export interface FileProblem extends Problem { file: string }
export interface CheckResult { files: number; problems: FileProblem[] }

export const formatProblem = (p: FileProblem): string => `${p.file}: ${p.where}: ${p.message}`;

const enPath = new URL('../../../web/src/strings/en.json', import.meta.url);
const universePath = new URL('../../story/universe.json', import.meta.url);

export function loadEnKeys(): Set<string> | null {
  try { return new Set(Object.keys(JSON.parse(readFileSync(enPath, 'utf8')))); } catch { return null; }
}

function castOf(path: string): string[] {
  try {
    const u = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(u?.cast) ? u.cast.map((c: any) => String(c?.id)) : [];
  } catch { return []; }
}

function listJson(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(dir, rel)).sort()) {
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(join(dir, r)).isDirectory()) out.push(...listJson(dir, r));
    else if (name.endsWith('.json') && name !== 'index.json') out.push(r);
  }
  return out;
}

export interface CheckOptions { snek?: SnekApi | null; enKeys?: ReadonlySet<string> | null; universeCast?: readonly string[] }

/** Throws only when the target does not exist (a usage error); everything else becomes a problem line. */
export async function checkPath(target: string, opts: CheckOptions = {}): Promise<CheckResult> {
  if (!existsSync(target)) throw new Error(`no such file or folder: ${target}`);
  const isDir = statSync(target).isDirectory();
  const files = isDir ? listJson(target).map((r) => join(target, r)) : [target];
  const snek = opts.snek !== undefined ? opts.snek : await loadSnek();
  const enKeys = opts.enKeys !== undefined ? opts.enKeys : loadEnKeys();
  const universeFile = isDir && existsSync(join(target, 'universe.json')) ? join(target, 'universe.json') : null;
  const universeCast = new Set<string>(opts.universeCast ?? (universeFile ? castOf(universeFile) : existsSync(universePath) ? castOf(fileURLToPath(universePath)) : []));
  const ctx: StoryContext = { enKeys, universeCast };
  const problems: FileProblem[] = [];
  for (const file of files) {
    let data: any;
    try { data = JSON.parse(readFileSync(file, 'utf8')); }
    catch (e: any) { problems.push({ file, where: 'file', message: `not valid JSON (${String(e?.message ?? e).slice(0, 100)}).` }); continue; }
    let found: Problem[];
    if (isStoryFile(data)) found = data.gameId ? checkGameStory(data, ctx) : checkUniverse(data, ctx);
    else found = checkPack(data, snek);
    for (const p of found) problems.push({ file, ...p });
  }
  return { files: files.length, problems };
}
