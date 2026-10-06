// Server routes for the web feature group "board" (SPEC D-7, AC-97): board pages are `board:<pageId>` documents in
// the class database (the trainer pack and handover read them), and the Excalidraw fonts are served locally so the
// board never calls a CDN (AC-102).
import { z } from 'zod';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { brotliCompress, brotliCompressSync, gzipSync, constants as zc } from 'node:zlib';
import { extname, join, normalize, resolve, sep } from 'node:path';

const STAFF = ['admin', 'trainer', 'substitute', 'coordinator'];
const pageSchema = z.object({
  title: z.string().trim().min(1).max(120),
  order: z.number().int().min(0).max(10000),
  dayIndex: z.number().int().min(0).optional(),
  elements: z.array(z.record(z.string(), z.any())).max(5000),
});
const FONT_ROOT = resolve(new URL('../../../../board/assets', import.meta.url).pathname);

export function register(app: any, ctx: any): void {
  const store = ctx.store;
  const keyOf = (id: string): string => ctx.ids.keyOf(id);
  const staff = ctx.guard.role(...STAFF);

  async function classDoc(key: string) {
    const cls = await store.get(`class-${key}`, `class:${key}`);
    if (!cls) throw ctx.http.fieldError('class', 'unknown-class', 404);
    return cls;
  }
  const idOf = (raw: string): string => {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(raw)) throw ctx.http.fieldError('page', 'invalid-id', 400);
    return raw;
  };

  // Classes the board can be used for.
  app.get('/api/board/classes', staff, async () => {
    const keys = new Set<string>();
    for (const n of store.names()) if (/^class-./.test(n)) keys.add(n.slice('class-'.length));
    const out = [];
    for (const key of [...keys].sort()) {
      const cls = await store.get(`class-${key}`, `class:${key}`);
      if (cls) out.push({ id: key, name: cls.name ?? key });
    }
    return Response.json({ classes: out });
  });

  async function pagesOf(key: string) {
    const docs = await store.list(`class-${key}`, 'board:');
    return docs.map((d: any) => ({ id: keyOf(d.id), title: d.title ?? keyOf(d.id), order: d.order ?? 0, dayIndex: d.dayIndex, elements: d.elements ?? [] }))
      .sort((a: any, b: any) => a.order - b.order || a.id.localeCompare(b.id));
  }

  app.get('/api/board/classes/:id/pages', staff, async (c: any) => {
    const key = keyOf(c.req.param('id'));
    await classDoc(key);
    return c.json({ pages: await pagesOf(key) });
  });

  // One round trip for the screen's first paint: the classes and the pages of the first one.
  app.get('/api/board/boot', staff, async (c: any) => {
    const keys = new Set<string>();
    for (const n of store.names()) if (/^class-./.test(n)) keys.add(n.slice('class-'.length));
    const classes = [];
    for (const key of [...keys].sort()) {
      const cls = await store.get(`class-${key}`, `class:${key}`);
      if (cls) classes.push({ id: key, name: cls.name ?? key });
    }
    return c.json({ classes, pages: classes[0] ? await pagesOf(classes[0].id) : [] });
  });

  app.put('/api/board/classes/:id/pages/:pid', staff, async (c: any) => {
    const key = keyOf(c.req.param('id'));
    await classDoc(key);
    const pid = idOf(c.req.param('pid'));
    const b = await ctx.http.validateBody(c, pageSchema);
    const id = `board:${pid}`;
    const prev = await store.get(`class-${key}`, id);
    await store.put(`class-${key}`, {
      ...(prev ?? {}), type: 'board', id, schema: ctx.schema, updatedAt: ctx.clock.now(), updatedBy: String(c.get('session')?.personId ?? ''),
      title: b.title, order: b.order, ...(b.dayIndex !== undefined ? { dayIndex: b.dayIndex } : {}), elements: b.elements,
    });
    return c.json({ ok: true, id: pid });
  });

  app.delete('/api/board/classes/:id/pages/:pid', staff, async (c: any) => {
    const key = keyOf(c.req.param('id'));
    await classDoc(key);
    await store.remove(`class-${key}`, `board:${idOf(c.req.param('pid'))}`);
    return c.json({ ok: true });
  });

  // The board is about 3 MB of JavaScript, so on a slow phone link it only meets the 3 s budget (AC-101) when sent
  // compressed. The static server sends files as they are; this middleware compresses built assets (brotli when the browser accepts it, cached by mtime).
  const gz = new Map<string, { mtime: number; enc: string; body: Uint8Array }>();
  const TYPES: Record<string, string> = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const compress = (file: string, enc: string, mtime: number) => {
    const raw = readFileSync(file);
    const hit = { mtime, enc, body: enc === 'br' ? brotliCompressSync(raw, { params: { [zc.BROTLI_PARAM_QUALITY]: 5 } }) : gzipSync(raw, { level: 6 }) };
    gz.set(`${enc}:${file}`, hit);
    return hit;
  };
  // Warm the cache just after start so the first phone to open the board pays no compression time: a fast pass over
  // every large file, then the slow, smallest-output brotli (quality 11, on the thread pool, so requests are not blocked)
  // for the board chunk and the chunks it statically imports (found by reading its `from"./x.js"` imports).
  const best = (file: string) => new Promise<void>((resolveBest) => {
    const mtime = statSync(file).mtimeMs;
    const raw = readFileSync(file);
    brotliCompress(raw, { params: { [zc.BROTLI_PARAM_QUALITY]: 11, [zc.BROTLI_PARAM_SIZE_HINT]: raw.length } }, (err, body) => {
      if (!err) gz.set(`br:${file}`, { mtime, enc: 'br', body });
      resolveBest();
    });
  });
  setTimeout(async () => {
    try {
      const dir = join(resolve(ctx.config.webDist), 'assets');
      if (!existsSync(dir)) return;
      const files = readdirSync(dir).filter((x) => x.endsWith('.js') || x.endsWith('.css'));
      // The board chunk and every chunk it statically imports (read from its `from"./x.js"` imports), smallest first.
      const critical = new Set<string>(files.filter((x) => /^Board-/.test(x)));
      const todo = [...critical].filter((x) => x.endsWith('.js'));
      while (todo.length) {
        const text = readFileSync(join(dir, todo.pop()!), 'utf8');
        for (const m of text.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) if (!critical.has(m[1]) && existsSync(join(dir, m[1]))) { critical.add(m[1]); todo.push(m[1]); }
      }
      const order = [...critical].map((f) => join(dir, f)).sort((x, y) => statSync(x).size - statSync(y).size);
      // Slow brotli (quality 11) on the thread pool, in parallel, so requests are not blocked; the fast pass follows.
      const slow = Promise.all(order.map(best));
      for (const f of files) {
        const file = join(dir, f);
        if (statSync(file).size < 20000 || critical.has(f)) continue;
        compress(file, 'br', statSync(file).mtimeMs);
        await new Promise((r) => setImmediate(r));
      }
      await slow;
    } catch { /* warming is best effort */ }
  }, 0).unref();
  app.use('/assets/*', async (c: any, next: any) => {
    const ext = extname(c.req.path);
    if (c.req.method !== 'GET' || !TYPES[ext] || !/\b(br|gzip)\b/.test(c.req.header('accept-encoding') ?? '')) return next();
    const enc = /\bbr\b/.test(c.req.header('accept-encoding')) ? 'br' : 'gzip';
    const root = resolve(ctx.config.webDist);
    let rel: string;
    try { rel = normalize(decodeURIComponent(c.req.path)); } catch { return next(); }
    const file = resolve(root, '.' + sep + rel);
    if (!file.startsWith(root + sep) || !existsSync(file)) return next();
    const mtime = statSync(file).mtimeMs;
    const key = `${enc}:${file}`;
    let hit = gz.get(key);
    if (!hit || hit.mtime !== mtime) hit = compress(file, enc, mtime);
    return new Response(hit.body as BodyInit, { headers: { 'content-type': TYPES[ext], 'content-encoding': hit.enc, vary: 'accept-encoding', 'cache-control': 'public, max-age=31536000, immutable' } });
  });

  // Fonts for the canvas (EXCALIDRAW_ASSET_PATH = /board-assets/). Public: the files are the MIT-licensed Excalidraw fonts.
  app.get('/board-assets/*', (c: any) => {
    let rel: string;
    try { rel = normalize(decodeURIComponent(c.req.path.slice('/board-assets/'.length))); } catch { return new Response('not found', { status: 404 }); }
    const file = resolve(FONT_ROOT, rel);
    if (!file.startsWith(FONT_ROOT + sep) || extname(file) !== '.woff2' || !existsSync(file)) return new Response('not found', { status: 404 });
    return new Response(readFileSync(file), { headers: { 'content-type': 'font/woff2', 'cache-control': 'public, max-age=31536000, immutable' } });
  });
}
