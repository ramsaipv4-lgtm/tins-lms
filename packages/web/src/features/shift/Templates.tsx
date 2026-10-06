// Runbook and ADR templates graded by rubric (AC-164, C-8).
import { useState } from 'react';
import { t } from '../../strings/index.ts';
import { ErrorNote, api, useAction } from './lib.tsx';

type Res = { rows: { id: string; pass: boolean }[]; earned: number; max: number };

function Doc({ kind }: { kind: 'runbook' | 'adr' }) {
  const [text, setText] = useState(t(`shift.tpl.${kind}.start`));
  const [res, setRes] = useState<Res | null>(null);
  const { error, run } = useAction();
  return (
    <div data-testid={`template-${kind}`}>
      <h2>{t(`shift.tpl.${kind}.title`)}</h2>
      <div className="field sh-form"><label htmlFor={`tp-t-${kind}`}>{t(`shift.tpl.${kind}.title`)}</label>
        <textarea id={`tp-t-${kind}`} rows={6} value={text} onChange={(e) => setText(e.target.value)} /></div>
      <button type="button" onClick={() => run(async () => setRes(await api('/api/corp/templates/grade', { method: 'POST', body: { kind, text } })))}>{t(`shift.tpl.${kind}.grade`)}</button>
      {res && (
        <div role="status" data-testid={`template-score-${kind}`}>
          <p>{t('shift.tpl.score', { earned: res.earned, max: res.max })}</p>
          <ul className="sh-list">{res.rows.map((r) => <li key={r.id} className={r.pass ? 'sh-ok' : 'sh-bad'}>{t(`shift.tpl.row.${r.id}`)}: {r.pass ? t('shift.tpl.met') : t('shift.tpl.missing')}</li>)}</ul>
        </div>
      )}
      <ErrorNote error={error} />
    </div>
  );
}

export default function Templates() {
  return <><h1>{t('shift.tpl.title')}</h1><Doc kind="runbook" /><Doc kind="adr" /></>;
}
