// The Coach day timeline (AC-156, PLAN 7.2): study blocks from the class schedule and cards due.
import { useEffect, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import PinGate from './Gate.tsx';
import { useStoryMode } from './story.ts';
import './coach.css';

interface Section { id: string; title: string; plannedSec: number; graded: boolean; kind: string; released: boolean }
interface Day { index: number; date: string; start: string; end: string; sections: Section[] }
interface Timeline { classId: string | null; className: string; today: number | null; days: Day[]; cardsDue: number }

export function dayLabel(d: Day): string {
  return t('coach.timeline.dayLink', { n: d.index, date: d.date });
}

function View() {
  const [data, setData] = useState<Timeline | null>(null);
  const [error, setError] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const story = useStoryMode();
  useEffect(() => { api<Timeline>('/api/coach/timeline').then(setData).catch(() => setError(true)); }, []);
  if (error) return <p role="alert">{t('app.error')}</p>;
  if (!data) return <p role="status">{t('app.loading')}</p>;
  if (!data.days.length) return <section aria-labelledby="tl-h"><h1 id="tl-h">{t('coach.timeline.title')}</h1><p>{t('coach.timeline.none')}</p><p>{t('coach.timeline.cards', { n: data.cardsDue })}</p></section>;
  const idx = picked ?? data.today ?? 0;
  const day = data.days[Math.min(idx, data.days.length - 1)];
  return (
    <section aria-labelledby="tl-h">
      <h1 id="tl-h">{t('coach.timeline.title')}</h1>
      <nav aria-label={t('coach.timeline.days')}>
        <ul className="coach-chips">
          {data.today !== null && <li><button type="button" className="coach-quiet" onClick={() => setPicked(data.today)}>{t('coach.timeline.today')}</button></li>}
          {data.days.map((d) => (
            <li key={d.index}><button type="button" className="coach-quiet" aria-pressed={d.index === day.index} onClick={() => setPicked(d.index)}>{dayLabel(d)}</button></li>
          ))}
        </ul>
      </nav>
      <div data-testid="day-timeline" data-day={day.index} data-story={story ? 'on' : 'off'}>
        <h2>{t('coach.timeline.dayHeading', { n: day.index, date: day.date })}</h2>
        <div className="coach-block" data-kind="study">
          <strong>{day.start}–{day.end}</strong> {t(story ? 'coach.timeline.study.story' : 'coach.timeline.study', { name: data.className })}
        </div>
        {day.sections.length > 0 && (
          <ul>
            {day.sections.map((s) => s.released
              ? <li key={s.id} data-testid={`section-${s.id}`} className={story ? 'coach-block coach-story' : 'coach-block'}>{story ? t('coach.story.chapter') : t('coach.timeline.block')}: <span translate="no">{s.title}</span> ({Math.round(s.plannedSec / 60)} {t('coach.timeline.min')})</li>
              : <li key={s.id} data-testid={`locked-${s.id}`} className="coach-block" data-kind="locked">{t('coach.timeline.locked')}: <span translate="no">{s.title}</span></li>)}
          </ul>
        )}
        <div className="coach-block" data-kind="cards">{t('coach.timeline.cards', { n: data.cardsDue })}</div>
      </div>
    </section>
  );
}

export default function Timeline() {
  return <PinGate>{() => <View />}</PinGate>;
}
