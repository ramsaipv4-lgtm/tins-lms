// express-pouchdb (D-9) mounted at /db on the same HTTP server. A guard chain runs before it:
// route modules (sync.ts) push functions onto ctx.dbGuards; each is (req, res, next) in Express style.
// Built-in guard: only the org, class-* and person-* databases are reachable; nothing else
// (lms-private, _all_dbs, _utils ...) is.
import { join } from 'node:path';
import express from 'express';
import expressPouchdb from 'express-pouchdb';

const OPEN_DB = /^\/(org|class-[A-Za-z0-9_-]+|person-[A-Za-z0-9_-]+)(\/|$|\?)/;

export function createDbMount(store: any, dataDir: string, guards: Array<(req: any, res: any, next: (e?: any) => void) => void>) {
  const app = express();
  app.use((req: any, res: any, next: any) => {
    const path: string = req.url;
    const isRoot = path === '/' || path.startsWith('/?');
    if (!isRoot && !OPEN_DB.test(path)) {
      res.statusCode = 403;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: { database: 'forbidden' } }));
      return;
    }
    let i = 0;
    const step = (err?: any) => {
      if (err) return next(err);
      const g = guards[i++];
      if (!g) return next();
      try { g(req, res, step); } catch (e) { next(e); }
    };
    step();
  });
  app.use(expressPouchdb(store.PouchDB, {
    mode: 'minimumForPouchDB',
    inMemoryConfig: true,
    logPath: join(dataDir, 'express-pouchdb.log'),
  }));
  return app;
}
