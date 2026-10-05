// Feature group "admin": class setup, verbal syllabus, college outputs, certificates, switches, Google opt-in.
import type { FeatureRoute } from '../registry.ts';

export const routes: FeatureRoute[] = [
  { path: '/admin/classes', space: 'admin', label: 'admin.nav.classes', order: 10, load: () => import('./ClassSetup.tsx') },
  { path: '/admin/setup', space: 'admin', label: 'admin.nav.classes', nav: false, load: () => import('./ClassSetup.tsx') },
  { path: '/admin/syllabus', space: 'admin', label: 'admin.nav.syllabus', order: 20, load: () => import('./Syllabus.tsx') },
  { path: '/admin/reports', space: 'admin', label: 'admin.nav.reports', order: 30, load: () => import('./Reports.tsx') },
  { path: '/admin/certificates', space: 'admin', label: 'admin.nav.certificates', order: 40, load: () => import('./Certificates.tsx') },
  { path: '/admin/switches', space: 'admin', label: 'admin.nav.switches', order: 50, load: () => import('./Switches.tsx') },
  { path: '/teach/schedule', space: 'teach', label: 'admin.nav.schedule', order: 30, roles: ['trainer', 'substitute', 'coordinator'], load: () => import('./TrainerSchedule.tsx') },
  { path: '/teach/quizzes', space: 'teach', label: 'admin.nav.quizzes', order: 31, roles: ['trainer', 'substitute'], load: () => import('./TrainerQuizzes.tsx') },
  { path: '/teach/feedback', space: 'teach', label: 'admin.nav.feedback', order: 32, roles: ['trainer', 'coordinator'], load: () => import('./Feedback.tsx') },
  { path: '/teach/batch', space: 'teach', label: 'admin.nav.batch', order: 33, roles: ['coordinator', 'trainer'], load: () => import('./Batch.tsx') },
  { path: '/learn/feedback', space: 'learn', label: 'admin.nav.feedback', order: 80, load: () => import('./LearnerFeedback.tsx') },
];
