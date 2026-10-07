import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
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

/** A changed copy of the demo package (one diagnostic question reworded, one script section edited), for the "what changes" check. */
export function changedPackageTar() {
  const root = join(SEED_ROOT, 'fixtures', 'package');
  const work = join(DEMOS, 'out', '.raw', 'package-changed');
  rmSync(work, { recursive: true, force: true });
  cpSync(root, work, { recursive: true });
  const ql = join(work, 'track1', 'day1', 'quicklearn.md');
  writeFileSync(ql, readFileSync(ql, 'utf8')
    .replace('7. Which command serves the site with live reload?', '7. Which command previews the site in the browser with live reload?')
    .replace('8. Which key sets the order of pages in a menu?', '8. Which front matter key sets the order of pages in a menu?'));
  const ins = join(work, 'track1', 'day1', 'instructor_script.md');
  writeFileSync(ins, readFileSync(ins, 'utf8').replace('Welcome back.', 'Welcome back, and thanks for the feedback on pace.'));
  const out = join(DEMOS, 'out', '.raw', 'package-changed.tar');
  const r = spawnSync('tar', ['--format=ustar', '-cf', out, '-C', work, ...readdirSync(work).sort()], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`tar failed: ${r.stderr}`);
  return out;
}
