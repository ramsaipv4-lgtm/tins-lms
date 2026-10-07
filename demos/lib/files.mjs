import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEMOS, SEED_ROOT } from './hub.mjs';

/** ustar archive of the demo course package (demos/seed/fixtures/package), as the upload screen expects. */
export function packageTar() {
  const root = join(SEED_ROOT, 'fixtures', 'package');
  const dir = join(DEMOS, 'out', '.raw');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'package.tar');
  const r = spawnSync('tar', ['--format=ustar', '-cf', out, '-C', root, ...readdirSync(root).sort()], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`tar failed: ${r.stderr}`);
  return out;
}
export const fixturePath = (rel) => join(SEED_ROOT, 'fixtures', rel);
