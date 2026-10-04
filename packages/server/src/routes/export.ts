// Export, import, signed class packages and device keys (AC-74..AC-77, SPEC §4.24, §5.8, Appendix A "Export").
// The server only stores, signs and serves; manifests, tar and signatures all come from core (D-22).
import { z } from 'zod';
import {
  buildManifest, verifyManifest, tarPack, tarUnpack, generateSigningKeys, signPackage, openPackage,
} from '../../../core/src/index.ts';

type FileEntry = { path: string; bytes: Uint8Array };
type Doc = Record<string, any>;

const enc = new TextEncoder();
const dec = new TextDecoder();
const text = (s: string): Uint8Array => enc.encode(s);
const MAX_UPLOAD = 16 * 1024 * 1024;

// Keys that hold secrets are dropped from anything written to an export (D-28, AC-77).
const SECRET_KEY = /(private|secret|token|passphrase|password|cookie|^d$|hash$)/i;
const SECRET_KEEP = new Set(['hash', 'prevHash']); // ledger chain hashes are not secrets

function clean(value: any): any {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out: Doc = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY.test(k) && !SECRET_KEEP.has(k)) continue;
      out[k] = clean(v);
    }
    return out;
  }
  return value;
}

function stripRev(doc: Doc): Doc {
  const d = clean(doc);
  delete d._rev;
  return d;
}

function csvCell(v: unknown): string {
  let s = v === undefined || v === null ? '' : Array.isArray(v) ? v.join(';') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`; // spreadsheet formula guard
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}
const json = (v: unknown): string => JSON.stringify(v, null, 1) + '\n';
const byId = (a: Doc, b: Doc): number => (a._id < b._id ? -1 : a._id > b._id ? 1 : 0);

function dayMarkdown(d: Doc, withBody: boolean): string {
  const lines = [`# Day ${d.index ?? ''} ${d.date ?? ''}`.trim(), ''];
  for (const s of d.sections ?? []) {
    lines.push(`## ${s.title ?? s.id}`, '', `Planned: ${s.plannedSec ?? 0} s. Kind: ${s.kind ?? ''}.${s.graded ? ' Graded.' : ''}`, '');
    if (withBody && typeof s.body === 'string') lines.push(s.body, '');
  }
  return lines.join('\n');
}

