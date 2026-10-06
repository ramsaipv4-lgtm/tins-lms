// Pure navigation rules of the shell (no React, no Vite): which entries a space nav shows and which screen is a space's
// home. The shell passes the registry's routes in, so node tests can run these on small route lists.
import type { FeatureRoute, Space } from '../features/registry.ts';
import { switchOn, type Switches } from './switches.ts';

// The roles a person can hold inside each space (teach: trainer, substitute, coordinator; learn and coach: learner).
export const SPACE_ROLES: Record<Space, string[]> = { admin: ['admin'], teach: ['trainer', 'substitute', 'coordinator'], learn: ['learner'], coach: ['learner'] };

// By `order` (default 100), then by the visible label: the first entry a journey's accessible-name pattern matches wins.
export function sortRoutes(routes: FeatureRoute[], label: (key: string) => string): FeatureRoute[] {
  return [...routes].sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || label(a.label).localeCompare(label(b.label)));
}

// Nav entries of a space for these roles. `sw` is the feature switches (null: not known, nothing is hidden).
export function navEntries(routes: FeatureRoute[], space: Space, roles: string[] | undefined, sw: Switches | null, label: (key: string) => string): FeatureRoute[] {
  return sortRoutes(routes.filter((r) => r.space === space && r.nav !== false
    && (!r.roles || !roles || r.roles.some((x) => roles.includes(x))) && switchOn(sw, r.switch)), label);
}

// Per-role space home (registry `home`): the first route declaring one that covers every role this person holds in the
// space (a trainer who is also coordinator keeps the generic home).
export function homeRoute(routes: FeatureRoute[], space: Space, roles: string[], label: (key: string) => string): FeatureRoute | null {
  const mine = SPACE_ROLES[space].filter((r) => roles.includes(r));
  if (!mine.length) return null;
  return sortRoutes(routes.filter((r) => r.space === space && r.home && mine.every((x) => (r.home as string[]).includes(x))), label)[0] ?? null;
}
