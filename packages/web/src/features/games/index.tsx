// Feature group "games": the arcade, the picker, the deep-link route that mounts a game, and the team XP on the
// celebration wall (SPEC §13.3, D-49). Screens load on demand; the engine, the story player and each game are separate
// chunks (vite.config.ts, D-57) that are requested only after a game or the prologue opens.
import type { FeatureRoute } from '../registry.ts';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';

export const routes: FeatureRoute[] = [
  { path: '/learn/games', space: 'learn', label: 'games.nav', order: 70, roles: ['learner'], switch: 'games', load: () => import('./Arcade.tsx') },
  { path: '/learn/games/:gameId', space: 'learn', label: 'games.nav', nav: false, roles: ['learner'], load: () => import('./Picker.tsx') },
  { path: '/learn/games/:gameId/:packId/:levelId', space: 'learn', label: 'games.nav', nav: false, roles: ['learner'], load: () => import('./Play.tsx') },
];

// The celebration wall (coach group) lists teams as `wall-team-<teamId>`. AC-206 wants each team's XP there too, and only the
// team's average (teamScore). The wall belongs to another group, so this adds one line to each team entry after it renders.
if (typeof document !== 'undefined') {
  let teams: Promise<{ teamId: string; xp: number }[]> | null = null;
  let queued = false;
  const decorate = () => {
    queued = false;
    if (location.pathname !== '/learn/wall') { teams = null; return; }
    const items = [...document.querySelectorAll<HTMLElement>('[data-testid^="wall-team-"]:not([data-games-xp])')];
    if (!items.length) return;
    for (const li of items) li.setAttribute('data-games-xp', '');
    teams ??= api<{ teams: { teamId: string; xp: number }[] }>('/api/games/teams').then((r) => r.teams, () => []);
    void teams.then((list) => {
      for (const li of items) {
        const id = (li.dataset.testid ?? '').slice('wall-team-'.length);
        const tm = list.find((x) => x.teamId === id);
        if (!tm || li.querySelector('[data-games-team-xp]')) continue;
        const p = document.createElement('p');
        p.setAttribute('data-games-team-xp', '');
        p.setAttribute('data-testid', `wall-xp-${id}`);
        p.textContent = t('games.wall.xp', { n: tm.xp });
        li.appendChild(p);
      }
    });
  };
  const schedule = () => { if (!queued) { queued = true; queueMicrotask(decorate); } };
  const start = () => { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); schedule(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}
