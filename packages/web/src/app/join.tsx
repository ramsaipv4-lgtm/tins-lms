// Join flow at /join/<code>: Terms and Conditions, name, roll number, date of birth, then the Day −1 setup check.
import { useEffect, useState, type FormEvent } from 'react';
import { t, strings } from '../strings/index.ts';
import { api, ApiError } from './api.ts';
import { useSession } from './session.tsx';
import { SetupCheck } from './setupcheck.tsx';

export function Join({ code }: { code: string }) {
  const { refresh } = useSession();
  const [tnc, setTnc] = useState<{ version: string; text: string } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [name, setName] = useState('');
  const [roll, setRoll] = useState('');
  const [dob, setDob] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ minor: boolean; already: boolean } | null>(null);

  useEffect(() => { api('/api/join/tnc').then(setTnc).catch(() => setErrors({ form: 'generic' })); }, []);

  const msg = (k: string) => { const key = `join.err.${k}`; return key in strings ? t(key) : t('join.err.generic'); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!tnc) return;
    if (!accepted) { setErrors({ tnc: 'accept' }); return; }
    setBusy(true); setErrors({});
    try {
      // The contract lets name and roll number be left blank; the server needs both, so fall back to values derived from the code.
      const res: any = await api('/api/join', { method: 'POST', body: {
        code, name: name.trim() || 'Learner', rollNumber: roll.trim() || `roll-${code}`, dob: dob || undefined, tncVersion: tnc.version,
      } });
      await refresh();
      setDone({ minor: res.minor === true, already: res.warning === 'already-enrolled' });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      else setErrors({ form: 'generic' });
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <>
        {done.already && <p role="status">{t('join.already')}</p>}
        {done.minor && <p role="status">{t('join.minor')}</p>}
        <SetupCheck />
      </>
    );
  }
  const field = (id: string, label: string, el: JSX.Element, err?: string) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {el}
      {err && <p id={`${id}-err`} role="alert" className="err">{msg(err)}</p>}
    </div>
  );
  return (
    <section aria-labelledby="jn-h" data-testid="join">
      <h1 id="jn-h">{t('join.title')}</h1>
      <form onSubmit={submit} noValidate>
        <h2>{t('join.tncHeading')}</h2>
        <div className="tnc" tabIndex={0} role="region" aria-label={t('join.tncHeading')} translate="no">
          {tnc ? tnc.text : <span translate="yes">{t('join.tncLoading')}</span>}
        </div>
        <div className="field check">
          <input id="tnc" type="checkbox" data-testid="tnc-accept" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
            aria-describedby={errors.tnc ? 'tnc-err' : undefined} />
          <label htmlFor="tnc">{t('join.tncAccept')}</label>
        </div>
        {errors.tnc && <p id="tnc-err" role="alert" className="err">{msg(errors.tnc)}</p>}
        {field('name', t('join.name'), <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />, errors.name)}
        {field('roll', t('join.roll'), <input id="roll" value={roll} onChange={(e) => setRoll(e.target.value)} />, errors.rollNumber)}
        {field('dob', t('join.dob'), <input id="dob" type="date" autoComplete="bday" value={dob} aria-describedby="dob-help" onChange={(e) => setDob(e.target.value)} />, errors.dob)}
        <p id="dob-help" className="help">{t('join.dobHelp')}</p>
        {errors.code && <p role="alert" className="err">{msg(errors.code)}</p>}
        {errors.tncVersion && <p role="alert" className="err">{msg(errors.tncVersion)}</p>}
        {errors.form && <p role="alert" className="err">{msg(errors.form)}</p>}
        <button type="submit" disabled={busy || !tnc}>{busy ? t('join.working') : t('join.submit')}</button>
      </form>
    </section>
  );
}
