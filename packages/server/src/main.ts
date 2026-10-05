// Entry point: node packages/server/src/main.ts (SPEC §2). Reads PORT, LMS_PROFILE, LMS_DATA_DIR, LMS_TEST_MODE, LMS_TLS.
// One Node HTTP server: /db goes to express-pouchdb (D-9), everything else to Hono.
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getRequestListener } from '@hono/node-server';
import { createApp } from './app.ts';
import { readConfig } from './core/config.ts';
import { createCtx } from './core/ctx.ts';
import { createDbMount } from './core/dbmount.ts';
import { loadOrCreateCa } from './core/ca.ts';
import { randomCode } from './core/ids.ts';
import { Hono } from 'hono';
import { hashCode, registerSignin } from './routes/accounts.ts';
import { ApiError } from './core/http.ts';

const config = readConfig();
const ctx = createCtx(config);

// First start: create the org, the admin invite (printed once) and, on a hub, the certificate authority.
const { created } = await ctx.people.ensureOrg(ctx);
if (config.profile === 'hub') ctx.ca = await loadOrCreateCa(config.dataDir);
if (created) {
  const code = `ADM-${randomCode(4)}-${randomCode(4)}`;
  await ctx.store.put(ctx.store.priv, { id: `invite:${await hashCode(ctx, code)}`, type: 'invite', role: 'admin', usedAt: null, createdAt: ctx.clock.now() });
  console.log(`ADMIN_INVITE ${code}`);
}

const app = createApp(ctx);

// Sign-in routes (/api/signin/*) need no session; they live on their own small app so the session gate in app.ts is not involved.
const signinApp = new Hono();
signinApp.use('*', async (c, next) => { c.set('session' as any, null); await next(); });
signinApp.onError((err, c) => {
  if (err instanceof ApiError) return c.json(err.body as any, err.status as any);
  ctx.log(`unhandled error: ${(err as Error)?.name ?? 'Error'}`);
  return c.json({ error: { server: 'internal' } }, 500);
});
registerSignin(signinApp, ctx);

// LMS_PSEUDO_LOCALE=1: inject <meta name="lms-pseudo-locale" content="1"> into the HTML the server sends (SPEC Appendix C).
const pseudoLocale = process.env.LMS_PSEUDO_LOCALE === '1';
const PSEUDO_META = '<meta name="lms-pseudo-locale" content="1">';
async function fetchWithExtras(req: Request): Promise<Response> {
  const path = new URL(req.url).pathname;
  const res = path.startsWith('/api/signin/') ? await signinApp.fetch(req) : await app.fetch(req);
  if (!pseudoLocale || !(res.headers.get('content-type') ?? '').startsWith('text/html')) return res;
  const html = await res.text();
  if (/<meta[^>]*name="lms-pseudo-locale"/.test(html.replace(/<!--[\s\S]*?-->/g, ''))) return new Response(html, { status: res.status, headers: res.headers });
  const out = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${PSEUDO_META}`) : PSEUDO_META + html;
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  return new Response(out, { status: res.status, headers });
}
const honoListener = getRequestListener(fetchWithExtras);
const dbApp = createDbMount(ctx.store, config.dataDir, ctx.dbGuards);

const handler = (req: any, res: any) => {
  const url: string = req.url ?? '/';
  if (url === '/db' || url.startsWith('/db/') || url.startsWith('/db?')) {
    req.url = url.slice(3) || '/';
    return dbApp(req, res);
  }
  return honoListener(req, res);
};

let server;
const cert = join(config.dataDir, 'tls', 'cert.pem');
const key = join(config.dataDir, 'tls', 'key.pem');
if (config.tls !== 'off' && existsSync(cert) && existsSync(key)) {
  server = createHttps({ cert: readFileSync(cert), key: readFileSync(key) }, handler);
} else {
  if (config.tls !== 'off') ctx.log('no certificate under <data>/tls; serving plain HTTP');
  server = createHttp(handler);
}

server.listen(config.port, () => {
  const addr: any = server.address();
  console.log(`LISTENING ${addr.port}`);
});

const stop = () => {
  server.close();
  ctx.store.close().finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
