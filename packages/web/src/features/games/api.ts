// REST calls of the games feature (server: routes/features/games.ts). Results that cannot be sent (offline) wait in a
// small local outbox and go out the next time the arcade opens; the key makes a repeat harmless.
import { api, ApiError } from '../../app/api.ts';

export interface PlayerView {
  xp: number; coins: number;
  seen: { prologue: boolean; intro: Record<string, true>; scenes: Record<string, true> };
  avatar: { look: string; color: string; nameTag: string } | null;
  timingOffsetMs: number; settings: { autoAdvance: boolean }; cosmetics: string[]; gear: string[];
}
export interface TileView {
  gameId: string; lastScore?: number; stars?: number;
  packs: { id: string; title: string; day: number; levels: { id: string; title: string; locked: boolean }[] }[];
}
export interface ArcadeView {
  classKey: string; now: number; arcadeOn: boolean; switches: Record<string, boolean>; tiles: TileView[]; player: PlayerView; scenes: string[];
}
export interface PackView {
  pack: any; classKey: string; seedSalt: string; levels: { id: string; locked: boolean }[]; player: PlayerView;
}

export const loadArcade = (): Promise<ArcadeView> => api('/api/games/arcade');
export const loadPack = (gameId: string, packId: string): Promise<PackView> => api(`/api/games/pack/${encodeURIComponent(gameId)}/${encodeURIComponent(packId)}`);
export const loadTeams = (): Promise<{ teams: { teamId: string; xp: number }[] }> => api('/api/games/teams');
export const savePlayer = (patch: unknown): Promise<{ player: PlayerView }> => api('/api/games/player', { method: 'PUT', body: patch });

const KEY = 'lms-games-outbox';
type Pending = { body: any };
function readBox(): Pending[] { try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
function writeBox(list: Pending[]): void { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage may be blocked */ } }

/** Send one finished round. A network failure queues it (and rejects, so the results screen says "will be saved"); a refusal does not queue. */
export async function submitResult(body: any): Promise<{ gameResult: any; player: PlayerView }> {
  try {
    return await api('/api/games/results', { method: 'POST', body });
  } catch (e) {
    if (!(e instanceof ApiError)) writeBox([...readBox(), { body }]);
    throw e;
  }
}
export async function flushOutbox(): Promise<void> {
  const box = readBox();
  if (!box.length) return;
  const left: Pending[] = [];
  for (const p of box) {
    try { await api('/api/games/results', { method: 'POST', body: p.body }); }
    catch (e) { if (!(e instanceof ApiError)) left.push(p); }
  }
  writeBox(left);
}

/** Test mode (meta tag) and the D-51 flags the screens need before the engine loads. */
export function testMode(): boolean {
  try { return document.querySelector('meta[name="lms-test-mode"]')?.getAttribute('content') === '1'; } catch { return false; }
}
export function storyOff(): boolean {
  return testMode() && new URLSearchParams(location.search).get('story') === 'off';
}
