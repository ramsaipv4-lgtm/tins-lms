// Heading Strike (G-1, AC-168): one round of five questions. Off when the headingStrike switch is off.
import { useMemo, useState } from 'react';
import { t } from '../../strings/index.ts';
import { useSession } from '../../app/session.tsx';
import { useSwitches } from './story.ts';
import { ROUND_SIZE, buildRound, score } from './strike.ts';
import './coach.css';

export default function Strike() {
  const { me } = useSession();
  const sw = useSwitches();
  const [round, setRound] = useState(0);
  const questions = useMemo(() => buildRound(`strike:${me?.personId ?? 'anon'}:${round}`), [me?.personId, round]);
  const [picks, setPicks] = useState<(number | null)[]>([]);
  const [started, setStarted] = useState(false);
  if (!sw) return <p role="status">{t('app.loading')}</p>;
  if (!sw.headingStrike) return <section aria-labelledby="hs-h"><h1 id="hs-h">{t('coach.strike.title')}</h1><p role="status">{t('coach.strike.off')}</p></section>;
  const story = sw.storyMode;
  const done = started && picks.length >= ROUND_SIZE;
  const q = questions[picks.length];
  const pts = score(questions, picks);
  return (
    <section aria-labelledby="hs-h">
      <h1 id="hs-h">{t(story ? 'coach.strike.title.story' : 'coach.strike.title')}</h1>
      <div data-testid="heading-strike" data-story={story ? 'on' : 'off'}>
        {!started && (<><p>{t('coach.strike.intro', { n: ROUND_SIZE })}</p><button type="button" onClick={() => { setPicks([]); setStarted(true); }}>{t('coach.strike.start')}</button></>)}
        {started && !done && q && (
          <div>
            <p role="status">{t('coach.strike.progress', { n: picks.length + 1, total: ROUND_SIZE })}</p>
            <p id="hs-q">{t('coach.strike.question')}</p>
            <ul className="coach-answers" aria-labelledby="hs-q">
              {q.options.map((o, i) => (
                <li key={`${q.id}-${i}`}><button type="button" translate="no" onClick={() => setPicks((p) => [...p, i])}><code>{o}</code></button></li>
              ))}
            </ul>
          </div>
        )}
        {done && (
          <div>
            <p role="status">{t('coach.strike.over', { score: pts, total: ROUND_SIZE })}</p>
            <button type="button" onClick={() => { setRound((r) => r + 1); setPicks([]); setStarted(false); }}>{t('coach.strike.again')}</button>
          </div>
        )}
      </div>
    </section>
  );
}
