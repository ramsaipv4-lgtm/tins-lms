// Serves packages/web/dist at / with SPA fallback to index.html (only when the folder exists).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json', '.wasm': 'application/wasm',
};

export function serveWeb(dist: string, urlPath: string): Response | null {
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
  const headers: Record<string, string> = { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' };
  if (isIndex || file.endsWith('sw.js')) headers['cache-control'] = 'no-cache';
  return new Response(readFileSync(file), { headers });
}
