// Trainer: upload a changed package and see which days and questions change (AC-166).
import { useState } from 'react';
import { t } from '../../strings/index.ts';
import { tarPack } from '../../../../core/src/export.ts';
import Library from '../tele/Library.tsx';

interface Diff {
  hasCurrent: boolean; unchanged: boolean;
  days: { index: number; change: string; sections: { title: string; change: string }[]; questions: { text: string; change: string }[] }[];
}

export default function TPackages() {
  const [diff, setDiff] = useState<Diff | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function upload(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true); setError(false); setDiff(null);
    try {
      let bytes: Uint8Array;
      if (files.length === 1) bytes = new Uint8Array(await files[0].arrayBuffer());
      else {
        const entries = [];
        for (const f of Array.from(files)) entries.push({ path: (f as any).webkitRelativePath || f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
        bytes = tarPack(entries);
      }
      const res = await fetch('/api/classroom/package-diff', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/x-tar' }, body: bytes as BodyInit });
      if (!res.ok) throw new Error(String(res.status));
      setDiff(await res.json());
    } catch { setError(true); } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="pk-h">
      {/* One screen for "the package library": the tele group's library list, then the changed-package check. */}
      <Library />
      <h2 id="pk-h">{t('classroom.pkg.title')}</h2>
      <p className="help">{t('classroom.pkg.intro')}</p>
      <div className="field">
        <label htmlFor="pkg-file">{t('classroom.pkg.field')}</label>
        <input id="pkg-file" type="file" multiple onChange={(e) => void upload(e.target.files)} />
      </div>
      {busy && <p role="status">{t('classroom.pkg.checking')}</p>}
      {error && <p className="err" role="alert">{t('classroom.pkg.failed')}</p>}
      {diff && (
        <div data-testid="package-diff">
          <h2>{t('classroom.pkg.diff')}</h2>
          {!diff.hasCurrent && <p>{t('classroom.pkg.noCurrent')}</p>}
          {diff.unchanged && <p>{t('classroom.pkg.unchanged')}</p>}
          <ul>
            {diff.days.map((d) => (
              <li key={d.index}>
                {t('classroom.pkg.day', { n: d.index, change: t(`classroom.change.${d.change}`) })}
                <ul>
                  {d.sections.map((s, i) => <li key={`s${i}`} translate="no">{t('classroom.pkg.section', { change: t(`classroom.change.${s.change}`), title: s.title })}</li>)}
                  {d.questions.map((q, i) => <li key={`q${i}`} translate="no">{t('classroom.pkg.question', { change: t(`classroom.change.${q.change}`), text: q.text })}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
