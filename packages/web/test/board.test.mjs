// b8-1 tests: AC-97 board pages, Mermaid drop and PDF with notebook ruling; AC-101 board code loads only on demand.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, mkdtempSync, rmSync, existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPdf, rulingYs, fitInside, pdfText, A4 } from '../../board/src/pdf.ts';
import { addPage, makePage, sortPages, withElements, isMermaidFile, mermaidSource } from '../../board/src/model.ts';

const ROOT = join(new URL('..', import.meta.url).pathname, '..', '..');
const text = (u) => Buffer.from(u).toString('latin1');

test('AC-97 ruling: at least 15 evenly spaced horizontal lines', () => {
  const ys = rulingYs();
  assert.ok(ys.length >= 15, `${ys.length} lines`);
  const gaps = new Set(ys.slice(1).map((y, i) => Math.round((ys[i] - y) * 100)));
  assert.equal(gaps.size, 1, 'even spacing');
  assert.ok(ys.every((y) => y > 0 && y < A4.height));
});

test('AC-97 pdf: valid structure, one page per board page, vector ruling lines full width, title text', () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = text(buildPdf([{ title: 'Page 1 (intro)', image: { data: jpeg, width: 100, height: 50 } }, { title: 'Page 2', image: null }]));
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /\/Count 2/);
  const lines = [...pdf.matchAll(/^0 ([\d.]+) m ([\d.]+) ([\d.]+) l S$/gm)];
  assert.ok(lines.length >= 30, 'ruling on both pages');
  assert.ok(lines.every((m) => m[1] === m[3] && Number(m[2]) === A4.width), 'horizontal and full width');
  assert.match(pdf, /\(Page 1 \\\(intro\\\)\) Tj/);
  assert.match(pdf, /\/Filter \/DCTDecode/);
  // xref offsets point at "n 0 obj"
  const xref = pdf.indexOf('xref\n');
  const entries = [...pdf.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)];
  entries.forEach((m, i) => assert.equal(pdf.slice(Number(m[1]), Number(m[1]) + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));
  assert.equal(Number(/startxref\n(\d+)/.exec(pdf)[1]), xref);
});

test('pdf helpers: text escaping and aspect-fit', () => {
  assert.equal(pdfText('a(b)\\c'), '(a\\(b\\)\\\\c)');
  assert.equal(pdfText('ok 中'), '(ok ?)');
  assert.deepEqual(fitInside(200, 100, 100, 100), { width: 100, height: 50 });
  assert.deepEqual(fitInside(0, 10, 100, 100), { width: 0, height: 0 });
});

test('AC-97 page model: add, order, per-page elements, deleted ones dropped', () => {
  const first = [makePage('Page 1', 0, 'a')];
  const { pages, page } = addPage(first, 'Page 2', 'b');
  assert.equal(page.order, 1);
  const edited = withElements(pages, 'b', [{ id: 'r', type: 'rectangle' }, { id: 'x', isDeleted: true }]);
  assert.deepEqual(edited.find((p) => p.id === 'b').elements.map((e) => e.id), ['r']);
  assert.equal(edited.find((p) => p.id === 'a').elements.length, 0);
  assert.deepEqual(sortPages([{ ...page }, first[0]]).map((p) => p.id), ['a', 'b']);
});

test('AC-97 mermaid file detection', () => {
  assert.ok(isMermaidFile({ name: 'flow.mmd' }));
  assert.ok(isMermaidFile({ name: 'X.MERMAID' }));
  assert.ok(!isMermaidFile({ name: 'photo.png' }));
  assert.equal(mermaidSource('```mermaid\ngraph TD\nA-->B\n```'), 'graph TD\nA-->B');
  assert.equal(mermaidSource('graph TD\nA-->B\n'), 'graph TD\nA-->B');
});

let child, base, dir;
const post = (p, body, cookie) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
async function login(personId, roles) {
  const r = await post('/__test/login', { personId, roles });
  return r.headers.get('set-cookie').split(';')[0];
}
async function browser() {
  const { chromium } = await import(join(process.env.LMS_NODE_MODULES ?? join(ROOT, 'node_modules'), '@playwright/test/index.mjs'));
  const d = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  const rev = readdirSync(d).find((x) => /^chromium-\d+$/.test(x));
  return chromium.launch(rev ? { executablePath: join(d, rev, 'chrome-linux', 'chrome') } : {});
}

