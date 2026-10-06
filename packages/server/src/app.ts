// The Hono app: session middleware, error mapping, route modules, static web app.
import { Hono } from 'hono';
import { isPublicApi } from './core/guard.ts';
import { ApiError } from './core/http.ts';
import { serveWeb, warmWeb } from './core/static.ts';
import { registerRoutes } from './routes/index.ts';
import type { Ctx } from './core/ctx.ts';

export function createApp(ctx: Ctx) {
  const app = new Hono();

  // Attach the session (if any) to every API request; refuse anonymous access except on public routes.
  app.use('/api/*', async (c, next) => {
    const s = ctx.sessions.get(c);
    c.set('session', s);
    if (!s && !isPublicApi(c.req.path)) throw new ApiError(401, { error: { session: 'required' } });
    if (s) ctx.policy.check(c.req.method, c.req.path, s.roles);
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json(err.body as any, err.status as any);
    ctx.log(`unhandled error: ${(err as Error)?.name ?? 'Error'}`); // message may hold user data: not logged
    return c.json({ error: { server: 'internal' } }, 500);
  });

  registerRoutes(app, ctx);
  warmWeb(ctx.config.webDist);

  app.notFound((c) => {
    const p = c.req.path;
    if (c.req.method === 'GET' && !p.startsWith('/api/') && !p.startsWith('/__test') && !p.startsWith('/db')) {
      const r = serveWeb(ctx.config.webDist, p, c.req.header('accept-encoding') ?? '');
      if (r) return r;
    }
    return c.json({ error: { route: 'not-found' } }, 404);
  });

  return app;
}
