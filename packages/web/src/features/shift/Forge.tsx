// Practice forge first (AC-170, §20.1): the exercise runs on the hub's Forgejo; GitHub comes second.
import { t } from '../../strings/index.ts';
import { Link } from '../../app/router.tsx';
import { ErrorNote, api, useAction, usePoll } from './lib.tsx';

type S = { done: boolean; forgeUser: string | null; repos: string[]; githubUser: string | null };

export default function Forge() {
  const { data, reload } = usePoll<S>('/api/forge/state', 5000);
  const { error, run } = useAction();
  return (
    <section aria-labelledby="fg-h">
      <h1 id="fg-h">{t('shift.forge.title')}</h1>
      <div data-testid="forge-exercise" data-state={data?.done ? 'done' : 'todo'} className="sh-card">
        <h2>{t('shift.forge.exercise')}</h2>
        <p>{t('shift.forge.intro')}</p>
        <ol><li>{t('shift.forge.s1')}</li><li>{t('shift.forge.s2')}</li><li>{t('shift.forge.s3')}</li></ol>
        {data?.done
          ? <p role="status" className="sh-ok">{t('shift.forge.done', { repo: data.repos[0] ?? '' })}</p>
          : <button type="button" onClick={() => run(async () => { await api('/api/forge/check', { method: 'POST', body: {} }); await reload(); })}>{t('shift.forge.check')}</button>}
        <ErrorNote error={error} />
      </div>
      <p>{t('shift.forge.later')} <Link to="/learn/accounts">{t('shift.nav.accounts')}</Link></p>
    </section>
  );
}