before(async () => {
  const idx = join(ROOT, 'packages/web/dist/index.html');
  const newest = Math.max(...['packages/web/src/features/board', 'packages/board/src'].flatMap((d) => readdirSync(join(ROOT, d)).map((f) => statSync(join(ROOT, d, f)).mtimeMs)));
  if (!existsSync(idx) || statSync(idx).mtimeMs < newest) spawnSync('npm', ['run', 'build', '-w', 'packages/web'], { cwd: ROOT, encoding: 'utf8' });
  for (let i = 0; i < 100 && !existsSync(idx); i++) await new Promise((r) => setTimeout(r, 300));
  dir = mkdtempSync(join(tmpdir(), 'lms-board-'));
  const env = { ...process.env, PORT: '0', LMS_PROFILE: 'hub', LMS_DATA_DIR: dir, LMS_TLS: 'off', LMS_TEST_MODE: '1' };
  child = spawn(process.execPath, [join(ROOT, 'packages/server/src/main.ts')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  base = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server did not start')), 30000);
    child.stdout.on('data', (d) => { out += d; const m = /LISTENING (\d+)/.exec(out); if (m) { clearTimeout(t); res(`http://127.0.0.1:${m[1]}`); } });
    child.on('exit', (c) => rej(new Error('server exited ' + c)));
  });
  const r = await post('/__test/seed', { fixture: 'journeys/base.json' });
  assert.equal(r.status, 200, await r.clone().text());
}, { timeout: 180000 });
after(async () => { child?.kill('SIGTERM'); if (dir) rmSync(dir, { recursive: true, force: true }); });

test('AC-97 board page API: staff only, pages saved in the class database and ordered', async () => {
  const tr = await login('tr1', ['trainer']);
  const learner = await login('l1', ['learner']);
  const get = (p, c) => fetch(base + p, { headers: { cookie: c } });
  const put = (p, body, c) => fetch(base + p, { method: 'PUT', headers: { 'content-type': 'application/json', cookie: c }, body: JSON.stringify(body) });
  const classes = (await (await get('/api/board/classes', tr)).json()).classes;
  assert.ok(classes.length >= 1);
  const cid = classes[0].id;
  assert.equal((await get(`/api/board/classes/${cid}/pages`, learner)).status, 403);
  assert.equal((await put(`/api/board/classes/${cid}/pages/p2`, { title: 'Second', order: 1, elements: [] }, tr)).status, 200);
  assert.equal((await put(`/api/board/classes/${cid}/pages/p1`, { title: 'First', order: 0, elements: [{ id: 'e1', type: 'rectangle' }] }, tr)).status, 200);
  assert.equal((await put(`/api/board/classes/${cid}/pages/bad id`, { title: 'x', order: 0, elements: [] }, tr)).status, 400);
  assert.equal((await put(`/api/board/classes/${cid}/pages/p3`, { title: '', order: 0, elements: [] }, tr)).status, 400);
  const pages = (await (await get(`/api/board/classes/${cid}/pages`, tr)).json()).pages;
  assert.deepEqual(pages.map((p) => p.title), ['First', 'Second']);
  assert.equal(pages[0].elements[0].id, 'e1');
  // the trainer pack's handover reads the same documents
  const hv = await (await get(`/api/tele/classes/${cid}/handover/0`, tr)).json();
  assert.deepEqual(hv.boardPages.map((p) => p.title).sort(), ['First', 'Second']);
  // the test elements are not real drawings (Excalidraw would choke on them in the browser test): remove the pages
  for (const pid of ['p1', 'p2']) assert.equal((await fetch(base + `/api/board/classes/${cid}/pages/${pid}`, { method: 'DELETE', headers: { cookie: tr } })).status, 200);
});

test('AC-97 fonts are served locally and only .woff2 inside the assets folder', async () => {
  const r = await fetch(base + '/board-assets/fonts/Virgil/Virgil-Regular.woff2');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'font/woff2');
  assert.equal((await fetch(base + '/board-assets/..%2f..%2fpackage.json')).status, 404);
  assert.equal((await fetch(base + '/board-assets/fonts/nope.woff2')).status, 404);
});

