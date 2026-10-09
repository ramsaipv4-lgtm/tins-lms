// Story check (SPEC §13.5 "Story-check rules", D-61, AC-234). Pure: the caller supplies the en.json key set.
// A problem is { where, message }; the CLI prints `<file>: <where>: <message>`.
import { TUNING } from '../tuning.ts';
import { BEAT_TYPES, beatMs } from './runner.ts';
import type { Beat } from '../engine/types.ts';

export interface Problem { where: string; message: string }

export const GAME_IDS = ['syntax-drop', 'maze-coder', 'breakout', 'raid', 'sniper', 'whack-a-bug', 'aftershock', 'garage'] as const;

export interface StoryContext {
  /** keys of packages/web/src/strings/en.json; null skips the key check */
  enKeys: ReadonlySet<string> | null;
  /** cast ids of universe.json (plus anything the caller adds) */
  universeCast: ReadonlySet<string>;
}

const num = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);
const numArr = (v: unknown): boolean => Array.isArray(v) && v.length > 0 && v.every(num);

/** Scene length for the length check only: sum of the beats' ms plus each say's holdMs (default story.sayNominalMs). */
export function sceneLengthMs(beats: readonly Beat[]): number {
  let total = 0;
  for (const b of beats) total += b.t === 'say' ? (typeof b.holdMs === 'number' ? b.holdMs : TUNING['story.sayNominalMs']) : beatMs(b);
  return total;
}

function rangeFor(sceneId: string): { name: string; min: number; max: number } | null {
  if (sceneId === 'prologue') return { name: 'prologue', min: TUNING['story.prologueMinMs'], max: TUNING['story.prologueMaxMs'] };
  if (/\.intro$/.test(sceneId)) return { name: 'intro', min: TUNING['story.introMinMs'], max: TUNING['story.introMaxMs'] };
  if (/\.chapter-end$/.test(sceneId)) return { name: 'chapter-end', min: TUNING['story.chapterEndMinMs'], max: TUNING['story.chapterEndMaxMs'] };
  return null;
}

function checkBeat(b: any, where: string, sceneId: string, cast: ReadonlySet<string>, ctx: StoryContext, out: Problem[]): void {
  if (!b || typeof b !== 'object' || typeof b.t !== 'string') { out.push({ where, message: 'a beat needs a type "t".' }); return; }
  if (!(BEAT_TYPES as readonly string[]).includes(b.t)) { out.push({ where, message: `unknown beat type "${b.t}" (known: ${BEAT_TYPES.join(', ')}).` }); return; }
  const bad = (what: string) => out.push({ where, message: `${b.t} beat needs ${what}.` });
  switch (b.t) {
    case 'say':
      if (typeof b.who !== 'string' || !b.who) bad('a "who"');
      else if (!cast.has(b.who)) out.push({ where, message: `speaker "${b.who}" is not in the universe cast or this game's cast.` });
      if (typeof b.key !== 'string' || !b.key) bad('a "key"');
      else if (ctx.enKeys && !ctx.enKeys.has(b.key)) out.push({ where, message: `text key "${b.key}" is not in en.json.` });
      if (b.holdMs !== undefined && !(num(b.holdMs) && b.holdMs >= 0)) bad('holdMs to be a number of ms');
      break;
    case 'move': if (typeof b.target !== 'string' || !numArr(b.to) || !num(b.ms)) bad('"target", "to" (numbers) and "ms"'); break;
    case 'camera': if (!numArr(b.to) || !num(b.ms)) bad('"to" (numbers) and "ms"'); break;
    case 'wait': if (!num(b.ms) || b.ms < 0) bad('"ms"'); break;
    case 'sfx': case 'music': if (typeof b.name !== 'string' || !b.name) bad('a "name"'); break;
    case 'shake': if (!num(b.ms) || !num(b.power)) bad('"ms" and "power"'); break;
    case 'spawn': if (typeof b.what !== 'string' || !numArr(b.at)) bad('"what" and "at" (numbers)'); break;
    case 'fade': if ((b.to !== 'in' && b.to !== 'out') || !num(b.ms)) bad('"to" ("in" or "out") and "ms"'); break;
    case 'avatar': break;
  }
  if (b.t === 'avatar' && sceneId !== 'prologue') out.push({ where, message: 'the avatar beat is allowed only in the prologue.' });
}

