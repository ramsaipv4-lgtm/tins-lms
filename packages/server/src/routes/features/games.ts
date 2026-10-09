// Server routes for the web feature group "games" (SPEC §13, D-46, D-47, D-49, D-55, D-56, D-59, D-62).
//   GET  /api/games/arcade                      tiles for the learner's class (switches, released packs, own last scores), the player
//   GET  /api/games/pack/:gameId/:packId        one released pack, with its locked levels
//   POST /api/games/results                     one finished round: gameResult, cards, error notes, mastery, player caches
//   PUT  /api/games/player                      seen flags, avatar, timing offset, settings
//   GET  /api/games/teams                       team XP (teamScore) of the learner's class: team level only (AC-168)
// Also exported for content.ts and testmode.ts: gamesGate (check G9-games), storeGamePacks, importSamplePacks.
// Packs live in the private database as `gamepack:<classKey>:<gameId>:<packId>` and are served only after their `day` starts,
// so a pack's answers do not reach a learner early. The hub recomputes `teamScore` documents within seconds of any
// gameResult or player write (changes feeds on the person databases, plus a scan for new ones).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { isOn, switchDefaults } from '../../../../core/src/index.ts';
import { TUNING } from '../../../../games/src/tuning.ts';
import { checkPack } from '../../../../games/src/check/packs.ts';
import { loadSnek } from '../../../../games/src/check/snek.ts';
import { arcadeOn, arcadeTiles, gameAvailable, levelLocked, packReleased, type StoredPack } from '../../../../games/src/engine/arcade.ts';
import { loadResults, personDb, recordRound, refreshPlayer } from '../../../../games/src/engine/results.ts';
import { normalizePlayer, patchPlayer, withCaches, playerId } from '../../../../games/src/engine/player.ts';
import type { Pack } from '../../../../games/src/engine/types.ts';

