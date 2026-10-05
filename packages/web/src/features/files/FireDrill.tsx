// /teach/fire-drill (AC-167): a rehearsal of the hub going down in class. Three steps: start, stop the hub (phones keep
// working from their stored copy), start the hub again (phones catch up). The trainer's device runs the same checks
// a phone would, and phones that see the drill running report back on their own.
import { useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import * as phone from './phone.ts';
import { usePhone } from './ui.ts';

type Step = 0 | 1 | 2 | 3;
interface Checks { hasBundle: boolean; sections: number; opened: number; worker: boolean }
interface Ack { personId: string; ok: boolean }

export default function FireDrill() {
  usePhone();
  const [step, setStep] = useState<Step>(0);
  const [drill, setDrill] = useState<string | null>(null);
  const [checks, setChecks] = useState<Checks | null>(null);
  const [hub, setHub] = useState<boolean | null>(null);
  const [acks, setAcks] = useState<Ack[]>([]);
  const [caught, setCaught] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const classKey = () => phone.getBundle()?.classes[0]?.key ?? null;
  const reach = async () => { try { await api('/api/health'); return true; } catch { return false; } };

  async function start() {
    setBusy(true);
    const key = classKey();
    try { if (key) setDrill((await api<{ id: string }>('/api/files/drill', { body: { classId: key } })).id); } catch { setDrill(null); } // the drill still runs without the hub
    setStep(1); setBusy(false);
  }
  async function stopHub() {
    setBusy(true);
    setHub(await reach());
    setChecks(await phone.selfCheck());
    setStep(2); setBusy(false);
  }
  async function startHub() {
    setBusy(true);
    const up = await reach();
    setCaught(up);
    if (up) {
      await phone.refreshNow(); phone.syncNow();
      if (drill) { try { setAcks((await api<{ acks: Ack[] }>(`/api/files/drill?id=${encodeURIComponent(drill)}`)).acks); await api('/api/files/drill-finish', { body: { id: drill } }); } catch { /* the record is optional */ } }
    }
    setStep(3); setBusy(false);
  }

  const pass = !!checks?.hasBundle && checks.opened === checks.sections;
  return (
    <section aria-labelledby="fdr-h" data-testid="fire-drill" data-step={step}>
      <h1 id="fdr-h">{t('files.drill.title')}</h1>
      <p className="help">{t('files.drill.help')}</p>
      <p role="status">{t('files.drill.step', { n: step + 1 > 3 ? 3 : step + 1 })}</p>
      {step === 0 && (<>
        <p>{t('files.drill.s0')}</p>
        <button type="button" disabled={busy} onClick={() => { void start(); }}>{t('files.drill.start')}</button>
      </>)}
      {step === 1 && (<>
        <h2>{t('files.drill.s1h')}</h2>
        <p>{t('files.drill.s1')}</p>
        <button type="button" disabled={busy} onClick={() => { void stopHub(); }}>{t('files.drill.next')}</button>
      </>)}
      {step === 2 && (<>
        <h2>{t('files.drill.s2h')}</h2>
        <ul>
          <li>{t(hub ? 'files.drill.hubStillUp' : 'files.drill.hubDown')}</li>
          <li>{t(checks?.hasBundle ? 'files.drill.copyOk' : 'files.drill.copyMissing')}</li>
          <li>{t('files.drill.opened', { n: checks?.opened ?? 0, m: checks?.sections ?? 0 })}</li>
        </ul>
        <p>{t('files.drill.s2')}</p>
        <button type="button" disabled={busy} onClick={() => { void startHub(); }}>{t('files.drill.next')}</button>
      </>)}
      {step === 3 && (<>
        <h2>{t('files.drill.result')}</h2>
        <p role="status"><strong>{t(pass ? 'files.drill.passed' : 'files.drill.failed')}</strong></p>
        <ul>
          <li>{t(caught ? 'files.drill.caughtUp' : 'files.drill.catchPending')}</li>
          <li>{t('files.drill.phones', { n: acks.filter((a) => a.ok).length, m: acks.length })}</li>
        </ul>
        <button type="button" onClick={() => { setStep(0); setDrill(null); setChecks(null); setAcks([]); }}>{t('files.drill.again')}</button>
      </>)}
    </section>
  );
}
