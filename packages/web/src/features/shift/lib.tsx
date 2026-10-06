// Shared helpers for the shift feature screens: polling, m:ss formatting, small form pieces.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../app/api.ts';
import { t, strings } from '../../strings/index.ts';
import './shift.css';

export { api };

// GET that never uses a cached copy (browser, proxy or service worker): approvals must show as soon as they exist.
async function fresh<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

// Fetch `path` now and every `ms` milliseconds; `reload` refetches on demand (after a write).
export function usePoll<T>(path: string, ms = 2000): { data: T | null; error: boolean; reload: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const alive = useRef(true);
  const reload = useCallback(async () => {
    try { const d = await fresh<T>(path); if (alive.current) { setData(d); setError(false); } } catch { if (alive.current) setError(true); }
  }, [path]);
  useEffect(() => {
    alive.current = true;
    void reload();
    const id = setInterval(() => { void reload(); }, ms);
    const wake = () => { void reload(); };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => { alive.current = false; clearInterval(id); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  }, [reload, ms]);
  return { data, error, reload };
}

export function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60), s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Server error body -> a translated message (keys shift.err.<code>, fallback shift.err.generic).
export function errText(e: unknown): string {
  const f = e instanceof ApiError ? Object.values(e.fields)[0] : null;
  const key = `shift.err.${f}`;
  return f && key in strings ? t(key) : t('shift.err.generic');
}

export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); return true; } catch (e) { setError(errText(e)); return false; }
  }, []);
  return { error, run, clear: () => setError(null) };
}

export function ErrorNote({ error }: { error: string | null }) {
  return error ? <p role="alert" className="err">{error}</p> : null;
}
