// Small things the shell loads at start (kept tiny, no libraries): the data meter, "Wi-Fi only downloads",
// the file-download helper, and kiosk mode (Coach space hidden, sign-out after 30 minutes idle).
// Settings live in localStorage (per device); every access is wrapped because private windows can throw.
const K = { bytes: 'lms.meter', wifi: 'lms.wifiOnly', kiosk: 'lms.kiosk', me: 'lms.me' };
export const IDLE_MS = 30 * 60 * 1000;

function read(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function write(k: string, v: string | null) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } }

// ---- data meter: bytes this app moved on this device ----
let bytes = Number(read(K.bytes)) || 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const meterListeners = new Set<() => void>();
function addBytes(n: number) {
  if (!(n > 0)) return;
  bytes += n;
  for (const l of meterListeners) l();
  saveTimer ??= setTimeout(() => { saveTimer = null; write(K.bytes, String(bytes)); }, 400);
}
export const meterBytes = () => bytes;
export function onMeter(fn: () => void): () => void { meterListeners.add(fn); return () => { meterListeners.delete(fn); }; }
export function resetMeter() { bytes = 0; write(K.bytes, '0'); for (const l of meterListeners) l(); }

export function formatBytes(n: number): { value: string; unit: 'B' | 'KB' | 'MB' | 'GB' } {
  if (n < 1024) return { value: String(Math.round(n)), unit: 'B' };
  if (n < 1024 * 1024) return { value: String(Math.round(n / 1024)), unit: 'KB' };
  if (n < 1024 ** 3) return { value: (n / 1024 / 1024).toFixed(1), unit: 'MB' };
  return { value: (n / 1024 ** 3).toFixed(2), unit: 'GB' };
}

function installMeter() {
  const w = window as any;
  if (w.__lmsMeter) return;
  w.__lmsMeter = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await orig(input, init);
    try {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
      if (url.origin === location.origin) {
        const body: any = init?.body;
        if (typeof body === 'string') addBytes(body.length);
        else if (body && typeof body.byteLength === 'number') addBytes(body.byteLength);
        else if (body && typeof body.size === 'number') addBytes(body.size);
        const len = Number(res.headers.get('content-length'));
        if (len > 0) addBytes(len);
        else res.clone().arrayBuffer().then((b) => addBytes(b.byteLength), () => {});
      }
    } catch { /* never break a request because of the meter */ }
    return res;
  };
  // Page and asset loads that do not go through fetch (the shell, scripts, styles) count once per page load.
  addEventListener('load', () => setTimeout(() => {
    let n = 0;
    for (const e of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
      if (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest') continue;
      n += e.transferSize || e.encodedBodySize || 0;
    }
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    addBytes(n + (nav?.transferSize || nav?.encodedBodySize || 0));
  }, 500), { once: true });
}

// ---- Wi-Fi only downloads (F-3) ----
export const wifiOnly = () => read(K.wifi) === '1';
export const setWifiOnly = (on: boolean) => write(K.wifi, on ? '1' : null);
export function onCellular(): boolean {
  const c = (navigator as any).connection;
  if (!c) return false;
  if (c.type) return c.type === 'cellular';
  // Desktop and many phone browsers do not report the connection type; a slow effective type (3g or worse) is the best sign left.
  if (c.effectiveType === '3g' || c.effectiveType === '2g' || c.effectiveType === 'slow-2g') return true;
  // A narrow, slow link (a mobile-data profile reports about 1.5 Mbit/s and 150 ms) counts as cellular as well.
  return typeof c.downlink === 'number' && c.downlink > 0 && c.downlink <= 2 && c.rtt >= 100;
}
export const downloadsHeld = () => wifiOnly() && onCellular();

// Saves bytes as a file download (a data URL would be size-limited; an object URL is not).
export function saveFile(name: string, bytes: Uint8Array | string, type = 'application/octet-stream') {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---- kiosk mode (F-2): shared device ----
export const kioskOn = () => read(K.kiosk) === '1';
let lastActive = Date.now();
const kioskListeners = new Set<() => void>();
export function onKiosk(fn: () => void): () => void { kioskListeners.add(fn); return () => { kioskListeners.delete(fn); }; }

const inCoach = () => /^\/(learn\/)?coach(\/|$)/.test(location.pathname);
function applyKiosk() {
  const on = kioskOn();
  document.documentElement.toggleAttribute('data-kiosk', on);
  if (on && inCoach()) { history.replaceState(null, '', '/learn'); dispatchEvent(new PopStateEvent('popstate')); }
  for (const l of kioskListeners) l();
}
export function setKiosk(on: boolean) { write(K.kiosk, on ? '1' : null); lastActive = Date.now(); applyKiosk(); }

async function idleSignOut() {
  try { await (await import('./phone.ts')).wipeDevice(); } catch { /* best effort */ }
  try { await fetch('/api/signout', { method: 'POST', credentials: 'same-origin' }); } catch { /* hub unreachable: the local sign-out below still happens */ }
  write(K.me, null);
  location.assign('/signin');
}

function installKiosk() {
  const style = document.createElement('style');
  // The Coach space is personal; on a shared device it is not offered at all (display:none also removes it from the accessibility tree).
  style.textContent = 'html[data-kiosk] a[href^="/coach"],html[data-kiosk] a[href^="/learn/coach"]{display:none!important}';
  document.head.appendChild(style);
  const touch = () => { lastActive = Date.now(); };
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) addEventListener(ev, touch, { passive: true });
  addEventListener('popstate', () => { if (kioskOn() && inCoach()) applyKiosk(); });
  setInterval(() => { if (kioskOn() && Date.now() - lastActive >= IDLE_MS) { lastActive = Date.now(); void idleSignOut(); } }, 1000);
  applyKiosk();
}

// Called once from the feature's index.tsx when the shell loads.
export function boot() {
  if (typeof window === 'undefined' || (window as any).__lmsFilesBoot) return;
  (window as any).__lmsFilesBoot = true;
  installMeter();
  installKiosk();
  // The phone profile (hub bundle, local database, sync) loads after the shell is interactive and only once someone is signed in.
  setTimeout(() => { void import('./phone.ts').then((m) => m.start()); }, 0);
}
