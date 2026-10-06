// Kiosk mode (F-2, a shared device): the shell hides the Coach space while it is on. The flag lives in localStorage
// (per device); the files group's Settings screen sets it and runs the 30-minute idle sign-out.
import { useSyncExternalStore } from 'react';

const KEY = 'lms.kiosk';
const listeners = new Set<() => void>();

export function kioskOn(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
export function setKiosk(on: boolean): void {
  try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* private window: no kiosk */ }
  for (const l of listeners) l();
}
export function onKiosk(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export const useKiosk = (): boolean => useSyncExternalStore(onKiosk, kioskOn, () => false);
