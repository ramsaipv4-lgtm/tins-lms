// Feature group "board": the trainer's whiteboard (SPEC D-7, AC-97). The board code is big, so it sits behind load()
// and is fetched only when /teach/board opens (AC-101); nothing in this file imports it.
import type { FeatureRoute } from '../registry.ts';

export const routes: FeatureRoute[] = [
  { path: '/teach/board', space: 'teach', label: 'board.nav', order: 25, roles: ['trainer', 'substitute', 'admin'], load: () => import('./Board.tsx') },
];
