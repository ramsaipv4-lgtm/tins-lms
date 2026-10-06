// Coach space plumbing: the PIN lock (F-05), encrypted entries in the personal database (D-21, D-26), sync.
// The PIN stretches with PBKDF2-SHA-256 at 600,000 iterations to a wrapping key; a random data key sits wrapped in
// `coachMeta:main`. Entries are sealed with the data key, so changing the PIN never re-encrypts them.
import { aesGcmOpen, aesGcmSeal, base64Decode, base64Encode, utf8Decode, utf8Encode } from '../../../../core/src/util.ts';
import { unwrapPersonKey, wrapPersonKey } from '../../../../core/src/keys.ts';
import { openPersonDb, personDbName, remoteDb } from '../../app/db.ts';

export const PBKDF2_ITERATIONS = 600_000;
export const MIN_PIN = 4;
export const META_ID = 'coachMeta:main';
export type EntryKind = 'food' | 'money' | 'steps' | 'sleep' | 'note';
export interface Entry { id: string; kind: EntryKind; values: Record<string, any>; source: 'manual' | 'screenshot' | 'healthconnect'; confirmed: boolean; at: number }

// The unlocked data key lives only in memory: a reload or "Lock" asks for the PIN again.
let unlocked: { person: string; key: Uint8Array } | null = null;
const listeners = new Set<() => void>();
export const unlockedKey = (person: string): Uint8Array | null => (unlocked && unlocked.person === person ? unlocked.key : null);
export function lockCoach(): void { unlocked = null; listeners.forEach((f) => f()); }
export function onLockChange(f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; }
function setUnlocked(person: string, key: Uint8Array): void { unlocked = { person, key }; listeners.forEach((f) => f()); }

export function pinProblem(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return 'digits';
  if (pin.length < MIN_PIN) return 'short';
  return null;
}

async function wrappingKey(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey('raw', utf8Encode(pin), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, base, 256));
}

// The personal database is reached through app/db.ts: the hub's /db/person-<key> endpoint over PouchDB's http adapter
// (it sends x-lms-schema and the session cookie). Entries are still sealed on this device before they leave it (D-26).
const remotes = new Map<string, Promise<any>>();
const remote = (person: string) => { if (!remotes.has(person)) remotes.set(person, remoteDb(personDbName(person))); return remotes.get(person)!; };

async function dbGet(person: string, id: string): Promise<any | null> {
  try { return await (await remote(person)).get(id); } catch (e: any) {
    if (e?.status === 404) return null;
    throw new Error(`db get ${e?.status ?? e?.message}`);
  }
}
async function dbPut(person: string, doc: { _id: string } & Record<string, unknown>): Promise<void> {
  try { await (await remote(person)).put(doc); } catch (e: any) { throw new Error(`db put ${e?.status ?? e?.message}`); }
}
async function dbRows(person: string, prefix: string): Promise<any[]> {
  try { return (await (await remote(person)).allDocs({ include_docs: true, startkey: prefix, endkey: `${prefix}\ufff0` })).rows as any[]; }
  catch (e: any) { throw new Error(`db list ${e?.status ?? e?.message}`); }
}

// A PIN exists once the record carries the wrapped data key. Before that the record may hold only the salt (reserveMeta).
export async function hasPin(person: string): Promise<boolean> {
  const meta = await dbGet(person, META_ID);
  return !!meta && typeof meta.wrapped === 'string';
}

// The PIN record is created when the PIN screen opens, with just the salt, and the key is added to the same record when
// the PIN is chosen. Stretching a PIN takes a while on a phone, so writing the whole record at the end made the first
// document of the personal database appear at an unpredictable moment, in the middle of whatever the learner did next.
export async function reserveMeta(person: string): Promise<void> {
  if ((await dbGet(person, META_ID)) !== null) return;
  await dbPut(person, { _id: META_ID, type: 'coachMeta', id: META_ID, schema: 1, updatedAt: Date.now(), updatedBy: `person:${person}`, salt: base64Encode(crypto.getRandomValues(new Uint8Array(16))) });
}

