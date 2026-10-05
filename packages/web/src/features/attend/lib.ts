// Shared helpers for the attend group: class context and polling.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../app/api.ts';

export interface AttendCtx { classId: string; className: string; day: number; days: number[]; closed: boolean; wrapup: any }

export function useAttendCtx(day?: number) {
  const [ctx, setCtx] = useState<AttendCtx | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    try { setCtx(await api<AttendCtx>('/api/attend/context' + (day === undefined ? '' : `?day=${day}`))); setError(false); }
    catch { setError(true); }
  }, [day]);
  useEffect(() => { void reload(); }, [reload]);
  return { ctx, error, reload };
}

// Calls `fn` now and every `ms` while mounted.
export function usePoll(fn: () => void | Promise<void>, ms: number, deps: unknown[] = []) {
  useEffect(() => {
    let live = true;
    const run = () => { if (live) void fn(); };
    run();
    const id = setInterval(run, ms);
    return () => { live = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useData<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    if (!path) return;
    try { setData(await api<T>(path)); setError(false); } catch { setError(true); }
  }, [path]);
  useEffect(() => { void reload(); }, [reload, ...deps]);
  return { data, error, reload };
}
