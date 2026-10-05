// Trainer: voice notes, typed or dictated, attached to a learner (AC-159). Stored privately, trainers only.
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useAttendCtx } from './lib.ts';

export default function Notes() {
  const { ctx, error } = useAttendCtx();
  const [people, setPeople] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [who, setWho] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const id = ctx?.classId;

  async function load() {
    if (!id) return;
    const r = await api<any>(`/api/classes/${id}/roster`);
    setPeople(r.learners);
    setNotes((await api<{ notes: any[] }>(`/api/classes/${id}/notes`)).notes);
  }
  useEffect(() => { void load().catch(() => {}); }, [id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!who || !text.trim()) { setMsg(t('attend.notes.missing')); return; }
    try {
      await api(`/api/classes/${id}/notes`, { method: 'POST', body: { personId: who, text } });
      setText(''); setMsg(t('attend.notes.saved')); await load();
    } catch { setMsg(t('attend.error')); }
  }
  const nameOf = (p: string) => people.find((x) => x.personId === p)?.name ?? p;
  const byPerson: Record<string, any[]> = {};
  for (const n of notes) (byPerson[n.personId] ??= []).push(n);

  if (error) return <p role="alert">{t('attend.error')}</p>;
  return (
    <section aria-labelledby="no-h">
      <h1 id="no-h">{t('attend.notes.title')}</h1>
      <form onSubmit={save}>
        <p><label htmlFor="n-who">{t('attend.notes.learner')}</label>{' '}
          <select id="n-who" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">{t('attend.notes.choose')}</option>
            {people.map((p) => <option key={p.personId} value={p.personId} translate="no">{p.name}</option>)}
          </select></p>
        <p><label htmlFor="n-text">{t('attend.notes.note')}</label>{' '}
          <textarea id="n-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} /></p>
        <button type="submit">{t('attend.notes.save')}</button>
        <p role="status">{msg}</p>
      </form>
      {Object.entries(byPerson).map(([p, list]) => (
        <div key={p} data-testid="learner-notes">
          <h2 translate="no">{nameOf(p)}</h2>
          <ul>{list.map((n) => <li key={n.id}>{n.text}</li>)}</ul>
        </div>
      ))}
    </section>
  );
}
