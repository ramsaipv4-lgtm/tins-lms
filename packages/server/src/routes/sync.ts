// Sync rules for /db/* (SPEC §5.6, D-6, D-9, D-21, D-23, D-24, D-26, D-33) and the hub's merge pass.
// Everything here runs as Express-style guards pushed onto ctx.dbGuards, before express-pouchdb sees the
// request; the merge pass listens to PouchDB changes feeds and writes core-merged revisions back.
import { canSync, mergeRevisions } from '../../../core/src/index.ts';

const READ_POSTS = new Set(['_all_docs', '_changes', '_bulk_get', '_revs_diff', '_find', '_ensure_full_commit']);
const ORG_WRITERS = ['admin', 'trainer', 'coordinator'];
const PLAIN_FIELDS = ['kind', 'values', 'source'];

// Errors use the CouchDB shape { error: <string>, reason: <string> }: PouchDB clients choke on an object there.
function send(res: any, status: number, error: string, reason: string, extra: Record<string, any> = {}): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error, reason, ...extra }));
}

// Express-style guards read the cookie straight from the raw request; ctx.sessions only needs headers.
function sessionOf(ctx: any, req: any): { personId: string; roles: string[] } | null {
  const raw = new Request('http://hub.invalid/', { headers: req.headers.cookie ? { cookie: req.headers.cookie } : {} });
  return ctx.sessions.get({ req: { raw, header: (n: string) => raw.headers.get(n) ?? undefined } });
}

function readBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (d: Buffer) => chunks.push(d));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// express-pouchdb reads the request stream itself, so after buffering it we play the bytes back to it.
function replay(req: any, body: Buffer): void {
  const origOn = req.on.bind(req);
  let scheduled = false;
  Object.defineProperty(req, 'readable', { value: true, configurable: true }); // raw-body refuses an ended stream
  req.on = (event: string, fn: any) => {
    origOn(event, fn);
    if (event === 'data' && !scheduled) {
      scheduled = true;
      setImmediate(() => { if (body.length) req.emit('data', body); req.emit('end'); });
    }
    return req;
  };
}

function isDocId(s: string | undefined): boolean {
  return !!s && !s.startsWith('_') ;
}

