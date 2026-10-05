// Error notebook (AC-85): the learner's wrong answers, grouped by subtopic.
import { useEffect, useState } from 'react';
import { t } from '../../strings/index.ts';
import { api } from '../../app/api.ts';

interface Item { day: number; question: string; given: string; correct: string }
interface Data { subtopics: { subtopic: string; items: Item[] }[] }

export default function Errors() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { api<Data>('/api/learn/errors').then(setData).catch(() => setError(true)); }, []);
  if (error) return <p role="alert">{t('learn.error')}</p>;
  if (!data) return <p role="status">{t('learn.loading')}</p>;
  return (
    <section aria-labelledby="en-h">
      <h1 id="en-h">{t('learn.errors.title')}</h1>
      <p>{t('learn.errors.intro')}</p>
      <div data-testid="error-notebook">
        {data.subtopics.length === 0 && <p>{t('learn.errors.none')}</p>}
        {data.subtopics.map((g) => (
          <section key={g.subtopic} aria-label={g.subtopic}>
            <h2 translate="no">{g.subtopic}</h2>
            <ul>
              {g.items.map((i, k) => (
                <li key={k}>
                  <p><strong>{t('learn.errors.day', { n: i.day })}.</strong> <span translate="no">{i.question}</span></p>
                  <p>{t('learn.errors.given')} <span translate="no">{i.given || t('learn.errors.blank')}</span></p>
                  <p>{t('learn.errors.correct')} <span translate="no">{i.correct}</span></p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
