// The "stage": a Playwright page that records a walkthrough with a visible cursor, a caption bar,
// readable pauses and typing with a per-character delay. Everything the viewer sees is a real screen
// of the app; the overlay (cursor + caption) is injected DOM, so it is part of the raw recording.
import { mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const PROFILES = {
  desktop: { viewport: { width: 1280, height: 720 }, video: { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, caption: 22 },
  phone: { viewport: { width: 360, height: 740 }, video: { width: 720, height: 1480 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, caption: 17 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

/** Runs in every page of the context before the app's own scripts. */
function overlayScript({ captionPx, mobile }) {
  const SS = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };
  const build = () => {
    if (document.getElementById('__demo_cursor')) return;
    const root = document.documentElement;
    // cursor dot
    const dot = document.createElement('div');
    dot.id = '__demo_cursor';
    const s = dot.style;
    s.position = 'fixed'; s.left = '0px'; s.top = '0px'; s.width = '26px'; s.height = '26px'; s.marginLeft = '-13px'; s.marginTop = '-13px';
    s.borderRadius = '50%'; s.background = 'rgba(255,196,0,0.85)'; s.border = '3px solid #111'; s.boxShadow = '0 0 0 2px #fff, 0 2px 8px rgba(0,0,0,.5)';
    s.zIndex = '2147483646'; s.pointerEvents = 'none'; s.transition = mobile ? 'transform 450ms cubic-bezier(.4,0,.2,1)' : 'none';
    const pos = (SS.get('__cur') || '640,360').split(',').map(Number);
    s.transform = `translate(${pos[0]}px, ${pos[1]}px)`;
    s.display = SS.get('__curShown') === '1' ? 'block' : 'none';
    root.appendChild(dot);
    // caption bar
    const bar = document.createElement('div');
    bar.id = '__demo_caption';
    const b = bar.style;
    b.position = 'fixed'; b.left = '0'; b.right = '0'; b.bottom = '0'; b.zIndex = '2147483647'; b.pointerEvents = 'none';
    b.background = 'rgba(8,12,24,0.94)'; b.color = '#fff'; b.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    b.fontWeight = '600'; b.fontSize = captionPx + 'px'; b.lineHeight = '1.3'; b.padding = mobile ? '12px 14px' : '14px 32px'; b.textAlign = 'center';
    b.borderTop = '3px solid #ffc400'; b.boxSizing = 'border-box'; b.display = 'none';
    root.appendChild(bar);
    const text = SS.get('__cap');
    if (text) { bar.textContent = text; b.display = 'block'; applyPad(); }
    if (SS.get('__capPos') === 'top') place('top');
  };
  function place(where) {
    const bar = document.getElementById('__demo_caption'); if (!bar) return;
    if (where === 'top') { bar.style.top = '0'; bar.style.bottom = 'auto'; bar.style.borderTop = 'none'; bar.style.borderBottom = '3px solid #ffc400'; }
    else { bar.style.bottom = '0'; bar.style.top = 'auto'; bar.style.borderBottom = 'none'; bar.style.borderTop = '3px solid #ffc400'; }
    SS.set('__capPos', where);
    applyPad();
  }
  function applyPad() {
    const bar = document.getElementById('__demo_caption'); if (!bar) return;
    const h = bar.style.display === 'none' ? 0 : bar.offsetHeight;
    const top = bar.style.top === '0px';
    document.documentElement.style.paddingBottom = top ? '0px' : h + 'px';
  }
  window.__demo = {
    caption(text) {
      build();
      const bar = document.getElementById('__demo_caption');
      SS.set('__cap', text || '');
      if (!text) { bar.style.display = 'none'; applyPad(); return; }
      bar.textContent = text; bar.style.display = 'block'; applyPad();
    },
    barRect() { const bar = document.getElementById('__demo_caption'); if (!bar || bar.style.display === 'none') return null; const r = bar.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; },
    place,
    cursor(x, y) {
      build();
      const dot = document.getElementById('__demo_cursor');
      dot.style.display = 'block'; SS.set('__curShown', '1');
      dot.style.transform = `translate(${x}px, ${y}px)`; SS.set('__cur', `${x},${y}`);
    },
  };
  const ripple = (x, y) => {
    build();
    const r = document.createElement('div');
    const s = r.style;
    s.position = 'fixed'; s.left = x + 'px'; s.top = y + 'px'; s.width = '20px'; s.height = '20px'; s.marginLeft = '-10px'; s.marginTop = '-10px';
    s.borderRadius = '50%'; s.border = '4px solid #ff3d00'; s.zIndex = '2147483645'; s.pointerEvents = 'none';
    document.documentElement.appendChild(r);
    const a = r.animate([{ transform: 'scale(0.6)', opacity: 1 }, { transform: 'scale(3.4)', opacity: 0 }], { duration: 650, easing: 'ease-out' });
    a.onfinish = () => r.remove();
    const dot = document.getElementById('__demo_cursor');
    if (dot) dot.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.6)' }, { filter: 'brightness(1)' }], { duration: 300 });
  };
  const track = (e) => {
    build();
    if (e.pointerType === 'touch') return; // touch: the stage moves the dot itself
    const dot = document.getElementById('__demo_cursor');
    dot.style.display = 'block'; SS.set('__curShown', '1');
    dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; SS.set('__cur', `${e.clientX},${e.clientY}`);
  };
  window.addEventListener('mousemove', (e) => track({ clientX: e.clientX, clientY: e.clientY, pointerType: 'mouse' }), true);
  window.addEventListener('pointerdown', (e) => { ripple(e.clientX, e.clientY); }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
  window.addEventListener('load', build);
}

/** Multiplier on every pause and typing delay. `fast` is a developer mode for trying a scene out (no video is produced). */
export function pacing(pace) { return pace === 'slow' ? 1.2 : pace === 'fast' ? 0.1 : 0.35; }
/** Caption reading time scales less than the other pauses: a caption must stay readable at the normal pace. */
const captionPace = (pace) => (pace === 'slow' ? 2 : pace === 'fast' ? 0.1 : 1);

/**
 * createStage({ browser, name, profile, pace, outDir, hub, headed })
 * Returns the stage; call stage.finish() to close the context and get the raw .webm.
 */
export async function createStage({ browser, name, profile = 'desktop', pace = 'normal', outDir, hub, log = () => {} }) {
  const prof = PROFILES[profile];
  const k = pacing(pace);
  const rawDir = join(outDir, '.raw', name);
  mkdirSync(rawDir, { recursive: true });
  const context = await browser.newContext({
    viewport: prof.viewport, deviceScaleFactor: prof.deviceScaleFactor, isMobile: prof.isMobile, hasTouch: prof.hasTouch,
    locale: 'en-IN', timezoneId: 'Asia/Kolkata', acceptDownloads: true,
    recordVideo: { dir: rawDir, size: prof.video },
  });
  await context.addInitScript(overlayScript, { captionPx: prof.caption, mobile: prof.isMobile });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(30_000);
  const t0 = Date.now();
  const scenes = []; const skipped = []; const failures = [];
  let current = null;
  let captionText = '';

  const stage = {
    page, context, hub, profile, prof, k, scenes, skipped, failures,
    now: () => (Date.now() - t0) / 1000,
    sleep,
    /** Pause so a viewer can read; doubled with --pace slow. */
    async pause(ms = 1200) { await sleep(ms * k); },
    /** Set the caption bar; holds long enough to read it (unless hold === 0). */
    async say(text, { hold } = {}) {
      captionText = text;
      await page.evaluate((x) => window.__demo?.caption(x), text).catch(() => {});
      const ms = hold ?? Math.min(2800, Math.max(1400, 800 + text.length * 21));
      if (ms) await sleep(hold === undefined ? ms * captionPace(pace) : ms * k);
    },
    async clearCaption() { captionText = ''; await page.evaluate(() => window.__demo?.caption('')).catch(() => {}); },

    /** A named scene: sets its caption, records the time it starts, and records a failure without hiding it. */
    async scene(title, caption, fn) {
      current = { title, caption, start: stage.now() };
      scenes.push(current);
      log(`  scene: ${title}`);
      if (caption) await stage.say(caption);
      try { await fn(); } catch (e) {
        current.failed = String(e.message).split('\n')[0].slice(0, 300);
        failures.push(`${title}: ${current.failed}`);
        log(`  scene FAILED: ${title}: ${current.failed}`);
        await page.screenshot({ path: join(outDir, '.raw', `${name}-fail-${scenes.length}.png`) }).catch(() => {});
      }
      current.end = stage.now();
    },
    /** A scene the UI does not support: listed in index.md as skipped, with the reason. Nothing is faked. */
    skip(title, reason) { skipped.push({ title, reason }); log(`  scene skipped: ${title} (${reason})`); },

    // ----- navigation and people -----
    async open(path = '/') {
      await page.goto(hub.url + path, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('app-ready').waitFor({ state: 'visible', timeout: 30_000 });
      if (captionText) await page.evaluate((x) => window.__demo?.caption(x), captionText).catch(() => {});
      await stage.settle();
    },
    async settle(ms = 350) { await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {}); await sleep(ms); },
    /** Sign in through the test-mode shortcut (the app's own passkey sign-in cannot run unattended), then open a page. */
    async signInAs([personId, roles], path = '/') {
      const r = await context.request.post(`${hub.url}/__test/login`, { data: { personId, roles } });
      if (!r.ok()) throw new Error(`test login ${personId}: ${r.status()}`);
      await stage.open(path);
    },
    /** Phone: scroll so the page's heading is at the top of the screen (the menu above it is long). */
    async focusHeading() {
      if (!prof.isMobile) return;
      await page.evaluate(() => { const h = document.querySelector('main h1, h1'); if (h) window.scrollTo({ top: Math.max(0, h.getBoundingClientRect().top + window.scrollY - 10), behavior: 'smooth' }); });
      await sleep(700);
    },
    /** Tap a navigation link by name, wait for the screen and (on a phone) bring its content into view. */
    async go(name) {
      await page.evaluate(() => window.scrollTo(0, 0)); await sleep(250);
      await stage.click(stage.link(name));
      await stage.settle(600);
      await stage.focusHeading();
    },
    /** A CDP virtual authenticator, so passkey sign-up works unattended (the app itself is unchanged). */
    async enablePasskeys() {
      const cdp = await context.newCDPSession(page);
      await cdp.send('WebAuthn.enable', { enableUI: false });
      await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    },
    async signOutCookies() { await context.clearCookies(); },

    // ----- the cursor -----
    async _clearOfCaption(loc) {
      const box = await loc.boundingBox();
      if (!box) return box;
      const vp = prof.viewport;
      const bar = await page.evaluate(() => window.__demo?.barRect() || null).catch(() => null);
      if (bar && box.y + box.height > bar.y - 6 && box.y < bar.y + bar.h + 6) {
        // the element is under the caption: scroll it to the middle first, then flip the bar to the other edge if still in the way
        await loc.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'nearest' })).catch(() => {});
        await sleep(200);
        let b2 = await loc.boundingBox();
        const bar2 = await page.evaluate(() => window.__demo?.barRect() || null);
        if (bar2 && b2 && b2.y + b2.height > bar2.y - 6 && b2.y < bar2.y + bar2.h + 6) {
          const where = bar2.y > vp.height / 2 ? 'top' : 'bottom';
          await page.evaluate((w) => window.__demo.place(w), where);
          await sleep(150); b2 = await loc.boundingBox();
        }
        return b2;
      }
      return box;
    },
    /** Move the visible cursor (and the mouse, on desktop) to a point with an eased glide. */
    async glideTo(tx, ty) {
      if (prof.isMobile) {
        await page.evaluate(([x, y]) => window.__demo.cursor(x, y), [tx, ty]);
        await sleep(520);
        return;
      }
      const from = await page.evaluate(() => { try { return (sessionStorage.getItem('__cur') || '640,360').split(',').map(Number); } catch { return [640, 360]; } });
      const dist = Math.hypot(tx - from[0], ty - from[1]);
      const steps = Math.max(8, Math.min(40, Math.round(dist / 22)));
      for (let i = 1; i <= steps; i++) {
        const e = ease(i / steps);
        await page.mouse.move(from[0] + (tx - from[0]) * e, from[1] + (ty - from[1]) * e);
        await sleep(14 * Math.min(k, 1.5));
      }
    },
    /** Press at one point and drag to another (drawing on a canvas). Desktop only. */
    async drag(x1, y1, x2, y2) {
      await stage.glideTo(x1, y1);
      await page.mouse.down();
      const steps = 14;
      for (let i = 1; i <= steps; i++) { await page.mouse.move(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps); await sleep(22); }
      await page.mouse.up();
      await sleep(300 * k);
    },
    /** Scroll the target into view, glide the cursor onto it and return the aim point. */
    async moveTo(target) {
      const loc = target.first();
      await loc.waitFor({ state: 'visible' });
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      let box = await stage._clearOfCaption(loc);
      if (!box) box = await loc.boundingBox();
      const tx = Math.round(box.x + Math.min(box.width / 2, 90));
      const ty = Math.round(box.y + Math.min(box.height / 2, 26));
      await stage.glideTo(tx, ty);
      await sleep(180 * k);
      return { loc, box, x: tx, y: ty };
    },
    async click(target, { after = 500 } = {}) {
      const { loc, box, x, y } = await stage.moveTo(target);
      const position = { x: x - box.x, y: y - box.y };
      if (prof.isMobile) await loc.tap({ position }); else await loc.click({ position });
      await sleep(after * k);
    },
    /** Click into a field and type with a per-character delay. */
    async type(target, text, { delay = 55, clear = true } = {}) {
      const { loc, box, x, y } = await stage.moveTo(target);
      const position = { x: x - box.x, y: y - box.y };
      if (prof.isMobile) await loc.tap({ position }); else await loc.click({ position });
      if (clear) await loc.fill('').catch(() => {});
      await page.keyboard.type(text, { delay: Math.round(delay * Math.max(0.55, Math.min(k, 1.6))) });
      await sleep(350 * k);
    },
    /** Fill a field without moving the cursor to it (for the 4th, 5th ... answer of a long form, so the video does not drag). */
    async fill(target, text) {
      const loc = target.first();
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await loc.fill(text);
      await sleep(100 * k);
    },
    async check(target) {
      const loc = target.first();
      if (await loc.isChecked().catch(() => false)) return;
      await stage.click(loc);
    },
    async select(target, option) {
      const { loc } = await stage.moveTo(target);
      await loc.selectOption(option);
      await sleep(400 * k);
    },
    async press(key, ms = 300) { await page.keyboard.press(key); await sleep(ms * k); },
    /** Click a navigation link by its visible name. */
    link(name) { return page.getByRole('link', { name, exact: typeof name === 'string' }); },
    button(name) { return page.getByRole('button', { name, exact: typeof name === 'string' }); },
    tid(id) { return page.getByTestId(id); },
    async scroll(px, ms = 700) {
      await page.evaluate(([y, d]) => new Promise((res) => { const s = window.scrollY; const t0 = performance.now(); const f = (t) => { const p = Math.min(1, (t - t0) / d); window.scrollTo(0, s + y * p); p < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); }), [px, ms]);
      await sleep(250 * k);
    },
    async toTop() { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200); },
    /** Wait until text appears in the body (e.g. a live update). */
    async waitForText(re, timeout = 20_000) { await page.getByText(re).first().waitFor({ state: 'visible', timeout }); },

    /** Closes the context (finishing the video) and moves the raw recording to out/<name>.webm. */
    async finish() {
      const video = page.video();
      await context.close();
      const src = await video.path();
      const dst = join(outDir, `${name}.webm`);
      if (existsSync(dst)) { try { (await import('node:fs')).rmSync(dst); } catch {} }
      renameSync(src, dst);
      return { webm: dst, seconds: stage.now() };
    },
  };
  return stage;
}