function checkScene(sceneId: string, scene: any, cast: ReadonlySet<string>, ctx: StoryContext, out: Problem[]): void {
  const where = `scene ${sceneId}`;
  if (!scene || !Array.isArray(scene.beats)) { out.push({ where, message: 'a scene is { beats: [...] }.' }); return; }
  scene.beats.forEach((b: any, i: number) => checkBeat(b, `${where}, beat ${i}`, sceneId, cast, ctx, out));
  const avatars = scene.beats.filter((b: any) => b?.t === 'avatar').length;
  if (sceneId === 'prologue' && avatars !== 1) out.push({ where, message: `the prologue needs exactly one avatar beat (found ${avatars}).` });
  const range = rangeFor(sceneId);
  const allKnown = scene.beats.every((b: any) => b && (BEAT_TYPES as readonly string[]).includes(b.t));
  if (range && allKnown) {
    const ms = sceneLengthMs(scene.beats as Beat[]);
    if (ms < range.min || ms > range.max) {
      out.push({ where, message: `${range.name} length ${(ms / 1000).toFixed(1)} s is outside ${range.min / 1000} to ${range.max / 1000} s.` });
    }
  }
}

/** Check universe.json (a file with `cast` and `scenes.prologue`). */
export function checkUniverse(data: any, ctx: StoryContext): Problem[] {
  const out: Problem[] = [];
  if (!data || typeof data !== 'object' || !Array.isArray(data.cast)) { out.push({ where: 'universe', message: 'universe.json needs a "cast" list.' }); return out; }
  const cast = new Set<string>(data.cast.map((c: any) => String(c?.id)));
  if (!data.scenes || typeof data.scenes !== 'object') { out.push({ where: 'scene prologue', message: 'universe.json needs "scenes" with a prologue scene.' }); return out; }
  if (!data.scenes.prologue) out.push({ where: 'scene prologue', message: 'universe.json has no prologue scene.' });
  for (const [id, scene] of Object.entries<any>(data.scenes)) checkScene(id, scene, cast, ctx, out);
  return out;
}

/** Check one game story file (`{ gameId, front, cast, scenes: { intro, 'chapter-end', ... } }`). */
export function checkGameStory(data: any, ctx: StoryContext): Problem[] {
  const out: Problem[] = [];
  if (!data || typeof data !== 'object') return [{ where: 'story', message: 'a story file is a JSON object.' }];
  const gameId = String(data.gameId ?? '');
  if (!(GAME_IDS as readonly string[]).includes(gameId)) out.push({ where: 'story', message: `gameId "${gameId}" is not a known game.` });
  if (!data.front || typeof data.front.nameKey !== 'string') out.push({ where: 'story', message: 'front.nameKey is required.' });
  if (!Array.isArray(data.cast)) out.push({ where: 'story', message: 'a "cast" list is required.' });
  const cast = new Set<string>([...ctx.universeCast, ...(Array.isArray(data.cast) ? data.cast.map((c: any) => String(c?.id)) : [])]);
  const scenes = data.scenes && typeof data.scenes === 'object' ? data.scenes : {};
  for (const need of ['intro', 'chapter-end']) {
    if (!scenes[need]) out.push({ where: `scene ${gameId}.${need}`, message: `the required scene ${need} is missing.` });
  }
  for (const [name, scene] of Object.entries<any>(scenes)) {
    if (name === 'prologue') { out.push({ where: 'scene prologue', message: 'the prologue belongs in universe.json.' }); continue; }
    checkScene(`${gameId}.${name}`, scene, cast, ctx, out);
  }
  return out;
}

/** Is this parsed JSON a story file (scenes at the top level)? */
export function isStoryFile(data: any): boolean {
  return !!data && typeof data === 'object' && !Array.isArray(data) && data.scenes !== undefined;
}