export function register(app: any, ctx: any): void {
  const priv: string = ctx.store.priv;

  // ---- hub signing key pair: the private half lives only in the private db and is never exported ----
  let hubKeys: Promise<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey }> | null = null;
  async function loadHubKeys() {
    const doc = await ctx.store.get(priv, 'hubkey:signing');
    if (doc?.privateJwk && doc?.publicJwk) return { publicJwk: doc.publicJwk, privateJwk: doc.privateJwk };
    const keys = await generateSigningKeys();
    await ctx.store.put(priv, { type: 'hubkey', id: 'hubkey:signing', schema: ctx.schema, ...keys, updatedAt: ctx.clock.now(), updatedBy: 'hub' });
    return keys;
  }
  const getHubKeys = () => (hubKeys ??= loadHubKeys().catch((e) => { hubKeys = null; throw e; }));
  ctx.hooks.onReset.push(() => { hubKeys = null; });

  const classDbs = (): string[] => ctx.store.names().filter((n: string) => n.startsWith('class-')).sort();
  const personDbs = (): string[] => ctx.store.names().filter((n: string) => n.startsWith('person-')).sort();

  // Builds the export file list. `keep(dbName, doc)` filters documents (everything for the admin export).
  async function buildExport(opts: { title: string; keep: (db: string, d: Doc) => boolean; withBody: boolean; dbs: string[] }): Promise<Uint8Array> {
    const files: FileEntry[] = [];
    const add = (path: string, body: string) => files.push({ path, bytes: text(body) });
    const all: Record<string, Doc[]> = {};
    for (const db of opts.dbs) {
      const docs = (await ctx.store.list(db)).filter((d: Doc) => opts.keep(db, d)).sort(byId).map(stripRev);
      all[db] = docs;
    }
    const org = all['org'] ?? [];
    const people = org.filter((d) => d.type === 'person');
    const nameOf = new Map<string, string>(people.map((p) => [ctx.ids.keyOf(p.id), p.name]));

    const rosterRows: unknown[][] = [];
    const attRows: unknown[][] = [];
    const gradeRows: unknown[][] = [];
    const tickets: Doc[] = [];
    const mdDays: Array<[string, Doc]> = [];
    for (const [db, docs] of Object.entries(all)) {
      if (!db.startsWith('class-')) continue;
      const classKey = db.slice('class-'.length);
      for (const d of docs) {
        if (d.type === 'enrolment') rosterRows.push([ctx.ids.keyOf(String(d.personId)), nameOf.get(ctx.ids.keyOf(String(d.personId))) ?? '', classKey, d.status, d.profile ?? '', d.joinedAt ?? '']);
        else if (d.type === 'attendance') attRows.push([classKey, ctx.ids.keyOf(String(d.personId)), d.dayIndex, d.method, d.verified, d.at]);
        else if (d.type === 'ledger') for (const e of d.entries ?? []) gradeRows.push([classKey, d.subject, e.seq, e.value, e.by, e.at, e.reason ?? '', e.corrects ?? '']);
        else if (d.type === 'ticket') tickets.push({ classId: classKey, ...d });
        else if (d.type === 'day') mdDays.push([classKey, d]);
      }
    }
    for (const p of people) if (!rosterRows.some((r) => r[0] === ctx.ids.keyOf(p.id))) rosterRows.push([ctx.ids.keyOf(p.id), p.name, '', '', (p.roles ?? []).join(';'), '']);

    add('README.md', `# ${opts.title}\n\nExport of Coach LMS data. manifest.json lists every other file with its SHA-256.\nData files under data/ are the full documents; the CSV files are for spreadsheets.\n`);
    add('roster.csv', csv(['personId', 'name', 'classId', 'status', 'profile', 'joinedAt'], rosterRows));
    add('attendance.csv', csv(['classId', 'personId', 'dayIndex', 'method', 'verified', 'at'], attRows));
    add('grades.csv', csv(['classId', 'subject', 'seq', 'value', 'by', 'at', 'reason', 'corrects'], gradeRows));
    for (const [classKey, d] of mdDays) add(`content/${classKey}/day-${d.index}.md`, dayMarkdown(d, opts.withBody));
    for (const [db, docs] of Object.entries(all)) {
      add(`data/${db}.json`, json(docs));
      if (db.startsWith('class-')) {
        add(`ledger/${db}.json`, json(docs.filter((d) => d.type === 'ledger')));
        add(`events/${db}.json`, json(docs.filter((d) => d.type === 'integrity' || d.type === 'event')));
      }
    }
    add('board/board.json', json(tickets));

    files.sort((a, b) => (a.path < b.path ? -1 : 1));
    const manifest = await buildManifest(files);
    return tarPack([{ path: 'manifest.json', bytes: text(json(manifest)) }, ...files]);
  }

  function tarResponse(c: any, bytes: Uint8Array, name: string) {
    return c.body(bytes, 200, { 'content-type': 'application/x-tar', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' });
  }

  // ---- AC-74: full export (admin; ctx.policy also enforces this) ----
  app.get('/api/export', ctx.guard.role('admin'), async (c: any) => {
    const bytes = await buildExport({ title: 'Full export', keep: () => true, withBody: true, dbs: ['org', ...classDbs()] });
    return tarResponse(c, bytes, 'lms-export.tar');
  });

  // ---- AC-74: only the caller's own data ----
  app.get('/api/me/export', ctx.guard.auth, async (c: any) => {
    const me: string = c.get('session').personId;
    const mine = (d: Doc) => d.personId !== undefined && ctx.ids.keyOf(String(d.personId)) === me;
    const myAttempts = new Set<string>();
    for (const db of classDbs()) for (const d of await ctx.store.list(db, 'attempt:')) if (mine(d)) myAttempts.add(d.id.slice('attempt:'.length));
    const keep = (db: string, d: Doc): boolean => {
      if (db === 'org') return d.type === 'person' && ctx.ids.keyOf(d.id) === me;
      if (db === `person-${me}`) return true;
      if (d.type === 'ledger') return typeof d.subject === 'string' && d.subject.startsWith('attempt:') && myAttempts.has(d.subject.slice('attempt:'.length));
      if (d.type === 'ticket') return d.assignee !== undefined && ctx.ids.keyOf(String(d.assignee)) === me;
      return mine(d);
    };
    const dbs = ['org', ...classDbs(), ...personDbs().filter((n: string) => n === `person-${me}`)];
    const bytes = await buildExport({ title: 'My data', keep, withBody: false, dbs });
    return tarResponse(c, bytes, 'my-data.tar');
  });

  // ---- AC-75: import an export into this server (admin) ----
  app.post('/api/import', ctx.guard.role('admin'), async (c: any) => {
    const buf = new Uint8Array(await c.req.arrayBuffer());
    if (buf.length === 0) throw ctx.http.fieldError('body', 'empty');
    if (buf.length > MAX_UPLOAD * 4) throw ctx.http.fieldError('body', 'too-large', 413);
    let entries: FileEntry[];
    try { entries = tarUnpack(buf); } catch { throw ctx.http.fieldError('body', 'not-a-tar'); }
    const mf = entries.find((e) => e.path === 'manifest.json');
    if (!mf) throw ctx.http.fieldError('manifest', 'missing');
    let manifest: any;
    try { manifest = JSON.parse(dec.decode(mf.bytes)); } catch { throw ctx.http.fieldError('manifest', 'unreadable'); }
    const rest = entries.filter((e) => e.path !== 'manifest.json');
    const v = await verifyManifest(rest, manifest);
    if (v.missing.length || v.extra.length || v.changed.length) throw new ctx.http.ApiError(400, { error: { manifest: 'mismatch' }, ...v });
    let imported = 0;
    for (const e of rest) {
      const m = /^data\/(org|class-[A-Za-z0-9_-]+|person-[A-Za-z0-9_-]+)\.json$/.exec(e.path);
      if (!m) continue;
      let docs: any;
      try { docs = JSON.parse(dec.decode(e.bytes)); } catch { throw ctx.http.fieldError(e.path, 'unreadable'); }
      if (!Array.isArray(docs)) throw ctx.http.fieldError(e.path, 'not-a-list');
      for (const d of docs) {
        if (!d || typeof d.id !== 'string' || typeof d.type !== 'string') throw ctx.http.fieldError(e.path, 'bad-document');
        await ctx.store.put(m[1], stripRev(d));
        imported++;
      }
    }
    return c.json({ ok: true, imported });
  });

  // ---- AC-76: signed class package for the files profile (trainer) ----
  app.get('/api/classes/:id/package', ctx.guard.role('trainer', 'substitute'), async (c: any) => {
    const q = ctx.http.validateQuery(c, z.object({ day: z.coerce.number().int().min(0) }));
    const classKey = ctx.ids.keyOf(c.req.param('id'));
    const db = `class-${classKey}`;
    const cls = await ctx.store.get(db, `class:${classKey}`);
    if (!cls) throw ctx.http.fieldError('id', 'unknown', 404);
    const days = (await ctx.store.list(db, 'day:')).filter((d: Doc) => d.index === q.day);
    const files: FileEntry[] = [{ path: 'class.json', bytes: text(json(stripRev(cls))) }];
    for (const d of days) {
      // Section bodies stay sealed on the server until released (AC-68); the package carries structure only.
      const copy = stripRev({ ...d, sections: (d.sections ?? []).map((s: Doc) => { const { body: _b, ...rest } = s; return rest; }) });
      files.push({ path: `day-${q.day}.json`, bytes: text(json(copy)) }, { path: `day-${q.day}.md`, bytes: text(dayMarkdown(copy, false)) });
    }
    files.sort((a, b) => (a.path < b.path ? -1 : 1));
    const manifest = await buildManifest(files);
    const archive = tarPack([{ path: 'manifest.json', bytes: text(json(manifest)) }, ...files]);
    const signed = await signPackage(archive, (await getHubKeys()).privateJwk);
    return c.body(signed, 200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' });
  });

  // ---- AC-76: register a device signing key (public half only) ----
  const jwkSchema = z.object({ kty: z.literal('EC'), crv: z.literal('P-256'), x: z.string().min(1), y: z.string().min(1) }).strict();
  const deviceKeySchema = z.object({ deviceId: z.string().min(1).max(128), publicJwk: z.record(z.string(), z.unknown()) });
  app.post('/api/me/device-key', ctx.guard.auth, async (c: any) => {
    const b = await ctx.http.validateBody(c, deviceKeySchema);
    if ('d' in b.publicJwk) throw ctx.http.fieldError('publicJwk', 'private-key-refused');
    const { key_ops: _k, ext: _e, alg: _a, ...bare } = b.publicJwk as Doc;
    const pub = ctx.http.parseWith(jwkSchema, bare);
    const me = c.get('session').personId;
    await ctx.store.put(priv, { type: 'devicekey', id: `devicekey:${me}:${b.deviceId}`, schema: ctx.schema, personId: me, deviceId: b.deviceId, publicJwk: pub, updatedAt: ctx.clock.now(), updatedBy: me });
    return c.json({ ok: true });
  });

  // ---- AC-76: a learner's signed submission file ----
  app.post('/api/classes/:id/files', ctx.guard.auth, async (c: any) => {
    const classKey = ctx.ids.keyOf(c.req.param('id'));
    const db = `class-${classKey}`;
    if (!(await ctx.store.get(db, `class:${classKey}`))) throw ctx.http.fieldError('id', 'unknown', 404);
    const buf = new Uint8Array(await c.req.arrayBuffer());
    if (buf.length === 0) throw ctx.http.fieldError('body', 'empty');
    if (buf.length > MAX_UPLOAD) throw ctx.http.fieldError('body', 'too-large', 413);

    const enrolled = new Set<string>();
    for (const e of await ctx.store.list(db, 'enrolment:')) if (e.status !== 'dropped') enrolled.add(ctx.ids.keyOf(String(e.personId)));
    const candidates: Array<{ personId: string; deviceId: string; publicJwk: JsonWebKey }> = [];
    for (const k of await ctx.store.list(priv, 'devicekey:')) if (enrolled.has(k.personId)) candidates.push({ personId: k.personId, deviceId: k.deviceId, publicJwk: k.publicJwk });

    const all = await openPackage(buf, candidates.map((k) => k.publicJwk));
    if (!all.ok) {
      const status = all.reason === 'untrusted' ? 403 : 400;
      return c.json({ error: { file: all.reason } }, status);
    }
    let signer = candidates[0];
    for (const k of candidates) { if ((await openPackage(buf, [k.publicJwk])).ok) { signer = k; break; } }

    const key = ctx.ids.randomKey();
    const now = ctx.clock.now();
    await ctx.store.put(db, {
      type: 'file', id: `file:${key}`, schema: ctx.schema, personId: signer.personId, deviceId: signer.deviceId,
      receivedAt: now, files: all.files.map((f) => ({ path: f.path, size: f.bytes.length })),
      container: Buffer.from(buf).toString('base64'), updatedAt: now, updatedBy: c.get('session').personId,
    });
    return c.json({ ok: true, id: key, personId: signer.personId, files: all.files.length }, 201);
  });
}
