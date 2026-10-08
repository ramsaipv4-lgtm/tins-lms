// Starts a throw-away hub in TEST MODE for the demos (never use test mode on a live server).
// Own temp data dir, port chosen by the OS, fixtures read from demos/seed (not from the tests repo).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const here = dirname(fileURLToPath(import.meta.url));
export const DEMOS = resolve(here, '..');
export const REPO = resolve(DEMOS, '..');
export const SEED_ROOT = join(DEMOS, 'seed');
export const SERVER_ENTRY = join(REPO, 'packages', 'server', 'src', 'main.ts');

function freePort() {
  return new Promise((res, rej) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
}

/** Start a hub. Returns { url, port, dataDir, request(), login(), stop(), restart() }. */
export async function startHub({ log = () => {} } = {}) {
  if (!existsSync(SERVER_ENTRY)) throw new Error(`server entry not found: ${SERVER_ENTRY}`);
  if (!existsSync(join(REPO, 'packages', 'web', 'dist', 'index.html'))) throw new Error('web app is not built: run `npm run build -w packages/web` first');
  const dataDir = mkdtempSync(join(tmpdir(), 'lms-demo-'));
  let port = await freePort();
  let child = null; let out = '';
  const env = () => {
    const e = { ...process.env, PORT: String(port), LMS_PROFILE: 'hub', LMS_DATA_DIR: dataDir, LMS_TLS: 'off', LMS_TEST_MODE: '1', LMS_ACCEPTANCE_DIR: SEED_ROOT };
    delete e.NODE_TEST_CONTEXT;
    return e;
  };
  async function spawnIt() {
    out = '';
    child = spawn(process.execPath, [SERVER_ENTRY], { cwd: REPO, env: env(), stdio: ['ignore', 'pipe', 'pipe'] });
    const add = (d) => { out += d; if (out.length > 1 << 20) out = out.slice(-(1 << 19)); };
    child.stdout.on('data', add); child.stderr.on('data', add);
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error(`hub did not print LISTENING ${port} in 40 s\n${out}`)), 40_000);
      child.stdout.on('data', () => { if (out.includes(`LISTENING ${port}`)) { clearTimeout(t); res(); } });
      child.on('exit', (c) => { clearTimeout(t); rej(new Error(`hub exited (${c})\n${out}`)); });
    });
  }
  await spawnIt();
  log(`hub listening on ${port}, data in ${dataDir}`);
  const hub = {
    dataDir,
    get port() { return port; },
    get url() { return `http://127.0.0.1:${port}`; },
    stdout: () => out,
    /** Fetch as one person (cookie jar per person). */
    jars: new Map(),
    async request(path, { method = 'GET', body, as, headers = {} } = {}) {
      const h = { ...headers };
      if (as && hub.jars.get(as)) h.cookie = hub.jars.get(as);
      let payload = body;
      if (body !== undefined && typeof body !== 'string' && !(body instanceof Uint8Array)) { payload = JSON.stringify(body); h['content-type'] = 'application/json'; }
      const r = await fetch(hub.url + path, { method, body: payload, headers: h, redirect: 'manual' });
      const set = r.headers.get('set-cookie'); if (set && as) hub.jars.set(as, set.split(';')[0]);
      const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
      return { status: r.status, json, text };
    },
    /** Sign in as a person through the test login (cookie kept for later API calls as that person). */
    async login(personId, roles) {
      const r = await hub.request('/__test/login', { method: 'POST', body: { personId, roles }, as: personId });
      if (r.status >= 300) throw new Error(`test login ${personId}: ${r.status} ${r.text}`);
    },
    async seed(...names) {
      for (const n of names) {
        const r = await hub.request('/__test/seed', { method: 'POST', body: { fixture: `journeys/${n}.json` } });
        if (r.status >= 300) throw new Error(`seed ${n}: ${r.status} ${r.text.slice(0, 300)}`);
      }
    },
    async clock(ms) {
      const r = await hub.request('/__test/clock', { method: 'POST', body: { now: ms } });
      if (r.status >= 300) throw new Error(`clock: ${r.status} ${r.text}`);
    },
    /** API call as a person; throws on error unless allowFail. */
    async api(as, path, method = 'GET', body, { allowFail = false } = {}) {
      if (!hub.jars.get(as[0])) await hub.login(as[0], as[1]);
      const r = await hub.request(path, { method, body, as: as[0] });
      if (r.status >= 300 && !allowFail) throw new Error(`${method} ${path} as ${as[0]} -> ${r.status} ${r.text.slice(0, 300)}`);
      return r;
    },
    async stop() {
      if (!child) return;
      const c = child; child = null;
      c.kill('SIGTERM');
      await new Promise((r) => { c.once('exit', r); setTimeout(r, 4000); });
    },
    /** Same port, same data: the learner's phone reconnects to it. */
    async restart() { await spawnIt(); },
    async dispose() { await hub.stop(); try { rmSync(dataDir, { recursive: true, force: true }); } catch {} },
  };
  return hub;
}
