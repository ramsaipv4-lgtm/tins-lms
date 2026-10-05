// A learner who was dropped from the class is told so on every screen (AC-152).
// Runs once when the app starts: polls /api/classroom/my-status and shows a status banner while dropped.
import { t } from '../../strings/index.ts';

export function mountDroppedNotice(): void {
  if (typeof document === 'undefined') return;
  let box: HTMLDivElement | null = null;
  async function check() {
    try {
      const res = await fetch('/api/classroom/my-status', { credentials: 'same-origin', headers: { accept: 'application/json' } });
      if (!res.ok) { box?.remove(); box = null; return; }
      const { dropped } = await res.json();
      if (dropped && !box) {
        box = document.createElement('div');
        box.setAttribute('role', 'status');
        box.setAttribute('data-testid', 'dropped-notice');
        box.style.cssText = 'padding:12px 16px;margin:0;background:#ffe58f;color:#1a1a1a;border-bottom:1px solid #767676';
        box.textContent = t('classroom.dropped.notice');
        document.body.prepend(box);
      } else if (!dropped && box) { box.remove(); box = null; }
    } catch { /* offline: keep what is shown */ }
  }
  const start = () => { void check(); setInterval(() => void check(), 4000); window.addEventListener('popstate', () => void check()); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}
