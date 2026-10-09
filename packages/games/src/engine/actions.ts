// Common actions, keys and the action-validity table (SPEC §13.3 "Common actions and keys").
// One table drives three things: whether act() does anything, which `act-<action>` buttons show, and which key maps to
// which action in a status. Within a status no two actions share a key.
import type { ActionSpec, Status } from './types.ts';

export const COMMON_ACTIONS = ['start', 'pause', 'resume', 'continue', 'quit', 'assist', 'next', 'skip', 'replay', 'avatar'] as const;
export type CommonAction = (typeof COMMON_ACTIONS)[number];
export const isCommon = (a: string): a is CommonAction => (COMMON_ACTIONS as readonly string[]).includes(a);

/** What the engine knows about the screen when it judges an action. */
export interface View {
  status: Status;
  overlay: 'menu' | 'lesson' | null;   // when status is 'paused'
  avatarBeat: boolean;                  // story: the running beat is the prologue's avatar beat
  hasSeenScene: boolean;                // replay needs at least one seen scene
  storyOn: boolean;
}

/** The validity table. */
export function commonValid(action: CommonAction, v: View): boolean {
  switch (action) {
    case 'start': return v.status === 'title';
    case 'pause': return v.status === 'playing' || v.status === 'story';
    case 'resume': return v.status === 'paused' && v.overlay === 'menu';
    case 'continue': return v.status === 'paused' && v.overlay === 'lesson';
    case 'quit': return v.status === 'paused' || v.status === 'won' || v.status === 'lost';
    case 'assist': return v.status === 'title' || v.status === 'paused';
    case 'next': return v.status === 'story' && !v.avatarBeat;
    case 'skip': return v.status === 'story';
    case 'replay': return (v.status === 'paused' || v.status === 'title') && v.storyOn && v.hasSeenScene;
    case 'avatar': return v.status === 'story' && v.avatarBeat;
  }
}

/** Keys of the common actions, by action. `Enter` and the arrows are KeyboardEvent.key values; letters match case-insensitively. */
export const COMMON_KEYS: Record<CommonAction, string[]> = {
  start: ['Enter'], pause: ['p', 'Escape'], resume: ['p', 'Escape'], continue: ['Enter'], quit: ['q'], assist: ['h'],
  next: ['n', 'Enter'], skip: ['f', 'Backspace'], replay: ['l'], avatar: ['Enter'],
};

export const normKey = (k: string): string => (k.length === 1 ? k.toLowerCase() : k);

/** A game's own action valid in this view? Default: while playing. */
export function specValid(spec: ActionSpec, v: View): boolean {
  return (spec.validIn ?? ['playing']).includes(v.status);
}

export interface Resolved { action: string; arg?: unknown; spec?: ActionSpec; release?: boolean }

/** Which action does this key press mean in this view? null when none. Common keys win; a clash is a bug (see keyClashes). */
export function resolveKey(key: string, v: View, specs: readonly ActionSpec[]): Resolved | null {
  const k = normKey(key);
  for (const a of COMMON_ACTIONS) {
    if (commonValid(a, v) && COMMON_KEYS[a].some((x) => normKey(x) === k)) return { action: a };
  }
  for (const spec of specs) {
    if (!specValid(spec, v)) continue;
    if ((spec.keys ?? []).some((x) => normKey(x) === k)) return spec.keyAsArg ? { action: spec.action, arg: key, spec } : { action: spec.action, arg: spec.arg, spec };
  }
  return null;
}

/** Key clashes within one status: a list of sentences, empty when the table is sound. */
export function keyClashes(specs: readonly ActionSpec[]): string[] {
  const problems: string[] = [];
  const statuses: Status[] = ['story', 'title', 'playing', 'paused', 'won', 'lost'];
  for (const status of statuses) {
    for (const overlay of status === 'paused' ? (['menu', 'lesson'] as const) : ([null] as const)) {
      for (const avatarBeat of status === 'story' ? [false, true] : [false]) {
        const v: View = { status, overlay, avatarBeat, hasSeenScene: true, storyOn: true };
        const owners = new Map<string, string>();
        const claim = (key: string, who: string) => {
          const k = normKey(key);
          const prev = owners.get(k);
          if (prev && prev !== who) problems.push(`in status ${status}${overlay ? ` (${overlay})` : ''}${avatarBeat ? ' (avatar beat)' : ''} the key ${key} is used by both ${prev} and ${who}`);
          else owners.set(k, who);
        };
        for (const a of COMMON_ACTIONS) if (commonValid(a, v)) for (const key of COMMON_KEYS[a]) claim(key, a);
        for (const s of specs) if (specValid(s, v)) for (const key of s.keys ?? []) claim(key, s.action + (s.arg !== undefined ? ':' + JSON.stringify(s.arg) : ''));
      }
    }
  }
  return [...new Set(problems)];
}

/** The `data-testid` of an action's button: act-<name> where name is the spec's `button` (or the action, plus an argument suffix). */
export const buttonId = (name: string): string => `act-${name}`;
