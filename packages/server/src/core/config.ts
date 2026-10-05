// Server configuration read from the environment (SPEC §2). Nothing here is secret.
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../../package.json' with { type: 'json' };

export const SCHEMA = 1; // current document schema version (D-23); compat rules live in core canSync
export const VERSION: string = pkg.version;

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, '..', '..', '..', '..');

export type Config = {
  port: number;
  profile: 'phone' | 'hub' | 'cloud' | 'hybrid';
  dataDir: string;
  testMode: boolean;
  tls: string; // 'off' or anything else (certificate files under <dataDir>/tls)
  repoRoot: string;
  webDist: string;
};

export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  const profileRaw = env.LMS_PROFILE ?? 'hub';
  const profiles = ['phone', 'hub', 'cloud', 'hybrid'];
  const profile = (profiles.includes(profileRaw) ? profileRaw : 'hub') as Config['profile'];
  const dataDir = resolve(env.LMS_DATA_DIR ?? join(REPO_ROOT, '.lms-data'));
  mkdirSync(dataDir, { recursive: true });
  const port = env.PORT === undefined || env.PORT === '' ? 8080 : Number(env.PORT);
  return {
    port: Number.isInteger(port) && port >= 0 ? port : 8080,
    profile,
    dataDir,
    testMode: env.LMS_TEST_MODE === '1',
    tls: env.LMS_TLS ?? 'on',
    repoRoot: REPO_ROOT,
    // LMS_WEB_DIST lets a test serve its own build without touching the shared dist (integration I-3).
    webDist: env.LMS_WEB_DIST || join(REPO_ROOT, 'packages', 'web', 'dist'),
  };
}

export function hasWebDist(cfg: Config): boolean {
  return existsSync(join(cfg.webDist, 'index.html'));
}
