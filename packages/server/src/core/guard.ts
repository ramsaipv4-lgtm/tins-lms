// Role guard (D-30). `auth` needs any session; `role(...allowed)` needs one of the listed roles
// (admin always passes). Handlers read the session with c.get('session').
import { ApiError } from './http.ts';

export const ROLES = ['admin', 'trainer', 'substitute', 'learner', 'coordinator'];

export function createGuards() {
  const auth = async (c: any, next: any) => {
    if (!c.get('session')) throw new ApiError(401, { error: { session: 'required' } });
    await next();
  };
  const role = (...allowed: string[]) => async (c: any, next: any) => {
    const s = c.get('session');
    if (!s) throw new ApiError(401, { error: { session: 'required' } });
    if (!(s.roles.includes('admin') || s.roles.some((r: string) => allowed.includes(r)))) {
      throw new ApiError(403, { error: { role: 'forbidden' } });
    }
    await next();
  };
  return { auth, role };
}

// Routes that need no session (SPEC AC-62): health, join, sign-in and pairing claim.
export function isPublicApi(path: string): boolean {
  return path === '/api/health'
    || path === '/api/join' || path.startsWith('/api/join/')
    || path === '/api/sign-in' || path.startsWith('/api/sign-in/')
    || path === '/api/pairing/claim';
}
