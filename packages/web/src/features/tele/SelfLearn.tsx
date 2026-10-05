// Self-learn (AI-delivered) player (AC-151): plays the day's script section by section, runs the scripted quiz
// by itself and queues questions it cannot answer. With AI off it plays text only and answers nothing.
import { useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { usePoll, type ClassCtx } from './lib.tsx';

interface View {
  active: boolean; aiOn: boolean; total: number; current: number; done: boolean; quizRan: boolean;
  sections: { id: string; title: string; graded: boolean; text: string }[]; queue: { text: string }[];
}

export function SelfLearn({ cls, dayIndex }: { cls: ClassCtx; dayIndex: number }) {
  const [v, setV] = useState<View | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  usePoll(async () => { setV(await api<View>(`/api/tele/classes/${cls.id}/self-learn/${dayIndex}`)); }, 4000, [cls.id, dayIndex]);
  if (!v || !v.active) return null;

  async function next() {
    try { setV(await api<View>(`/api/tele/classes/${cls.id}/self-learn/next`, { method: 'POST', body: { dayIndex } })); } catch { setMsg(t('tele.err.generic')); }
  }
  async function ask() {
    if (!q.trim()) return;
    try {
      const r = await api<{ queue: { text: string }[] }>(`/api/tele/classes/${cls.id}/self-learn/${dayIndex}/ask`, { method: 'POST', body: { text: q.trim() } });
      setV((o) => (o ? { ...o, queue: r.queue } : o));
      setQ(''); setMsg(t('tele.self.queued'));
    } catch { setMsg(t('tele.err.generic')); }
  }
  return (
    <section data-testid="self-learn" aria-label={t('tele.self.region')}>
      <h2>{t('tele.self.title')}</h2>
      <p className="help">{t(v.aiOn ? 'tele.self.aiOn' : 'tele.self.aiOff')}</p>
      <p role="status">{t('tele.self.progress', { n: Math.max(v.current + 1, 0), total: v.total })}</p>
      {v.sections.map((s, i) => (
        <article key={s.id}>
          <h3 translate="no">{s.title}</h3>
          <pre translate="no" style={{ whiteSpace: 'pre-wrap', font: 'inherit' }}>{s.text}</pre>
          {s.graded && v.quizRan && i === v.current && <p role="status">{t('tele.self.quiz')}</p>}
        </article>
      ))}
      <div className="row">
        <button type="button" onClick={next} disabled={v.done}>{t('tele.self.next')}</button>
      </div>
      <div className="field">
        <label htmlFor="sl-q">{t('tele.self.question')}</label>
        <input id="sl-q" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <button type="button" onClick={ask}>{t('tele.self.ask')}</button>
      {msg && <p role="status">{msg}</p>}
      {v.queue.length > 0 && (
        <>
          <h3>{t('tele.self.queueTitle')}</h3>
          <ul>{v.queue.map((x, i) => <li key={i} translate="no">{x.text}</li>)}</ul>
        </>
      )}
    </section>
  );
}
