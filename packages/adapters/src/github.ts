// GitHub App adapter (AC-110, AC-111). Only fetch; base URLs are injected so tests use a fake.
// Secrets: the token is only ever sent in the Authorization header, never logged or returned.

export type GithubConfig = { apiUrl: string; graphqlUrl: string; token: string; org: string };
export type Failure = { ok: false; reason: string; status?: number };

type Reply = { status: number; ok: boolean; body: any };

export function createGithubAdapter(cfg: GithubConfig) {
  const api = cfg.apiUrl.replace(/\/+$/, '');

  async function call(method: string, url: string, body?: unknown, token = cfg.token): Promise<Reply> {
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': 'coach-lms',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { message: text.slice(0, 200) }; }
    return { status: res.status, ok: res.ok, body: parsed };
  }

  const fail = (what: string, r: Reply): Failure => ({
    ok: false,
    reason: `${what} failed: ${r.body?.message ?? 'HTTP ' + r.status}`,
    status: r.status,
  });

  async function must(what: string, r: Reply): Promise<Reply> {
    if (!r.ok) throw new Error(`${what} failed (${r.status}): ${r.body?.message ?? ''}`);
    return r;
  }

  async function graphql(query: string, variables: Record<string, unknown>): Promise<any> {
    const r = await call('POST', cfg.graphqlUrl, { query, variables });
    await must('graphql', r);
    if (r.body?.errors?.length) throw new Error(`graphql failed: ${r.body.errors[0]?.message ?? 'error'}`);
    return r.body?.data;
  }

  const enc = encodeURIComponent;

  return {
    async provisionLearner(a: { username: string; team: string; template: string; repo: string; projectTitle: string }) {
      const [tOwner, tName] = a.template.split('/');
      const user = (await must('lookup user', await call('GET', `${api}/users/${enc(a.username)}`))).body;
      await must('org invitation', await call('POST', `${api}/orgs/${enc(cfg.org)}/invitations`, { invitee_id: user.id }));
      await must('team membership', await call('PUT', `${api}/orgs/${enc(cfg.org)}/teams/${enc(a.team)}/memberships/${enc(a.username)}`, { role: 'member' }));
      await must('repo from template', await call('POST', `${api}/repos/${tOwner}/${tName}/generate`, { owner: cfg.org, name: a.repo, private: true }));
      await must('branch protection', await call('PUT', `${api}/repos/${cfg.org}/${a.repo}/branches/main/protection`, {
        required_status_checks: null,
        enforce_admins: true,
        required_pull_request_reviews: { required_approving_review_count: 1 },
        restrictions: null,
        allow_force_pushes: false,
        allow_deletions: false,
      }));
      let ownerId: string = cfg.org;
      const org = await call('GET', `${api}/orgs/${enc(cfg.org)}`).catch(() => null);
      if (org && org.ok && org.body?.node_id) ownerId = org.body.node_id;
      const created = await graphql(
        'mutation($ownerId:ID!,$title:String!){createProjectV2(input:{ownerId:$ownerId,title:$title}){projectV2{id}}}',
        { ownerId, title: a.projectTitle },
      );
      const projectId = created?.createProjectV2?.projectV2?.id;
      if (!projectId) throw new Error('createProjectV2 returned no project id');
      await graphql(
        'mutation($projectId:ID!,$name:String!,$dataType:ProjectV2CustomFieldType!){createProjectV2Field(input:{projectId:$projectId,name:$name,dataType:$dataType}){projectV2Field{__typename}}}',
        { projectId, name: 'Iteration', dataType: 'ITERATION' },
      );
      return { repo: `${cfg.org}/${a.repo}`, projectId };
    },

    async openPullRequest(a: { repo: string; branch: string; title: string; body?: string }) {
      const base = `${api}/repos/${a.repo}`;
      const ref = await must('read main', await call('GET', `${base}/git/ref/heads/main`));
      const sha = ref.body?.object?.sha;
      const mk = await call('POST', `${base}/git/refs`, { ref: `refs/heads/${a.branch}`, sha });
      if (!mk.ok && mk.status !== 422) throw new Error(`create branch failed (${mk.status}): ${mk.body?.message ?? ''}`);
      const pr = await must('open pull request', await call('POST', `${base}/pulls`, {
        title: a.title, head: a.branch, base: 'main', body: a.body ?? '',
      }));
      return { number: pr.body.number as number };
    },

    async mergePullRequest(a: { repo: string; number: number }): Promise<{ ok: true } | Failure> {
      const r = await call('PUT', `${api}/repos/${a.repo}/pulls/${a.number}/merge`, {});
      return r.ok ? { ok: true } : fail('merge', r);
    },

    async writeFile(a: { repo: string; branch: string; path: string; content: string }): Promise<{ ok: true } | Failure> {
      const url = `${api}/repos/${a.repo}/contents/${a.path.split('/').map(enc).join('/')}`;
      const body: Record<string, unknown> = {
        message: `Update ${a.path}`,
        content: Buffer.from(a.content, 'utf8').toString('base64'),
        branch: a.branch,
      };
      let r = await call('PUT', url, body);
      if (!r.ok && (r.status === 409 || r.status === 422)) {
        const cur = await call('GET', `${url}?ref=${enc(a.branch)}`);
        if (cur.ok && cur.body?.sha) r = await call('PUT', url, { ...body, sha: cur.body.sha });
      }
      return r.ok ? { ok: true } : fail('write file', r);
    },

    async personaToken(a: { installationId: number | string; batchEndsAt: number; now: number }): Promise<{ token: string; expiresAt: number } | Failure> {
      if (a.now >= a.batchEndsAt) return { ok: false, reason: 'batch has ended; no persona token issued' };
      const r = await call('POST', `${api}/app/installations/${a.installationId}/access_tokens`, {});
      if (!r.ok) return fail('persona token', r);
      const given = r.body?.expires_at ? Date.parse(r.body.expires_at) : NaN;
      const expiresAt = Number.isFinite(given) ? Math.min(given, a.batchEndsAt) : a.batchEndsAt;
      return { token: r.body.token as string, expiresAt };
    },
  };
}
