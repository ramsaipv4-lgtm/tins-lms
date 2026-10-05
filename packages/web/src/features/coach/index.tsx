// Feature group "coach": the Coach space (PIN, conversation, timeline, screenshot import) plus the learner's
// portfolio, Heading Strike and the team wall. Screens are code-split; nothing heavy loads with the shell.
import type { FeatureRoute } from '../registry.ts';

export const routes: FeatureRoute[] = [
  { path: '/coach/plan', space: 'coach', label: 'coach.nav.plan', order: 10, roles: ['learner'], load: () => import('./Plan.tsx') },
  { path: '/coach/timeline', space: 'coach', label: 'coach.nav.timeline', order: 20, roles: ['learner'], load: () => import('./Timeline.tsx') },
  { path: '/coach/food', space: 'coach', label: 'coach.nav.food', order: 30, roles: ['learner'], load: () => import('./Shot.tsx') },
  { path: '/coach/today', space: 'coach', label: 'coach.nav.today', order: 40, roles: ['learner'], load: () => import('./Enter.tsx').then((m) => ({ default: m.ToToday })) },
  { path: '/learn/coach', space: 'learn', label: 'coach.nav.enter', order: 59, roles: ['learner'], load: () => import('./Enter.tsx') },
  { path: '/learn/portfolio', space: 'learn', label: 'coach.nav.portfolio', order: 60, roles: ['learner'], load: () => import('./Portfolio.tsx') },
  { path: '/learn/heading-strike', space: 'learn', label: 'coach.nav.strike', order: 61, roles: ['learner'], load: () => import('./Strike.tsx') },
  { path: '/learn/wall', space: 'learn', label: 'coach.nav.wall', order: 62, roles: ['learner'], load: () => import('./Wall.tsx') },
];
