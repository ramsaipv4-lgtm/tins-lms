// App shell: router, session, role spaces with a <nav> each, sign-in, join flow. `app-ready` appears once interactive.
import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType } from 'react';
import { featureRoutes, type FeatureRoute, type Space } from '../features/registry.ts';
import { t } from '../strings/index.ts';
import { Link, RouterProvider, matchPath, navigate, usePath } from './router.tsx';
import { SessionProvider, spacesFor, useSession } from './session.tsx';
import { SignIn } from './signin.tsx';
import { Join } from './join.tsx';
import { SetupCheck } from './setupcheck.tsx';
import { useKiosk } from './kiosk.ts';
import { switchOn, useSwitches, type Switches } from './switches.ts';
import { homeRoute, navEntries } from './nav.ts';
import type { Me } from './session.tsx';

// Appendix C: home-<space> uses the role name (home-learner).
const HOME_ID: Record<Space, string> = { admin: 'admin', teach: 'trainer', learn: 'learner', coach: 'coach' };
const SPACES: Space[] = ['admin', 'teach', 'learn', 'coach'];
const lazyCache = new Map<FeatureRoute, ComponentType<{ params: Record<string, string> }>>();
function componentOf(r: FeatureRoute) {
  if (!lazyCache.has(r)) lazyCache.set(r, lazy(r.load) as any);
  return lazyCache.get(r)!;
}

function Home({ space, me }: { space: Space; me: Me }) {
  const entries = navFor(space, me.roles);
  const hr = homeRoute(featureRoutes, space, me.roles, t);
  if (hr) {
    const C = componentOf(hr);
    return <div data-testid={`home-${HOME_ID[space]}`}><Suspense fallback={<p role="status">{t('app.loading')}</p>}><C params={{}} /></Suspense></div>;
  }
  return (
    <section data-testid={`home-${HOME_ID[space]}`} aria-labelledby="home-h">
      <h1 id="home-h">{t('home.title', { space: t(`space.${space}`) })}</h1>
      <p>{entries.length ? t('home.welcome') : t('home.empty')}</p>
    </section>
  );
}

const navFor = (space: Space, roles?: string[], sw?: Switches | null) => navEntries(featureRoutes, space, roles, sw ?? null, t);

function spaceOfPath(path: string): Space | null {
  const first = path.split('/')[1];
  return (SPACES as string[]).includes(first) ? (first as Space) : null;
}

// Spaces a person may open right now: kiosk mode (a shared device) takes the personal Coach space away.
function useSpaces(me: Me | null, kiosk: boolean): Space[] {
  return me ? spacesFor(me.roles).filter((s) => !(kiosk && s === 'coach')) : [];
}

function Content() {
  const path = usePath();
  const { me, ready } = useSession();
  const kiosk = useKiosk();
  const space = spaceOfPath(path);
  const spaces = useSpaces(me, kiosk);

  useEffect(() => {
    if (!ready) return;
    if (path === '/' && me) navigate(`/${spaces[0] ?? 'learn'}`, true);
    if (me && kiosk && space === 'coach') navigate('/learn', true);
  }, [ready, path, me, kiosk, space]);
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
    if (path === `/${space}`) return <Home space={space} me={me} />;
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
  const kiosk = useKiosk();
  const spaces = useSpaces(me, kiosk);
  const candidates = useMemo(() => (space && me ? navFor(space, me.roles) : []), [space, me]);
  const sw = useSwitches(candidates.some((r) => r.switch), path);
  const entries = useMemo(() => candidates.filter((r) => switchOn(sw, r.switch)), [candidates, sw]);
  return (
    <header className="bar">
      <Link to="/" className="brand">{t('app.name')}</Link>
      {me && space && spaces.includes(space) && (
        <nav aria-label={t(`space.${space}`) + ' ' + t('nav.main')} data-space={space} className="spacenav">
          <ul>
            <li><Link to={`/${space}`}>{t('nav.home')}</Link></li>
            {entries.map((r) => <li key={r.path}><Link to={r.link ?? r.path}>{t(r.label)}</Link></li>)}
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
  const { ready, me } = useSession();
  const [interactive, setInteractive] = useState(false);
  useEffect(() => { document.title = t('app.name'); setInteractive(true); }, []);
  // Staff phones fetch the board's code in the background (service worker, src/sw.ts) so the board opens fast; a learner's never does.
  const staff = !!me && me.roles.some((r) => r === 'admin' || r === 'trainer' || r === 'substitute');
  useEffect(() => {
    if (!staff || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'warm-board' })).catch(() => {});
  }, [staff]);
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
