// Coach LMS command line: `node packages/cli/src/main.ts loadtest --learners 200 --target <url>` (SPEC Appendix B)
// and `node packages/cli/src/main.ts games check|new ...` (SPEC §13.5).
import { runLoadTest } from './loadtest.ts';
import { runGames } from './games.ts';

export function parseArgs(argv: string[]): { command: string; flags: Record<string, string> } {
  const [command = '', ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else flags[a.slice(2)] = rest[i + 1] !== undefined && !rest[i + 1].startsWith('--') ? rest[++i] : 'true';
    }
  }
  return { command, flags };
}

async function main(argv: string[]): Promise<number> {
  if (argv[0] === 'games') return runGames(argv.slice(1));
  const { command, flags } = parseArgs(argv);
  if (command !== 'loadtest') {
    console.error('usage: lms loadtest --learners <n> --target <url>\n       lms games check <dir-or-file>\n       lms games new <gameId> <packId> [--dir <dir>]');
    return 2;
  }
  const learners = Number(flags.learners ?? 200);
  if (!Number.isInteger(learners) || learners < 1 || !flags.target) {
    console.error('usage: lms loadtest --learners <n> --target <url>');
    return 2;
  }
  try {
    const summary = await runLoadTest({ target: flags.target, learners });
    console.log(JSON.stringify(summary)); // the last stdout line is the summary
    return summary.pass ? 0 : 1;
  } catch (e) {
    console.error(`loadtest: ${(e as Error).message}`);
    return 1;
  }
}

if (import.meta.url === new URL(process.argv[1], 'file://').href || process.argv[1]?.endsWith('main.ts')) {
  process.exitCode = await main(process.argv.slice(2));
}
