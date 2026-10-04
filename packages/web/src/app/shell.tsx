// App shell: router, session, role spaces with a <nav> each, sign-in, join flow. `app-ready` appears once interactive.
import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType } from 'react';
import { featureRoutes, type FeatureRoute, type Space } from '../features/registry.ts';
import { t } from '../strings/index.ts';
import { Link, RouterProvider, matchPath, navigate, usePath } from './router.tsx';
import { SessionProvider, spacesFor, useSession } from './session.tsx';
import { SignIn } from './signin.tsx';
import { Join } from './join.tsx';
import { SetupCheck } from './setupcheck.tsx';

// Appendix C: home-<space> uses the role name (home-learner).
const HOME_ID: Record<Space, string> = { admin: 'admin', teach: 'trainer', learn: 'learner', coach: 'coach' };
const SPACES: Space[] = ['admin', 'teach', 'learn', 'coach'];
const lazyCache = new Map<FeatureRoute, ComponentType<{ params: Record<string, string> }>>();
function componentOf(r: FeatureRoute) {
  if (!lazyCache.has(r)) lazyCache.set(r, lazy(r.load) as any);
  return lazyCache.get(r)!;
}

function Home({ space }: { space: Space }) {
  const entries = navEntries(space);
  return (
    <section data-testid={`home-${HOME_ID[space]}`} aria-labelledby="home-h">
      <h1 id="home-h">{t('home.title', { space: t(`space.${space}`) })}</h1>
      <p>{entries.length ? t('home.welcome') : t('home.empty')}</p>
    </section>
  );
}

function navEntries(space: Space, roles?: string[]) {
  return featureRoutes
    .filter((r) => r.space === space && r.nav !== false && (!r.roles || !roles || r.roles.some((x) => roles.includes(x))))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || t(a.label).localeCompare(t(b.label)));
}

function spaceOfPath(path: string): Space | null {
  const first = path.split('/')[1];
  return (SPACES as string[]).includes(first) ? (first as Space) : null;
}

function Content() {
  const path = usePath();
  const { me, ready } = useSession();
  const space = spaceOfPath(path);
  const spaces = me ? spacesFor(me.roles) : [];

  useEffect(() => {
    if (!ready) return;
    if (path === '/' && me) navigate(`/${spaces[0] ?? 'learn'}`, true);
  }, [ready, path, me]);
  useEffect(() => {
    if (ready && !me && space) navigate(`/signin?next=${encodeURIComponent(path)}`, true);
  }, [ready, me, space, path]);

  const join = matchPath('/join/:code', path);
  if (join) return <Join code={join.code} />;
  if (path === '/signin' || (path === '/' && ready && !me)) return <SignIn />;
  if (!ready || !me) return <p role="status">{t('app.loading')}</p>;
  if (path === '/setup') return <SetupCheck />;
  if (space) {
    if (!spaces.includes(space)) return <p role="alert">{t('app.notAllowed')}</p>;
    if (path === `/${space}`) return <Home space={space} />;
    for (const r of featureRoutes) {
      const params = r.space === space ? matchPath(r.path, path) : null;
      if (!params) continue;
      if (r.roles && !r.roles.some((x) => me.roles.includes(x))) return <p role="alert">{t('app.notAllowed')}</p>;
      const C = componentOf(r);
      return <Suspense fallback={<p role="status">{t('app.loading')}</p>}><C params={params} /></Suspense>;
    }
  }
  return path === '/' ? null : <p role="alert">{t('app.notFound')}</p>;
}

function Header() {
  const path = usePath();
  const { me, signOut, online } = useSession();
  const space = spaceOfPath(path);
  const spaces = me ? spacesFor(me.roles) : [];
  const entries = useMemo(() => (space && me ? navEntries(space, me.roles) : []), [space, me]);
  return (
    <header className="bar">
      <Link to="/" className="brand">{t('app.name')}</Link>
      {me && space && (
        <nav aria-label={t(`space.${space}`) + ' ' + t('nav.main')} data-space={space} className="spacenav">
          <ul>
            <li><Link to={`/${space}`}>{t('nav.home')}</Link></li>
            {entries.map((r) => <li key={r.path}><Link to={r.path}>{t(r.label)}</Link></li>)}
            {space === 'learn' && <li><Link to="/setup">{t('nav.setup')}</Link></li>}
          </ul>
        </nav>
      )}
      {me && (
        <nav aria-label={t('nav.spaces')} className="spaces">
          <ul>{spaces.map((s) => <li key={s}><Link to={`/${s}`}>{t(`space.${s}`)}</Link></li>)}</ul>
        </nav>
      )}
      <span className="grow" />
      {!online && <span role="status" className="chip">{t('app.offline')}</span>}
      {me ? <button type="button" onClick={() => { signOut(); navigate('/signin'); }}>{t('nav.signOut')}</button>
          : <Link to="/signin">{t('nav.signIn')}</Link>}
    </header>
  );
}

function Frame() {
  const { ready } = useSession();
  const [interactive, setInteractive] = useState(false);
  useEffect(() => { document.title = t('app.name'); setInteractive(true); }, []);
  return (
    <div className="app" {...(ready && interactive ? { 'data-testid': 'app-ready' } : {})}>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{t('app.skip')}</a>
      <Header />
      <main id="main" tabIndex={-1}><Content /></main>
    </div>
  );
}

export function Shell() {
  return <RouterProvider><SessionProvider><Frame /></SessionProvider></RouterProvider>;
}
