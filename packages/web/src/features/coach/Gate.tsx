// The Coach PIN gate (F-05): course content never needs a PIN, the Coach space always does.
import { useEffect, useState, type ReactNode } from 'react';
import { t } from '../../strings/index.ts';
import { useSession } from '../../app/session.tsx';
import { createPin, hasPin, lockCoach, onLockChange, pinProblem, unlockWithPin, unlockedKey } from './lib.ts';

type Mode = 'loading' | 'setup' | 'unlock' | 'open';
const MAX_TRIES = 5;

export default function PinGate({ children, needTrackers = false }: { children: (key: Uint8Array, person: string) => ReactNode; needTrackers?: boolean }) {
  const { me } = useSession();
  const person = me?.personId ?? '';
  const [mode, setMode] = useState<Mode>(() => (person && unlockedKey(person) ? 'open' : 'loading'));
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!person) return;
    let live = true;
    if (unlockedKey(person)) { setMode('open'); } else {
      setMode('loading');
      void hasPin(person).then((has) => { if (live && !unlockedKey(person)) setMode(has ? 'unlock' : 'setup'); }).catch(() => { if (live) setMode('setup'); });
    }
    const off = onLockChange(() => { if (live) { setPin(''); setConfirm(''); setMode(unlockedKey(person) ? 'open' : 'unlock'); } });
    return () => { live = false; off(); };
  }, [person]);

  if (needTrackers && me && !me.coachTrackers) return <p role="status">{t('coach.minor')}</p>;
  if (!me || mode === 'loading') return <p role="status">{t('app.loading')}</p>;
  const key = unlockedKey(person);
  if (mode === 'open' && key) {
    return (<>
      <p><button type="button" className="coach-quiet" onClick={() => lockCoach()}>{t('coach.lock')}</button></p>
      {children(key, person)}
    </>);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (tries >= MAX_TRIES) { setError(t('coach.pin.locked')); return; }
    const problem = pinProblem(pin);
    if (problem) { setError(t(`coach.pin.err.${problem}`)); return; }
    setBusy(true);
    try {
      if (mode === 'setup') {
        if (pin !== confirm) { setError(t('coach.pin.err.mismatch')); return; }
        await createPin(person, pin);
      } else if (!(await unlockWithPin(person, pin))) {
        setTries((n) => n + 1); setError(t('coach.pin.err.wrong'));
      }
    } catch (e: any) { console.error('coach pin failed', e?.name, e?.message); setError(t('app.error')); } finally { setBusy(false); setPin(''); setConfirm(''); }
  }

  return (
    <section data-testid="coach-pin">
      <h1>{mode === 'setup' ? t('coach.pin.setupTitle') : t('coach.pin.unlockTitle')}</h1>
      <p className="help">{mode === 'setup' ? t('coach.pin.setupHelp') : t('coach.pin.unlockHelp')}</p>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="coach-pin-input">{t('coach.pin.label')}</label>
          <input id="coach-pin-input" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} />
        </div>
        {mode === 'setup' && (
          <div className="field">
            <label htmlFor="coach-pin-confirm">{t('coach.pin.confirm')}</label>
            <input id="coach-pin-confirm" type="password" inputMode="numeric" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        )}
        {error && <p role="alert" className="err">{error}</p>}
        <button type="submit" disabled={busy}>{mode === 'setup' ? t('coach.pin.create') : t('coach.pin.unlock')}</button>
      </form>
    </section>
  );
}
