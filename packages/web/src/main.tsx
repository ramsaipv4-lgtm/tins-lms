import { createRoot } from 'react-dom/client';
import { Shell } from './app/shell.tsx';
import './app/app.css';

// A new build's worker takes over (skipWaiting + claim): reload once so the page runs the same build as its caches.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

createRoot(document.getElementById('root')!).render(<Shell />);
