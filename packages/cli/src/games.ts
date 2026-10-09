// `lms games check <dir-or-file>` and `lms games new <gameId> <packId> [--dir <dir>]` (SPEC §13.5).
// Pure core + thin shell (pattern pure-core-cli-contract): gamesCore returns { code, stdout, stderr }; only
// runGames touches process. Exit codes: 0 ok, 1 problems found / refused to overwrite, 2 usage error.
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { checkPath, formatProblem } from '../../games/src/check/index.ts';
import { isStarterGame, PACK_ID_RE, starterJson } from '../../games/src/check/starter.ts';
import { FIRST_WAVE } from '../../games/src/check/packs.ts';
import type { SnekApi } from '../../games/src/check/snek.ts';
import { writeFileAtomic } from '../../../lib/atomic-write.mjs';

export interface CoreResult { code: number; stdout: string; stderr: string }

const USAGE = [
  'usage: lms games check <dir-or-file>',
  '       lms games new <gameId> <packId> [--dir <dir>]',
  `       gameId is one of: ${FIRST_WAVE.join(', ')}`,
].join('\n');

const usage = (why: string): CoreResult => ({ code: 2, stdout: '', stderr: `${why}\n${USAGE}\n` });

export async function gamesCore(args: string[], env: { cwd: string; snek?: SnekApi | null }): Promise<CoreResult> {
  const [sub, ...rest] = args;
  const flags: Record<string, string> = {};
  const pos: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (rest[i + 1] !== undefined && !rest[i + 1].startsWith('--')) flags[a.slice(2)] = rest[++i];
      else flags[a.slice(2)] = '';
    } else pos.push(a);
  }

  if (sub === 'check') {
    if (pos.length !== 1 || Object.keys(flags).length) return usage('games check needs exactly one folder or file.');
    const target = resolve(env.cwd, pos[0]);
    if (!existsSync(target)) return usage(`no such file or folder: ${pos[0]}`);
    const r = await checkPath(target, env.snek === undefined ? {} : { snek: env.snek });
    const shown = (f: string) => (f.startsWith(target) ? pos[0] + f.slice(target.length) : f);
    if (r.problems.length === 0) return { code: 0, stdout: `ok: ${r.files} file(s)\n`, stderr: '' };
    return { code: 1, stdout: r.problems.map((p) => formatProblem({ ...p, file: shown(p.file) })).join('\n') + '\n', stderr: '' };
  }

  if (sub === 'new') {
    const known = new Set(['dir']);
    for (const k of Object.keys(flags)) if (!known.has(k)) return usage(`unknown option --${k}.`);
    if (pos.length !== 2) return usage('games new needs a game id and a pack id.');
    const [gameId, packId] = pos;
    if (!isStarterGame(gameId)) return usage(`unknown game "${gameId}".`);
    if (!PACK_ID_RE.test(packId)) return usage(`pack id "${packId}" must use lower-case letters, digits and hyphens.`);
    if ('dir' in flags && !flags.dir) return usage('--dir needs a folder.');
    const base = resolve(env.cwd, flags.dir ?? '.');
    const file = join(base, 'games', gameId, `${packId}.json`);
    if (existsSync(file)) return { code: 1, stdout: '', stderr: `refusing to overwrite ${file}\n` };
    mkdirSync(join(base, 'games', gameId), { recursive: true });
    writeFileAtomic(file, starterJson(gameId, packId));
    return { code: 0, stdout: `${file}\n`, stderr: '' };
  }

  return usage(sub ? `unknown games command "${sub}".` : 'games needs a command.');
}

export async function runGames(args: string[]): Promise<number> {
  const r = await gamesCore(args, { cwd: process.cwd() });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.code;
}
