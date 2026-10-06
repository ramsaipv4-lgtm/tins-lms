// The trimmed Excalidraw wrapper: one scene (one page) per mount. Pages, saving and strings live in the web screen.
import { useEffect, useRef } from 'react';
import { Excalidraw, exportToCanvas } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './board.css';
import { isMermaidFile, liveElements } from './model.ts';
import { mermaidToElements } from './mermaid.ts';

// Fonts come from our own server (/board-assets/, see routes/features/board.ts), never from a CDN (AC-102).
(globalThis as any).EXCALIDRAW_ASSET_PATH = '/board-assets/';

const UI_OPTIONS = {
  canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, toggleTheme: false, clearCanvas: true, changeViewBackgroundColor: false },
  tools: { image: false },
};

export interface BoardCanvasProps {
  /** The page shown. Changing it swaps the scene inside the same Excalidraw instance (no remount, so no slow re-init). */
  pageId: string;
  initialElements: any[];
  /** `pageId` is the page the reported elements belong to. */
  onChange: (elements: any[], pageId: string) => void;
  onApi: (api: any) => void;
  onMermaidError: (message: string) => void;
}

/** Add a Mermaid diagram (as Excalidraw elements) to the scene the API controls. */
export async function dropMermaid(api: any, text: string): Promise<void> {
  const { elements, files } = await mermaidToElements(text);
  const fileList = Object.values(files ?? {});
  if (fileList.length) api.addFiles(fileList);
  api.updateScene({ elements: [...api.getSceneElements(), ...elements] });
  api.scrollToContent(elements, { fitToContent: true, animate: false });
}

export default function BoardCanvas(props: BoardCanvasProps) {
  const apiRef = useRef<any>(null);
    const cb = useRef(props);
  cb.current = props;
  const sceneOf = useRef(props.pageId); // the page whose elements are on the canvas right now
  const first = useRef(props.initialElements);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || sceneOf.current === props.pageId) return;
    sceneOf.current = props.pageId;
    api.updateScene({ elements: props.initialElements, captureUpdate: 'NEVER' });
    api.history.clear();
    if (props.initialElements.length) api.scrollToContent(props.initialElements, { fitToContent: true, animate: false });
    else api.updateScene({ appState: { scrollX: 0, scrollY: 0 } });
  }, [props.pageId]);

  // Capture-phase drop on the whole page while the board is open: a Mermaid file dropped anywhere on the board screen
  // is drawn, and never reaches Excalidraw's own drop handler (which would reject it).
  useEffect(() => {
    const el: Document = document;
    const over = (e: DragEvent) => { if (e.dataTransfer && Array.from(e.dataTransfer.items ?? []).some((i) => i.kind === 'file')) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      const file = Array.from(e.dataTransfer?.files ?? []).find(isMermaidFile);
      if (!file) return;
      e.preventDefault(); e.stopPropagation();
      file.text().then((text) => dropMermaid(apiRef.current, text)).catch((err) => cb.current.onMermaidError(String(err?.message ?? err)));
    };
    el.addEventListener('dragover', over as any, true);
    el.addEventListener('drop', drop as any, true);
    return () => { el.removeEventListener('dragover', over as any, true); el.removeEventListener('drop', drop as any, true); };
  }, []);

  return (
    <div className="lms-board-canvas">
      <Excalidraw
        excalidrawAPI={(api: any) => { apiRef.current = api; cb.current.onApi(api); }}
        initialData={{ elements: first.current, appState: { viewBackgroundColor: '#ffffff' }, scrollToContent: first.current.length > 0 } as any}
        UIOptions={UI_OPTIONS as any}
        onChange={(els: any) => cb.current.onChange(liveElements(els), sceneOf.current)}
        langCode="en"
        autoFocus
      />
    </div>
  );
}

/** Render a page's drawing to a JPEG for the PDF. Returns null for an empty page. */
export async function pageToJpeg(elements: any[]): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  const live = liveElements(elements);
  if (!live.length) return null;
  const canvas: HTMLCanvasElement = await exportToCanvas({
    elements: live, appState: { exportBackground: true, viewBackgroundColor: '#ffffff' } as any, files: null, exportPadding: 24,
    getDimensions: (w: number, h: number) => { const s = Math.min(2, 1600 / Math.max(w, h)); return { width: Math.round(w * s), height: Math.round(h * s), scale: s }; },
  } as any);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('jpeg'))), 'image/jpeg', 0.92));
  return { data: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}