// True once the PIN record is readable back from the hub AND the device's own copy of the personal database (filled by
// the live replication in files/phone.ts) has it, so the PIN record can no longer "land" in the middle of an import.
// The upload stays disabled until then (AC-94). The wait for the local copy is bounded: replication may be off.
export async function metaReady(person: string, waitLocalMs = 8000): Promise<boolean> {
  try { if ((await dbGet(person, META_ID)) === null) return false; } catch { return false; }
  try {
    const local = await openPersonDb(person);
    const until = Date.now() + waitLocalMs;
    for (;;) {
      try { await local.get(META_ID); break; } catch (e: any) { if (e?.status !== 404 || Date.now() > until) break; }
      await new Promise((r) => setTimeout(r, 150));
    }
  } catch { /* no local database: the hub copy is enough */ }
  return true;
}

export async function createPin(person: string, pin: string): Promise<void> {
  const prev = await dbGet(person, META_ID);
  const salt = prev?.salt ? base64Decode(prev.salt) : crypto.getRandomValues(new Uint8Array(16));
  const dataKey = crypto.getRandomValues(new Uint8Array(32));
  const wrapped = await wrapPersonKey(dataKey, await wrappingKey(pin, salt));
  await dbPut(person, { _id: META_ID, ...(prev?._rev ? { _rev: prev._rev } : {}), type: 'coachMeta', id: META_ID, schema: 1, updatedAt: Date.now(), updatedBy: `person:${person}`, salt: base64Encode(salt), wrapped: base64Encode(wrapped) });
  setUnlocked(person, dataKey);
}

export async function unlockWithPin(person: string, pin: string): Promise<boolean> {
  const meta = await dbGet(person, META_ID);
  if (!meta) return false;
  try {
    const key = await unwrapPersonKey(base64Decode(meta.wrapped), await wrappingKey(pin, base64Decode(meta.salt)));
    setUnlocked(person, key);
    return true;
  } catch { return false; }
}

// ---- encrypted entries ----
export async function sealJson(key: Uint8Array, value: unknown): Promise<{ iv: string; ct: string }> {
  const sealed = await aesGcmSeal(key, utf8Encode(JSON.stringify(value)));
  return { iv: base64Encode(sealed.slice(0, 12)), ct: base64Encode(sealed.slice(12)) };
}
export async function openJson(key: Uint8Array, enc: { iv: string; ct: string }): Promise<any> {
  const iv = base64Decode(enc.iv), ct = base64Decode(enc.ct);
  const sealed = new Uint8Array(iv.length + ct.length); sealed.set(iv); sealed.set(ct, iv.length);
  return JSON.parse(utf8Decode(await aesGcmOpen(key, sealed)));
}

// The stored document carries only type, id, schema, updatedAt, updatedBy and `enc` (the hub refuses anything else).
export async function saveEntry(person: string, key: Uint8Array, entry: Omit<Entry, 'id' | 'at'> & { idHint?: string }): Promise<string> {
  const at = Date.now();
  const id = `coachEntry:${entry.idHint ?? `${entry.kind}-${at.toString(36)}-${Math.random().toString(36).slice(2, 6)}`}`;
  const { idHint: _h, ...rest } = entry;
  await dbPut(person, { _id: id, type: 'coachEntry', id, schema: 1, updatedAt: at, updatedBy: `person:${person}`, enc: await sealJson(key, { ...rest, at }) });
  return id;
}

export async function listEntries(person: string, key: Uint8Array): Promise<Entry[]> {
  const out: Entry[] = [];
  for (const row of await dbRows(person, 'coachEntry:')) {
    if (!row.doc?.enc) continue;
    try { out.push({ id: row.id, ...(await openJson(key, row.doc.enc)) }); } catch { /* sealed with another key */ }
  }
  return out.sort((a, b) => a.at - b.at);
}
