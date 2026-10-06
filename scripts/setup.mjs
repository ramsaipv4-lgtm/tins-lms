#!/usr/bin/env node
// Gate setup (tins.json "setup", runs before the SPEC lint; tins-kit RF-21): link the acceptance
// suite from the tests repo and, in task worktrees, the shared node_modules.
import { existsSync, readdirSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const acc = join(root, 'acceptance');
if (!existsSync(acc)) {
  const src = process.env.LMS_ACCEPTANCE_DIR || resolve(root, '..', 'tins-lms-tests', 'acceptance');
  if (!existsSync(src)) { console.error('acceptance suite not found: clone https://github.com/ramsaipv4-lgtm/tins-lms-tests next to this repo or set LMS_ACCEPTANCE_DIR'); process.exit(1); }
  symlinkSync(src, acc, 'dir');
}
if (!existsSync(join(root, 'node_modules')) && process.env.LMS_NODE_MODULES) symlinkSync(process.env.LMS_NODE_MODULES, join(root, 'node_modules'), 'dir');
// Packages with their own node_modules (npm workspaces keep a package's dependency there when it conflicts
// with the hoisted one, e.g. packages/web's React 19 next to the root React 18 Excalidraw pulled in): link
// those too, or a task worktree builds against different versions than main does (integration I-8).
if (process.env.LMS_NODE_MODULES) {
  const main = resolve(process.env.LMS_NODE_MODULES, '..');
  for (const p of existsSync(join(main, 'packages')) ? readdirSync(join(main, 'packages')) : []) {
    const src = join(main, 'packages', p, 'node_modules'); const dst = join(root, 'packages', p, 'node_modules');
    if (resolve(src) !== resolve(dst) && existsSync(src) && existsSync(join(root, 'packages', p)) && !existsSync(dst)) symlinkSync(src, dst, 'dir');
  }
}
