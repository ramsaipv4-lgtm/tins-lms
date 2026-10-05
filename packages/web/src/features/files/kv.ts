// A tiny key-value store on IndexedDB for the phone profile: the hub bundle, the device signing key and imported
// day packages. It is local to this browser, never replicated, and loads no library (the shell stays small).
const DB = 'lms-phone';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  try { return ((await run('readonly', (s) => s.get(key))) as T | undefined) ?? null; } catch { return null; }
}
export async function kvSet(key: string, value: unknown): Promise<void> {
  try { await run('readwrite', (s) => s.put(value, key)); } catch { /* private window: the phone profile then works for this visit only */ }
}
export async function kvKeys(prefix: string): Promise<string[]> {
  try { return ((await run('readonly', (s) => s.getAllKeys())) as IDBValidKey[]).map(String).filter((k) => k.startsWith(prefix)); } catch { return []; }
}
export async function kvDelete(key: string): Promise<void> {
  try { await run('readwrite', (s) => s.delete(key)); } catch { /* ignore */ }
}
