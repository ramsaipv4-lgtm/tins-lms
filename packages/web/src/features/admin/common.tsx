// Small helpers shared by the admin screens.
import { useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '../../app/api.ts';
import { t } from '../../strings/index.ts';

export function useLoad<T>(path: string | null, deps: unknown[] = []): { data: T | null; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) { setData(null); return; }
    let live = true;
    setError(null);
    api<T>(path).then((d) => { if (live) setData(d); }).catch((e) => { if (live) setError(e instanceof ApiError ? t('admin.err.load') : t('admin.err.offline')); });
    return () => { live = false; };
  }, [path, n, ...deps]);
  return { data, error, reload: () => setN((x) => x + 1) };
}

export function Msg({ error, status }: { error?: string | null; status?: string | null }): ReactNode {
  if (error) return <p role="alert" className="err">{error}</p>;
  if (status) return <p role="status">{status}</p>;
  return null;
}

export interface ClassRow { id: string; key: string; name: string; cohortId: string; cohortName: string; programId: string; programName: string }

// Class picker used by report, schedule and quiz screens. Selects the first class when none is chosen.
export function ClassPicker({ classes, value, onChange, label }: { classes: ClassRow[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div className="field">
      <label htmlFor="admin-class-pick">{label}</label>
      <select id="admin-class-pick" value={value} onChange={(e) => onChange(e.target.value)}>
        {classes.map((c) => <option key={c.id} value={c.id} translate="no">{c.name}</option>)}
      </select>
    </div>
  );
}

export function errText(e: unknown): string {
  if (e instanceof ApiError) {
    const f = Object.values(e.fields)[0];
    return f ? t('admin.err.field', { reason: String(f) }) : t('admin.err.status', { status: e.status });
  }
  return t('admin.err.offline');
}
