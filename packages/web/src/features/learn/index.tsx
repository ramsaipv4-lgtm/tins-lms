// Feature group "learn": learner day screens (catch-up, cards, error notebook, quick-learn, explain-it-back,
// exit ticket) and the first-run screen. The trainer's exit-ticket tally lives in the teach space.
import type { FeatureRoute } from '../registry.ts';

export const routes: FeatureRoute[] = [
  { path: '/learn/catch-up', space: 'learn', label: 'learn.nav.catchUp', order: 1, roles: ['learner'], load: () => import('./Catchup.tsx') },
  { path: '/learn/cards', space: 'learn', label: 'learn.nav.cards', order: 7.5, roles: ['learner'], load: () => import('./Cards.tsx') },
  { path: '/learn/error-notebook', space: 'learn', label: 'learn.nav.errors', order: 3, roles: ['learner'], load: () => import('./Errors.tsx') },
  { path: '/learn/quick-learn', space: 'learn', label: 'learn.nav.quickLearn', order: 4, roles: ['learner'], load: () => import('./QuickLearn.tsx') },
  { path: '/learn/explain', space: 'learn', label: 'learn.nav.explain', order: 5, roles: ['learner'], load: () => import('./Explain.tsx') },
  { path: '/learn/exit-ticket', space: 'learn', label: 'learn.nav.exitTicket', order: 6, roles: ['learner'], load: () => import('./ExitTicket.tsx') },
  { path: '/teach/exit-ticket', space: 'teach', label: 'learn.nav.exitTicket', order: 30, roles: ['trainer', 'substitute'], load: () => import('./ExitTally.tsx') },
];

// First run (AC-155). A fresh app has no session, and the shell shows its sign-in screen at "/" and sends every
// space route there, so a feature route cannot be reached yet. The group therefore mounts its own first-run
// screen in front of the shell, only when "/" is opened with no session. The screen is loaded on demand.
async function maybeFirstRun(): Promise<void> {
  if (typeof document === 'undefined' || location.pathname !== '/') return;
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (res.status !== 401) return;
  } catch { return; } // offline: the installed app keeps showing the shell
  const [{ createRoot }, { createElement }, mod] = await Promise.all([import('react-dom/client'), import('react'), import('./FirstRun.tsx')]);
  if (location.pathname !== '/') return;
  const host = document.createElement('div');
  host.id = 'learn-first-run-host';
  document.body.appendChild(host);
  document.documentElement.classList.add('learn-first-run');
  const style = document.createElement('style');
  style.textContent = '.learn-first-run #main{display:none}#learn-first-run-host{max-width:720px;margin:0 auto;padding:16px}';
  document.head.appendChild(style);
  createRoot(host).render(createElement(mod.default));
}
if (typeof document !== 'undefined') {
  const run = () => { void maybeFirstRun(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
}
