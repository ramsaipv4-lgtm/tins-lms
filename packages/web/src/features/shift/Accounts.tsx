// Accounts: link a GitHub username later; the GitHub pass then offers to move the practice repos (AC-170).
import { useState, type FormEvent } from 'react';
import { t } from '../../strings/index.ts';
import { ErrorNote, api, useAction, usePoll } from './lib.tsx';

type S = { done: boolean; githubUser: string | null; githubPass: boolean; moved: boolean; repos: string[] };

export default function Accounts() {
  const { data, reload } = usePoll<S>('/api/forge/state', 5000);
  const [name, setName] = useState('');
  const { error, run } = useAction();
  const link = (e: FormEvent) => { e.preventDefault(); void run(async () => { await api('/api/forge/link', { method: 'POST', body: { githubUser: name } }); await reload(); }); };
  return (
    <section aria-labelledby="ac-h">
      <h1 id="ac-h">{t('shift.accounts.title')}</h1>
      {!data?.githubUser && (
        <form onSubmit={link} className="sh-form">
          <div className="field"><label htmlFor="ac-gh">{t('shift.accounts.github')}</label>
            <input id="ac-gh" value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="none" /></div>
          <button type="submit">{t('shift.accounts.link')}</button>
        </form>
      )}
      {data?.githubUser && <p role="status">{t('shift.accounts.linked', { user: data.githubUser })}</p>}
      {data?.githubUser && data.githubPass && (
        <div className="sh-card" data-testid="github-pass">
          <h2>{t('shift.accounts.pass')}</h2>
          <p>{t('shift.accounts.passHelp')}</p>
          {data.moved
            ? <p role="status" className="sh-ok">{t('shift.accounts.moved', { user: data.githubUser })}</p>
            : data.done
              ? <button type="button" onClick={() => run(async () => { await api('/api/forge/move', { method: 'POST', body: {} }); await reload(); })}>{t('shift.accounts.move')}</button>
              : <p>{t('shift.accounts.finishFirst')}</p>}
        </div>
      )}
      <ErrorNote error={error} />
    </section>
  );
}
