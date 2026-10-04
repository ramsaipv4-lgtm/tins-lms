// Day −1 setup check (AC-81): data-testid="setup-check", every item has data-state="pass|fail".
import { useCallback, useEffect, useState } from 'react';
import { t } from '../strings/index.ts';
import { api } from './api.ts';
import { Link } from './router.tsx';
import { useSession } from './session.tsx';

interface Item { id: string; label: string; ok: boolean }

async function run(): Promise<Item[]> {
  const check = async (id: string, fn: () => Promise<boolean>): Promise<Item> => {
    let ok = false;
    try { ok = await fn(); } catch { ok = false; }
    return { id, label: t(`setup.${id}`), ok };
  };
  return Promise.all([
    check('secure', async () => window.isSecureContext),
    check('worker', async () => 'serviceWorker' in navigator),
    check('storage', async () => {
      await new Promise<void>((res, rej) => { const r = indexedDB.open('lms-setup-check'); r.onsuccess = () => { r.result.close(); res(); }; r.onerror = () => rej(r.error); });
      const est = await navigator.storage?.estimate?.();
      return !est?.quota || est.quota - (est.usage ?? 0) > 50 * 1024 * 1024;
    }),
    check('server', async () => (await api('/api/health')).ok === true),
    check('account', async () => !!(await api('/api/me')).personId),
    check('tnc', async () => !(await api('/api/me')).tnc.needsAcceptance),
  ]);
}

export function SetupCheck() {
  const { me } = useSession();
  const [items, setItems] = useState<Item[] | null>(null);
  const go = useCallback(() => { setItems(null); void run().then(setItems); }, []);
  useEffect(go, [go]);
  return (
    <section aria-labelledby="sc-h">
      <h1 id="sc-h">{t('setup.title')}</h1>
      <p>{t('setup.intro')}</p>
      {!items ? <p role="status">{t('setup.running')}</p> : (
        <ul data-testid="setup-check" className="checks">
          {items.map((i) => (
            <li key={i.id} data-testid={`setup-${i.id}`} data-state={i.ok ? 'pass' : 'fail'} className={i.ok ? 'pass' : 'fail'}>
              <span aria-hidden="true">{i.ok ? '✓' : '✗'}</span> {i.label}: <strong>{i.ok ? t('setup.pass') : t('setup.fail')}</strong>
            </li>
          ))}
        </ul>
      )}
      <p className="row">
        <button type="button" onClick={go}>{t('setup.recheck')}</button>
        {me && <Link to="/" className="btn">{t('setup.done')}</Link>}
      </p>
    </section>
  );
}