export function register(_app: any, ctx: any): void {
  const watchers = new Map<string, any>();
  const queues = new Map<string, Promise<void>>();

  // ---- merge pass (D-24) ----
  async function resolveConflicts(dbName: string, id: string): Promise<void> {
    const db = ctx.store.db(dbName);
    let winner: any;
    try { winner = await db.get(id, { conflicts: true }); } catch { return; }
    const conflicts: string[] = winner._conflicts ?? [];
    if (conflicts.length === 0) return;
    const revs: any[] = [winner];
    for (const rev of conflicts) {
      try { revs.push(await db.get(id, { rev })); } catch { /* gone */ }
    }
    const strip = (d: any) => { const { _conflicts, _rev, _revisions, _revs_info, ...rest } = d; return rest; };
    const type = String(winner.type ?? id.split(':')[0]);
    const { doc } = mergeRevisions(type, revs.map(strip));
    const merged = { ...doc, _id: id, id, _rev: winner._rev };
    await db.bulkDocs([merged, ...conflicts.map((rev) => ({ _id: id, _rev: rev, _deleted: true }))]);
  }

  function enqueue(dbName: string, id: string): void {
    const prev = queues.get(dbName) ?? Promise.resolve();
    const next = prev.then(() => resolveConflicts(dbName, id)).catch((e: any) => ctx.log(`merge pass failed in ${dbName}: ${e?.name ?? 'Error'}`));
    queues.set(dbName, next);
  }

  function watch(dbName: string): void {
    if (watchers.has(dbName)) return;
    const db = ctx.store.db(dbName);
    const feed = db.changes({ since: 0, live: true, conflicts: true, include_docs: true });
    feed.on('change', (ch: any) => { if (ch.doc?._conflicts?.length) enqueue(dbName, ch.id); });
    feed.on('error', () => { watchers.delete(dbName); });
    // A reset (or any destroy) must not leave a live feed on the old handle: it blocks the next open of that name.
    db.once('destroyed', () => { try { feed.cancel(); } catch { /* ignore */ } if (watchers.get(dbName) === feed) watchers.delete(dbName); });
    watchers.set(dbName, feed);
  }

  // express-pouchdb caches database handles by name and never learns that /__test/reset destroyed one;
  // the stale handle then hangs every request. Dropping the cache entry on destroy fixes that.
  ctx.store.PouchDB.on('destroyed', (name: string) => { ctx.store.PouchDB.__dbCacheMap?.delete(name); });

  ctx.hooks.onReset.push(() => {
    for (const f of watchers.values()) { try { f.cancel(); } catch { /* ignore */ } }
    watchers.clear();
    queues.clear();
  });

  for (const name of ctx.store.names()) if (/^(org|class-.+|person-.+)$/.test(name)) watch(name);

  // ---- guards ----
  const schemaGuard = (req: any, res: any, next: any) => {
    const h = req.headers['x-lms-schema'];
    if (h === undefined) return next();
    const n = Number(Array.isArray(h) ? h[0] : h);
    if (!Number.isInteger(n)) return send(res, 400, 'bad_request', 'x-lms-schema must be an integer');
    const r = canSync(n, ctx.schema);
    if (r.ok) return next();
    // 426: the client or the hub must be updated; the body names the action (update-app / update-hub).
    return send(res, 426, r.action, `${r.action}: client schema ${n}, hub schema ${ctx.schema}`, { action: r.action });
  };

  const accessGuard = (req: any, res: any, next: any) => {
    const [pathPart] = String(req.url).split('?');
    const seg = pathPart.split('/').filter(Boolean);
    if (seg.length === 0) return next(); // server banner
    const session = sessionOf(ctx, req);
    if (!session) return send(res, 401, 'unauthorized', 'session required');
    const dbName = decodeURIComponent(seg[0]);
    const method = String(req.method).toUpperCase();
    const isRead = method === 'GET' || method === 'HEAD' || (method === 'POST' && seg.length === 2 && READ_POSTS.has(seg[1]));
    if (seg.length === 1 && method === 'DELETE') return send(res, 403, 'forbidden', 'database forbidden');
    const isAdmin = session.roles.includes('admin');
    if (dbName === 'org') {
      if (!isRead && !session.roles.some((r) => ORG_WRITERS.includes(r))) return send(res, 403, 'forbidden', 'role forbidden');
    } else if (dbName.startsWith('person-')) {
      const owner = dbName.slice('person-'.length);
      const ok = session.personId === owner || (isAdmin && isRead);
      if (!ok) return send(res, 403, 'forbidden', 'database forbidden');
    }
    if (dbName === 'org' || dbName.startsWith('class-') || dbName.startsWith('person-')) {
      watch(dbName);
      // A personal or class database exists as soon as its owner (or a member) asks for it.
      ctx.store.db(dbName).info().then(() => next(), (e: any) => next(e));
      return;
    }
    next();
  };

  // Document rules on writes: coachEntry only in the owner's personal database, never for a minor,
  // never with plaintext fields (D-26, D-33).
  const documentGuard = async (req: any, res: any, next: any) => {
    try {
      const method = String(req.method).toUpperCase();
      if (method !== 'POST' && method !== 'PUT') return next();
      const [pathPart] = String(req.url).split('?');
      const seg = pathPart.split('/').filter(Boolean);
      if (seg.length === 0) return next();
      const dbName = decodeURIComponent(seg[0]);
      const ctype = String(req.headers['content-type'] ?? '');
      const bulk = seg.length === 2 && seg[1] === '_bulk_docs';
      const single = (seg.length === 1 && method === 'POST') || (seg.length === 2 && method === 'PUT' && isDocId(seg[1]));
      if (!(bulk || single) || !ctype.includes('json')) return next();
      const body = await readBody(req);
      replay(req, body);
      let parsed: any;
      try { parsed = JSON.parse(body.toString('utf8') || 'null'); } catch { return next(); } // express-pouchdb reports bad JSON
      const docs: any[] = bulk ? (Array.isArray(parsed?.docs) ? parsed.docs : []) : [parsed];
      const idOf = (d: any) => (single && seg.length === 2 ? decodeURIComponent(seg[1]) : String(d?._id ?? ''));
      const coach = docs.filter((d) => d && !d._deleted && (d.type === 'coachEntry' || idOf(d).startsWith('coachEntry:')));
      if (coach.length === 0) return next();
      if (!dbName.startsWith('person-')) return send(res, 400, 'bad_request', 'coachEntry-only-in-personal-database');
      const person = await ctx.people.getPerson(ctx, dbName.slice('person-'.length));
      const minor = !!person && (person.minor === true || (typeof person.dob === 'string' && ctx.people.isMinor(person.dob, ctx.clock.now())));
      if (minor) return send(res, 403, 'forbidden', 'coachEntry refused: minor profile');
      for (const d of coach) {
        const plain = PLAIN_FIELDS.filter((f) => d[f] !== undefined);
        if (plain.length > 0) return send(res, 400, 'bad_request', 'coachEntry plaintext refused', { fields: plain });
        if (!d.enc || typeof d.enc.iv !== 'string' || typeof d.enc.ct !== 'string') return send(res, 400, 'bad_request', 'coachEntry needs enc: { iv, ct }');
      }
      next();
    } catch (e) { next(e); }
  };

  ctx.dbGuards.push(schemaGuard, accessGuard, documentGuard);
}
