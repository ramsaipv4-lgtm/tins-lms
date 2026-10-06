// Server routes for the web feature group "board" (SPEC D-7, AC-97): board pages are `board:<pageId>` documents in
// the class database (the trainer pack and handover read them), and the Excalidraw fonts are served locally so the
// board never calls a CDN (AC-102).
import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { extname, normalize, resolve, sep } from 'node:path';

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

  // Fonts for the canvas (EXCALIDRAW_ASSET_PATH = /board-assets/). Public: the files are the MIT-licensed Excalidraw fonts.
  app.get('/board-assets/*', (c: any) => {
    let rel: string;
    try { rel = normalize(decodeURIComponent(c.req.path.slice('/board-assets/'.length))); } catch { return new Response('not found', { status: 404 }); }
    const file = resolve(FONT_ROOT, rel);
    if (!file.startsWith(FONT_ROOT + sep) || extname(file) !== '.woff2' || !existsSync(file)) return new Response('not found', { status: 404 });
    return new Response(readFileSync(file), { headers: { 'content-type': 'font/woff2', 'cache-control': 'public, max-age=31536000, immutable' } });
  });
}
