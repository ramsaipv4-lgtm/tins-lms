// The board screen: pages, saving, Mermaid import and the PDF export around the trimmed Excalidraw canvas.
import { useCallback, useEffect, useRef, useState } from 'react';
import './board.css';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import BoardCanvas, { dropMermaid, pageToJpeg } from '../../../../board/src/BoardCanvas.tsx';
import { addPage, makePage, sortPages, withElements, buildPdf, type BoardPage } from '../../../../board/src/index.ts';

type SaveState = 'saved' | 'saving' | 'failed';

export default function Board() {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState<string | null>(null);
  const [pages, setPages] = useState<BoardPage[] | null>(null);
  const [current, setCurrent] = useState<string>('');
  const [save, setSave] = useState<SaveState>('saved');
  const [message, setMessage] = useState<{ kind: 'status' | 'alert'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const pagesRef = useRef<BoardPage[]>([]);
  const apiRef = useRef<any>(null);
  const timer = useRef<any>(null);
  const classRef = useRef<string | null>(null);
  classRef.current = classId;

  const commit = useCallback((next: BoardPage[]) => { pagesRef.current = next; setPages(next); }, []);

  // First paint does not wait for the server: a blank first page is shown at once and the saved pages replace it
  // when they arrive (only if nothing has been drawn meanwhile).
  useEffect(() => {
    const blank = makePage(t('board.pageTitle', { n: 1 }), 0);
    commit([blank]); setCurrent(blank.id);
    let live = true;
    api('/api/board/boot').then((r: any) => {
      if (!live) return;
      setClasses(r.classes); setClassId(r.classes[0]?.id ?? '');
      const untouched = pagesRef.current.length === 1 && pagesRef.current[0].elements.length === 0;
      if (r.pages.length && untouched) { const sorted = sortPages(r.pages); commit(sorted); setCurrent(sorted[0].id); }
    }).catch(() => live && setClassId(''));
    return () => { live = false; };
  }, [commit]);
  const firstClass = useRef(true);
  useEffect(() => {
    if (!classId) return;
    if (firstClass.current) { firstClass.current = false; return; } // boot already carried this class's pages
    let live = true;
    api(`/api/board/classes/${classId}/pages`).then((r: any) => {
      if (!live) return;
      const sorted = r.pages.length ? sortPages(r.pages) : [makePage(t('board.pageTitle', { n: 1 }), 0)];
      commit(sorted); setCurrent(sorted[0].id);
    }).catch(() => {});
    return () => { live = false; };
  }, [classId, commit]);

  const persist = useCallback(async (page: BoardPage) => {
    const cid = classRef.current;
    if (!cid) return;
    setSave('saving');
    try {
      await api(`/api/board/classes/${cid}/pages/${page.id}`, { method: 'PUT', body: { title: page.title, order: page.order, elements: page.elements } });
      setSave('saved');
    } catch { setSave('failed'); }
  }, []);

  const onChange = useCallback((elements: any[], id: string) => {
    const prev = pagesRef.current.find((p) => p.id === id);
    if (!prev || JSON.stringify(prev.elements) === JSON.stringify(elements)) return;
    commit(withElements(pagesRef.current, id, elements));
    if (!elements.length && !prev.elements.length) return;
    clearTimeout(timer.current);
    setSave('saving');
    timer.current = setTimeout(() => { const p = pagesRef.current.find((x) => x.id === id); if (p) persist(p); }, 600);
  }, [commit, persist]);
  const currentRef = useRef('');
  currentRef.current = current;

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const p = pagesRef.current.find((x) => x.id === currentRef.current);
    if (p && p.elements.length) return persist(p);
  }, [persist]);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function onAddPage() {
    await flush();
    const { pages: next, page } = addPage(pagesRef.current, t('board.pageTitle', { n: pagesRef.current.length + 1 }));
    commit(next); setCurrent(page.id);
    await persist(page);
  }
  async function onSelect(id: string) {
    if (id === current) return;
    await flush();
    setCurrent(id);
  }

  async function onExport() {
    setBusy(true); setMessage({ kind: 'status', text: t('board.exporting') });
    try {
      const all = pagesRef.current;
      const pdfPages = [];
      for (const p of all) pdfPages.push({ title: p.title, image: await pageToJpeg(p.elements) });
      const bytes = buildPdf(pdfPages);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'board.pdf'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage({ kind: 'status', text: t('board.exported', { n: all.length }) });
    } catch (e: any) {
      setMessage({ kind: 'alert', text: t('board.mermaidError', { why: String(e?.message ?? e) }) });
    } finally { setBusy(false); }
  }

  async function onFile(file: File | undefined) {
    if (!file || !apiRef.current) return;
    try { await dropMermaid(apiRef.current, await file.text()); setMessage(null); }
    catch (e: any) { setMessage({ kind: 'alert', text: t('board.mermaidError', { why: String(e?.message ?? e) }) }); }
  }

  if (!pages) return <p role="status">{t('board.loading')}</p>;
  const page = pages.find((p) => p.id === current) ?? pages[0];

  return (
    <section data-testid="board" aria-labelledby="board-h" className="board-screen">
      <h1 id="board-h">{t('board.title')}</h1>
      <div className="board-bar">
        {classes.length > 1 && (
          <label>{t('board.class')}{' '}
            <select value={classId ?? ''} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id} translate="no">{c.name}</option>)}
            </select>
          </label>
        )}
        <div role="tablist" aria-label={t('board.pages')} className="board-tabs">
          {pages.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === page.id} className={p.id === page.id ? 'active' : ''} onClick={() => onSelect(p.id)} translate="no">{p.title}</button>
          ))}
        </div>
        <button type="button" onClick={onAddPage}>{t('board.addPage')}</button>
        <label className="board-import">
          <span className="btn">{t('board.importMermaid')}</span>
          <input type="file" accept=".mmd,.mermaid" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <button type="button" data-testid="board-export-pdf" disabled={busy} onClick={onExport}>{t('board.exportPdf')}</button>
        <span role="status" className="board-save">{save === 'saving' ? t('board.saving') : save === 'failed' ? t('board.saveFailed') : t('board.saved')}</span>
      </div>
      {message && <p role={message.kind}>{message.text}</p>}
      {classId === '' && <p>{t('board.noClass')}</p>}
      <p className="board-help">{t('board.importHelp')}</p>
      <div className="board-surface" role="group" aria-label={t('board.canvas')}>
        <BoardCanvas pageId={page.id} initialElements={page.elements} onChange={onChange} onApi={(a) => { apiRef.current = a; }}
          onMermaidError={(why) => setMessage({ kind: 'alert', text: t('board.mermaidError', { why }) })} />
      </div>
    </section>
  );
}
