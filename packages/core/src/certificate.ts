// Certificate ids (SPEC 4.33): 12 Crockford base32 characters from an HMAC-SHA-256.
import { canonicalJson, hmacSha256, utf8Encode } from './util.ts';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function base32Crockford(bytes: Uint8Array, chars: number): string {
  let bits = 0;
  let acc = 0;
  let out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5 && out.length < chars) {
      out += CROCKFORD[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
    if (out.length >= chars) break;
  }
  return out;
}

export async function certificateId(
  secret: Uint8Array,
  personId: string,
  programId: string,
  issuedAt: number,
): Promise<string> {
  const msg = utf8Encode(canonicalJson({ issuedAt, personId, programId, v: 'cert1' }));
  const mac = await hmacSha256(secret, msg);
  return base32Crockford(mac, 12);
}

export async function verifyCertificateId(
  id: string,
  secret: Uint8Array,
  personId: string,
  programId: string,
  issuedAt: number,
): Promise<boolean> {
  const expected = await certificateId(secret, personId, programId, issuedAt);
  if (typeof id !== 'string' || id.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ id.charCodeAt(i);
  return diff === 0;
}
