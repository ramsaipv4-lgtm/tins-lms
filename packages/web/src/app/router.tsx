// Tiny History-API router (no dependency). Paths are real URLs, so every route is deep-linkable.
import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

export function navigate(to: string, replace = false) {
  if (to === location.pathname + location.search) return;
  if (replace) history.replaceState(null, '', to); else history.pushState(null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const Ctx = createContext<string>('/');
export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  return <Ctx.Provider value={path}>{children}</Ctx.Provider>;
}
export const usePath = () => useContext(Ctx);

export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean), b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function Link({ to, onClick, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const path = usePath();
  return (
    <a
      href={to} {...rest}
      aria-current={path === to ? 'page' : undefined}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || rest.target === '_blank') return;
        e.preventDefault(); navigate(to);
      }}
    />
  );
}
