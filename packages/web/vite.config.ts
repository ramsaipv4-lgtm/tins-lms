// Web build: output goes to packages/web/dist, which the server serves at "/" (SPEC §2, Appendix C).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';
import type { OutputChunk } from 'rolldown';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const root = fileURLToPath(new URL('.', import.meta.url));

// The board's chunks (SPEC AC-101): the Board screen, everything it imports statically or loads on demand, and nothing
// the rest of the app also uses. They are listed, board critical files first, in /warm-board.json; the service worker
// (src/sw.ts) keeps them out of its install and fetches them in the background for staff only.
const boardChunks = new Set<string>();

// Game chunks (SPEC D-57, AC-200): the engine, the story player, Snek and each game are separate chunks with these names, so
// nothing of a game is requested before the arcade opens and the budgets can be checked in .vite/manifest.json by name.
// `three` joins when the first 3D game exists.
export function gameChunkName(id: string): string | null {
  const m = /packages[\\/]games[\\/]src[\\/](engine|tuning\.ts|story|lang|games[\\/]([a-z0-9-]+))/.exec(id);
  if (m) {
    if (m[1] === 'story') return 'games-story';
    if (m[1] === 'lang') return 'snek';
    if (m[2]) return `game-${m[2]}`;
    return 'games-engine';
  }
  return /node_modules[\\/]three[\\/]/.test(id) ? 'three' : null;
}
function boardList(): Plugin {
  return {
    name: 'lms-board-list',
    generateBundle(_o, bundle) {
      boardChunks.clear();
      const chunks = Object.values(bundle).filter((c): c is OutputChunk => c.type === 'chunk');
      const board = chunks.find((c) => /features\/board\/Board\.tsx$/.test(c.facadeModuleId ?? ''));
      if (!board) return;
      const byName = new Map(chunks.map((c) => [c.fileName, c]));
      // The shell is the entry chunk and what it imports statically: never part of the board, and not walked through
      // (it also reaches every other screen by import()).
      const shell = new Set<string>();
      for (const e of chunks.filter((c) => c.isEntry)) for (const n of staticOf(e.fileName)) shell.add(n);
      function staticOf(name: string, seen = new Set<string>()): string[] {
        if (seen.has(name)) return [];
        seen.add(name);
        return [name, ...(byName.get(name)?.imports ?? []).flatMap((n) => staticOf(n, seen))];
      }
      const closure = (from: OutputChunk, dynamic: boolean) => {
        const seen = new Set<string>(); const order: string[] = []; const queue = [from.fileName];
        while (queue.length) {
          const n = queue.shift()!;
          if (seen.has(n) || shell.has(n)) continue;
          seen.add(n); order.push(n);
          const c = byName.get(n);
          if (c) queue.push(...c.imports, ...(dynamic ? c.dynamicImports : []));
        }
        return order;
      };
      const all = closure(board, true);
      const inside = new Set(all);
      // A chunk that anything outside the board also imports belongs to the core; repeat until stable.
      for (let changed = true; changed;) {
        changed = false;
        for (const c of chunks) {
          if (inside.has(c.fileName)) continue;
          for (const n of [...c.imports, ...c.dynamicImports]) if (n !== board.fileName && inside.delete(n)) changed = true;
        }
      }
      // Order: what the board needs to open (its static chunks, then what those load right away: Excalidraw's file
      // handlers, the English strings), then the rest (Mermaid diagrams), other languages last.
      const isLocale = (n: string) => (byName.get(n)?.moduleIds ?? []).some((m) => /\/locales\//.test(m)) && !/^assets\/en-/.test(n);
      const first = closure(board, false).filter((n) => inside.has(n));
      const eager = first.flatMap((n) => byName.get(n)?.dynamicImports ?? []).filter((n, i, a) => inside.has(n) && !first.includes(n) && a.indexOf(n) === i && !isLocale(n));
      const rest = all.filter((n) => inside.has(n) && !first.includes(n) && !eager.includes(n));
      const list = [...first, ...eager, ...rest.filter((n) => !isLocale(n)), ...rest.filter(isLocale)];
      const extra: string[] = [];
      for (const n of list) {
        const m = byName.get(n)?.viteMetadata;
        for (const f of [...(m?.importedCss ?? []), ...(m?.importedAssets ?? [])]) if (!list.includes(f) && !extra.includes(f)) extra.push(f);
      }
      const files = [...list, ...extra];
      files.forEach((f) => boardChunks.add('/' + f));
      this.emitFile({ type: 'asset', fileName: 'warm-board.json', source: JSON.stringify(files.map((f) => '/' + f)) });
    },
  };
}

export default defineConfig({
  root,
  // LMS_PSEUDO_LOCALE=1 at build time bakes the pseudo-locale in (Appendix C); a <meta> can also switch it on at run time.
  define: { __LMS_PSEUDO__: JSON.stringify(process.env.LMS_PSEUDO_LOCALE === '1') },
  // One React for the app and everything it imports (the board's Excalidraw would otherwise pick up the hoisted
  // React 18 from the root node_modules next to packages/web's pinned React 19: two Reacts, "reading 'useRef'"; I-8).
  // pouchdb-browser 9.0.0 imports Node's `events`, which no installed package provides and Vite externalises in a browser
  // build ("Class extends value #<Object>"). The `pouchdb` package ships the same 9.0.0 as one self-contained browser file
  // with `events` inlined, so app/db.ts keeps importing 'pouchdb-browser' and the build resolves it to that file.
  resolve: { dedupe: ['react', 'react-dom', 'scheduler'], alias: { 'pouchdb-browser': require.resolve('pouchdb/dist/pouchdb.js') } },
  build: {
    outDir: process.env.LMS_WEB_OUT || 'dist', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 400,
    manifest: true, // packages/web/dist/.vite/manifest.json (D-57)
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: gameChunkName, debugName: 'games', includeDependenciesRecursively: false, priority: 10 }] } } },
  },
  plugins: [
    react(),
    boardList(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Coach LMS', short_name: 'Coach LMS', start_url: '/', scope: '/', display: 'standalone',
        background_color: '#ffffff', theme_color: '#1d4ed8',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      // Own worker (src/sw.ts): core precache in parallel, board chunks warmed on request (see the notes there).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,json}'],
        manifestTransforms: [async (entries) => ({ manifest: entries.filter((e) => !boardChunks.has('/' + e.url.replace(/^\//, ''))), warnings: [] })],
      },
    }),
  ],
});
