// WhatsApp link and clipboard helpers on top of core (SPEC 4.32).
import { waLink } from '../../../../core/src/messages.ts';

export function waLinkSafe(phone: string, text: string): string | null {
  try { return waLink(phone, text); } catch { return null; }
}

export async function copyText(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); return; } catch { /* fall back */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('aria-hidden', 'true'); document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } finally { ta.remove(); }
}
