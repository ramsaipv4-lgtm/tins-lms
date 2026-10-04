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
import { hashCode } from './routes/accounts.ts';

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
const honoListener = getRequestListener(app.fetch);
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
