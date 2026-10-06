// The phone profile (D-20, AC-95): once signed in, the device keeps a copy of everything it needs to work without the
// hub. The hub bundle (sealed sections, keys of released sections, diagnostics, hub public key) lives in IndexedDB;
// cards and mastery checks live in the personal PouchDB, which replicates with the hub whenever it is reachable.
import { api } from '../../app/api.ts';
import { loadPouch, openPersonDb, remoteDb } from '../../app/db.ts';
import { generateSigningKeys, signPackage, openPackage, tarPack, verifyManifest, buildManifest } from '../../../../core/src/export.ts';
import { openSection } from '../../../../core/src/release.ts';
import { masteryMap } from '../../../../core/src/mastery.ts';
import { reviewCard, type Card, type Rating } from '../../../../core/src/cards.ts';
import { kvDelete, kvGet, kvKeys, kvSet } from './kv.ts';
import { downloadsHeld } from './net.ts';

export type RatingName = Rating;
export interface BSection { id: string; title: string; graded: boolean; sealed: string; key?: string }
export interface BDay { index: number; date: string | null; sections: BSection[] }
export interface BQuestion { n: number; text: string; answer: string }
export interface BClass {
  key: string; name: string; profile: string | null; days: BDay[];
  diagnostics: Record<string, BQuestion[]>; drill: { id: string; startedAt: number } | null;
}
export interface Bundle { now: number; schema: number; personId: string; hubKey: JsonWebKey; classes: BClass[]; fetchedAt: number; offset: number }
export interface Imported { classKey: string; className: string; day: BDay; keys: Record<string, string>; diagnostic: BQuestion[] }
export interface Device { deviceId: string; publicJwk: JsonWebKey; privateJwk: JsonWebKey; registered: boolean }

const dec = new TextDecoder();
const enc = new TextEncoder();
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// ---- who is signed in (the shell caches the last /api/me answer in localStorage) ----
export function cachedMe(): { personId: string; roles: string[] } | null {
  try { const m = JSON.parse(localStorage.getItem('lms.me') || 'null'); return m && typeof m.personId === 'string' ? m : null; } catch { return null; }
}

// ---- shared state ----
let person: string | null = null;
let bundle: Bundle | null = null;
let hubUp: boolean | null = null;
let lastSync = 0;
const listeners = new Set<() => void>();
export const subscribe = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const notify = () => { for (const l of listeners) l(); };
export const getBundle = () => bundle;
export const hubReachable = () => hubUp;
export const lastSyncAt = () => lastSync;

// The device clock may be wrong; every time shown or compared uses the hub's clock plus the time since we last asked it (D-27).
export const nowMs = () => Date.now() + (bundle?.offset ?? 0);

let readyResolve: () => void = () => {};
let readyPromise: Promise<void> = new Promise((r) => { readyResolve = r; });
// Resolves when the first replication of the personal database caught up, the hub is unreachable, or after a few seconds.
export function whenReady(): Promise<void> { return Promise.race([readyPromise, new Promise<void>((r) => setTimeout(r, 6000))]); }

// PouchDB comes from the app-wide helper in app/db.ts (loadPouch, openPersonDb, remoteDb); it loads on first use.

// ---- the personal database ----
let dbPromise: Promise<any> | null = null;
export function personDb(): Promise<any> {
  if (!person) return Promise.reject(new Error('not signed in'));
  dbPromise ??= openPersonDb(person);
  return dbPromise;
}
async function docs(prefix: string): Promise<any[]> {
  const db = await personDb();
  const r = await db.allDocs({ include_docs: true, startkey: prefix, endkey: prefix + '￿' });
  return r.rows.map((x: any) => x.doc).filter(Boolean);
}
export const listCards = () => docs('card:');
export const listChecks = () => docs('masteryCheck:');

function toCard(doc: any): Card {
  const f = doc.fsrs ?? {};
  return {
    id: doc.id, due: f.due ?? 0, stability: f.stability ?? 0, difficulty: f.difficulty ?? 0, elapsed_days: f.elapsed_days ?? 0,
    scheduled_days: f.scheduled_days ?? 0, learning_steps: f.learning_steps ?? 0, reps: f.reps ?? 0, lapses: f.lapses ?? 0,
    state: f.state ?? 0, last_review: f.last_review ? new Date(f.last_review) : undefined,
  } as Card;
}
export const cardDueAt = (doc: any): number => Number(doc?.fsrs?.due ?? 0);

