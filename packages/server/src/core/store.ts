// Store access: PouchDB (leveldb) under <dataDir>/db. Documents use _id === id (`<type>:<key>`).
// Databases: org, class-<key>, person-<key> (replicated at /db) and `lms-private` (never exposed:
// join-code hashes and anything else that must not replicate).
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import PouchDB from 'pouchdb';

export const PRIVATE_DB = 'lms-private';

export type Doc = Record<string, any>;

export function createStore(dataDir: string) {
  const dbDir = join(dataDir, 'db');
  mkdirSync(dbDir, { recursive: true });
  const P: any = (PouchDB as any).defaults({ prefix: dbDir + '/' });
  const open = new Map<string, any>();

  function db(name: string): any {
    let d = open.get(name);
    if (!d) { d = new P(name); open.set(name, d); }
    return d;
  }

  async function get(dbName: string, id: string): Promise<Doc | null> {
    try { return await db(dbName).get(id); } catch (e: any) { if (e?.status === 404) return null; throw e; }
  }

  // Insert or replace. Sets _id from id (or id from _id). Retries when another write wins the revision.
  async function put(dbName: string, doc: Doc): Promise<Doc> {
    const id = doc.id ?? doc._id;
    if (typeof id !== 'string' || id === '') throw new Error('document needs an id');
    for (let attempt = 0; attempt < 5; attempt++) {
      const prev = await get(dbName, id);
      const next: Doc = { ...doc, _id: id, id };
      delete next._rev;
      if (prev) next._rev = prev._rev;
      try {
        const r = await db(dbName).put(next);
        return { ...next, _rev: r.rev };
      } catch (e: any) { if (e?.status !== 409) throw e; }
    }
    throw new Error('could not write document after retries');
  }

  async function remove(dbName: string, id: string): Promise<boolean> {
    const prev = await get(dbName, id);
    if (!prev) return false;
    await db(dbName).remove(prev);
    return true;
  }

  // All documents whose id starts with `prefix` (e.g. 'enrolment:').
  async function list(dbName: string, prefix = ''): Promise<Doc[]> {
    const r = await db(dbName).allDocs({ include_docs: true, startkey: prefix, endkey: prefix + '￰' });
    return r.rows.map((row: any) => row.doc).filter((d: Doc | null) => d && !String(d._id).startsWith('_design/'));
  }

  function names(): string[] {
    try { return readdirSync(dbDir); } catch { return []; }
  }

  async function destroyAll(): Promise<void> {
    // pouch__all_dbs__ is express-pouchdb's own bookkeeping database; destroying it hangs every /db request.
    const all = new Set<string>([...open.keys(), ...names()]);
    for (const n of all) {
      if (n.startsWith('pouch__')) continue;
      try { await new P(n).destroy(); } catch { /* already gone */ }
    }
    open.clear();
  }

  async function close(): Promise<void> {
    for (const d of open.values()) { try { await d.close(); } catch { /* ignore */ } }
    open.clear();
  }

  return { PouchDB: P, db, get, put, remove, list, names, destroyAll, close, priv: PRIVATE_DB };
}

export type Store = ReturnType<typeof createStore>;
