// Feature group "tele": teleprompter, substitute cover, trainer pack, package library, rehearsal (SPEC 6.3).
import type { FeatureRoute } from '../registry.ts';

export const routes: FeatureRoute[] = [
  { path: '/teach/teleprompter', space: 'teach', label: 'tele.nav.teleprompter', order: 10, roles: ['trainer', 'substitute', 'admin'], load: () => import('./Teleprompter.tsx') },
  { path: '/teach/substitute', space: 'teach', label: 'tele.nav.substitute', nav: false, order: 20, roles: ['trainer', 'admin'], load: () => import('./Substitute.tsx') },
  { path: '/teach/handover', space: 'teach', label: 'tele.nav.handover', order: 21, roles: ['substitute', 'admin'], load: () => import('./Handover.tsx') },
  { path: '/teach/trainer-pack', space: 'teach', label: 'tele.nav.pack', order: 30, roles: ['trainer', 'substitute', 'admin'], load: () => import('./Pack.tsx') },
  { path: '/teach/package-library', space: 'teach', label: 'tele.nav.library', order: 31, roles: ['trainer', 'admin'], load: () => import('./Library.tsx') },
  { path: '/teach/rehearsal', space: 'teach', label: 'tele.nav.rehearsal', order: 32, roles: ['trainer', 'admin'], load: () => import('./Rehearsal.tsx') },
  { path: '/teach/delivery-reports', space: 'teach', label: 'tele.nav.reports', order: 40, roles: ['trainer', 'admin'], load: () => import('./Reports.tsx') },
  { path: '/learn/today', space: 'learn', label: 'tele.nav.today', order: 5, roles: ['learner'], load: () => import('./Today.tsx') },
];
