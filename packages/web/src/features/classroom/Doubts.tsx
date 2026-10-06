// Doubt queue (AC-91). Learners post (optionally anonymous) and upvote; the trainer sees the same list by votes
// with the author's name hidden for anonymous doubts. Exports the list so both screens share it.
import { useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useLoad } from './lib.ts';

interface Doubt { id: string; text: string; votes: number; answered: boolean; anonymous: boolean; author: string | null; voted: boolean }

export function DoubtList({ doubts, role, onChange }: { doubts: Doubt[]; role: 'learner' | 'trainer'; onChange: () => void }) {
  async function act(path: string) { try { await api(path, { method: 'POST' }); } catch { /* next poll shows the truth */ } onChange(); }
  return (
    <ul data-testid="doubt-list" role="list" style={{ listStyle: 'none', padding: 0 }}>
      {doubts.map((d) => (
        <li key={d.id} role="listitem" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, margin: '8px 0' }}>
          <p style={{ margin: 0 }} translate="no">{d.text}</p>
          <p className="help" style={{ margin: '4px 0' }}>
            {d.anonymous ? t('classroom.doubt.anonymousAuthor') : <span translate="no">{d.author}</span>} · {t('classroom.doubt.votes', { n: d.votes })}
            {d.answered ? ` · ${t('classroom.doubt.answered')}` : ''}
          </p>
          {role === 'learner' && (
            <button type="button" disabled={d.voted} onClick={() => void act(`/api/classroom/doubts/${encodeURIComponent(d.id)}/upvote`)}>
              {t(d.voted ? 'classroom.doubt.upvoted' : 'classroom.doubt.upvote', { n: d.votes })}
            </button>
          )}
          {role === 'trainer' && !d.answered && (
            <button type="button" onClick={() => void act(`/api/classroom/doubts/${encodeURIComponent(d.id)}/answered`)}>{t('classroom.doubt.markAnswered')}</button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function LDoubts() {
  const { data, error, reload } = useLoad<{ doubts: Doubt[] }>('/api/classroom/doubts', 3000);
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post() {
    if (!text.trim()) { setMsg(t('classroom.doubt.required')); return; }
    setBusy(true); setMsg(null);
    try {
      await api('/api/classroom/doubts', { body: { text: text.trim(), anonymous: anon } });
      setText(''); setAnon(false); await reload();
    } catch { setMsg(t('classroom.error')); } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="ld-h">
      <h1 id="ld-h">{t('classroom.doubt.title')}</h1>
      <p className="help">{t('classroom.doubt.intro')}</p>
      <div className="field">
        <label htmlFor="ld-text">{t('classroom.doubt.field')}</label>
        <textarea id="ld-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="field check">
        <input id="ld-anon" type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
        <label htmlFor="ld-anon">{t('classroom.doubt.anonymous')}</label>
      </div>
      <button type="button" disabled={busy} onClick={() => void post()}>{t('classroom.doubt.post')}</button>
      {msg && <p className="err" role="alert">{msg}</p>}
      {error && !data && <p className="err" role="alert">{t('classroom.error')}</p>}
      {data && data.doubts.length === 0 && <p>{t('classroom.doubt.none')}</p>}
      <DoubtList doubts={data?.doubts ?? []} role="learner" onChange={() => void reload()} />
    </section>
  );
}

export function TDoubts() {
  const { data, error, reload } = useLoad<{ doubts: Doubt[] }>('/api/classroom/doubts', 3000);
  return (
    <section aria-labelledby="td-h">
      <h1 id="td-h">{t('classroom.doubt.teachTitle')}</h1>
      {error && !data && <p className="err" role="alert">{t('classroom.error')}</p>}
      {data && data.doubts.length === 0 && <p>{t('classroom.doubt.none')}</p>}
      <DoubtList doubts={data?.doubts ?? []} role="trainer" onChange={() => void reload()} />
    </section>
  );
}
