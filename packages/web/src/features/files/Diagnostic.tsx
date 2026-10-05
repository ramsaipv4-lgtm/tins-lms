// /learn/diagnostic (AC-95): the day's 8-question diagnostic, taken and marked on this device from the stored copy.
// The result is a mastery check in the personal database; it replicates to the hub when it can.
import { useEffect, useState, type FormEvent } from 'react';
import { t } from '../../strings/index.ts';
import * as phone from './phone.ts';
import { usePhone } from './ui.ts';

export default function Diagnostic() {
  const { bundle, ready } = usePhone();
  const [data, setData] = useState<Awaited<ReturnType<typeof phone.contentDays>> | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ day: number; correct: number; max: number; marks: boolean[] } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => { let live = true; void phone.contentDays().then((d) => { if (live) setData(d); }); return () => { live = false; }; }, [bundle, ready]);
  if (!data) return <p role="status">{t('app.loading')}</p>;
  const withQuestions = Object.keys(data.diagnostics).map(Number).sort((a, b) => a - b);
  const d = day ?? withQuestions[0] ?? null;
  const questions = d === null ? [] : data.diagnostics[d] ?? [];
  if (d === null || questions.length === 0) return <section><h1>{t('files.diag.title')}</h1><p role="status">{t('files.diag.none')}</p></section>;
  const dayNo = d;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const marks = questions.map((q) => phone.gradeAnswer(answers[q.n] ?? '', q.answer));
    const correct = marks.filter(Boolean).length;
    try { await phone.saveCheck(dayNo, correct, questions.length); setError(false); } catch { setError(true); }
    setResult({ day: dayNo, correct, max: questions.length, marks });
    setOpen(false);
  }

  return (
    <section aria-labelledby="dg-h">
      <h1 id="dg-h">{t('files.diag.title')}</h1>
      <div className="field">
        <label htmlFor="dg-day">{t('files.day.pick')}</label>
        <select id="dg-day" value={d} onChange={(e) => { setDay(Number(e.target.value)); setOpen(false); setResult(null); }}>
          {withQuestions.map((n) => <option key={n} value={n}>{t('files.day.option', { n, date: data.days.find((x) => x.index === n)?.date ?? '' })}</option>)}
        </select>
      </div>
      {!open && <p><button type="button" onClick={() => { setOpen(true); setAnswers({}); setResult(null); }}>{result ? t('files.diag.retry') : t('files.diag.start')}</button></p>}
      {open && (
        <form onSubmit={(e) => { void submit(e); }}>
          {questions.map((q) => (
            <div className="field" key={q.n} data-testid={`diag-q-${q.n}`}>
              <label htmlFor={`dq-${q.n}`}><span translate="no">{q.n}. {q.text}</span></label>
              <input id={`dq-${q.n}`} type="text" autoComplete="off" value={answers[q.n] ?? ''}
                onChange={(e) => setAnswers((o) => ({ ...o, [q.n]: e.target.value }))} />
            </div>
          ))}
          <button type="submit">{t('files.diag.submit')}</button>
        </form>
      )}
      {result && (
        <div role="status" data-testid="diag-result">
          <p><strong>{t('files.diag.score', { score: `${result.correct}/${result.max}` })}</strong></p>
          <ul>{questions.map((q, i) => <li key={q.n}>{t(result.marks[i] ? 'files.diag.right' : 'files.diag.wrong', { n: q.n })}</li>)}</ul>
        </div>
      )}
      {error && <p role="alert" className="err">{t('files.diag.saveError')}</p>}
    </section>
  );
}
