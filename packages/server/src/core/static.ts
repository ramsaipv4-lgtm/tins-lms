// Serves packages/web/dist at / with SPA fallback to index.html (only when the folder exists).
// Text files are sent compressed (brotli when the browser accepts it, else gzip), cached in memory by file and
// mtime: on a phone link every byte counts (SPEC §6.1 budgets; integration I-8).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { brotliCompress, brotliCompressSync, gzipSync, constants as zc } from 'node:zlib';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json', '.wasm': 'application/wasm',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt', '.map', '.wasm']);
const MIN_BYTES = 1024;
const cache = new Map<string, { mtime: number; body: Uint8Array }>();

/** Picks the encoding for an Accept-Encoding header: 'br', 'gzip' or null. */
export function pickEncoding(acceptEncoding: string): 'br' | 'gzip' | null {
  const ae = acceptEncoding.toLowerCase();
  if (/\bbr\b(?!;q=0(\.0*)?\b)/.test(ae)) return 'br';
  if (/\bgzip\b(?!;q=0(\.0*)?\b)/.test(ae)) return 'gzip';
  return null;
}

export function compressed(file: string, raw: Uint8Array, mtime: number, enc: 'br' | 'gzip'): Uint8Array {
  const key = `${enc}:${file}`;
  const hit = cache.get(key);
  if (hit && hit.mtime === mtime) return hit.body;
  const body = enc === 'br' ? brotliCompressSync(raw, { params: { [zc.BROTLI_PARAM_QUALITY]: 5, [zc.BROTLI_PARAM_SIZE_HINT]: raw.length } }) : gzipSync(raw, { level: 6 });
  cache.set(key, { mtime, body });
  return body;
}

export function serveWeb(dist: string, urlPath: string, acceptEncoding = ''): Response | null {
  if (!existsSync(join(dist, 'index.html'))) return null;
  let rel: string;
  try { rel = normalize(decodeURIComponent(urlPath)); } catch { return null; }
  const root = resolve(dist);
  let file = resolve(root, '.' + sep + rel);
  if (file !== root && !file.startsWith(root + sep)) return null;
  let isIndex = false;
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (extname(rel) !== '' && !rel.endsWith(sep)) return null; // a missing asset is a 404, not the app
    file = join(root, 'index.html');
    isIndex = true;
  }
  const ext = extname(file);
  const headers: Record<string, string> = { 'content-type': TYPES[ext] ?? 'application/octet-stream' };
  if (isIndex || file.endsWith('sw.js')) headers['cache-control'] = 'no-cache';
  else if (rel.split(sep).includes('assets')) headers['cache-control'] = 'public, max-age=31536000, immutable'; // hashed build files
  const raw = readFileSync(file);
  if (!COMPRESSIBLE.has(ext) || raw.length < MIN_BYTES) return new Response(raw, { headers });
  headers.vary = 'accept-encoding';
  const enc = pickEncoding(acceptEncoding);
  if (!enc) return new Response(raw, { headers });
  headers['content-encoding'] = enc;
  return new Response(compressed(file, raw, statSync(file).mtimeMs, enc), { headers });
}

/**
 * Warms the compression cache just after start so the first phone to open the board pays no compression time: a
 * fast pass over every large asset, then the slow, smallest-output brotli (quality 11, on the thread pool) for the
 * board chunk and the chunks it statically imports (found by reading its `from"./x.js"` imports). Best effort.
 */
export function warmWeb(dist: string): void {
  setTimeout(async () => {
    try {
      const dir = join(resolve(dist), 'assets');
      if (!existsSync(dir)) return;
      const files = readdirSync(dir).filter((x) => x.endsWith('.js') || x.endsWith('.css'));
      const critical = new Set<string>(files.filter((x) => /^Board-/.test(x)));
      const todo = [...critical].filter((x) => x.endsWith('.js'));
      while (todo.length) {
        const text = readFileSync(join(dir, todo.pop()!), 'utf8');
        for (const m of text.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) {
          if (!critical.has(m[1]) && existsSync(join(dir, m[1]))) { critical.add(m[1]); todo.push(m[1]); }
        }
      }
      const best = (file: string) => new Promise<void>((done) => {
        const mtime = statSync(file).mtimeMs;
        const raw = readFileSync(file);
        brotliCompress(raw, { params: { [zc.BROTLI_PARAM_QUALITY]: 11, [zc.BROTLI_PARAM_SIZE_HINT]: raw.length } }, (err, body) => {
          if (!err) cache.set(`br:${file}`, { mtime, body });
          done();
        });
      });
      const order = [...critical].map((f) => join(dir, f)).sort((x, y) => statSync(x).size - statSync(y).size);
      const slow = Promise.all(order.map(best));
      for (const f of files) {
        const file = join(dir, f);
        if (statSync(file).size < 20000 || critical.has(f)) continue;
        compressed(file, readFileSync(file), statSync(file).mtimeMs, 'br');
        await new Promise((r) => setImmediate(r));
      }
      await slow;
    } catch { /* warming is best effort */ }
  }, 0).unref();
}