const PACK_PATH = /(?:^|\/)games\/([a-z0-9][a-z0-9-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*)\.json$/;

export interface GateCheck { id: string; pass: boolean; waived: boolean; detail: string }

/** The content-gate check G9-games (D-55): the pack check on every `<track>/games/<gameId>/<packId>.json`; passes when there are none; never waivable. */
export async function gamesGate(files: Record<string, string>): Promise<GateCheck> {
  const paths = Object.keys(files).filter((p) => PACK_PATH.test(p)).sort();
  if (paths.length === 0) return { id: 'G9-games', pass: true, waived: false, detail: 'no game packs' };
  const snek = await loadSnek();
  const problems: string[] = [];
  for (const path of paths) {
    const [, folderGame, stem] = PACK_PATH.exec(path)!;
    let pack: any;
    try { pack = JSON.parse(files[path]); } catch (e: any) { problems.push(`${path}: file: not valid JSON.`); continue; }
    if (pack && typeof pack === 'object' && typeof pack.game === 'string' && pack.game !== folderGame) problems.push(`${path}: pack: game "${pack.game}" does not match the folder ${folderGame}.`);
    if (pack && typeof pack === 'object' && typeof pack.id === 'string' && pack.id !== stem) problems.push(`${path}: pack: id "${pack.id}" does not match the file name ${stem}.json.`);
    for (const p of checkPack(pack, snek)) problems.push(`${path}: ${p.where}: ${p.message}`);
  }
  return problems.length
    ? { id: 'G9-games', pass: false, waived: false, detail: problems.join('\n') }
    : { id: 'G9-games', pass: true, waived: false, detail: `${paths.length} game pack(s)` };
}

export function register(app: any, ctx: any): void {
  const { store, ids, http } = ctx;
  const priv: string = store.priv;
  const classKeys = (): string[] => store.names().filter((n: string) => n.startsWith('class-')).map((n: string) => n.slice(6));
  const packDocId = (classKey: string, gameId: string, packId: string) => `gamepack:${classKey}:${gameId}:${packId}`;

  // A game is offered only when this build contains its code (packages/games/src/games/<gameId>/index.ts): a pack for a game
  // that is not built yet gets no tile and its deep link says "not available".
  // LMS_GAMES_PLAYABLE (comma list) overrides the folder scan; the unit tests use it to run without a game module.
  function builtGames(): string[] {
    if (process.env.LMS_GAMES_PLAYABLE !== undefined) return process.env.LMS_GAMES_PLAYABLE.split(',').map((x) => x.trim()).filter(Boolean);
    const root = join(ctx.config.repoRoot, 'packages', 'games', 'src', 'games');
    try { return readdirSync(root).filter((n) => existsSync(join(root, n, 'index.ts'))); } catch { return []; }
  }

  // ---- packs of a class ----
  ctx.hooks.gamesStorePacks = storePacks;
  async function storePacks(classKey: string, items: { pack: Pack; day?: number }[], source: string): Promise<number> {
    for (const { pack, day } of items) {
      const d = day ?? pack.day;
      await store.put(priv, { type: 'gamePack', id: packDocId(classKey, pack.game, pack.id), classKey, gameId: pack.game, packId: pack.id, day: d, pack: { ...pack, day: d }, source, updatedAt: ctx.clock.now() });
    }
    return items.length;
  }
  async function classPacks(classKey: string): Promise<StoredPack[]> {
    const docs = await store.list(priv, `gamepack:${classKey}:`);
    return docs.map((d: any) => ({ gameId: d.gameId, packId: d.packId, day: d.day, pack: d.pack }));
  }

  // ---- the learner's class ----
  async function enrolment(db: string, personKey: string) {
    return (await store.list(db, 'enrolment:')).find((e: any) => ids.keyOf(String(e.personId ?? e.id)) === personKey) ?? null;
  }
  async function myClass(c: any) {
    const s = c.get('session');
    const me = ids.keyOf(s.personId);
    for (const key of classKeys()) {
      const doc = await store.get(`class-${key}`, `class:${key}`);
      if (!doc) continue;
      const en = await enrolment(`class-${key}`, me);
      if (en && en.status !== 'dropped') return { key, db: `class-${key}`, doc, me };
      if ((doc.trainerIds ?? []).map((x: string) => ids.keyOf(x)).includes(me)) return { key, db: `class-${key}`, doc, me };
    }
    if (!s.roles.includes('learner') || s.roles.includes('admin')) {
      for (const key of classKeys()) {
        const doc = await store.get(`class-${key}`, `class:${key}`);
        if (doc) return { key, db: `class-${key}`, doc, me };
      }
    }
    throw http.fieldError('class', 'none', 404);
  }
  async function layers(cls: any) {
    const org = (await store.get('org', 'org:main')) ?? {};
    const cohort = cls?.cohortId ? await store.get('org', cls.cohortId) : null;
    const program = cohort?.programId ? await store.get('org', cohort.programId) : null;
    return { layers: { class: cls?.switches ?? {}, program: program?.switches ?? {}, org: org.switches ?? {} }, timeZone: program?.timezone as string | undefined };
  }
  async function switchesOf(cls: any) {
    const { layers: l, timeZone } = await layers(cls);
    const out: Record<string, boolean> = {};
    for (const k of Object.keys(switchDefaults())) out[k] = isOn(k, l);
    return { switches: out, timeZone };
  }

  const view = (p: any) => ({ xp: p.xp, coins: p.coins, seen: p.seen, avatar: p.avatar ?? null, timingOffsetMs: p.timingOffsetMs, settings: p.settings, cosmetics: p.cosmetics, gear: p.gear });
  async function playerOf(me: string) {
    const doc = await store.get(personDb(me), playerId(me));
    const results = await loadResults(store, me);
    return { player: withCaches(normalizePlayer(doc, me, ctx.clock.now(), ctx.schema), results), results };
  }

  app.get('/api/games/arcade', async (c: any) => {
    const { key, doc, me } = await myClass(c);
    const { switches, timeZone } = await switchesOf(doc);
    const { player, results } = await playerOf(me);
    const now = ctx.clock.now();
    const tiles = arcadeOn(switches)
      ? arcadeTiles({ switches, packs: await classPacks(key), results, schedule: doc.schedule, now, timeZone, playable: builtGames() })
      : [];
    return c.json({
      classKey: key, now, arcadeOn: arcadeOn(switches), switches: { games: switches.games, ...Object.fromEntries(Object.entries(switches).filter(([k]) => k.startsWith('game.'))) },
      tiles, player: view(player), scenes: Object.keys(player.seen.scenes),
    });
  });

  app.get('/api/games/pack/:gameId/:packId', async (c: any) => {
    const gameId = c.req.param('gameId'), packId = c.req.param('packId');
    const { key, doc, me } = await myClass(c);
    const { switches, timeZone } = await switchesOf(doc);
    const unavailable = () => new http.ApiError(404, { error: { game: 'unavailable' } });
    if (!gameAvailable(gameId, switches) || !builtGames().includes(gameId)) throw unavailable();
    const stored = await store.get(priv, packDocId(key, gameId, packId));
    if (!stored || !packReleased(doc.schedule, stored.day, ctx.clock.now(), timeZone)) throw unavailable();
    const { player, results } = await playerOf(me);
    const pack: Pack = stored.pack;
    return c.json({
      pack, classKey: key, seedSalt: String(doc.seedSalt ?? key),
      levels: pack.levels.map((l) => ({ id: l.id, locked: levelLocked(pack, l, results) })), player: view(player),
    });
  });

  // ---- results ----
  const roundSchema = z.object({
    outcome: z.enum(['won', 'lost']), skill: z.number().finite(), socketsTotal: z.number().int().min(0), socketsCorrect: z.number().int().min(0),
    socketsByConcept: z.record(z.string(), z.number().int().min(0)), durationMs: z.number().finite().min(0),
    mistakes: z.array(z.object({ itemId: z.string().min(1), concept: z.string().min(1), question: z.string().optional(), given: z.string().optional(), correct: z.string().optional(), why: z.string().optional() })).max(500),
    claimed: z.number().int().min(0).optional(), assisted: z.number().int().min(0).optional(), goldenCoins: z.number().int().min(0).optional(),
  });
  const resultSchema = z.object({
    gameId: z.string().min(1), packId: z.string().min(1), levelId: z.string().min(1), assist: z.boolean().default(false),
    seed: z.number().finite().default(0), clientKey: z.string().min(1).max(80).optional(), result: roundSchema,
  });
  app.post('/api/games/results', ctx.guard.role('learner'), async (c: any) => {
    const b = await http.validateBody(c, resultSchema);
    const { key, doc, me } = await myClass(c);
    const { switches, timeZone } = await switchesOf(doc);
    if (!gameAvailable(b.gameId, switches)) throw http.fieldError('gameId', 'game-unavailable', 403);
    const stored = await store.get(priv, packDocId(key, b.gameId, b.packId));
    if (!stored || !packReleased(doc.schedule, stored.day, ctx.clock.now(), timeZone)) throw http.fieldError('packId', 'pack-unavailable', 404);
    const pack: Pack = stored.pack;
    const level = pack.levels.find((l) => l.id === b.levelId);
    if (!level) throw http.fieldError('levelId', 'unknown-level', 404);
    const existing = await loadResults(store, me);
    if (levelLocked(pack, level, existing)) throw http.fieldError('levelId', 'level-locked', 403);
    const out = await recordRound(store, {
      personKey: me, classKey: key, pack, levelId: b.levelId, result: { ...b.result, socketsByConcept: b.result.socketsByConcept, mistakes: b.result.mistakes },
      assist: b.assist, seed: b.seed, now: ctx.clock.now(), schema: ctx.schema, tuning: TUNING, clientKey: b.clientKey,
    });
    markDirty(me);
    return c.json({ gameResult: out.gameResult, player: view(out.player) });
  });

  // ---- the player document ----
  const patchSchema = z.object({
    seen: z.object({ prologue: z.boolean().optional(), intro: z.record(z.string(), z.boolean()).optional(), scenes: z.record(z.string(), z.boolean()).optional() }).optional(),
    avatar: z.object({ look: z.string().max(24).optional(), color: z.string().max(24).optional(), nameTag: z.string().max(24).optional() }).optional(),
    timingOffsetMs: z.number().finite().optional(),
    settings: z.object({ autoAdvance: z.boolean().optional() }).optional(),
  });
  app.put('/api/games/player', ctx.guard.role('learner'), async (c: any) => {
    const patch = await http.validateBody(c, patchSchema);
    const me = ids.keyOf(c.get('session').personId);
    const db = personDb(me);
    const now = ctx.clock.now();
    const doc = await store.get(db, playerId(me));
    const results = await loadResults(store, me);
    const next = withCaches(patchPlayer(normalizePlayer(doc, me, now, ctx.schema), patch, now, me), results);
    const saved = await store.put(db, next);
    markDirty(me);
    return c.json({ player: view(normalizePlayer(saved, me, now, ctx.schema)) });
  });

  // ---- team XP (team level only, AC-168, AC-206) ----
  app.get('/api/games/teams', async (c: any) => {
    const { key, db, doc } = await myClass(c);
    const { switches } = await switchesOf(doc);
    if (!arcadeOn(switches)) return c.json({ teams: [] });
    const docs = await store.list(db, 'teamScore:');
    const teams = Object.keys(doc.teams ?? {}).sort().map((teamId) => ({ teamId, xp: Number(docs.find((d: any) => d.teamId === teamId)?.xp ?? 0) }));
    return c.json({ classKey: key, teams });
  });

  // ---- teamScore: the average player.xp over the team's current members, recomputed within seconds of a write ----
  async function recomputeClass(classKey: string): Promise<void> {
    const db = `class-${classKey}`;
    const cls = await store.get(db, `class:${classKey}`);
    if (!cls?.teams) return;
    const gone = new Set<string>();
    for (const e of await store.list(db, 'enrolment:')) if (e.status === 'dropped') gone.add(ids.keyOf(String(e.personId ?? e.id)));
    for (const [teamId, members] of Object.entries<string[]>(cls.teams)) {
      const current = (members ?? []).map((m) => ids.keyOf(m)).filter((m) => !gone.has(m));
      let sum = 0;
      for (const m of current) sum += Number((await store.get(personDb(m), playerId(m)))?.xp ?? 0);
      const xp = current.length ? Math.round(sum / current.length) : 0;
      const id = `teamScore:${teamId}`;
      const prev = await store.get(db, id);
      if (prev && prev.xp === xp && prev.teamId === teamId) continue;
      await store.put(db, { type: 'teamScore', id, schema: ctx.schema, updatedAt: ctx.clock.now(), updatedBy: 'hub:games', teamId, xp });
    }
  }

  const dirty = new Set<string>();
  let flushing = false;
  let timer: any = null;
  function markDirty(personKey: string): void {
    dirty.add(personKey);
    timer ??= setTimeout(() => { timer = null; void flush(); }, 150);
    timer.unref?.();
  }
  async function flush(): Promise<void> {
    if (flushing) { timer ??= setTimeout(() => { timer = null; void flush(); }, 150); timer.unref?.(); return; }
    flushing = true;
    try {
      while (dirty.size) {
        const people = [...dirty]; dirty.clear();
        const classes = new Set<string>();
        for (const p of people) {
          try { await refreshPlayer(store, p, ctx.clock.now(), ctx.schema, 'hub:games'); } catch { /* the person database may be gone after a reset */ }
          for (const key of classKeys()) {
            const cls = await store.get(`class-${key}`, `class:${key}`);
            const inTeam = Object.values<string[]>(cls?.teams ?? {}).some((m) => (m ?? []).some((x) => ids.keyOf(x) === p));
            if (inTeam) classes.add(key);
          }
        }
        for (const key of classes) await recomputeClass(key);
      }
    } catch (e: any) { ctx.log(`games: team score pass failed: ${e?.name ?? 'Error'}`); } finally { flushing = false; }
  }

  const feeds = new Map<string, any>();
  function watch(name: string): void {
    if (feeds.has(name)) return;
    const personKey = name.slice('person-'.length);
    const db = store.db(name);
    const feed = db.changes({ since: 0, live: true });
    feed.on('change', (ch: any) => { if (/^(player|gameResult):/.test(String(ch.id))) markDirty(personKey); });
    feed.on('error', () => { feeds.delete(name); });
    db.once('destroyed', () => { try { feed.cancel(); } catch { /* ignore */ } if (feeds.get(name) === feed) feeds.delete(name); });
    feeds.set(name, feed);
  }
  function scan(): void {
    for (const name of store.names()) if (/^person-.+/.test(name)) watch(name);
  }
  scan();
  const interval = setInterval(scan, 1000);
  interval.unref?.();
  ctx.hooks.onReset.push(() => { for (const f of feeds.values()) { try { f.cancel(); } catch { /* ignore */ } } feeds.clear(); dirty.clear(); });
}

/** Store every `<track>/games/<gameId>/<packId>.json` of a published package for the class (D-55). */
export async function storeGamePacks(ctx: any, classKey: string, files: Record<string, string>): Promise<number> {
  const items: { pack: Pack }[] = [];
  for (const path of Object.keys(files).sort()) {
    if (!PACK_PATH.test(path)) continue;
    try { items.push({ pack: JSON.parse(files[path]) }); } catch { /* the gate already refused it */ }
  }
  if (!items.length || !ctx.hooks.gamesStorePacks) return 0;
  return ctx.hooks.gamesStorePacks(classKey, items, 'package');
}

/** D-59: import every sample pack under packages/games/packs/<gameId>/<packId>.json into the class, with `day` replaced. */
export async function importSamplePacks(ctx: any, classKey: string, day: number): Promise<number> {
  const root = join(ctx.config.repoRoot, 'packages', 'games', 'packs');
  if (!existsSync(root) || !ctx.hooks.gamesStorePacks) return 0;
  const items: { pack: Pack; day: number }[] = [];
  for (const game of readdirSync(root).sort()) {
    const dir = join(root, game);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith('.json')) continue;
      try { items.push({ pack: JSON.parse(readFileSync(join(dir, f), 'utf8')), day }); } catch { /* a broken sample is the pack check's business */ }
    }
  }
  return ctx.hooks.gamesStorePacks(classKey, items, 'sample');
}
