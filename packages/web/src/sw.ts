/// <reference lib="webworker" />
// Service worker (D-5 installable offline app). Two caches, so the app takes over quickly and the heavy staff-only
// code does not hold it up (AC-100, AC-101, AC-102):
//   core  every file of the build except the board's own chunks. Fetched in parallel at install, so the worker controls
//         the page (and a reload works with the hub stopped) within a moment of the shell loading.
//   board the board's chunks (vite.config.ts lists them in /warm-board.json, board critical files first). Fetched in the
//         background only when the page asks, which it does for staff (admin, trainer, substitute) once the shell is up;
//         a learner's phone never downloads the board. The page itself still requests the board's JavaScript only when
//         the board opens (SPEC Appendix C: a service worker may precache it in the background); a request for a chunk
//         that is still downloading shares that download instead of starting a second one.
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] };

const entries = self.__WB_MANIFEST;
const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const BUILD = hash(entries.map((e) => `${e.url}@${e.revision ?? ''}`).join('|'));
const CORE = `lms-core-${BUILD}`;
const BOARD = `lms-board-${BUILD}`;
const abs = (u: string) => new URL(u, self.registration.scope).pathname;
const known = new Set(entries.map((e) => abs(e.url)));
// Paths the worker never answers itself: the API, the sync endpoint, test hooks and the server-rendered certificate check.
const DENY = /^\/(api|db|__test|verify)(\/|$)/;

async function pool<T>(items: T[], size: number, run: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (next < items.length) await run(items[next++]); }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE);
    await pool(entries, 8, async (e) => {
      const path = abs(e.url);
      if (await cache.match(path)) return;
      // Built assets carry a content hash in their name, so the browser's own cache may answer; the rest must be fresh.
      const res = await fetch(new Request(path, path.startsWith('/assets/') ? {} : { cache: 'reload' }));
      if (!res.ok) throw new Error(`precache ${path}: ${res.status}`);
      await cache.put(path, res);
    });
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if ((k.startsWith('lms-') || k.startsWith('workbox-')) && k !== CORE && k !== BOARD) await caches.delete(k);
    await self.clients.claim();
  })());
});

const inflight = new Map<string, Promise<Response>>();
let warming: Promise<void> | null = null;
function warmBoard(): Promise<void> {
  warming ??= (async () => {
    const list: string[] = await (await ((await caches.match('/warm-board.json')) ?? fetch('/warm-board.json'))).json();
    const cache = await caches.open(BOARD);
    await pool(list, 3, async (path) => {
      if (await cache.match(path)) return;
      const pending = fetch(path).then((r) => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r; });
      inflight.set(path, pending);
      try { await cache.put(path, (await pending).clone()); } finally { inflight.delete(path); }
    });
  })().catch(() => { warming = null; }); // offline or hub down: the page asks again next time
  return warming;
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'warm-board') event.waitUntil(warmBoard());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || DENY.test(url.pathname)) return;
  if (req.mode === 'navigate') {
    event.respondWith((async () => (await caches.match('/index.html')) ?? fetch(req))());
    return;
  }
  if (!url.pathname.startsWith('/assets/') && !known.has(url.pathname)) return;
  event.respondWith((async () => {
    const hit = await caches.match(url.pathname);
    if (hit) return hit;
    const pending = inflight.get(url.pathname);
    if (pending) { try { return (await pending).clone(); } catch { /* fall through to the network */ } }
    return fetch(req);
  })());
});
