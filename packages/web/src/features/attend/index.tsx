// Feature group "attend": attendance, wrap-up, messages, trainer notes, digest and lab clusters.
import type { FeatureRoute } from '../registry.ts';

export const routes: FeatureRoute[] = [
  { path: '/teach/attendance', space: 'teach', label: 'attend.nav.attendance', order: 10, roles: ['trainer', 'substitute'], load: () => import('./TAttendance.tsx') },
  { path: '/teach/today', space: 'teach', label: 'attend.nav.today', order: 11, roles: ['trainer'], load: () => import('./WrapUp.tsx') },
  { path: '/teach/roster', space: 'teach', label: 'attend.nav.roster', order: 12, roles: ['trainer', 'substitute'], load: () => import('./Roster.tsx') },
  { path: '/teach/absentees', space: 'teach', label: 'attend.nav.absentees', order: 13, roles: ['trainer', 'substitute'], load: () => import('./Absentees.tsx') },
  { path: '/teach/notes', space: 'teach', label: 'attend.nav.notes', order: 14, roles: ['trainer', 'substitute'], load: () => import('./Notes.tsx') },
  { path: '/teach/digest', space: 'teach', label: 'attend.nav.digest', order: 15, roles: ['trainer', 'substitute'], load: () => import('./Digest.tsx') },
  { path: '/teach/labs', space: 'teach', label: 'attend.nav.labs', order: 16, roles: ['trainer', 'substitute'], load: () => import('./Labs.tsx') },
  { path: '/teach/reports', space: 'teach', label: 'attend.nav.reports', order: 17, roles: ['trainer', 'substitute'], load: () => import('./Reports.tsx') },
  { path: '/learn/attendance', space: 'learn', label: 'attend.nav.attendance', order: 10, roles: ['learner'], load: () => import('./LAttendance.tsx') },
  { path: '/learn/today', space: 'learn', label: 'attend.nav.today', order: 11, roles: ['learner'], load: () => import('./LToday.tsx') },
  { path: '/learn/lab-feedback', space: 'learn', label: 'attend.nav.labFeedback', order: 12, roles: ['learner'], load: () => import('./LFeedback.tsx') },
  { path: '/learn/profile', space: 'learn', label: 'attend.nav.profile', order: 13, roles: ['learner'], load: () => import('./LProfile.tsx') },
  // Stopgap until the learn group's Cards screen lands: shows cards-due-count for the wrap-up journey (AC-89).
  { path: '/learn/day-cards', space: 'learn', label: 'attend.nav.cards', order: 14, roles: ['learner'], load: () => import('./LCards.tsx') },
];