// Rates a card on this device with the core scheduler; the change replicates to the hub when it can.
export async function rateCard(doc: any, rating: Rating): Promise<void> {
  const now = nowMs();
  const next = reviewCard(toCard(doc), rating, now);
  const fsrs = {
    due: next.due, stability: next.stability, difficulty: next.difficulty, elapsed_days: next.elapsed_days,
    scheduled_days: next.scheduled_days, learning_steps: next.learning_steps, reps: next.reps, lapses: next.lapses,
    state: next.state, last_review: next.last_review ? new Date(next.last_review).getTime() : null,
  };
  const db = await personDb();
  await db.put({ ...doc, fsrs, updatedAt: now, updatedBy: person });
  notify();
}

export async function saveCheck(day: number, correct: number, max: number): Promise<void> {
  const now = nowMs();
  const db = await personDb();
  await db.put({
    _id: `masteryCheck:day-${day}:${now}`, id: `masteryCheck:day-${day}:${now}`, type: 'masteryCheck', schema: bundle?.schema ?? 1,
    updatedAt: now, updatedBy: person, skill: `day-${day}`, day, correct, max, score: max ? correct / max : 0, at: now, mode: 'recorded',
  });
  notify();
}
export async function mastery(): Promise<Record<string, 'mastered' | 'not-yet'>> {
  return masteryMap((await listChecks()).map((c) => ({ skill: String(c.skill), score: Number(c.score), at: Number(c.at) })));
}

