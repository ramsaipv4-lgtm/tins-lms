// Feature group "shift": Shift engine, sprint rituals, corporate practice, peer review, practice forge (b7-6).
import type { FeatureRoute } from '../registry.ts';
import { startDrillAlert } from './drillalert.ts';

startDrillAlert();

export const routes: FeatureRoute[] = [
  { path: '/learn/shift', space: 'learn', label: 'shift.nav.shift', order: 40, roles: ['learner'], load: () => import('./Shift.tsx') },
  { path: '/learn/standup', space: 'learn', label: 'shift.nav.standup', order: 41, roles: ['learner'], load: () => import('./Standup.tsx') },
  { path: '/learn/poker', space: 'learn', label: 'shift.nav.poker', order: 42, roles: ['learner'], load: () => import('./Poker.tsx') },
  { path: '/learn/retro', space: 'learn', label: 'shift.nav.retro', order: 43, roles: ['learner'], load: () => import('./Retro.tsx') },
  { path: '/learn/tickets', space: 'learn', label: 'shift.nav.tickets', order: 44, roles: ['learner'], load: () => import('./Tickets.tsx') },
  { path: '/learn/deployments', space: 'learn', label: 'shift.nav.deployments', order: 45, roles: ['learner'], load: () => import('./Deploys.tsx') },
  { path: '/learn/templates', space: 'learn', label: 'shift.nav.templates', order: 46, roles: ['learner'], load: () => import('./Templates.tsx') },
  { path: '/learn/demo-day', space: 'learn', label: 'shift.nav.demo', order: 47, roles: ['learner'], load: () => import('./Demo.tsx') },
  { path: '/learn/key-drill', space: 'learn', label: 'shift.nav.drill', order: 48, roles: ['learner'], load: () => import('./Drill.tsx') },
  { path: '/learn/reviews', space: 'learn', label: 'shift.nav.reviews', order: 6, roles: ['learner'], load: () => import('./Reviews.tsx') },
  { path: '/learn/lab', space: 'learn', label: 'shift.nav.lab', order: 50, roles: ['learner'], load: () => import('./Lab.tsx') },
  { path: '/learn/forge', space: 'learn', label: 'shift.nav.forge', order: 51, roles: ['learner'], load: () => import('./Forge.tsx') },
  { path: '/learn/accounts', space: 'learn', label: 'shift.nav.accounts', order: 1.5, roles: ['learner'], load: () => import('./Accounts.tsx') },
  { path: '/teach/change-requests', space: 'teach', label: 'shift.nav.approvals', order: 40, roles: ['trainer'], load: () => import('./Approvals.tsx') },
  { path: '/teach/standup', space: 'teach', label: 'shift.nav.standup', order: 42, roles: ['trainer'], load: () => import('./TeachStandup.tsx') },
  { path: '/teach/poker', space: 'teach', label: 'shift.nav.poker', order: 44, roles: ['trainer'], load: () => import('./Poker.tsx') },
  { path: '/teach/drills', space: 'teach', label: 'shift.nav.drills', order: 43, roles: ['trainer'], load: () => import('./TeachDrills.tsx') },
  { path: '/teach/class-settings', space: 'teach', label: 'shift.nav.settings', order: 41, roles: ['trainer'], load: () => import('./ClassSettings.tsx') },
];
