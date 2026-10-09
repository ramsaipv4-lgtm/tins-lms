// The `player` document (SPEC §13.6, §13.11): XP and coins are caches over gameResults and purchases, recomputed on
// every write, so they persist across sessions and devices and merge safely. Pure functions; no DOM, no Node.
export interface Purchase { itemId: string; price: number; at: number }
export interface Avatar { look: string; color: string; nameTag: string }
export interface PlayerDoc {
  type: 'player'; id: string; schema: number; updatedAt: number; updatedBy: string;
  xp: number; coins: number;
  cosmetics: string[]; gear: string[]; purchases: Purchase[];
  seen: { prologue: boolean; intro: Record<string, true>; scenes: Record<string, true> };
  avatar?: Avatar;
  timingOffsetMs: number;
  settings: { autoAdvance: boolean };
  [field: string]: unknown;
}
export interface ResultLike { xp?: number; coins?: number }

export const TIMING_OFFSET_MAX = 150; // syntaxDrop.calibrationMaxOffsetMs

export const playerId = (personKey: string): string => `player:${personKey}`;

export function emptyPlayer(personKey: string, now = 0, schema = 1): PlayerDoc {
  return {
    type: 'player', id: playerId(personKey), schema, updatedAt: now, updatedBy: personKey, xp: 0, coins: 0,
    cosmetics: [], gear: [], purchases: [], seen: { prologue: false, intro: {}, scenes: {} },
    timingOffsetMs: 0, settings: { autoAdvance: false },
  };
}

const clampOffset = (n: unknown): number => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(-TIMING_OFFSET_MAX, Math.min(TIMING_OFFSET_MAX, v)) : 0;
};
const strList = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.map(String))].sort() : []);
const trueMap = (v: unknown): Record<string, true> => {
  const out: Record<string, true> = {};
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v as object)) if (x) out[k] = true;
  return out;
};
function purchaseList(v: unknown): Purchase[] {
  if (!Array.isArray(v)) return [];
  const byKey = new Map<string, Purchase>();
  for (const p of v) {
    if (!p || typeof p !== 'object') continue;
    const q = { itemId: String((p as any).itemId), price: Number((p as any).price) || 0, at: Number((p as any).at) || 0 };
    byKey.set(`${q.itemId}@${q.at}`, q);
  }
  return [...byKey.values()].sort((a, b) => a.at - b.at || (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0));
}

/** Fill every field with its default and clamp the offset; keeps unknown fields. */
export function normalizePlayer(doc: Partial<PlayerDoc> | null | undefined, personKey: string, now = 0, schema = 1): PlayerDoc {
  const base = emptyPlayer(personKey, now, schema);
  const d: any = doc ?? {};
  const out: PlayerDoc = {
    ...d,
    type: 'player', id: playerId(personKey), schema: d.schema ?? schema, updatedAt: Number(d.updatedAt ?? now) || 0, updatedBy: String(d.updatedBy ?? personKey),
    xp: Number(d.xp) || 0, coins: Number(d.coins) || 0,
    cosmetics: strList(d.cosmetics), gear: strList(d.gear), purchases: purchaseList(d.purchases),
    seen: { prologue: !!d.seen?.prologue, intro: trueMap(d.seen?.intro), scenes: trueMap(d.seen?.scenes) },
    timingOffsetMs: clampOffset(d.timingOffsetMs ?? base.timingOffsetMs),
    settings: { autoAdvance: !!d.settings?.autoAdvance },
  };
  if (d.avatar && typeof d.avatar === 'object') out.avatar = { look: String(d.avatar.look ?? ''), color: String(d.avatar.color ?? ''), nameTag: String(d.avatar.nameTag ?? '') };
  else delete out.avatar;
  return out;
}

/** xp = sum of gameResult.xp; coins = sum of gameResult.coins minus sum of purchases[].price. */
export function totals(results: readonly ResultLike[], purchases: readonly Purchase[]): { xp: number; coins: number } {
  let xp = 0, coins = 0;
  for (const r of results) { xp += Number(r.xp) || 0; coins += Number(r.coins) || 0; }
  for (const p of purchases) coins -= Number(p.price) || 0;
  return { xp, coins };
}

/** Recompute the caches. Returns the same object when nothing changes. */
export function withCaches<T extends PlayerDoc>(player: T, results: readonly ResultLike[]): T {
  const t = totals(results, player.purchases);
  return t.xp === player.xp && t.coins === player.coins ? player : { ...player, xp: t.xp, coins: t.coins };
}

const later = (a: PlayerDoc, b: PlayerDoc): PlayerDoc => (a.updatedAt !== b.updatedAt ? (a.updatedAt > b.updatedAt ? a : b) : a.updatedBy >= b.updatedBy ? a : b);

/** Merge two revisions of a player (commutative, associative, idempotent). Flags and owned items are unioned; profile fields are latest-wins.
 *  The caches come from the latest revision: the caller recomputes them from the results with withCaches(). */
export function mergePlayers(a: PlayerDoc, b: PlayerDoc): PlayerDoc {
  const w = later(a, b);
  const out: PlayerDoc = {
    ...w,
    cosmetics: strList([...a.cosmetics, ...b.cosmetics]),
    gear: strList([...a.gear, ...b.gear]),
    purchases: purchaseList([...a.purchases, ...b.purchases]),
    seen: {
      prologue: a.seen.prologue || b.seen.prologue,
      intro: { ...a.seen.intro, ...b.seen.intro },
      scenes: { ...a.seen.scenes, ...b.seen.scenes },
    },
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
  const avatar = w.avatar ?? (w === a ? b : a).avatar;
  if (avatar) out.avatar = avatar;
  return out;
}

export interface PlayerPatch {
  seen?: { prologue?: boolean; intro?: Record<string, boolean>; scenes?: Record<string, boolean> };
  avatar?: Partial<Avatar>;
  timingOffsetMs?: number;
  settings?: { autoAdvance?: boolean };
}

/** Apply a learner's change. XP, coins, purchases, cosmetics and gear are not settable here. */
export function patchPlayer(player: PlayerDoc, patch: PlayerPatch, now: number, by: string): PlayerDoc {
  const next: PlayerDoc = { ...player, seen: { prologue: player.seen.prologue, intro: { ...player.seen.intro }, scenes: { ...player.seen.scenes } }, settings: { ...player.settings } };
  if (patch.seen?.prologue) next.seen.prologue = true;
  for (const [k, v] of Object.entries(patch.seen?.intro ?? {})) if (v) next.seen.intro[k] = true;
  for (const [k, v] of Object.entries(patch.seen?.scenes ?? {})) if (v) next.seen.scenes[k] = true;
  if (patch.avatar) next.avatar = { look: String(patch.avatar.look ?? player.avatar?.look ?? 'block'), color: String(patch.avatar.color ?? player.avatar?.color ?? 'teal'), nameTag: String(patch.avatar.nameTag ?? player.avatar?.nameTag ?? '').slice(0, 24) };
  if (patch.timingOffsetMs !== undefined) next.timingOffsetMs = clampOffset(patch.timingOffsetMs);
  if (patch.settings && typeof patch.settings.autoAdvance === 'boolean') next.settings.autoAdvance = patch.settings.autoAdvance;
  next.updatedAt = now; next.updatedBy = by;
  return next;
}
