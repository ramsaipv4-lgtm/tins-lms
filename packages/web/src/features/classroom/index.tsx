// Feature group "classroom": appeals, doubts, drop switch, accommodations, content improvement.
// Nav orders below 10 on purpose: these screens share words with other groups' labels (roster, profile, packages),
// and the earliest entry wins when a journey opens "the first link matching".
import type { FeatureRoute } from '../registry.ts';
import { mountDroppedNotice } from './notice.ts';

mountDroppedNotice();

export const routes: FeatureRoute[] = [
  { path: '/learn/grades', space: 'learn', label: 'classroom.nav.grades', order: 20, roles: ['learner'], load: () => import('./LGrades.tsx') },
  { path: '/learn/doubts', space: 'learn', label: 'classroom.nav.doubts', order: 21, roles: ['learner'], load: () => import('./LDoubts.tsx') },
  { path: '/learn/accommodations', space: 'learn', label: 'classroom.nav.accommodations', order: 9, roles: ['learner'], load: () => import('./LSettings.tsx') },
  { path: '/teach/appeals', space: 'teach', label: 'classroom.nav.appeals', order: 20, roles: ['trainer'], load: () => import('./TAppeals.tsx') },
  { path: '/teach/doubts', space: 'teach', label: 'classroom.nav.doubts', order: 21, roles: ['trainer'], load: () => import('./TDoubts.tsx') },
  { path: '/teach/class-roster', space: 'teach', label: 'classroom.nav.roster', order: 11.5, roles: ['trainer'], load: () => import('./TRoster.tsx') },
  { path: '/teach/item-analysis', space: 'teach', label: 'classroom.nav.itemAnalysis', order: 25, roles: ['trainer', 'substitute'], load: () => import('./TAnalytics.tsx') },
  { path: '/teach/misconceptions', space: 'teach', label: 'classroom.nav.misconceptions', order: 26, roles: ['trainer', 'substitute'], load: () => import('./TMisconceptions.tsx') },
  { path: '/teach/packages', space: 'teach', label: 'classroom.nav.packages', order: 29, roles: ['trainer'], load: () => import('./TPackages.tsx') },
  { path: '/admin/accommodations', space: 'admin', label: 'classroom.nav.accommodations', order: 24, roles: ['admin'], load: () => import('./AAccommodations.tsx') },
];
