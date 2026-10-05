// Shared helpers for the tele group: class/day context, polling, formatting.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';

export interface DayRef { index: number; date: string | null; mode: string | null }
export interface ClassCtx {
  id: string; name: string; role: 'trainer' | 'substitute' | 'learner'; todayIndex: number;
  days: DayRef[]; selfLearnDays: number[]; aiOn: boolean;
}

export function fmtDur(sec: number): string {
  const s = Math.round(Math.abs(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Loads GET /api/tele/context once; `cls` is the first class the person can see.
export function useClass(): { cls: ClassCtx | null; ready: boolean; error: boolean } {
  const [state, setState] = useState<{ cls: ClassCtx | null; ready: boolean; error: boolean }>({ cls: null, ready: false, error: false });
  useEffect(() => {
    let live = true;
    api<{ classes: ClassCtx[] }>('/api/tele/context')
      .then((r) => { if (live) setState({ cls: r.classes[0] ?? null, ready: true, error: false }); })
      .catch(() => { if (live) setState({ cls: null, ready: true, error: true }); });
    return () => { live = false; };
  }, []);
  return state;
}

// Calls `fn` now and then every `ms` while the tab is visible; returns a manual reload.
export function usePoll(fn: () => Promise<void> | void, ms: number, deps: unknown[]): () => void {
  const ref = useRef(fn);
  ref.current = fn;
  const run = useCallback(() => { try { void Promise.resolve(ref.current()).catch(() => {}); } catch { /* ignore */ } }, []);
  useEffect(() => {
    run();
    const id = setInterval(() => { if (document.visibilityState !== 'hidden') run(); }, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return run;
}

export function DayPicker({ cls, value, onChange }: { cls: ClassCtx; value: number; onChange: (n: number) => void }) {
  return (
    <div className="field">
      <label htmlFor="tele-day">{t('tele.day.pick')}</label>
      <select id="tele-day" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {cls.days.map((d) => <option key={d.index} value={d.index}>{t('tele.day.option', { n: d.index, date: d.date ?? '' })}</option>)}
      </select>
    </div>
  );
}

export function Notice({ children }: { children: string }) {
  return <p role="status" className="help">{children}</p>;
}
