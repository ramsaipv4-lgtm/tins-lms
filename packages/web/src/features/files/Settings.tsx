// /learn/settings: export my data (AC-98), kiosk mode, Wi-Fi only downloads and the data meter (AC-167).
import { useEffect, useState } from 'react';
import { t } from '../../strings/index.ts';
import { downloadsHeld, formatBytes, kioskOn, meterBytes, onMeter, resetMeter, saveFile, setKiosk, setWifiOnly, wifiOnly } from './net.ts';
import * as phone from './phone.ts';
import { usePhone } from './ui.ts';

export default function Settings() {
  usePhone();
  const [kiosk, setK] = useState(kioskOn());
  const [wifi, setW] = useState(wifiOnly());
  const [bytes, setBytes] = useState(meterBytes());
  const [state, setState] = useState<'idle' | 'busy' | 'held' | 'done' | 'failed'>('idle');
  useEffect(() => onMeter(() => setBytes(meterBytes())), []);

  async function download(force: boolean) {
    if (!force && downloadsHeld()) { setState('held'); return; }
    setState('busy');
    try {
      const res = await fetch('/api/me/export', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(String(res.status));
      saveFile('my-data.tar', new Uint8Array(await res.arrayBuffer()), 'application/x-tar');
      setState('done');
    } catch { setState('failed'); }
  }

  const f = formatBytes(bytes);
  const hub = phone.hubReachable();
  return (
    <section aria-labelledby="fs-h">
      <h1 id="fs-h">{t('files.settings.title')}</h1>

      <h2>{t('files.settings.data')}</h2>
      <p className="help">{t('files.settings.dataHelp')}</p>
      <p><button type="button" disabled={state === 'busy'} onClick={() => { void download(false); }}>{t('files.settings.export')}</button></p>
      {state === 'held' && (
        <p role="status">{t('files.settings.held')} <button type="button" onClick={() => { void download(true); }}>{t('files.settings.anyway')}</button></p>
      )}
      {state === 'done' && <p role="status">{t('files.settings.exported')}</p>}
      {state === 'failed' && <p role="alert" className="err">{t('files.settings.exportFailed')}</p>}

      <h2>{t('files.settings.device')}</h2>
      <div className="field check">
        <input id="fs-kiosk" type="checkbox" checked={kiosk} onChange={(e) => { setKiosk(e.target.checked); setK(e.target.checked); }} />
        <label htmlFor="fs-kiosk">{t('files.settings.kiosk')}</label>
      </div>
      <p className="help">{t('files.settings.kioskHelp')}</p>
      <div className="field check">
        <input id="fs-wifi" type="checkbox" checked={wifi} onChange={(e) => { setWifiOnly(e.target.checked); setW(e.target.checked); }} />
        <label htmlFor="fs-wifi">{t('files.settings.wifi')}</label>
      </div>
      <p className="help">{t('files.settings.wifiHelp')}</p>

      <h2>{t('files.settings.meter')}</h2>
      <p data-testid="data-meter" role="status">{t('files.settings.used', { value: f.value, unit: f.unit })}</p>
      <p><button type="button" onClick={() => resetMeter()}>{t('files.settings.resetMeter')}</button></p>
      <p className="help">{hub === false ? t('files.settings.hubDown') : hub ? t('files.settings.hubUp') : ''}</p>
    </section>
  );
}
