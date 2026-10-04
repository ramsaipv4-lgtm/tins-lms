// Session state: GET /api/me with the cookie. The last answer is cached so the installed app opens offline.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from './api.ts';
import type { Role, Space } from '../features/registry.ts';

export interface Me {
  personId: string; roles: Role[]; minor: boolean; coachTrackers: boolean;
  tnc: { version: string; acceptedAt: number | null; needsAcceptance: boolean };
}
interface SessionValue { me: Me | null; ready: boolean; online: boolean; refresh: () => Promise<Me | null>; signOut: () => void }

const KEY = 'lms.me';
const Ctx = createContext<SessionValue>({ me: null, ready: false, online: true, refresh: async () => null, signOut: () => {} });
export const useSession = () => useContext(Ctx);

// Which role spaces a person may open (D-30). Coach is the learner's personal space.
export function spacesFor(roles: Role[]): Space[] {
  const s: Space[] = [];
  if (roles.includes('admin')) s.push('admin');
  if (roles.some((r) => r === 'trainer' || r === 'substitute' || r === 'coordinator')) s.push('teach');
  if (roles.includes('learner')) s.push('learn', 'coach');
  return s;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const m = await api<Me>('/api/me');
      setMe(m); setOnline(true);
      try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* private window */ }
      return m;
    } catch (e) {
      if (e instanceof ApiError) { // 401: signed out
        setMe(null); setOnline(true);
        try { localStorage.removeItem(KEY); } catch { /* ignore */ }
        return null;
      }
      setOnline(false); // network failure: fall back to the cached person
      try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); setMe(c); return c; } catch { return null; }
    } finally { setReady(true); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const signOut = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    void api('/api/signout', { method: 'POST' }).catch(() => {});
    setMe(null);
  }, []);
  return <Ctx.Provider value={{ me, ready, online, refresh, signOut }}>{children}</Ctx.Provider>;
}
