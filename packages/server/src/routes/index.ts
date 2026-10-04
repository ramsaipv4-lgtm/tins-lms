// Registers every route module. Each module exports `register(app, ctx)`; add new routes inside the
// module that owns them (TASKS.md), never here.
//
// What `ctx` gives a route module (built in ../core/ctx.ts):
//   ctx.config      { port, profile, dataDir, testMode, tls, repoRoot, webDist }
//   ctx.schema / ctx.version   document schema number and server version
//   ctx.clock       now() -> ms (use this, never Date.now(), when calling core); set(ms|null) is test-only
//   ctx.store       PouchDB access: get(db,id) -> doc|null, put(db,doc) upsert (_id = id), remove(db,id),
//                   list(db,prefix), db(name) raw PouchDB, priv = name of the never-replicated private db.
//                   Databases: 'org', 'class-<key>', 'person-<key>' (ids are `<type>:<key>`; routes use the key).
//   ctx.sessions    create(c,{personId,roles,deviceId?}) sets the HTTP-only cookie; get(c); destroy(c);
//                   revokeWhere(pred). In handlers prefer c.get('session') -> { personId (key), roles, deviceId? } | null.
//   ctx.guard       auth (any session) and role(...roles) middleware, e.g. app.post(path, ctx.guard.role('trainer'), h).
//                   admin always passes; list 'substitute' / 'coordinator' explicitly where they are allowed.
//                   Every /api/* route already needs a session except health, join, sign-in and pairing claim.
//   ctx.policy      add(method, pathPattern, roles) rows of the central role table (core/policy.ts); it runs before routing,
//                   so listed routes give 403 to the wrong role even before their module exists.
//   ctx.http        ApiError(status, body), fieldError(field,msg,status?), validateBody(c, zodSchema),
//                   validateQuery(c, zodSchema), parseWith(schema, data): invalid input -> 400 { error: { field: message } }.
//   ctx.ids         randomCode(n), randomKey(), sha256Hex(text), keyOf('person:l1') -> 'l1'.
//   ctx.people      ensureOrg, currentTnc, getPerson, savePerson, isMinor(dob, now).
//   ctx.ca / ctx.hubId   hub CA info { fingerprint, publicJwk } (null outside the hub profile) and the hub id.
//   ctx.dbGuards    push Express-style (req,res,next) functions that run before express-pouchdb serves /db/*.
//   ctx.hooks       seedPackage (content.ts sets it for /__test/seed `packages`), onReset (functions run by /__test/reset).
//   ctx.log(msg)    stderr line; never pass secrets, cookies, tokens or invite codes (D-28, AC-120).
import { register as health } from './health.ts';
import { register as accounts } from './accounts.ts';
import { register as testmode } from './testmode.ts';
import { register as pairing } from './pairing.ts';
import { register as attendance } from './attendance.ts';
import { register as content } from './content.ts';
import { register as sync } from './sync.ts';
import { register as grading } from './grading.ts';
import { register as exportRoutes } from './export.ts';

export type RouteModule = (app: any, ctx: any) => void;

export function registerRoutes(app: any, ctx: any): void {
  const modules: RouteModule[] = [health, accounts, pairing, attendance, content, sync, grading, exportRoutes];
  if (ctx.config.testMode) modules.push(testmode); // without LMS_TEST_MODE=1 /__test/* is a plain 404 (AC-78)
  for (const register of modules) register(app, ctx);
}
