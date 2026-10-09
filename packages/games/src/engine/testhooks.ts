// window.__game (SPEC §13.3 "Test hooks"): exists only in test mode, and only while a game or the prologue is mounted.
// Test mode is announced by <meta name="lms-test-mode" content="1">, which the server injects when LMS_TEST_MODE=1.
import type { Session } from './session.ts';
import type { TestGame } from './types.ts';

export function testModeOn(doc: { querySelector(sel: string): { getAttribute(n: string): string | null } | null } | undefined = typeof document !== 'undefined' ? document : undefined): boolean {
  try { return doc?.querySelector('meta[name="lms-test-mode"]')?.getAttribute('content') === '1'; } catch { return false; }
}

/** The query flags of D-51. Outside test mode they are ignored (all false / null). */
export function testFlags(search: string, testMode: boolean): { seed: string | null; manual: boolean; storyOff: boolean } {
  if (!testMode) return { seed: null, manual: false, storyOff: false };
  const q = new URLSearchParams(search);
  return { seed: q.get('seed'), manual: q.get('clock') === 'manual', storyOff: q.get('story') === 'off' };
}

export function hookFor(session: Session): TestGame {
  return {
    id: session.id,
    state: () => session.state(),
    act: (action, arg) => session.act(action, arg),
    advance: (ms) => session.advance(ms),
    stats: () => session.stats(),
  };
}

/** Install the hook on `win` when test mode is on; returns the function that removes it. */
export function installTestGame(win: any, session: Session, testMode: boolean): () => void {
  if (!testMode) return () => {};
  const hook = hookFor(session);
  win.__game = hook;
  return () => { if (win.__game === hook) delete win.__game; };
}
