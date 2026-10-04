// Builds the shared context handed to every route module (documented in routes/index.ts).
import { createClock } from './clock.ts';
import { createGuards } from './guard.ts';
import { createPolicy } from './policy.ts';
import { createSessions } from './sessions.ts';
import { createStore } from './store.ts';
import { ApiError, fieldError, parseWith, validateBody, validateQuery } from './http.ts';
import { randomCode, randomKey, sha256Hex, keyOf } from './ids.ts';
import { ORG_DB, currentTnc, ensureOrg, getPerson, isMinor, savePerson } from './people.ts';
import { SCHEMA, VERSION } from './config.ts';
import type { Config } from './config.ts';
import type { CaInfo } from './ca.ts';

export function createCtx(config: Config) {
  const clock = createClock();
  const store = createStore(config.dataDir);
  const secure = config.tls !== 'off';
  const sessions = createSessions({ secure, now: () => clock.now() });
  return {
    config,
    schema: SCHEMA,
    version: VERSION,
    clock,
    store,
    sessions,
    guard: createGuards(),
    policy: createPolicy(),
    http: { ApiError, fieldError, parseWith, validateBody, validateQuery },
    ids: { randomCode, randomKey, sha256Hex, keyOf },
    people: { ORG_DB, currentTnc, ensureOrg, getPerson, savePerson, isMinor },
    ca: null as CaInfo | null,
    hubId: undefined as string | undefined,
    // Express-style functions run before express-pouchdb handles /db/* (sync.ts adds auth and schema checks).
    dbGuards: [] as Array<(req: any, res: any, next: (e?: any) => void) => void>,
    hooks: {
      // content.ts sets this; the test seed calls it for each entry of `packages` in a fixture (`file` = resolved absolute path or null).
      seedPackage: null as null | ((p: { path: string; file: string | null; classId: string; publish: boolean }) => Promise<void>),
      // Functions run by /__test/reset after the data is wiped (before the org is recreated).
      onReset: [] as Array<() => Promise<void> | void>,
    },
    log: (msg: string) => { process.stderr.write(`[lms] ${msg}\n`); }, // never pass secrets
  };
}

export type Ctx = ReturnType<typeof createCtx>;
