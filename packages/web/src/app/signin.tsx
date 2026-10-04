import { useState } from 'react';
import { t } from '../strings/index.ts';
import { api } from './api.ts';
import { navigate } from './router.tsx';
import { useSession } from './session.tsx';

// Passkey and Google sign-in need server routes that SPEC Appendix A does not define yet (gap); until then the buttons
// call POST /api/signin/passkey and show "unavailable" if the server has no such route.
export function SignIn() {
  const { refresh } = useSession();
  const [msg, setMsg] = useState('');
  async function go(method: 'passkey' | 'google') {
    setMsg('');
    try {
      await api(`/api/signin/${method}`, { method: 'POST', body: {} });
      if (await refresh()) navigate(new URLSearchParams(location.search).get('next') || '/', true);
    } catch { setMsg(t('signin.unavailable')); }
  }
  return (
    <section aria-labelledby="si-h" data-testid="signin">
      <h1 id="si-h">{t('signin.title')}</h1>
      <p>{t('signin.intro')}</p>
      <p className="row">
        <button type="button" onClick={() => go('passkey')}>{t('signin.passkey')}</button>
        <button type="button" onClick={() => go('google')}>{t('signin.google')}</button>
      </p>
      {msg && <p role="alert">{msg}</p>}
    </section>
  );
}