test('AC-101 / AC-97 board chunk is requested only when opened; draw, add page, drop mermaid, export PDF with ruling', { timeout: 120000 }, async () => {
  const b = await browser();
  try {
    const ctx = await b.newContext({ viewport: { width: Number(process.env.BOARD_W ?? 1280), height: Number(process.env.BOARD_W ?? 1280) < 600 ? 700 : 800 }, ...(Number(process.env.BOARD_W ?? 1280) < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36' } : {}), acceptDownloads: true });
    const c = await login('tr1', ['trainer']);
    const [name, ...v] = c.split('=');
    await ctx.addCookies([{ name, value: v.join('='), url: base }]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 300)));
    const js = [];
    page.on('request', (r) => { if (/\.js(\?|$)/.test(r.url())) js.push(r.url()); });
    await page.goto(base + '/teach');
    await page.getByTestId('app-ready').waitFor({ timeout: 20000 });
    await page.waitForTimeout(500);
    assert.ok(!js.some((u) => /Board-/.test(u)), 'board chunk not requested before opening: ' + js.join(','));
    const t0 = Date.now();
    await page.getByRole('link', { name: /board/i }).click();
    await page.getByTestId('board').waitFor();
    await page.getByTestId('toolbar-rectangle').waitFor({ timeout: 15000 });
    assert.ok(Date.now() - t0 < 8000, `board usable (the 3 s phone budget is checked by AC-101 itself; this run shares the machine) in ${Date.now() - t0} ms`);
    assert.ok(js.some((u) => /Board-/.test(u)), 'board chunk requested after opening');

    const canvas = page.locator('canvas.excalidraw__canvas.static');
    const snap = () => canvas.evaluate((el) => el.toDataURL());
    await canvas.waitFor({ state: 'attached', timeout: 20000 });
    const empty = await snap();
    await page.locator('.board-surface').scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
    await page.getByTestId('toolbar-rectangle').click();
    await page.mouse.move(...at(0.3, 0.4)); await page.mouse.down(); await page.mouse.move(...at(0.6, 0.55), { steps: 5 }); await page.mouse.up();
    await page.waitForTimeout(300);
    const afterRect = await snap();
    assert.notEqual(afterRect, empty);
    await page.getByTestId('toolbar-text').click();
    await page.mouse.click(...at(0.4, 0.7));
    await page.keyboard.type('Hello');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const afterText = await snap();
    assert.notEqual(afterText, afterRect);

    // Mermaid drop (the file is built in the page; same path as a real file drop)
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(['graph TD\n  A[Start] --> B[End]\n'], 'flow.mmd', { type: 'text/plain' }));
      document.querySelector('[data-testid="board"]').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await page.waitForFunction((prev) => document.querySelector('canvas.excalidraw__canvas.static').toDataURL() !== prev, afterText, { timeout: 20000 });

    const tabs = await page.getByRole('tab').count();
    await page.getByRole('button', { name: /add page/i }).click();
    await page.getByRole('tab').nth(tabs).waitFor({ timeout: 10000 });
    assert.equal(await page.getByTestId('toolbar-rectangle').count() > 0, true);

    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByTestId('board-export-pdf').click()]);
    const file = await dl.path();
    if (process.env.BOARD_KEEP) writeFileSync(process.env.BOARD_KEEP, readFileSync(file));
    const pdf = readFileSync(file).toString('latin1');
    assert.match(pdf, /^%PDF-/);
    assert.equal(Number(/\/Count (\d+)/.exec(pdf)[1]), tabs + 1);
    assert.ok([...pdf.matchAll(/^0 [\d.]+ m 595\.28 [\d.]+ l S$/gm)].length >= 30, 'ruling lines in the PDF');
    // canvas stays plain: the static canvas has no ruling (an empty page snapshot is a single colour)
    const flat = await snap();
    const plain = await canvas.evaluate((el) => { const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data; for (let i = 4; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) return false; return true; });
    assert.ok(plain, 'a new page canvas is plain: ' + flat.length);
  } finally { await b.close(); }
});
