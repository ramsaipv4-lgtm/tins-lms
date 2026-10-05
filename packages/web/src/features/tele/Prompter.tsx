// Trainer teleprompter (AC-83): shows the script section by section, releases sections to learners with "next",
// and shows pacing against the plan. The same view runs in rehearsal mode, where nothing is released (AC-158).
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { pace } from '../../../../core/src/pace.ts';
import { DayPicker, fmtDur, usePoll, type ClassCtx } from './lib.tsx';

export interface TpSection { id: string; title: string; plannedSec: number; graded: boolean; released: boolean; text?: string }
export interface TpEvent { sectionId: string; at: number }
interface DayView { index: number; date: string | null; sections: TpSection[]; mode: string | null }

export function paceText(behindSec: number): string {
  if (Math.round(behindSec) === 0) return t('tele.pace.even');
  return behindSec > 0 ? t('tele.pace.behind', { t: fmtDur(behindSec) }) : t('tele.pace.ahead', { t: fmtDur(behindSec) });
}

const storeKey = (cls: string, day: number) => `tele.events.${cls}.${day}`;
function loadEvents(cls: string, day: number): TpEvent[] {
  try { const v = JSON.parse(localStorage.getItem(storeKey(cls, day)) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveEvents(cls: string, day: number, ev: TpEvent[]) {
  try { localStorage.setItem(storeKey(cls, day), JSON.stringify(ev)); } catch { /* private window */ }
}

export interface PrompterProps {
  cls: ClassCtx;
  rehearsal?: boolean;
  dayIndex: number;
  onDay?: (n: number) => void;
  // rehearsal: reports the final numbers when the trainer ends the run
  startedAt?: number;
  onFinish?: (sections: TpSection[], events: TpEvent[], now: number) => void;
}

export function Prompter({ cls, rehearsal, dayIndex, onDay, onFinish, startedAt }: PrompterProps) {
  const [day, setDay] = useState<DayView | null>(null);
  const [events, setEvents] = useState<TpEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const seeded = useRef<string>('');

  usePoll(async () => {
    const d = await api<DayView>(`/api/tele/classes/${cls.id}/days/${dayIndex}`);
    setDay(d);
  }, rehearsal ? 60000 : 3000, [cls.id, dayIndex, rehearsal]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // First load of a day: restore local pacing events, else start at the section that is already released.
  useEffect(() => {
    if (!day || seeded.current === `${cls.id}.${dayIndex}`) return;
    seeded.current = `${cls.id}.${dayIndex}`;
    if (rehearsal) { setEvents([{ sectionId: day.sections[0]?.id ?? '', at: startedAt ?? Date.now() }].filter((e) => e.sectionId)); return; }
    const saved = loadEvents(cls.id, dayIndex).filter((e) => day.sections.some((s) => s.id === e.sectionId));
    if (saved.length) { setEvents(saved); return; }
    let last = -1;
    day.sections.forEach((s, i) => { if (s.released) last = i; });
    if (last >= 0) { const ev = [{ sectionId: day.sections[last].id, at: Date.now() }]; setEvents(ev); saveEvents(cls.id, dayIndex, ev); }
  }, [day, cls.id, dayIndex, rehearsal]);

  const sections = day?.sections ?? [];
  const result = useMemo(() => pace(sections.map((s) => ({ id: s.id, plannedSec: s.plannedSec })), events, now), [sections, events, now]);
  const currentIdx = result.currentId ? sections.findIndex((s) => s.id === result.currentId) : -1;
  const next = sections[currentIdx + 1];

  async function goNext() {
    if (!next || busy) return;
    setBusy(true); setError('');
    try {
      if (!rehearsal) await api(`/api/classes/${cls.id}/teleprompter`, { method: 'POST', body: { sectionId: next.id, dayIndex } });
      const ev = [...events, { sectionId: next.id, at: Date.now() }];
      setEvents(ev);
      if (!rehearsal) saveEvents(cls.id, dayIndex, ev);
      setNow(Date.now());
      const d = await api<DayView>(`/api/tele/classes/${cls.id}/days/${dayIndex}`);
      setDay(d);
    } catch { setError(t('tele.err.generic')); } finally { setBusy(false); }
  }
  async function releaseAll() {
    setBusy(true); setError('');
    try {
      await api(`/api/classes/${cls.id}/teleprompter`, { method: 'POST', body: { releaseAll: true, dayIndex } });
      setDay(await api<DayView>(`/api/tele/classes/${cls.id}/days/${dayIndex}`));
    } catch { setError(t('tele.err.generic')); } finally { setBusy(false); }
  }

  const cur = currentIdx >= 0 ? sections[currentIdx] : null;
  return (
    <section data-testid="teleprompter" aria-label={t(rehearsal ? 'tele.rehearsal.region' : 'tele.prompter.region')}>
      {!rehearsal && onDay && <DayPicker cls={cls} value={dayIndex} onChange={onDay} />}
      {!day && !error && <p role="status">{t('app.loading')}</p>}
      {day && (
        <>
          <p data-testid="tp-pace" role="status" aria-live="polite" className="tp-pace">
            {events.length ? paceText(result.behindSec) : t('tele.pace.notStarted')}
          </p>
          <div className="row">
            <button type="button" data-testid="tp-next" onClick={goNext} disabled={!next || busy}>{t('tele.next')}</button>
            {!rehearsal && <button type="button" onClick={releaseAll} disabled={busy}>{t('tele.releaseAll')}</button>}
            {rehearsal && onFinish && <button type="button" onClick={() => onFinish(sections, events, Date.now())}>{t('tele.rehearsal.finish')}</button>}
          </div>
          {error && <p role="alert" className="err">{error}</p>}
          <h2>{cur ? t('tele.current', { title: cur.title }) : t('tele.noCurrent')}</h2>
          {cur && (
            <pre translate="no" style={{ whiteSpace: 'pre-wrap', font: 'inherit', fontSize: '1.25rem', lineHeight: 1.6, background: '#f3f3f3', padding: 12, borderRadius: 6 }}>{cur.text}</pre>
          )}
          <h2>{t('tele.sections')}</h2>
          <ol>
            {sections.map((s, i) => {
              const row = result.perSection[i];
              const state = i === currentIdx ? t('tele.state.current') : row?.actualSec != null ? t('tele.state.done') : s.released ? t('tele.state.released') : t('tele.state.upcoming');
              return (
                <li key={s.id} data-state={i === currentIdx ? 'current' : row?.actualSec != null ? 'done' : 'todo'}>
                  <span translate="no">{s.title}</span>{' '}
                  <span>{t('tele.planned', { t: fmtDur(s.plannedSec) })}</span>{' '}
                  {row?.deltaSec != null && <span>{t(row.deltaSec > 0 ? 'tele.over' : 'tele.under', { t: fmtDur(row.deltaSec) })}</span>}{' '}
                  <strong>{state}</strong>
                </li>
              );
            })}
          </ol>
        </>
      )}
      {error && !day && <p role="alert" className="err">{error}</p>}
    </section>
  );
}
