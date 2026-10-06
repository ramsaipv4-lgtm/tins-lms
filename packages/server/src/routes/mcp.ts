// MCP on the hub (SPEC Appendix B "MCP on the hub", AC-116, D-31): Streamable HTTP, JSON-RPC 2.0, POST /mcp,
// authenticated by the session cookie. Read tools only read what the signed-in person may read. The three write
// tools (grade_edit, post_message, repo_write) change nothing: they return a pending diff, and only a person
// confirming it through /api/mcp/pending/:id/confirm lets it happen (AI proposes, people decide).
import { z } from 'zod';

const PROTOCOL = '2025-06-18';
const STAFF = ['admin', 'trainer', 'substitute', 'coordinator'];

type Tool = { name: string; description: string; readOnly: boolean; schema: z.ZodType<any>; input: Record<string, unknown> };
const str = (d: string) => ({ type: 'string', description: d });
const obj = (properties: Record<string, unknown>, required: string[]) => ({ type: 'object', properties, required, additionalProperties: false });

// Write tools only describe a change; their arguments are recorded as given, never executed.
const LOOSE = z.record(z.string(), z.unknown());

const TOOLS: Tool[] = [
  { name: 'list_classes', description: 'Classes the signed-in person can see.', readOnly: true, schema: z.object({}), input: obj({}, []) },
  { name: 'class_schedule', description: 'The scheduled days of one class.', readOnly: true, schema: z.object({ classId: z.string().min(1) }),
    input: obj({ classId: str('class id') }, ['classId']) },
  { name: 'list_attempts', description: 'Graded-work attempts in a class: all of them for staff, only your own for a learner.', readOnly: true,
    schema: z.object({ classId: z.string().min(1) }), input: obj({ classId: str('class id') }, ['classId']) },
  { name: 'grade_edit', description: 'Propose a grade change. Returns a pending diff; a person must confirm it.', readOnly: false,
    schema: LOOSE,
    input: obj({ classId: str('class id'), attemptId: str('attempt id'), score: { type: 'number' }, reason: str('why') }, ['classId', 'attemptId', 'score']) },
  { name: 'post_message', description: 'Propose a message to people. Returns a pending diff; a person must confirm it.', readOnly: false,
    schema: LOOSE,
    input: obj({ recipients: { type: 'array', items: { type: 'string' } }, text: str('message text') }, ['recipients', 'text']) },
  { name: 'repo_write', description: 'Propose a repository change. Returns a pending diff; a person must confirm it.', readOnly: false,
    schema: LOOSE,
    input: obj({ repo: str('repository'), path: str('file path'), content: str('new file content') }, ['repo', 'path', 'content']) },
];

class RpcError extends Error {
  code: number;
  constructor(code: number, message: string) { super(message); this.code = code; }
}

