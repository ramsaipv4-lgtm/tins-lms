// Feature group "attend": attendance, wrap-up, messages, trainer notes, digest and lab clusters.
import type { FeatureRoute } from '../registry.ts';

export const routes: FeatureRoute[] = [
  { path: '/teach/attendance', space: 'teach', label: 'attend.nav.attendance', order: 10, roles: ['trainer', 'substitute'], load: () => import('./TAttendance.tsx') },
  { path: '/teach/today', space: 'teach', label: 'attend.nav.today', order: 5, roles: ['trainer'], load: () => import('./WrapUp.tsx') },
  { path: '/teach/roster', space: 'teach', label: 'attend.nav.roster', order: 12, roles: ['trainer', 'substitute'], load: () => import('./Roster.tsx') },
  { path: '/teach/absentees', space: 'teach', label: 'attend.nav.absentees', order: 13, roles: ['trainer', 'substitute'], load: () => import('./Absentees.tsx') },
  { path: '/teach/notes', space: 'teach', label: 'attend.nav.notes', order: 14, roles: ['trainer', 'substitute'], load: () => import('./Notes.tsx') },
  { path: '/teach/digest', space: 'teach', label: 'attend.nav.digest', order: 15, roles: ['trainer', 'substitute'], load: () => import('./Digest.tsx') },
  { path: '/teach/labs', space: 'teach', label: 'attend.nav.labs', order: 16, roles: ['trainer', 'substitute'], load: () => import('./Labs.tsx') },
  // Integration (b7-3 + b7-4): one 'Delivery reports' page (tele) embeds this draft list.
  { path: '/teach/draft-reports', space: 'teach', label: 'attend.nav.reports', nav: false, order: 17, roles: ['trainer', 'substitute'], load: () => import('./Reports.tsx') },
  { path: '/learn/attendance', space: 'learn', label: 'attend.nav.attendance', order: 10, roles: ['learner'], load: () => import('./LAttendance.tsx') },
  // Integration: one learner 'Today' page (tele) embeds this wrap-up panel.
  { path: '/learn/wrapup-today', space: 'learn', label: 'attend.nav.today', nav: false, order: 11, roles: ['learner'], load: () => import('./LToday.tsx') },
  { path: '/learn/lab-feedback', space: 'learn', label: 'attend.nav.labFeedback', order: 12, roles: ['learner'], load: () => import('./LFeedback.tsx') },
  { path: '/learn/profile', space: 'learn', label: 'attend.nav.profile', order: 13, roles: ['learner'], load: () => import('./LProfile.tsx') },
];
