// Forgejo adapter (AC-112) and push-check hook (AC-115). Only fetch; base URL injected.
import { scanText } from '../../../.tins/kit/src/secrets.mjs';

export type ForgejoConfig = { apiUrl: string; token: string; org: string };
export type Failure = { ok: false; reason: string; status?: number };
type Reply = { status: number; ok: boolean; body: any };

function randomPassword(): string {
  const b = new Uint8Array(24);
  globalThis.crypto.getRandomValues(b);
  return Buffer.from(b).toString('base64url');
}

export function createForgejoAdapter(cfg: ForgejoConfig) {
  const api = cfg.apiUrl.replace(/\/+$/, '') + '/api/v1';
  const enc = encodeURIComponent;

  async function call(method: string, path: string, body?: unknown): Promise<Reply> {
    const res = await fetch(api + path, {
      method,
      headers: { authorization: `token ${cfg.token}`, accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { message: text.slice(0, 200) }; }
    return { status: res.status, ok: res.ok, body: parsed };
  }
  const fail = (what: string, r: Reply): Failure => ({
    ok: false, reason: `${what} failed: ${r.body?.message ?? 'HTTP ' + r.status}`, status: r.status,
  });
  const must = (what: string, r: Reply): Reply => {
    if (!r.ok) throw new Error(`${what} failed (${r.status}): ${r.body?.message ?? ''}`);
    return r;
  };

  async function teamId(team: string): Promise<string> {
    if (/^\d+$/.test(team)) return team;
    const r = await call('GET', `/orgs/${enc(cfg.org)}/teams/search?q=${enc(team)}`).catch(() => null);
    const hit = r && r.ok ? (r.body?.data ?? []).find((t: any) => t.name === team) ?? r.body?.data?.[0] : null;
    return hit?.id !== undefined ? String(hit.id) : team;
  }

  return {
    async provisionLearner(a: { username: string; email: string; team: string; template: string; repo: string }) {
      const [tOwner, tName] = a.template.split('/');
      const existing = await call('GET', `/users/${enc(a.username)}`);
      let createdLogin = false;
      if (existing.status === 404) {
        must('create login', await call('POST', '/admin/users', {
          username: a.username, email: a.email, password: randomPassword(),
          must_change_password: true, send_notify: false,
        }));
        createdLogin = true;
      } else must('lookup user', existing);
      must('team member', await call('PUT', `/teams/${enc(await teamId(a.team))}/members/${enc(a.username)}`));
      must('repo from template', await call('POST', `/repos/${tOwner}/${tName}/generate`, {
        owner: cfg.org, name: a.repo, git_content: true, private: true,
      }));
      must('branch protection', await call('POST', `/repos/${cfg.org}/${a.repo}/branch_protections`, {
        branch_name: 'main', rule_name: 'main', enable_push: false, enable_force_push: false,
        required_approvals: 1, enable_merge_whitelist: false,
      }));
      return { repo: `${cfg.org}/${a.repo}`, createdLogin };
    },

    async openPullRequest(a: { repo: string; branch: string; title: string; body?: string }) {
      const base = `/repos/${a.repo}`;
      const mk = await call('POST', `${base}/branches`, { new_branch_name: a.branch, old_branch_name: 'main' });
      if (!mk.ok && mk.status !== 409 && mk.status !== 422) must('create branch', mk);
      const pr = must('open pull request', await call('POST', `${base}/pulls`, {
        title: a.title, head: a.branch, base: 'main', body: a.body ?? '',
      }));
      return { number: pr.body.number as number };
    },

    async mergePullRequest(a: { repo: string; number: number }): Promise<{ ok: true } | Failure> {
      const r = await call('POST', `/repos/${a.repo}/pulls/${a.number}/merge`, { Do: 'merge' });
      return r.ok ? { ok: true } : fail('merge', r);
    },

    async writeFile(a: { repo: string; branch: string; path: string; content: string }): Promise<{ ok: true } | Failure> {
      const p = `/repos/${a.repo}/contents/${a.path.split('/').map(enc).join('/')}`;
      const body: Record<string, unknown> = {
        message: `Update ${a.path}`, content: Buffer.from(a.content, 'utf8').toString('base64'), branch: a.branch,
      };
      const cur = await call('GET', `${p}?ref=${enc(a.branch)}`);
      const r = cur.ok && cur.body?.sha
        ? await call('PUT', p, { ...body, sha: cur.body.sha })
        : await call('POST', p, body);
      return r.ok ? { ok: true } : fail('write file', r);
    },

    async personaToken(a: { username: string; batchEndsAt: number; now: number }): Promise<{ token: string; expiresAt: number } | Failure> {
      if (a.now >= a.batchEndsAt) return { ok: false, reason: 'batch has ended; no persona token issued' };
      const r = await call('POST', `/users/${enc(a.username)}/tokens`, {
        name: `persona-${a.now}`, scopes: ['write:repository', 'write:issue'],
      });
      if (!r.ok) return fail('persona token', r);
      const token = r.body?.sha1 ?? r.body?.token;
      if (!token) return { ok: false, reason: 'persona token failed: no token in reply' };
      // Forgejo tokens carry no expiry of their own; the batch end is the recorded expiry.
      return { token: String(token), expiresAt: a.batchEndsAt };
    },

    async installPushCheck(a: { repo: string; hookUrl: string }): Promise<{ ok: true } | Failure> {
      const r = await call('POST', `/repos/${a.repo}/hooks`, {
        type: 'forgejo', active: true, events: ['push'],
        config: { url: a.hookUrl, content_type: 'json' },
      });
      return r.ok ? { ok: true } : fail('install push check', r);
    },
  };
}

export type PushCheckLog = (entry: { switch: 'secretScan'; on: boolean; by: string; at: number }) => void;

export function createPushCheck(opts: { log: PushCheckLog }) {
  let secretScan = true;

  const handler = (req: any, res: any): void => {
    const send = (code: number, obj: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    if (req.method !== 'POST') return send(405, { allowed: false, message: 'POST only' });
    let raw = '';
    req.on('data', (c: any) => { raw += c; });
    req.on('end', () => {
      let payload: any;
      try { payload = JSON.parse(raw); } catch { return send(400, { allowed: false, message: 'bad request body' }); }
      if (!secretScan) return send(200, { allowed: true });
      const files: Array<{ path: string; content: string }> = Array.isArray(payload?.files) ? payload.files : [];
      const hits: string[] = [];
      for (const f of files) {
        for (const h of scanText(String(f.path), String(f.content ?? ''))) hits.push(`${h.path}:${h.line} (${h.class})`);
      }
      if (hits.length === 0) return send(200, { allowed: true });
      // Report class and location only; the matched value is never repeated.
      send(200, {
        allowed: false,
        message: `Push blocked: a possible secret was found at ${hits.join(', ')}. Rotate this key now (treat it as leaked), remove it from the files, then push again.`,
      });
    });
  };

  return {
    handler,
    setSecretScan(on: boolean, by: string): void {
      secretScan = on;
      if (!on) opts.log({ switch: 'secretScan', on: false, by, at: Date.now() });
    },
  };
}
