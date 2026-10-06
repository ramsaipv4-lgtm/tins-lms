// Feature group "coach": the Coach space (PIN, conversation, timeline, screenshot import) plus the learner's
// portfolio, Heading Strike and the team wall. Screens are code-split; nothing heavy loads with the shell.
import type { FeatureRoute } from '../registry.ts';

export const routes: FeatureRoute[] = [
  { path: '/coach/plan', space: 'coach', label: 'coach.nav.plan', order: 10, roles: ['learner'], home: ['learner'], load: () => import('./Plan.tsx') },
  { path: '/coach/timeline', space: 'coach', label: 'coach.nav.timeline', order: 20, roles: ['learner'], load: () => import('./Timeline.tsx') },
  { path: '/coach/food', space: 'coach', label: 'coach.nav.food', order: 30, roles: ['learner'], load: () => import('./Shot.tsx') },
  { path: '/coach/today', space: 'coach', label: 'coach.nav.today', order: 40, roles: ['learner'], link: '/learn/today', load: () => import('../tele/Today.tsx') },
  { path: '/learn/portfolio', space: 'learn', label: 'coach.nav.portfolio', order: 60, roles: ['learner'], load: () => import('./Portfolio.tsx') },
  { path: '/learn/heading-strike', space: 'learn', label: 'coach.nav.strike', order: 61, roles: ['learner'], switch: 'headingStrike', load: () => import('./Strike.tsx') },
  { path: '/learn/wall', space: 'learn', label: 'coach.nav.wall', order: 62, roles: ['learner'], switch: ['teamBadges', 'celebrationWall'], load: () => import('./Wall.tsx') },
];
