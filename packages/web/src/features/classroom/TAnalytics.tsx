// Trainer: item analysis (flags weak questions) and suggested misconceptions (AC-166).
import { useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useLoad } from './lib.ts';

interface Item { itemId: string; p: number; discrimination: number; flag: boolean }
interface Sugg { id: string; itemId: string; given: string; count: number; label: string; status: string }

export function ItemTable() {
  const { data, error } = useLoad<{ analysis: Item[] }>('/api/classroom/item-analysis', 10000);
  return (
    <div data-testid="item-analysis">
      <h2>{t('classroom.analysis.title')}</h2>
      <p className="help">{t('classroom.analysis.intro')}</p>
      {error && !data && <p className="err" role="alert">{t('classroom.error')}</p>}
      {data && data.analysis.length === 0 && <p>{t('classroom.analysis.none')}</p>}
      {data && data.analysis.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left' }}>{t('classroom.analysis.item')}</th>
                <th scope="col" style={{ textAlign: 'left' }}>{t('classroom.analysis.p')}</th>
                <th scope="col" style={{ textAlign: 'left' }}>{t('classroom.analysis.d')}</th>
                <th scope="col" style={{ textAlign: 'left' }}>{t('classroom.analysis.flag')}</th>
              </tr>
            </thead>
            <tbody>
              {data.analysis.map((r) => (
                <tr key={r.itemId} data-testid={`item-row-${r.itemId}`} data-flag={r.flag ? 'true' : 'false'}>
                  <td translate="no">{r.itemId}</td>
                  <td>{r.p.toFixed(2)}</td>
                  <td>{r.discrimination.toFixed(2)}</td>
                  <td>{r.flag ? <strong>{t('classroom.analysis.flagged')}</strong> : t('classroom.analysis.ok')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Suggestion({ s, onChange }: { s: Sugg; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(s.label);
  async function decide(action: 'accept' | 'reject', text?: string) {
    try { await api('/api/classroom/misconceptions/decide', { body: { id: s.id, itemId: s.itemId, given: s.given, action, label: text ?? s.label } }); } catch { /* reload shows truth */ }
    setEditing(false); onChange();
  }
  return (
    <li role="listitem" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, margin: '8px 0' }}>
      <p style={{ margin: '0 0 8px' }}><span translate="no">{t('classroom.misc.row', { item: s.itemId, label: s.label, n: s.count })}</span> ({t(`classroom.misc.status.${s.status}`)})</p>
      {editing && (
        <div className="field">
          <label htmlFor={`ml-${s.id}`}>{t('classroom.misc.label')}</label>
          <input id={`ml-${s.id}`} value={label} onChange={(e) => setLabel(e.target.value)} />
          <button type="button" onClick={() => void decide('accept', label.trim() || s.given)}>{t('classroom.misc.save')}</button>
        </div>
      )}
      <div className="row">
        <button type="button" onClick={() => void decide('accept')}>{t('classroom.misc.accept')}</button>
        <button type="button" onClick={() => setEditing(!editing)}>{t('classroom.misc.edit')}</button>
        <button type="button" onClick={() => void decide('reject')}>{t('classroom.misc.reject')}</button>
      </div>
    </li>
  );
}

export function Suggestions() {
  const { data, error, reload } = useLoad<{ suggestions: Sugg[] }>('/api/classroom/misconceptions', 10000);
  return (
    <div>
      <h2>{t('classroom.misc.title')}</h2>
      <p className="help">{t('classroom.misc.intro')}</p>
      {error && !data && <p className="err" role="alert">{t('classroom.error')}</p>}
      {data && data.suggestions.length === 0 && <p>{t('classroom.misc.none')}</p>}
      <ul data-testid="misconception-suggestions" role="list" style={{ listStyle: 'none', padding: 0 }}>
        {data?.suggestions.map((s) => <Suggestion key={s.id} s={s} onChange={() => void reload()} />)}
      </ul>
    </div>
  );
}

export default function TAnalytics() {
  return (
    <section aria-labelledby="an-h">
      <h1 id="an-h">{t('classroom.analysis.title')}</h1>
      <ItemTable />
      <Suggestions />
    </section>
  );
}
