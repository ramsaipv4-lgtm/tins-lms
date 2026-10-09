// The arcade rules (SPEC §13.3 Routes, D-49, D-55): which games and packs a learner sees. Pure functions used by the
// hub routes and by the web screens, so both agree.
import { TUNING } from '../tuning.ts';
import type { Pack, PackLevel } from './types.ts';

export const GAME_SWITCH: Record<string, string> = {
  'syntax-drop': 'game.syntaxDrop', 'maze-coder': 'game.mazeCoder', breakout: 'game.breakout', raid: 'game.raid',
  sniper: 'game.sniper', 'whack-a-bug': 'game.whackABug', aftershock: 'game.aftershock', garage: 'game.garage',
};
export const GAME_NAMES: Record<string, string> = {
  'syntax-drop': 'Syntax Drop', 'maze-coder': 'Maze Coder', breakout: 'Breakout', raid: 'Seal the Beast',
  sniper: 'Snippet Sniper', 'whack-a-bug': 'Whack-a-Bug', aftershock: 'Aftershock', garage: 'Complexity Garage',
};
/** Games that have a playable module in this build. A game appears in the arcade only when it is listed here. */
export const PLAYABLE_GAMES = ['syntax-drop', 'sniper', 'whack-a-bug', 'aftershock'] as const;

export type Switches = Record<string, boolean>;
const on = (sw: Switches, name: string): boolean => sw[name] !== false; // an unknown or missing switch means the default: on

/** `games` (the whole arcade) is on. */
export const arcadeOn = (sw: Switches): boolean => on(sw, 'games');
/** Available only when both `games` and the game's own switch are on (D-49). */
export function gameAvailable(gameId: string, sw: Switches): boolean {
  const own = GAME_SWITCH[gameId];
  return !!own && arcadeOn(sw) && on(sw, own);
}

// ---- release on the class day (D-55) ----
/** UTC ms of a local wall-clock time in an IANA zone (the program's time zone). */
export function zonedTime(date: string, time: string, timeZone: string): number {
  const asUtc = Date.parse(`${date}T${time.length === 5 ? time + ':00' : time}Z`);
  if (!Number.isFinite(asUtc)) return NaN;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(asUtc));
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const shown = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
    return asUtc - (shown - asUtc);
  } catch { return asUtc; }
}

/** The moment a pack with this `day` is released: the start of class.schedule[day] in the program's zone. null = no such day. */
export function packReleaseAt(schedule: readonly { date?: string; start?: string }[] | undefined, day: number, timeZone = 'Asia/Kolkata'): number | null {
  const entry = schedule?.[day];
  if (!entry?.date) return null;
  const t = zonedTime(entry.date, entry.start ?? '00:00', timeZone);
  return Number.isFinite(t) ? t : null;
}
export function packReleased(schedule: readonly { date?: string; start?: string }[] | undefined, day: number, now: number, timeZone?: string): boolean {
  const at = packReleaseAt(schedule, day, timeZone);
  return at !== null && now >= at;
}

// ---- rank and locked levels (sniper, §13.7.2) ----
export type Rank = 'Recruit' | 'Marksman' | 'Sharpshooter' | 'Ghost';
export function sniperRank(claimed: number): Rank {
  if (claimed >= TUNING['sniper.rankGhost']) return 'Ghost';
  if (claimed >= TUNING['sniper.rankSharpshooter']) return 'Sharpshooter';
  if (claimed >= TUNING['sniper.rankMarksman']) return 'Marksman';
  return 'Recruit';
}
export interface ResultRef { gameId: string; packId: string; claimed?: number }
/** Rank is the sum of gameResult.claimed over the learner's results for the pack. */
export const claimedFor = (results: readonly ResultRef[], gameId: string, packId: string): number =>
  results.filter((r) => r.gameId === gameId && r.packId === packId).reduce((n, r) => n + (Number(r.claimed) || 0), 0);

/** A level is locked when the game says so: the sniper boss level (it has `plates`) needs Sharpshooter. */
export function levelLocked(pack: Pack, level: PackLevel, results: readonly ResultRef[]): boolean {
  if (pack.game === 'sniper' && Array.isArray(level.plates) && level.plates.length > 0) {
    return claimedFor(results, pack.game, pack.id) < TUNING['sniper.rankSharpshooter'];
  }
  return false;
}

export interface PackSummary { id: string; title: string; day: number; levels: { id: string; title: string; locked: boolean }[] }
export interface StoredPack { gameId: string; packId: string; day: number; pack: Pack }

/** The tiles for the arcade: only available games, only released packs, and only games that have a pack. */
export function arcadeTiles(args: {
  switches: Switches; packs: readonly StoredPack[]; results: readonly (ResultRef & { at?: number; score?: number; stars?: number })[];
  schedule: readonly { date?: string; start?: string }[] | undefined; now: number; timeZone?: string; playable?: readonly string[];
}): { gameId: string; packs: PackSummary[]; lastScore?: number; stars?: number }[] {
  const playable = args.playable ?? PLAYABLE_GAMES;
  const tiles: { gameId: string; packs: PackSummary[]; lastScore?: number; stars?: number }[] = [];
  for (const gameId of playable) {
    if (!gameAvailable(gameId, args.switches)) continue;
    const packs = args.packs
      .filter((p) => p.gameId === gameId && packReleased(args.schedule, p.day, args.now, args.timeZone))
      .map((p) => ({
        id: p.packId, title: p.pack.title, day: p.day,
        levels: p.pack.levels.map((l) => ({ id: l.id, title: l.title, locked: levelLocked(p.pack, l, args.results) })),
      }))
      .sort((a, b) => a.day - b.day || (a.id < b.id ? -1 : 1));
    if (packs.length === 0) continue;
    const mine = args.results.filter((r) => r.gameId === gameId && r.at !== undefined);
    const last = mine.length ? mine.reduce((a, b) => ((b.at ?? 0) >= (a.at ?? 0) ? b : a)) : null;
    tiles.push({ gameId, packs, ...(last ? { lastScore: last.score, stars: last.stars } : {}) });
  }
  return tiles;
}
