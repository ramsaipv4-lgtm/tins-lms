// First-run screen (AC-155, SPEC §17.4): four ways to start. Shown by index.tsx on a fresh app.
import { useState, type FormEvent } from 'react';
import { t } from '../../strings/index.ts';
import { api, ApiError } from '../../app/api.ts';

type Step = 'choose' | 'join' | 'hub' | 'hosted';

function deviceId(): string {
  try {
    let id = localStorage.getItem('lms.deviceId');
    if (!id) { id = globalThis.crypto.randomUUID(); localStorage.setItem('lms.deviceId', id); }
    return id;
  } catch { return globalThis.crypto.randomUUID(); }
}

export default function FirstRun() {
  const [step, setStep] = useState<Step>('choose');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [pairing, setPairing] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const msg = (k: string) => { const key = `learn.first.err.${k}`; return ['required', 'unknown', 'used', 'expired'].includes(k) ? t(key) : t('learn.first.err.generic'); };
  const to = (step2: Step) => { setErr(''); setStep(step2); };

  function joinClass(e: FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (!c) { setErr('required'); return; }
    location.assign(`/join/${encodeURIComponent(c)}`);
  }

  async function connect(e: FormEvent) {
    e.preventDefault();
    const c = pairing.trim();
    if (!c) { setErr('required'); return; }
    setBusy(true); setErr('');
    try {
      const base = address.trim().replace(/\/+$/, '');
      if (!base || base === location.origin) {
        await api('/api/pairing/claim', { body: { code: c, deviceId: deviceId() } });
      } else {
        const res = await fetch(`${base}/api/pairing/claim`, {
          method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: c, deviceId: deviceId() }),
        });
        if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
      }
      location.assign('/');
    } catch (x) {
      setErr(x instanceof ApiError ? (Object.values(x.fields)[0] as string) || 'generic' : 'generic');
      setBusy(false);
    }
  }

  async function phoneOnly() {
    setBusy(true); setErr('');
    try { await api('/api/join/phone-only', { method: 'POST', body: {} }); location.assign('/learn'); }
    catch { setErr('generic'); setBusy(false); }
  }

  const field = (id: string, label: string, help: string, value: string, set: (v: string) => void) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(e) => set(e.target.value)} autoComplete="off" aria-describedby={`${id}-help`} />
      <p id={`${id}-help`} className="help">{help}</p>
    </div>
  );
  const error = err && <p role="alert" className="err">{msg(err)}</p>;
  const back = <button type="button" className="secondary" onClick={() => to('choose')}>{t('learn.first.back')}</button>;

  return (
    <section data-testid="first-run" aria-labelledby="fr-h">
      {step === 'choose' && (
        <>
          <h1 id="fr-h">{t('learn.first.title')}</h1>
          <p>{t('learn.first.intro')}</p>
          <ul className="choices">
            <li><button type="button" onClick={() => to('join')} disabled={busy}>{t('learn.first.join')}</button></li>
            <li><button type="button" onClick={() => to('hub')} disabled={busy}>{t('learn.first.hub')}</button></li>
            <li><button type="button" onClick={() => to('hosted')} disabled={busy}>{t('learn.first.hosted')}</button></li>
            <li><button type="button" onClick={() => { void phoneOnly(); }} disabled={busy}>{t('learn.first.phone')}</button></li>
          </ul>
          {error}
        </>
      )}
      {step === 'join' && (
        <form onSubmit={joinClass} noValidate>
          <h1 id="fr-h">{t('learn.first.joinTitle')}</h1>
          {field('fr-code', t('learn.first.code'), t('learn.first.codeHelp'), code, setCode)}
          {error}
          <p className="row"><button type="submit">{t('learn.first.continue')}</button>{back}</p>
        </form>
      )}
      {step === 'hub' && (
        <form onSubmit={connect} noValidate>
          <h1 id="fr-h">{t('learn.first.hubTitle')}</h1>
          {field('fr-addr', t('learn.first.hubAddress'), t('learn.first.hubHelp'), address, setAddress)}
          {field('fr-pair', t('learn.first.pairing'), t('learn.first.pairingHelp'), pairing, setPairing)}
          {error}
          <p className="row"><button type="submit" disabled={busy}>{busy ? t('learn.first.working') : t('learn.first.connect')}</button>{back}</p>
        </form>
      )}
      {step === 'hosted' && (
        <>
          <h1 id="fr-h">{t('learn.first.hostedTitle')}</h1>
          <p>{t('learn.first.hostedText')}</p>
          <p className="row"><button type="button" onClick={() => location.assign('/signin')}>{t('learn.first.hostedGo')}</button>{back}</p>
        </>
      )}
    </section>
  );
}
