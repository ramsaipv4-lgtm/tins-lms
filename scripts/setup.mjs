#!/usr/bin/env node
// Gate setup (tins.json "setup", runs before the SPEC lint; tins-kit RF-21): link the acceptance
// suite from the tests repo and, in task worktrees, the shared node_modules.
import { existsSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const acc = join(root, 'acceptance');
if (!existsSync(acc)) {
  const src = process.env.LMS_ACCEPTANCE_DIR || resolve(root, '..', 'tins-lms-tests', 'acceptance');
  if (!existsSync(src)) { console.error('acceptance suite not found: clone https://github.com/ramsaipv4-lgtm/tins-lms-tests next to this repo or set LMS_ACCEPTANCE_DIR'); process.exit(1); }
  symlinkSync(src, acc, 'dir');
}
if (!existsSync(join(root, 'node_modules')) && process.env.LMS_NODE_MODULES) symlinkSync(process.env.LMS_NODE_MODULES, join(root, 'node_modules'), 'dir');
