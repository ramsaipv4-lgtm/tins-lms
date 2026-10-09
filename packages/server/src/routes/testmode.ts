// Test-mode routes (SPEC §5.9, Appendix A). Registered only when LMS_TEST_MODE=1.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { z } from 'zod';
import { hashCode } from './accounts.ts';
import { importSamplePacks } from './features/games.ts';

const loginSchema = z.object({ personId: z.string().min(1), roles: z.array(z.string()).default([]) });
const seedSchema = z.object({ fixture: z.string().min(1) });
const clockSchema = z.object({ now: z.number().finite().nullable() });

function fixtureDirs(ctx: any): string[] {
  const dirs = [join(ctx.config.repoRoot, 'acceptance', 'fixtures')];
  if (process.env.LMS_ACCEPTANCE_DIR) dirs.unshift(join(process.env.LMS_ACCEPTANCE_DIR, 'fixtures'));
  return dirs.filter((d) => existsSync(d));
}

function findFixture(ctx: any, rel: string): string | null {
  for (const dir of fixtureDirs(ctx)) {
    const root = resolve(dir);
    const file = resolve(root, rel);
    if (file.startsWith(root + sep) && existsSync(file)) return file;
  }
  return null;
}

const TEST_META = '<meta name="lms-test-mode" content="1">';

export function register(app: any, ctx: any): void {
  // With LMS_TEST_MODE=1 the HTML pages carry <meta name="lms-test-mode" content="1"> (SPEC §13.3 "Test hooks"): only then does the
  // web app expose window.__game and honour ?seed=, ?clock=manual and ?story=off. This module is registered in test mode only.
  app.use('*', async (c: any, next: any) => {
    await next();
    const res: Response = c.res;
    if (c.req.method !== 'GET' || !(res.headers.get('content-type') ?? '').startsWith('text/html')) return;
    const enc = res.headers.get('content-encoding');
    const raw = Buffer.from(await res.arrayBuffer());
    const html = (enc === 'br' ? brotliDecompressSync(raw) : enc === 'gzip' ? gunzipSync(raw) : raw).toString('utf8');
    const headers = new Headers(res.headers); headers.delete('content-encoding'); headers.delete('content-length');
    const out = /name="lms-test-mode"/.test(html.replace(/<!--[\s\S]*?-->/g, '')) ? html
      : /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${TEST_META}`) : TEST_META + html;
    c.res = new Response(out, { status: res.status, headers });
  });

  app.post('/__test/login', async (c: any) => {
    const b = await ctx.http.validateBody(c, loginSchema);
    const personId = ctx.ids.keyOf(b.personId);
    ctx.sessions.create(c, { personId, roles: b.roles });
    return c.json({ ok: true, personId, roles: b.roles });
  });

  app.post('/__test/clock', async (c: any) => {
    const b = await ctx.http.validateBody(c, clockSchema);
    ctx.clock.set(b.now);
    return c.json({ ok: true, now: ctx.clock.now() });
  });

  app.post('/__test/reset', async (c: any) => {
    await ctx.store.destroyAll();
    ctx.clock.set(null);
    for (const fn of ctx.hooks.onReset) await fn();
    await ctx.people.ensureOrg(ctx);
    return c.json({ ok: true });
  });

  app.post('/__test/seed', async (c: any) => {
    const b = await ctx.http.validateBody(c, seedSchema);
    const file = findFixture(ctx, b.fixture);
    if (!file) throw ctx.http.fieldError('fixture', 'not-found', 404);
    let data: any;
    try { data = JSON.parse(readFileSync(file, 'utf8')); } catch { throw ctx.http.fieldError('fixture', 'invalid-json'); }
    const counts = { docs: 0, packages: 0, joinCodes: 0, samplePacks: 0 };
    for (const [dbName, docs] of Object.entries<any>(data.databases ?? {})) {
      ctx.store.db(dbName);
      for (const doc of docs) {
        const id = doc.id ?? doc._id;
        if (typeof id !== 'string') throw ctx.http.fieldError('fixture', 'document-without-id');
        const { _rev, ...rest } = doc;
        await ctx.store.put(dbName, { ...rest, id });
        counts.docs++;
      }
    }
    for (const jc of data.joinCodes ?? []) {
      await ctx.store.put(ctx.store.priv, {
        id: `joincode:${await hashCode(ctx, jc.code)}`, type: 'joinCode', classId: ctx.ids.keyOf(jc.classId), usedAt: null,
      });
      counts.joinCodes++;
    }
    for (const p of data.packages ?? []) {
      if (ctx.hooks.seedPackage) {
        const resolveFile = (rel: string): string | null => {
          for (const dir of fixtureDirs(ctx)) for (const root of [dir, resolve(dir, '..')]) {
            const f = resolve(root, rel);
            if (existsSync(f)) return f;
          }
          return null;
        };
        await ctx.hooks.seedPackage({ path: p.path, file: resolveFile(p.path), classId: ctx.ids.keyOf(p.classId), publish: !!p.publish });
      }
      counts.packages++;
    }
    // D-59: every pack under packages/games/packs is imported into the class as if it came from its package, with `day` replaced.
    for (const sp of data.samplePacks ?? []) {
      counts.samplePacks += await importSamplePacks(ctx, ctx.ids.keyOf(sp.classId), Number(sp.day) || 0);
    }
    return c.json({ ok: true, ...counts });
  });
}
