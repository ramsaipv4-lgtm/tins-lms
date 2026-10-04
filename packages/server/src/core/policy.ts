// Central role policy (D-30, AC-62). A table of method + path pattern -> allowed roles, checked before
// routing, so a learner gets 403 on a trainer route even while the module that owns it is still a placeholder.
// Admin always passes. `:x` matches one path segment, a trailing `*` matches the rest. First match wins.
// Route modules may add rows with ctx.policy.add(...) and may still add ctx.guard.role(...) on a handler.
import { ApiError } from './http.ts';

type Rule = { method: string; re: RegExp; roles: string[] };

const T = ['trainer'];
const TS = ['trainer', 'substitute'];

const DEFAULT_RULES: Array<[string, string, string[]]> = [
  ['*', '/api/admin/*', []],                                  // admin only
  ['GET', '/api/export', []], ['POST', '/api/import', []],
  ['POST', '/api/classes/:id/join-codes', T],
  ['POST', '/api/pairing', T],
  ['GET', '/api/devices', T], ['DELETE', '/api/devices/:id', T],
  ['GET', '/api/classes/:id/attendance-code', TS],
  ['GET', '/api/classes/:id/printed-code', TS],
  ['POST', '/api/classes/:id/teleprompter', TS],
  ['GET', '/api/classes/:id/package', TS],
  ['GET', '/api/classes/:id/appeals', TS],
  ['GET', '/api/classes/:id/integrity', TS],
  // grade sign-off and syllabus edits: trainer only, a substitute gets 403
  ['POST', '/api/classes/:id/attempts/:aid/grade', T],
  ['POST', '/api/packages', T], ['POST', '/api/packages/:id/publish', T],
  ['PUT', '/api/classes/:id/days/*', T], ['POST', '/api/classes/:id/days/*', T], ['PATCH', '/api/classes/:id/days/*', T],
  ['*', '/api/classes/:id/syllabus*', T], ['*', '/api/syllabus*', T],
  ['POST', '/api/programs*', T], ['PUT', '/api/programs*', T], ['PATCH', '/api/programs*', T], ['DELETE', '/api/programs*', T],
];

function compile(pattern: string): RegExp {
  const body = pattern.split('/').map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'))).join('/');
  return new RegExp(`^${body}/?$`);
}

export function createPolicy() {
  const rules: Rule[] = DEFAULT_RULES.map(([method, p, roles]) => ({ method, re: compile(p), roles }));
  return {
    add(method: string, pattern: string, roles: string[]): void { rules.unshift({ method, re: compile(pattern), roles }); },
    // Throws 403 when the session's roles are not allowed for this request.
    check(method: string, path: string, roles: string[]): void {
      const rule = rules.find((r) => (r.method === '*' || r.method === method) && r.re.test(path));
      if (!rule) return;
      if (roles.includes('admin') || roles.some((r) => rule.roles.includes(r))) return;
      throw new ApiError(403, { error: { role: 'forbidden' } });
    },
  };
}
