// Leaked-key drill alert (AC-164, C-12): while the trainer's drill runs, every learner screen shows a
// role=alert banner, whichever page the learner is on. It lives outside the React tree so it needs no
// change in other groups' screens; it is started once, when the feature registry loads this group.
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';

let started = false;

export function startDrillAlert(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  let el: HTMLElement | null = null;
  let learner: boolean | null = null;
  const tick = async () => {
    try {
      if (learner === null || learner === false) {
        const me: any = await api('/api/me').catch(() => null);
        learner = !!me && Array.isArray(me.roles) && me.roles.includes('learner');
        if (!learner) { learner = null; throw new Error('not a learner'); }
      }
      const d: any = await api('/api/corp/drill');
      const on = !!d.started && !d.complete;
      if (on && !el) {
        el = document.createElement('div');
        el.setAttribute('role', 'alert');
        el.setAttribute('data-testid', 'drill-alert');
        el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:20;background:#fff;color:#8a0019;border:3px solid #b00020;padding:12px 16px;font-weight:700';
        el.textContent = t('shift.drill.alert');
        document.body.appendChild(el);
      } else if (!on && el) { el.remove(); el = null; }
    } catch { learner = learner === true ? true : null; if (el && learner !== true) { el.remove(); el = null; } }
  };
  setInterval(() => { void tick(); }, 4000);
  void tick();
}
