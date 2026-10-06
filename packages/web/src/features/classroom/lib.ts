// Shared helpers for the classroom group: polling data loader and a score formatter.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../app/api.ts';

// Loads `path` now and every `ms` while mounted; `reload()` fetches again at once.
export function useLoad<T>(path: string, ms = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const live = useRef(true);
  const reload = useCallback(async () => {
    try {
      const d = await api<T>(path);
      if (live.current) { setData(d); setError(false); }
    } catch { if (live.current) setError(true); }
  }, [path]);
  useEffect(() => {
    live.current = true;
    void reload();
    const id = ms > 0 ? setInterval(() => void reload(), ms) : null;
    return () => { live.current = false; if (id) clearInterval(id); };
  }, [reload, ms]);
  return { data, error, reload };
}

export const fraction = (score: number | null | undefined, max: number | null | undefined): string =>
  `${score ?? '?'}/${max ?? '?'}`;
