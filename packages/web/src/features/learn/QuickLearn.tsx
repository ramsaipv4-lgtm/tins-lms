// Audio quick-learn (AC-163, B-10): the day's quick-learn read aloud with the device's speech synthesis.
import { useEffect, useRef, useState } from 'react';
import { t } from '../../strings/index.ts';
import { api } from '../../app/api.ts';

export default function QuickLearn() {
  const [data, setData] = useState<{ day: number; text: string } | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState(false);
  const [speed, setSpeed] = useState('1');
  const [playing, setPlaying] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const rate = useRef(1);

  useEffect(() => {
    api<{ day: number; text: string }>('/api/learn/quick-learn').then(setData).catch((e) => (e?.status === 404 ? setMissing(true) : setError(true)));
    return () => { try { window.speechSynthesis?.cancel(); } catch { /* none */ } };
  }, []);

  const clamp = (v: string) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(2, Math.max(0.5, n)) : 1; };
  rate.current = clamp(speed);

  function play() {
    if (!data || !supported) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(data.text);
    u.rate = rate.current;
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    synth.speak(u);
    setPlaying(true);
  }
  function stop() { try { window.speechSynthesis.cancel(); } catch { /* none */ } setPlaying(false); }

  if (error) return <p role="alert">{t('learn.error')}</p>;
  if (missing) return <p role="status">{t('learn.quick.none')}</p>;
  if (!data) return <p role="status">{t('learn.loading')}</p>;
  return (
    <section aria-labelledby="ql-h">
      <h1 id="ql-h">{t('learn.quick.title', { n: data.day })}</h1>
      {!supported && <p role="status">{t('learn.quick.unsupported')}</p>}
      <div className="field">
        <label htmlFor="ql-speed">{t('learn.quick.speed')}</label>
        <input id="ql-speed" type="number" min="0.5" max="2" step="0.1" inputMode="decimal" value={speed} aria-describedby="ql-speed-help"
          onChange={(e) => setSpeed(e.target.value)} />
        <p id="ql-speed-help" className="help">{t('learn.quick.speedHelp')}</p>
      </div>
      <p className="row">
        <button type="button" onClick={play} disabled={!supported}>{t('learn.quick.play')}</button>
        <button type="button" onClick={stop}>{t('learn.quick.stop')}</button>
      </p>
      <h2>{t('learn.quick.text')}</h2>
      <div className="readable" translate="no" style={{ whiteSpace: 'pre-wrap' }}>{data.text}</div>
    </section>
  );
}
