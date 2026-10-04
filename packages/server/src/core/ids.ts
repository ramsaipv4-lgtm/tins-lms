// Random ids and one-time codes, from Web Crypto. Codes use Crockford base32 (no I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomBytes(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export function randomKey(): string {
  return Array.from(randomBytes(6), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomCode(len: number): string {
  let out = '';
  for (const b of randomBytes(len)) out += ALPHABET[b % 32];
  return out;
}

export function randomToken(): string {
  return Buffer.from(randomBytes(32)).toString('base64url');
}

export async function sha256Hex(text: string | Uint8Array): Promise<string> {
  const data = typeof text === 'string' ? new TextEncoder().encode(text) : text;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// "person:l1" and "l1" both mean the key "l1" (Appendix A).
export function keyOf(id: string): string {
  const i = id.indexOf(':');
  return i === -1 ? id : id.slice(i + 1);
}
