// Web build: output goes to packages/web/dist, which the server serves at "/" (SPEC §2, Appendix C).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  // LMS_PSEUDO_LOCALE=1 at build time bakes the pseudo-locale in (Appendix C); a <meta> can also switch it on at run time.
  define: { __LMS_PSEUDO__: JSON.stringify(process.env.LMS_PSEUDO_LOCALE === '1') },
  // One React for the app and everything it imports (the board's Excalidraw would otherwise pick up the hoisted
  // React 18 from the root node_modules next to packages/web's pinned React 19: two Reacts, "reading 'useRef'"; I-8).
  resolve: { dedupe: ['react', 'react-dom', 'scheduler'] },
  build: { outDir: process.env.LMS_WEB_OUT || 'dist', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 400 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Coach LMS', short_name: 'Coach LMS', start_url: '/', scope: '/', display: 'standalone',
        background_color: '#ffffff', theme_color: '#1d4ed8',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/db\//, /^\/__test\//],
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
    }),
  ],
});
