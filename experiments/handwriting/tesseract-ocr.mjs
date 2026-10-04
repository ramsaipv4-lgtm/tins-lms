import { createWorker } from 'tesseract.js';
const w = await createWorker('eng', 1, { langPath: new URL('./node_modules/@tesseract.js-data/eng/4.0.0_best_int', import.meta.url).pathname, gzip: true, cachePath: '/tmp/claude-0/hw/tess/cache' });
for (const v of ['v1-original', 'v2-opaque-shape-over', 'v3-translucent-highlight-over', 'v4-writing-over-filled-shape']) {
  const { data } = await w.recognize(`../${v}.png`);
  const { writeFileSync } = await import('node:fs'); writeFileSync(`../out-tesseract-${v.slice(0,2)}.md`, data.text);
}
await w.terminate();
