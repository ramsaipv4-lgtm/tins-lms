// File exchange (AC-96): classes without a hub connection trade signed files. The trainer downloads a day package and
// imports learners' submission files; a phone-only learner imports the package and exports a signed submission.
import { useEffect, useState, type ChangeEvent } from 'react';
import { api, ApiError } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { downloadsHeld, saveFile } from './net.ts';
import * as phone from './phone.ts';
import { usePhone } from './ui.ts';

export function TrainerFiles() {
  const [classes, setClasses] = useState<phone.BClass[] | null>(null);
  const [cls, setCls] = useState('');
  const [day, setDay] = useState(0);
  const [note, setNote] = useState<{ kind: 'ok' | 'err' | 'held'; text: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api<{ classes: phone.BClass[] }>('/api/files/bundle').then((b) => { if (live) setClasses(b.classes); }, () => { if (live) setClasses([]); });
    return () => { live = false; };
  }, []);
  if (!classes) return <p role="status">{t('app.loading')}</p>;
  const current = classes.find((c) => c.key === cls) ?? classes[0];
  if (!current) return <section><h1>{t('files.nav.files')}</h1><p role="status">{t('files.trainer.noClass')}</p></section>;

  async function download(force: boolean) {
    if (!force && downloadsHeld()) { setNote({ kind: 'held', text: t('files.settings.held') }); return; }
    setBusy(true); setNote(null);
    try {
      const res = await fetch(`/api/files/package?classId=${encodeURIComponent(current.key)}&day=${day}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(String(res.status));
      saveFile(`${current.key}-day-${day}.lmsp`, new Uint8Array(await res.arrayBuffer()));
      setNote({ kind: 'ok', text: t('files.trainer.downloaded', { n: day }) });
    } catch { setNote({ kind: 'err', text: t('files.trainer.downloadFailed') }); }
    setBusy(false);
  }

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setNote(null);
    try {
      const res = await fetch(`/api/classes/${encodeURIComponent(current.key)}/files`, {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(await file.arrayBuffer()),
      });
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, body);
      setNote({ kind: 'ok', text: t('files.trainer.accepted'), detail: t('files.trainer.acceptedDetail', { who: String(body.personId ?? '') }) });
    } catch (err) {
      const why = err instanceof ApiError ? Object.values(err.fields)[0] : 'network';
      setNote({ kind: 'err', text: t('files.trainer.rejected', { why: String(why ?? err) }) });
    }
  }

  return (
    <section aria-labelledby="ft-h" data-testid="files-trainer">
      <h1 id="ft-h">{t('files.nav.files')}</h1>
      <p className="help">{t('files.trainer.help')}</p>
      {classes.length > 1 && (
        <div className="field">
          <label htmlFor="ft-class">{t('files.trainer.class')}</label>
          <select id="ft-class" value={current.key} onChange={(e) => setCls(e.target.value)}>{classes.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select>
        </div>
      )}
      <div className="field">
        <label htmlFor="ft-day">{t('files.day.pick')}</label>
        <select id="ft-day" value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {current.days.map((d) => <option key={d.index} value={d.index}>{t('files.day.option', { n: d.index, date: d.date ?? '' })}</option>)}
        </select>
      </div>
      <p><button type="button" data-testid="pkg-download" disabled={busy || current.days.length === 0} onClick={() => { void download(false); }}>{t('files.trainer.download')}</button></p>

      <h2>{t('files.trainer.importTitle')}</h2>
      <div className="field">
        <label htmlFor="ft-import">{t('files.trainer.import')}</label>
        <input id="ft-import" data-testid="submission-import" type="file" onChange={(e) => { void importFile(e); }} />
      </div>
      {note && <p role={note.kind === 'err' ? 'alert' : 'status'} className={note.kind === 'err' ? 'err' : undefined}>{note.text}
        {note.kind === 'held' && <> <button type="button" onClick={() => { void download(true); }}>{t('files.settings.anyway')}</button></>}</p>}
      {note?.detail && <p className="help">{note.detail}</p>}
    </section>
  );
}

export function LearnerFiles() {
  const { bundle, ready } = usePhone();
  const [result, setResult] = useState<{ title: string; sections: { id: string; title: string; text: string | null }[] } | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string; detail?: string } | null>(null);

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setNote(null); setResult(null);
    const r = await phone.importPackage(new Uint8Array(await file.arrayBuffer()));
    if (!r.ok) { setNote({ kind: 'err', text: t(`files.learner.err.${r.reason}`) }); return; }
    const sections = [];
    for (const s of r.imported.day.sections) {
      const key = r.imported.keys[s.id];
      let text: string | null = null;
      if (key) { try { text = await phone.openText(s.sealed, key); } catch { text = null; } }
      sections.push({ id: s.id, title: s.title, text });
    }
    setResult({ title: t('files.learner.imported', { name: r.imported.className, n: r.imported.day.index }), sections });
    setNote({ kind: 'ok', text: t('files.learner.importedNote'), detail: t('files.learner.importedDetail') });
  }

  async function exportSubmission() {
    setNote(null);
    const cls = bundle?.classes[0]?.key ?? (await phone.listImports())[0]?.classKey;
    if (!cls) { setNote({ kind: 'err', text: t('files.learner.noClass') }); return; }
    const file = await phone.buildSubmission(cls);
    if (!file) { setNote({ kind: 'err', text: t('files.learner.noClass') }); return; }
    saveFile(file.name, file.bytes);
    setNote({ kind: 'ok', text: t('files.learner.exported') });
  }

  return (
    <section aria-labelledby="fl-h" data-testid="files-learner">
      <h1 id="fl-h">{t('files.nav.files')}</h1>
      <p className="help">{t('files.learner.help')}</p>
      <div className="field">
        <label htmlFor="fl-import">{t('files.learner.import')}</label>
        <input id="fl-import" data-testid="pkg-import" type="file" onChange={(e) => { void importFile(e); }} />
      </div>
      <p><button type="button" disabled={!ready} onClick={() => { void exportSubmission(); }}>{t('files.learner.export')}</button></p>
      {note && <p role={note.kind === 'err' ? 'alert' : 'status'} className={note.kind === 'err' ? 'err' : undefined}>{note.text}</p>}
      {note?.detail && <p className="help">{note.detail}</p>}
      {result && (
        <>
          <h2>{result.title}</h2>
          {result.sections.filter((s) => s.text !== null).map((s) => (
            <article key={s.id} data-testid={`section-${s.id}`}>
              <h3 translate="no">{s.title}</h3>
              <pre translate="no" style={{ whiteSpace: 'pre-wrap', font: 'inherit' }}>{s.text}</pre>
            </article>
          ))}
          {result.sections.some((s) => s.text === null) && <p className="help">{t('files.learner.someLocked')}</p>}
        </>
      )}
    </section>
  );
}

export default function Files({ params: _p }: { params: Record<string, string> }) {
  return location.pathname.startsWith('/teach') ? <TrainerFiles /> : <LearnerFiles />;
}
