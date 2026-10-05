// Screen text recognition (D-11, P-16). tesseract.js is imported on first use only, so it never enters the shell
// bundle (AC-102); its worker, core and English data all come from the hub, never a third-party CDN.
export interface OcrResult { lines: string[]; text: string }

export async function readScreenshot(file: Blob, onStatus?: (s: string) => void): Promise<OcrResult> {
  const mod: any = await import('tesseract.js');
  const createWorker = mod.createWorker ?? mod.default?.createWorker;
  const base = `${location.origin}/api/coach/ocr`;
  const worker = await createWorker('eng', 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/core`,
    langPath: `${base}/lang`,
    gzip: true,
    logger: (m: any) => { if (m?.status) onStatus?.(String(m.status)); },
  });
  try {
    const { data } = await worker.recognize(file);
    const text = String(data?.text ?? '');
    return { text, lines: text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) };
  } finally { await worker.terminate(); }
}
