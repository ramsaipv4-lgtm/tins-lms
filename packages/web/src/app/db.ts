// Local PouchDB databases and sync with the hub (D-6, D-21). pouchdb-browser is loaded on first use, never in the shell chunk.
import { api } from './api.ts';

let schemaPromise: Promise<number> | null = null;
function hubSchema(): Promise<number> {
  schemaPromise ??= api<{ schema: number }>('/api/health').then((h) => Number(h.schema) || 1).catch(() => { schemaPromise = null; return 1; });
  return schemaPromise;
}

async function pouch(): Promise<any> {
  return (await import('pouchdb-browser')).default;
}

export const classDbName = (classKey: string) => `class-${classKey}`;
export const personDbName = (personKey: string) => `person-${personKey}`;

export async function openDb(name: string): Promise<any> {
  const PouchDB = await pouch();
  return new PouchDB(name);
}
export const openClassDb = (classKey: string) => openDb(classDbName(classKey));
export const openPersonDb = (personKey: string) => openDb(personDbName(personKey));

export async function remoteDb(name: string): Promise<any> {
  const PouchDB = await pouch();
  const schema = await hubSchema();
  return new PouchDB(`${location.origin}/db/${name}`, {
    fetch: (url: any, o: any) => { o.headers.set('x-lms-schema', String(schema)); o.credentials = 'include'; return PouchDB.fetch(url, o); },
  });
}

// Live two-way replication between the local database and the hub; retries while offline. Call .cancel() to stop.
export async function syncDb(name: string, opts: { live?: boolean } = {}): Promise<any> {
  const [local, remote] = await Promise.all([openDb(name), remoteDb(name)]);
  return local.sync(remote, { live: opts.live ?? true, retry: true });
}
