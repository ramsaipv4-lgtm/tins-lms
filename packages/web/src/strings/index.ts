// Strings system (SPEC AC-123): every visible string comes from en.json or a feature's strings.en.json.
// Feature files are merged at build time; keys of a group start with "<group>.". Later files never override en.json.
import base from './en.json';

declare const __LMS_PSEUDO__: boolean;

const featureFiles = import.meta.glob('../features/*/strings.en.json', { eager: true, import: 'default' }) as Record<string, Record<string, string>>;

export const strings: Record<string, string> = { ...(base as Record<string, string>) };
for (const file of Object.values(featureFiles)) for (const [k, v] of Object.entries(file)) if (!(k in strings)) strings[k] = v;

// Pseudo-locale (Appendix C): LMS_PSEUDO_LOCALE=1 at build time, or <meta name="lms-pseudo-locale" content="1"> injected by the server.
export function pseudoLocale(): boolean {
  if (typeof __LMS_PSEUDO__ !== 'undefined' && __LMS_PSEUDO__) return true;
  try { return document.querySelector('meta[name="lms-pseudo-locale"]')?.getAttribute('content') === '1'; } catch { return false; }
}
let pseudo: boolean | null = null;

export function t(key: string, params?: Record<string, string | number>): string {
  let s = strings[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? ''));
  pseudo ??= pseudoLocale();
  return pseudo ? `⟦${s}⟧` : s;
}
