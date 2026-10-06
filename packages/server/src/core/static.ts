// Serves packages/web/dist at / with SPA fallback to index.html (only when the folder exists).
// Text files are sent compressed (brotli when the browser accepts it, else gzip), cached in memory by file and
// mtime: on a phone link every byte counts (SPEC §6.1 budgets; integration I-8).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { brotliCompressSync, gzipSync, constants as zc } from 'node:zlib';

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

function compressed(file: string, raw: Uint8Array, mtime: number, enc: 'br' | 'gzip'): Uint8Array {
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
  const raw = readFileSync(file);
  if (!COMPRESSIBLE.has(ext) || raw.length < MIN_BYTES) return new Response(raw, { headers });
  headers.vary = 'accept-encoding';
  const enc = pickEncoding(acceptEncoding);
  if (!enc) return new Response(raw, { headers });
  headers['content-encoding'] = enc;
  return new Response(compressed(file, raw, statSync(file).mtimeMs, enc), { headers });
}
