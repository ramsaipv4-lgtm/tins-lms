// Screen text recognition (D-11, P-16). tesseract.js is imported on first use only, so it never enters the shell
// bundle (AC-102); its worker, core and English data all come from the hub, never a third-party CDN.
// The worker is started when the Coach food screen opens (prewarmOcr), so the worker script, the WebAssembly core and
// the 3 MB English data are fetched and initialised while the learner is still typing the PIN, not after the upload.
export interface OcrResult { lines: string[]; text: string }

const MAX_SIDE = 1400; // a phone screenshot is ~1080x2400; text this size reads the same at 1400 px on the long side
let warm: Promise<any> | null = null;
let onStatus: ((s: string) => void) | undefined;

export function prewarmOcr(): Promise<any> {
  if (warm) return warm;
  warm = (async () => {
    const mod: any = await import('tesseract.js');
    const createWorker = mod.createWorker ?? mod.default?.createWorker;
    const base = `${location.origin}/api/coach/ocr`;
    return createWorker('eng', 1, {
      workerPath: `${base}/worker.min.js`,
      corePath: `${base}/core`,
      langPath: `${base}/lang`,
      gzip: false, // the hub sends the data with Content-Encoding: gzip, so the browser inflates it, not a script in the worker
      cacheMethod: 'none', // writing 15 MB to IndexedDB on a slow phone costs more than the HTTP cache's day-long copy saves
      logger: (m: any) => { if (m?.status) onStatus?.(String(m.status)); },
    });
  })();
  warm.catch(() => { warm = null; }); // a failed start is retried by the next upload
  return warm;
}

export async function releaseOcr(): Promise<void> {
  const w = warm; warm = null;
  try { await (await w)?.terminate(); } catch { /* never started */ }
}

// Shrink big images before recognition: recognition time grows with pixels. Falls back to the original file.
export async function downscale(file: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (k >= 1) { bmp.close(); return file; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * k); canvas.height = Math.round(bmp.height * k);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b ?? file), 'image/png'));
  } catch { return file; }
}

export async function readScreenshot(file: Blob, status?: (s: string) => void): Promise<OcrResult> {
  onStatus = status;
  const worker = await prewarmOcr();
  const { data } = await worker.recognize(await downscale(file));
  const text = String(data?.text ?? '');
  return { text, lines: text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) };
}
