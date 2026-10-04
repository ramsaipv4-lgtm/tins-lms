// Sessions: random token in an HTTP-only cookie; the server keeps token -> { personId, roles } in memory
// (restart signs everyone out; device sessions for pairing can add persistence later). Tokens are never
// logged and never stored anywhere readable.
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { randomToken } from './ids.ts';

export const COOKIE = 'lms_session';

export type Session = { personId: string; roles: string[]; deviceId?: string; createdAt: number };

export function createSessions(opts: { secure: boolean; now: () => number }) {
  const table = new Map<string, Session>();

  return {
    create(c: any, data: { personId: string; roles: string[]; deviceId?: string }): Session {
      const token = randomToken();
      const s: Session = { personId: data.personId, roles: [...data.roles], deviceId: data.deviceId, createdAt: opts.now() };
      table.set(token, s);
      setCookie(c, COOKIE, token, { httpOnly: true, sameSite: 'Lax', path: '/', secure: opts.secure });
      return s;
    },
    get(c: any): Session | null {
      const token = getCookie(c, COOKIE);
      return token ? (table.get(token) ?? null) : null;
    },
    destroy(c: any): void {
      const token = getCookie(c, COOKIE);
      if (token) table.delete(token);
      deleteCookie(c, COOKIE, { path: '/' });
    },
    // Drop every session matching `pred` (e.g. a revoked device). Returns how many were removed.
    revokeWhere(pred: (s: Session) => boolean): number {
      let n = 0;
      for (const [t, s] of table) if (pred(s)) { table.delete(t); n++; }
      return n;
    },
  };
}

export type Sessions = ReturnType<typeof createSessions>;
