// Coach screenshot import (AC-94, P-16): upload, read on the phone, confirm each value, then save encrypted.
import { useEffect, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { applyParseRules, type ParseRules } from '../../../../core/src/screenshot.ts';
import PinGate from './Gate.tsx';
import { bestRules, kindOfFields, parseNumber } from './fields.ts';
import { listEntries, metaReady, saveEntry, type Entry } from './lib.ts';
import { prewarmOcr, readScreenshot, releaseOcr } from './ocr.ts';
import './coach.css';

type Phase = 'idle' | 'reading' | 'confirm' | 'saved' | 'failed';
const KNOWN = ['calories', 'protein', 'amount'];
const label = (name: string) => (KNOWN.includes(name) ? t(`coach.field.${name}`) : name.charAt(0).toUpperCase() + name.slice(1));

function ShotImport({ person, keyBytes }: { person: string; keyBytes: Uint8Array }) {
  const [rules, setRules] = useState<ParseRules[] | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [app, setApp] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false); // PIN record confirmed on the hub and on this device
  const [picked, setPicked] = useState<File | null>(null); // a file chosen before the screen was ready waits here, never dropped

  const refresh = () => listEntries(person, keyBytes).then((e) => setEntries(e.filter((x) => x.source === 'screenshot'))).catch(() => {});
  useEffect(() => {
    api<{ rules: ParseRules[] }>('/api/coach/parse-rules').then((r) => setRules(r.rules)).catch(() => setRules([]));
    void refresh();
    void metaReady(person).then(() => setReady(true));
  }, [person]);

  const current = rules?.find((r) => r.app === app) ?? null;
  function fill(r: ParseRules, ls: string[]) {
    const found = applyParseRules(ls, r);
    setValues(Object.fromEntries(r.fields.map((f) => [f.name, found[f.name]?.value == null ? '' : String(found[f.name].value)])));
  }

  useEffect(() => { if (picked && rules && ready) { const f = picked; setPicked(null); void onFile(f); } }, [picked, rules, ready]);

  async function onFile(file: File) {
    setError(null); setPhase('reading'); setStatus('');
    try {
      const res = await readScreenshot(file, setStatus);
      setLines(res.lines);
      const best = bestRules(res.lines, rules);
      if (!best) { setPhase('failed'); setError(t('coach.shot.noRules')); return; }
      setApp(best.rules.app); fill(best.rules, res.lines); setPhase('confirm');
    } catch { setPhase('failed'); setError(t('coach.shot.readFail')); }
  }

  async function confirm() {
    if (!current) return;
    const out: Record<string, number> = {};
    for (const f of current.fields) {
      const raw = values[f.name] ?? '';
      if (raw.trim() === '') continue;
      const n = parseNumber(raw);
      if (n === null) { setError(t('coach.shot.badNumber', { name: label(f.name) })); return; }
      out[f.name] = n;
    }
    if (!Object.keys(out).length) { setError(t('coach.shot.nothing')); return; }
    try {
      await saveEntry(person, keyBytes, { kind: kindOfFields(Object.keys(out)), values: out, source: 'screenshot', confirmed: true });
      setPhase('saved'); setError(null); void refresh();
    } catch { setError(t('app.error')); }
  }

  return (
    <section aria-labelledby="shot-h">
      <h1 id="shot-h">{t('coach.shot.title')}</h1>
      <p className="help">{t('coach.shot.intro')}</p>
      <div className="field">
        <label htmlFor="coach-shot-file">{t('coach.shot.upload')}</label>
        <input id="coach-shot-file" data-testid="shot-upload" type="file" accept="image/*" disabled={phase === 'reading'} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setError(null); setPhase('reading'); setPicked(f); } e.target.value = ''; }} />
      </div>
      {phase === 'reading' && <p role="status">{t('coach.shot.reading')} {status}</p>}
      {error && <p role="alert" className="err">{error}</p>}
      {(phase === 'confirm' || (phase === 'failed' && current)) && current && (
        <div data-testid="shot-confirm" role="group" aria-labelledby="shot-confirm-h">
          <h2 id="shot-confirm-h">{t('coach.shot.confirmTitle')}</h2>
          <p className="help">{t('coach.shot.confirmHelp', { app: current.app })}</p>
          {rules && rules.length > 1 && (
            <div className="field">
              <label htmlFor="coach-shot-app">{t('coach.shot.app')}</label>
              <select id="coach-shot-app" value={app} onChange={(e) => { const r = rules.find((x) => x.app === e.target.value); if (r) { setApp(r.app); fill(r, lines); } }}>
                {rules.map((r) => <option key={r.app} value={r.app}>{r.app}</option>)}
              </select>
            </div>
          )}
          {current.fields.map((f) => (
            <div className="field" key={f.name}>
              <label htmlFor={`coach-f-${f.name}`}>{label(f.name)}{f.unit ? ` (${f.unit})` : ''}</label>
              <input id={`coach-f-${f.name}`} inputMode="decimal" value={values[f.name] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
              {(values[f.name] ?? '') === '' && <span className="help">{t('coach.shot.missing')}</span>}
            </div>
          ))}
          <div className="row">
            <button type="button" onClick={() => void confirm()}>{t('coach.shot.confirm')}</button>
            <button type="button" className="coach-quiet" onClick={() => { setPhase('idle'); setValues({}); }}>{t('coach.shot.cancel')}</button>
          </div>
        </div>
      )}
      {phase === 'saved' && <p role="status">{t('coach.shot.saved')}</p>}
      {entries.length > 0 && (
        <>
          <h2>{t('coach.shot.history')}</h2>
          <ul>{entries.map((e) => <li key={e.id}>{new Date(e.at).toLocaleString()}: {Object.entries(e.values).map(([k, v]) => `${label(k)} ${v}`).join(', ')}</li>)}</ul>
        </>
      )}
    </section>
  );
}

export default function Shot() {
  // Start the recognition worker as soon as the screen opens, while the learner is still on the PIN screen.
  useEffect(() => { void prewarmOcr().catch(() => {}); return () => { void releaseOcr(); }; }, []);
  return <PinGate needTrackers>{(key, person) => <ShotImport person={person} keyBytes={key} />}</PinGate>;
}
