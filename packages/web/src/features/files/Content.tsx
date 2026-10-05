// /learn/phone-day (AC-95): the released sections of a class day, opened on this device from the stored copy of the hub
// bundle and any imported day package. Works with the hub switched off.
import { useEffect, useState } from 'react';
import { downloadsHeld } from './net.ts';
import { t } from '../../strings/index.ts';
import * as phone from './phone.ts';
import { usePhone } from './ui.ts';

interface Shown { id: string; title: string; text: string | null; released: boolean }

export default function Content() {
  const { bundle, ready } = usePhone();
  const [data, setData] = useState<Awaited<ReturnType<typeof phone.contentDays>> | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [shown, setShown] = useState<Shown[]>([]);
  const [dl, setDl] = useState<'idle' | 'busy' | 'held' | 'done'>('idle');

  async function download(force: boolean) {
    if (!force && downloadsHeld()) { setDl('held'); return; }
    setDl('busy');
    await phone.refreshNow(force);
    setDl('done');
  }

  useEffect(() => { let live = true; void phone.contentDays().then((d) => { if (live) setData(d); }); return () => { live = false; }; }, [bundle, ready]);

  const days = data?.days ?? [];
  const today = new Date(phone.nowMs() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const withContent = days.filter((d) => d.sections.some((s) => s.key));
  const d = day ?? (days.find((x) => x.date === today && x.sections.some((s) => s.key)) ?? withContent[0] ?? days[0])?.index ?? null;
  const current = days.find((x) => x.index === d) ?? null;

  useEffect(() => {
    let live = true;
    (async () => {
      const out: Shown[] = [];
      for (const s of current?.sections ?? []) {
        let text: string | null = null;
        if (s.key) { try { text = await phone.openText(s.sealed, s.key); } catch { text = null; } }
        out.push({ id: s.id, title: s.title, text, released: !!s.key });
      }
      if (live) setShown(out);
    })();
    return () => { live = false; };
  }, [current]);

  if (!data) return <p role="status">{t('app.loading')}</p>;
  if (!data.cls) return <p role="status">{t('files.day.empty')}</p>;
  const released = shown.filter((s) => s.released);
  const locked = shown.filter((s) => !s.released);
  return (
    <section aria-labelledby="fd-h">
      <h1 id="fd-h">{t('files.day.title')}</h1>
      <p className="help">{t('files.day.from', { name: data.cls.name })} {phone.hubReachable() === false ? t('files.day.offline') : ''}</p>
      <div className="field">
        <label htmlFor="fd-day">{t('files.day.pick')}</label>
        <select id="fd-day" value={d ?? 0} onChange={(e) => setDay(Number(e.target.value))}>
          {days.map((x) => <option key={x.index} value={x.index}>{t('files.day.option', { n: x.index, date: x.date ?? '' })}</option>)}
        </select>
      </div>
      <p><button type="button" disabled={dl === 'busy'} onClick={() => { void download(false); }}>{t('files.day.download')}</button></p>
      {dl === 'held' && <p role="status">{t('files.settings.held')} <button type="button" onClick={() => { void download(true); }}>{t('files.settings.anyway')}</button></p>}
      {dl === 'done' && <p role="status">{t('files.day.saved')}</p>}
      {released.length === 0 && <p role="status">{t('files.day.none')}</p>}
      {released.map((s) => (
        <article key={s.id} data-testid={`section-${s.id}`}>
          <h2 translate="no">{s.title}</h2>
          <pre translate="no" style={{ whiteSpace: 'pre-wrap', font: 'inherit' }}>{s.text ?? t('files.day.unreadable')}</pre>
        </article>
      ))}
      {locked.length > 0 && (
        <>
          <h2>{t('files.day.locked')}</h2>
          <ul>{locked.map((s) => <li key={s.id}><span translate="no">{s.title}</span> {t('files.day.lockedHint')}</li>)}</ul>
        </>
      )}
    </section>
  );
}