// ---- answers are compared the way a person would: case, spacing, quotes and a leading dot do not matter ----
const norm = (s: string) => s.toLowerCase().replace(/[`'"“”‘’]/g, '').replace(/\s+/g, ' ').trim().replace(/^\./, '');
export function gradeAnswer(given: string, key: string): boolean {
  const g = norm(given), k = norm(key);
  if (!g || !k) return false;
  return g === k || (k.length >= 3 && g.includes(k));
}

// ---- opening sealed text ----
export async function openText(sealedB64: string, keyB64: string): Promise<string> {
  return dec.decode(await openSection(unb64(keyB64), unb64(sealedB64)));
}

// ---- imported day packages (file exchange) ----
export async function listImports(): Promise<Imported[]> {
  if (!person) return [];
  const out: Imported[] = [];
  for (const k of await kvKeys(`${person}:import:`)) { const v = await kvGet<Imported>(k); if (v) out.push(v); }
  return out;
}

// What the device can show for each day: the hub bundle first, then keys and days from imported packages.
export async function contentDays(classKey?: string): Promise<{ cls: { key: string; name: string } | null; days: BDay[]; diagnostics: Record<string, BQuestion[]> }> {
  const imports = await listImports();
  const bc = bundle?.classes.find((c) => !classKey || c.key === classKey) ?? bundle?.classes[0] ?? null;
  const key = bc?.key ?? imports[0]?.classKey ?? null;
  if (!key) return { cls: null, days: [], diagnostics: {} };
  const days = new Map<number, BDay>((bc?.days ?? []).map((d) => [d.index, { ...d, sections: d.sections.map((s) => ({ ...s })) }]));
  const diagnostics: Record<string, BQuestion[]> = { ...(bc?.diagnostics ?? {}) };
  for (const imp of imports.filter((i) => i.classKey === key)) {
    const have = days.get(imp.day.index);
    if (!have) days.set(imp.day.index, { ...imp.day, sections: imp.day.sections.map((s) => ({ ...s, key: imp.keys[s.id] ?? s.key })) });
    else for (const s of have.sections) { const k = imp.keys[s.id]; if (k && !s.key) s.key = k; }
    if (imp.diagnostic.length && !diagnostics[imp.day.index]) diagnostics[imp.day.index] = imp.diagnostic;
  }
  return { cls: { key, name: bc?.name ?? imports.find((i) => i.classKey === key)?.className ?? key }, days: [...days.values()].sort((a, b) => a.index - b.index), diagnostics };
}

// The signer's public key sits in the container header: "LMSP1\n" | u32 length | JWK (core/export.ts).
function embeddedKey(c: Uint8Array): JsonWebKey | null {
  try {
    const at = 6;
    const len = new DataView(c.buffer, c.byteOffset, c.length).getUint32(at);
    return JSON.parse(dec.decode(c.subarray(at + 4, at + 4 + len)));
  } catch { return null; }
}

export type ImportResult =
  | { ok: true; imported: Imported }
  | { ok: false; reason: 'no-hub-key' | 'untrusted' | 'bad-signature' | 'corrupt' | 'bad-manifest' | 'not-a-day-package' };

export async function importPackage(bytes: Uint8Array): Promise<ImportResult> {
  let hubKey: JsonWebKey | null = bundle?.hubKey ?? (person ? (await kvGet<Bundle>(`${person}:bundle`))?.hubKey ?? (await kvGet<JsonWebKey>(`${person}:hubkey`)) : null);
  let firstUse = false;
  if (!hubKey) {
    // This device has never talked to the hub (a phone that only exchanges files). The package is still checked for
    // tampering, and the hub key it carries is remembered, so later packages must come from the same hub.
    hubKey = embeddedKey(bytes);
    firstUse = true;
  }
  if (!hubKey) return { ok: false, reason: 'no-hub-key' };
  const opened = await openPackage(bytes, [hubKey]);
  if (!opened.ok) return { ok: false, reason: opened.reason };
  const mf = opened.files.find((f) => f.path === 'manifest.json');
  const rest = opened.files.filter((f) => f.path !== 'manifest.json');
  if (!mf) return { ok: false, reason: 'bad-manifest' };
  try {
    const v = await verifyManifest(rest, JSON.parse(dec.decode(mf.bytes)));
    if (v.missing.length || v.extra.length || v.changed.length) return { ok: false, reason: 'bad-manifest' };
    const read = (p: string) => { const f = rest.find((x) => x.path === p); return f ? JSON.parse(dec.decode(f.bytes)) : null; };
    const cls = read('class.json');
    const dayFile = rest.find((f) => /^day-\d+\.json$/.test(f.path));
    if (!cls?.id || !dayFile) return { ok: false, reason: 'not-a-day-package' };
    const day = JSON.parse(dec.decode(dayFile.bytes)) as BDay;
    const imported: Imported = { classKey: String(cls.id), className: String(cls.name ?? cls.id), day, keys: read('keys.json') ?? {}, diagnostic: read('diagnostic.json') ?? [] };
    if (firstUse && person) await kvSet(`${person}:hubkey`, hubKey);
    await kvSet(`${person}:import:${imported.classKey}:${day.index}`, imported);
    notify();
    return { ok: true, imported };
  } catch { return { ok: false, reason: 'corrupt' }; }
}

// ---- the device signing key (AC-76): the private half never leaves this device ----
export async function device(): Promise<Device> {
  const k = `${person}:device`;
  let d = await kvGet<Device>(k);
  if (!d) {
    const keys = await generateSigningKeys();
    d = { deviceId: `dev-${crypto.randomUUID()}`, publicJwk: keys.publicJwk, privateJwk: keys.privateJwk, registered: false };
    await kvSet(k, d);
  }
  return d;
}
export async function registerDevice(): Promise<boolean> {
  const d = await device();
  if (d.registered) return true;
  try {
    await api('/api/me/device-key', { body: { deviceId: d.deviceId, publicJwk: d.publicJwk } });
    await kvSet(`${person}:device`, { ...d, registered: true });
    return true;
  } catch { return false; }
}

// The learner's signed submission file: their diagnostic results and card work, signed by the device key.
export async function buildSubmission(classKey: string): Promise<{ name: string; bytes: Uint8Array } | null> {
  if (!person) return null;
  await registerDevice(); // a no-op once registered; when the hub is unreachable the file is still made, and signed all the same
  const d = await device();
  let checks: any[] = [], reviewed = 0;
  try {
    checks = (await listChecks()).map((c) => ({ day: c.day, correct: c.correct, max: c.max, at: c.at }));
    reviewed = (await listCards()).filter((c) => Number(c.fsrs?.reps) > 0).length;
  } catch { /* the local database is unavailable: the file then carries no results */ }
  const body = { kind: 'submission', personId: person, classId: classKey, deviceId: d.deviceId, createdAt: nowMs(), diagnostics: checks, cardsReviewed: reviewed };
  const files = [{ path: 'submission.json', bytes: enc.encode(JSON.stringify(body, null, 1) + '\n') }];
  const manifest = await buildManifest(files);
  const archive = tarPack([{ path: 'manifest.json', bytes: enc.encode(JSON.stringify(manifest, null, 1) + '\n') }, ...files]);
  return { name: `submission-${classKey}-${person}.lmsp`, bytes: await signPackage(archive, d.privateJwk) };
}

// ---- replication of the personal database ----
let sync: any = null;
let syncing = false;
async function ensureSync() {
  if (syncing || !person || downloadsHeld()) return;
  syncing = true;
  try {
    const [local, remote] = await Promise.all([personDb(), remoteDb(`person-${person}`)]);
    const h = local.sync(remote, { live: true, retry: true, back_off_function: (d: number) => (d === 0 ? 500 : Math.min(d * 1.5, 2500)) });
    sync = h;
    h.on('paused', (err: unknown) => { if (!err) { lastSync = Date.now(); hubUp = true; readyResolve(); notify(); } });
    h.on('change', () => { lastSync = Date.now(); notify(); });
    h.on('error', () => { try { h.cancel(); } catch { /* ignore */ } sync = null; syncing = false; });
    h.on('complete', () => { sync = null; syncing = false; });
  } catch { syncing = false; }
}
export function syncNow(): void { void ensureSync(); }

// ---- a quick check that this device would keep working without the hub (fire drill) ----
export async function selfCheck(): Promise<{ hasBundle: boolean; sections: number; opened: number; cards: number; worker: boolean }> {
  const b = bundle ?? (person ? await kvGet<Bundle>(`${person}:bundle`) : null);
  let sections = 0, opened = 0;
  for (const c of b?.classes ?? []) for (const d of c.days) for (const s of d.sections) {
    if (!s.key) continue;
    sections++;
    try { await openText(s.sealed, s.key); opened++; } catch { /* counted as not opened */ }
  }
  let cards = 0;
  if (cachedMe()?.roles.includes('learner')) { try { cards = (await listCards()).length; } catch { /* no local database yet */ } }
  return { hasBundle: !!b, sections, opened, cards, worker: !!navigator.serviceWorker?.controller };
}

// ---- refreshing from the hub ----
let busy = false;
async function refresh() {
  try {
    const fresh = await api<Omit<Bundle, 'fetchedAt' | 'offset'>>('/api/files/bundle');
    bundle = { ...fresh, fetchedAt: Date.now(), offset: fresh.now - Date.now() };
    hubUp = true;
    await kvSet(`${person}:bundle`, bundle);
    notify();
    return true;
  } catch (e: any) {
    if (e?.status === undefined) { hubUp = false; readyResolve(); notify(); } // network failure: keep working from the stored copy
    return false;
  }
}

async function acknowledgeDrill() {
  const c = bundle?.classes.find((x) => x.drill);
  if (!c?.drill) return;
  const seen = `${person}:drill:${c.drill.id}`;
  if (await kvGet(seen)) return;
  const r = await selfCheck();
  try {
    await api('/api/files/drill-ack', { body: { id: c.drill.id, ok: r.hasBundle && r.opened === r.sections, sections: r.opened, cards: r.cards } });
    await kvSet(seen, true);
  } catch { /* try again on the next round */ }
}

async function tick(force = false) {
  if (busy) return;
  busy = true;
  try {
    const me = cachedMe();
    if (!me) return;
    if (person !== me.personId) {
      person = me.personId; bundle = null; dbPromise = null; sync = null; syncing = false;
      readyPromise = new Promise((r) => { readyResolve = r; });
      bundle = await kvGet<Bundle>(`${person}:bundle`);
      notify();
    }
    prefetch(me.roles);
    if (!force && downloadsHeld()) return;
    // The device key goes to the hub first: it is the one thing a phone that later works by files only cannot do afterwards.
    if (me.roles.includes('learner')) await registerDevice();
    const ok = await refresh();
    if (!ok) return;
    if (me.roles.includes('learner')) await ensureSync();
    await acknowledgeDrill();
  } finally { busy = false; }
}

// Load the screens (and the database library) while the hub is reachable, so they open with the hub off even before the
// service worker has finished caching them.
let prefetched: string | null = null;
function prefetch(roles: string[]) {
  if (prefetched === person) return;
  prefetched = person;
  const loads = roles.includes('learner') ? [() => loadPouch(), () => import('../attend/LToday.tsx')] : [];
  for (const load of loads) void load().catch(() => {});
}

let started = false;
export function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  // The shell caches who is signed in a moment after it starts: begin as soon as that is known.
  let tries = 0;
  const early = setInterval(() => { if (cachedMe() || ++tries > 400) { clearInterval(early); void tick(); } }, 50);
  void tick();
  setInterval(() => { if (document.visibilityState !== 'hidden') void tick(); }, 10_000);
  addEventListener('online', () => void tick());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void tick(); });
}
export const refreshNow = (force = false) => tick(force);

// ---- shared device: send what is pending, then remove everything this person left on the device ----
export async function wipeDevice(): Promise<void> {
  const me = person ?? cachedMe()?.personId;
  if (!me) return;
  try {
    if (sync) { try { sync.cancel(); } catch { /* ignore */ } sync = null; syncing = false; }
    const [local, remote] = await Promise.all([openPersonDb(me), remoteDb(`person-${me}`)]);
    await Promise.race([local.replicate.to(remote), new Promise((r) => setTimeout(r, 4000))]);
    await local.destroy();
  } catch { /* unreachable hub: the stored copy is kept rather than lost */ }
  for (const k of await kvKeys(`${me}:`)) if (!k.endsWith(':device')) await kvDelete(k);
  person = null; bundle = null; dbPromise = null; notify();
}