export function register(app: any, ctx: any): void {
  const { store, ids } = ctx;
  const isStaff = (roles: string[]) => roles.some((r) => STAFF.includes(r));

  async function classKeys(session: any): Promise<string[]> {
    const keys = store.names().filter((n: string) => n.startsWith('class-')).map((n: string) => n.slice('class-'.length));
    if (isStaff(session.roles)) return keys;
    const mine: string[] = [];
    for (const k of keys) {
      const en = (await store.list(`class-${k}`, 'enrolment:')).find((e: any) => ids.keyOf(String(e.personId ?? e.id)) === session.personId && e.status !== 'dropped');
      if (en) mine.push(k);
    }
    return mine;
  }

  async function allowedClass(session: any, raw: string): Promise<string> {
    const key = ids.keyOf(raw);
    if (!(await classKeys(session)).includes(key)) throw new RpcError(-32602, 'unknown class');
    return key;
  }

  async function runRead(name: string, a: any, session: any): Promise<unknown> {
    if (name === 'list_classes') {
      const out = [];
      for (const k of await classKeys(session)) {
        const cls = await store.get(`class-${k}`, `class:${k}`);
        if (cls) out.push({ id: k, name: cls.name ?? k });
      }
      return { classes: out };
    }
    const key = await allowedClass(session, a.classId);
    const cls = await store.get(`class-${key}`, `class:${key}`);
    if (name === 'class_schedule') return { classId: key, schedule: cls?.schedule ?? [] };
    const all = await store.list(`class-${key}`, 'attempt:');
    const mine = isStaff(session.roles) ? all : all.filter((x: any) => x.personId === session.personId);
    return { classId: key, attempts: mine.map((x: any) => ({ id: ids.keyOf(x.id), personId: x.personId, itemId: x.itemId, mode: x.mode, score: x.score ?? null })) };
  }

  // A write tool never writes the thing itself: it stores a proposal and shows what would change.
  async function propose(name: string, a: Record<string, any>, session: any): Promise<unknown> {
    let diff: Record<string, unknown>;
    if (name === 'grade_edit') {
      const classId = a.classId ?? a.class_id;
      const attemptId = a.attemptId ?? a.attempt_id;
      const attempt = classId && attemptId ? await store.get(`class-${ids.keyOf(String(classId))}`, `attempt:${ids.keyOf(String(attemptId))}`) : null;
      diff = { kind: 'grade', classId: classId ?? null, attemptId: attemptId ?? null, personId: attempt?.personId ?? null, before: attempt?.score ?? null, after: a.score ?? null, reason: a.reason ?? null };
    } else if (name === 'post_message') {
      diff = { kind: 'message', recipients: a.recipients ?? a.to ?? null, text: a.text ?? a.body ?? a.message ?? null };
    } else {
      diff = { kind: 'repo', repo: a.repo ?? null, path: a.path ?? null, after: a.content ?? null };
    }
    const pendingId = ids.randomKey();
    await store.put(store.priv, { id: `mcppending:${pendingId}`, type: 'mcpPending', tool: name, args: a, diff, status: 'pending', proposedBy: session.personId, createdAt: ctx.clock.now() });
    return { status: 'pending', diff, pendingId };
  }

  async function handle(msg: any, session: any): Promise<any | null> {
    const id = msg?.id ?? null;
    const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });
    const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(-32600, 'invalid request');
    if (msg.id === undefined) return null; // notification (e.g. notifications/initialized): no response
    try {
      switch (msg.method) {
        case 'initialize':
          return ok({ protocolVersion: PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'coach-lms-hub', version: ctx.version } });
        case 'ping':
          return ok({});
        case 'tools/list':
          return ok({ tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input, annotations: { readOnlyHint: t.readOnly } })) });
        case 'tools/call': {
          const tool = TOOLS.find((t) => t.name === msg.params?.name);
          if (!tool) return fail(-32602, `unknown tool: ${String(msg.params?.name)}`);
          const parsed = tool.schema.safeParse(msg.params?.arguments ?? {});
          if (!parsed.success) return fail(-32602, `invalid arguments: ${parsed.error.issues.map((i) => i.path.join('.') || '_').join(', ')}`);
          const out = tool.readOnly ? await runRead(tool.name, parsed.data, session) : await propose(tool.name, parsed.data, session);
          return ok({ content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out, isError: false });
        }
        default:
          return fail(-32601, `method not found: ${msg.method}`);
      }
    } catch (e) {
      if (e instanceof RpcError) return fail(e.code, e.message);
      throw e;
    }
  }

  app.post('/mcp', async (c: any) => {
    const session = ctx.sessions.get(c);
    if (!session) return c.json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'session required' } }, 401);
    let body: any;
    try { body = JSON.parse(await c.req.text()); } catch { return c.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }, 400); }
    if (Array.isArray(body)) {
      const out = (await Promise.all(body.map((m) => handle(m, session)))).filter((x) => x !== null);
      return out.length ? c.json(out) : c.body(null, 202);
    }
    const res = await handle(body, session);
    return res === null ? c.body(null, 202) : c.json(res);
  });

  // The person's side of D-31: list what the AI proposed and confirm or reject it. Confirming a grade edit runs the
  // normal grade route with the confirmer's own session, so the usual role rules still apply.
  app.get('/api/mcp/pending', async (c: any) => {
    const s = c.get('session');
    const all = await store.list(store.priv, 'mcppending:');
    return c.json(all.filter((p: any) => p.status === 'pending' && (p.proposedBy === s.personId || isStaff(s.roles)))
      .map((p: any) => ({ pendingId: ids.keyOf(p.id), tool: p.tool, diff: p.diff, proposedBy: p.proposedBy })));
  });
  async function decide(c: any, status: 'confirmed' | 'rejected') {
    const s = c.get('session');
    const id = `mcppending:${ids.keyOf(c.req.param('id'))}`;
    const p = await store.get(store.priv, id);
    if (!p || p.status !== 'pending') throw ctx.http.fieldError('id', 'unknown-or-decided', 404);
    if (status === 'confirmed' && p.tool === 'grade_edit') {
      if (!p.diff.classId || !p.diff.attemptId || typeof p.diff.after !== 'number') throw ctx.http.fieldError('id', 'incomplete-proposal', 409);
      const r = await app.request(`/api/classes/${p.diff.classId}/attempts/${p.diff.attemptId}/grade`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: c.req.header('cookie') ?? '' },
        body: JSON.stringify({ score: p.diff.after, reason: p.diff.reason ?? 'confirmed AI proposal' }),
      });
      if (!r.ok) throw new ctx.http.ApiError(r.status, await r.json());
    }
    await store.put(store.priv, { ...p, status, decidedBy: s.personId, decidedAt: ctx.clock.now() });
    return c.json({ ok: true, status });
  }
  app.post('/api/mcp/pending/:id/confirm', (c: any) => decide(c, 'confirmed'));
  app.post('/api/mcp/pending/:id/reject', (c: any) => decide(c, 'rejected'));
}
