/*
 * FEATURE API (read this before filling a feature group; never edit this file or src/app/*).
 *
 * A group lives in src/features/<group>/ with two files:
 *   index.tsx        exports `routes: FeatureRoute[]` (empty until you add some)
 *   strings.en.json  flat { "<group>.some.key": "English text" }, merged into the app strings at build time
 * Groups are discovered with import.meta.glob, so adding a group folder needs no registry edit.
 *
 * ROUTES AND NAV. One entry per screen:
 *   { path: '/learn/cards', space: 'learn', label: 'learn.nav.cards', load: () => import('./Cards.tsx') }
 *   - path starts with '/<space>/' (space: admin | teach | learn | coach) and may contain ':id' params.
 *   - label is a strings key; with nav !== false the screen appears in that space's <nav> (ordered by `order`, then label).
 *   - load returns a module whose default export is a React component (code-split per screen; heavy code such as
 *     the board MUST sit behind load() so it is fetched only on its route). The component gets props { params }.
 *   - roles (optional) narrows who sees the entry/route inside the space (default: everyone allowed in the space).
 *   - Routes are deep-linkable: the server falls back to index.html for any path without an extension.
 *
 * STRINGS. `import { t } from '../../strings/index.ts'` then t('learn.nav.cards', { n: 3 }) ("{n}" placeholders).
 *   Never put a visible literal in JSX or aria-label: the pseudo-locale (LMS_PSEUDO_LOCALE=1) wraps every string
 *   as ⟦…⟧ and a journey fails on unwrapped text. Course/user data may be marked translate="no".
 *
 * DATA. REST: `import { api } from '../../app/api.ts'`; `await api('/api/me')`, `api(path, { method: 'POST', body })`
 *   (JSON, session cookie, throws ApiError with .status and .fields). Sync: `import { openClassDb, openPersonDb,
 *   syncDb } from '../../app/db.ts'`; openClassDb('c1') is the local PouchDB "class-c1", syncDb(name) replicates
 *   it with the hub at /db/<name> (live, retrying; sends x-lms-schema). Session and role info:
 *   `useSession()` from '../../app/session.tsx'; links: `Link` and `navigate` from '../../app/router.tsx'.
 *
 * TEST IDS. Put the data-testid values named in SPEC §6 / Appendix C and D on your elements; add accessible names
 *   matching the Appendix D patterns (nav labels are matched case-insensitively).
 */
import type { ComponentType } from 'react';

export type Space = 'admin' | 'teach' | 'learn' | 'coach';
export type Role = 'admin' | 'trainer' | 'substitute' | 'learner' | 'coordinator';

export interface FeatureRoute {
  path: string;
  space: Space;
  label: string;
  nav?: boolean;
  order?: number;
  roles?: Role[];
  load: () => Promise<{ default: ComponentType<{ params: Record<string, string> }> }>;
}

const modules = import.meta.glob('./*/index.tsx', { eager: true }) as Record<string, { routes?: FeatureRoute[] }>;

export const featureRoutes: FeatureRoute[] = Object.keys(modules).sort().flatMap((k) => modules[k].routes ?? []);
