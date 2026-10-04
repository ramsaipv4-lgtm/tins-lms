// Test-mode routes (SPEC §5.9, Appendix A). Registered only when LMS_TEST_MODE=1.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { z } from 'zod';
import { hashCode } from './accounts.ts';

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

export function register(app: any, ctx: any): void {
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
    const counts = { docs: 0, packages: 0, joinCodes: 0 };
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
    return c.json({ ok: true, ...counts });
  });
}
