// Story mode (G-4): one switch, presentation only. The hook reads the effective switch for the learner's class.
import { useEffect, useState } from 'react';
import { api } from '../../app/api.ts';

export interface CoachSwitches { headingStrike: boolean; storyMode: boolean; teamBadges: boolean; celebrationWall: boolean }
export function useSwitches(): CoachSwitches | null {
  const [s, setS] = useState<CoachSwitches | null>(null);
  useEffect(() => { api<CoachSwitches>('/api/coach/switches').then(setS).catch(() => setS({ headingStrike: true, storyMode: false, teamBadges: true, celebrationWall: true })); }, []);
  return s;
}
export function useStoryMode(): boolean { return useSwitches()?.storyMode === true; }
