#!/usr/bin/env node
// Product demo recorder. See demos/README.md.
//   node demos/run.mjs [--only <name|number>] [--headed] [--pace slow|normal]
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, writeFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { startHub, REPO, DEMOS } from './lib/hub.mjs';
import { createStage, PROFILES } from './lib/stage.mjs';
import { STANDARD } from './lib/people.mjs';
import { titleFrame, makeMp4, probeSeconds, writeIndex, TITLE_SECONDS } from './lib/video.mjs';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (args.includes('--help') || args.includes('-h')) {
  console.log('usage: node demos/run.mjs [--only <name|number>] [--headed] [--pace slow|normal]');
  process.exit(0);
}
const only = opt('--only');
const headed = args.includes('--headed');
const pace = opt('--pace') || 'normal';
if (!['slow', 'normal', 'fast'].includes(pace)) { console.error('--pace must be slow or normal (fast is for trying scenes out: it skips the video)'); process.exit(2); }
for (const a of args) if (a.startsWith('--') && !['--only', '--headed', '--pace', '--help'].includes(a)) { console.error(`unknown option ${a}`); process.exit(2); }

const OUT = join(DEMOS, 'out');
mkdirSync(OUT, { recursive: true });
const log = (m) => console.log(m);

const req = createRequire(join(REPO, 'package.json'));
const { chromium } = req('@playwright/test');
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

function ensureWebBuild() {
  if (existsSync(join(REPO, 'packages', 'web', 'dist', 'index.html'))) return;
  log('building the web app (npm run build -w packages/web) ...');
  const r = spawnSync('npm', ['run', 'build', '-w', 'packages/web'], { cwd: REPO, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('web build failed');
}

const dir = join(DEMOS, 'scenes');
const all = readdirSync(dir).filter((f) => /^\d\d-.*\.mjs$/.test(f)).sort();
const picked = all.filter((f) => !only || f.replace(/\.mjs$/, '') === only || f.startsWith(`${only}-`) || f.includes(only));
if (!picked.length) { console.error(`no demo matches --only ${only}. Available: ${all.map((f) => f.replace('.mjs', '')).join(', ')}`); process.exit(2); }

ensureWebBuild();
let bad = 0;
for (const file of picked) {
  const demo = (await import(pathToFileURL(join(dir, file)).href)).default;
  const prof = PROFILES[demo.profile || 'desktop'];
  log(`\n== ${demo.name}: ${demo.title} (${demo.profile || 'desktop'}, pace ${pace})`);
  const hub = await startHub({ log });
  let browser;
  try {
    await hub.seed(...(demo.seeds || STANDARD));
    await demo.prepare?.(hub);
    browser = await chromium.launch({
      headless: !headed, executablePath: chromiumPath, timeout: 30_000,
      args: headed ? [`--window-size=${prof.viewport.width + 16},${prof.viewport.height + 120}`, '--window-position=0,0'] : [],
    });
    const stage = await createStage({ browser, name: demo.name, profile: demo.profile || 'desktop', pace, outDir: OUT, hub, log });
    try { await demo.run(stage, hub); } catch (e) { stage.failures.push(`demo aborted: ${e.message.split('\n')[0]}`); log(`demo aborted: ${e.stack}`); }
    await stage.clearCaption().catch(() => {});
    const { webm, seconds } = await stage.finish();
    if (pace === 'fast') { log(`   fast mode: no mp4 (${seconds.toFixed(0)} s of screen time); ${stage.failures.length ? 'FAILURES: ' + stage.failures.join(' | ') : 'no failures'}`); if (stage.failures.length) bad++; continue; }
    const png = join(OUT, '.raw', `${demo.name}-title.png`);
    await titleFrame(browser, { title: demo.title, subtitle: demo.subtitle || '', width: prof.viewport.width, height: prof.viewport.height, scale: prof.video.width / prof.viewport.width, file: png });
    const mp4 = join(OUT, `${demo.name}.mp4`);
    const total = makeMp4({ webm, png, mp4, width: prof.video.width, height: prof.video.height });
    writeFileSync(join(OUT, `${demo.name}.json`), JSON.stringify({
      name: demo.name, title: demo.title, persona: demo.persona || '', shows: demo.shows || '', profile: demo.profile || 'desktop', size: `${prof.video.width}x${prof.video.height}`, seconds: total,
      scenes: stage.scenes.map((s) => ({ title: s.title, at: s.start + TITLE_SECONDS, failed: s.failed })), skipped: stage.skipped, failures: stage.failures,
    }, null, 1));
    log(`   wrote ${mp4} (${total.toFixed(1)} s)`);
    if (stage.failures.length) { bad++; log(`   FAILURES: ${stage.failures.join(' | ')}`); }
  } catch (e) {
    bad++; log(`demo ${demo.name} failed: ${e.stack}`);
  } finally {
    await browser?.close().catch(() => {});
    await hub.dispose().catch(() => {});
  }
}
writeIndex(OUT);
log(`\nindex: ${join(OUT, 'index.md')}`);
process.exit(bad ? 1 : 0);
