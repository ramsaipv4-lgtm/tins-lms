// Hub certificate authority (D-25): an ECDSA P-256 key pair from Web Crypto. The private key lives only in
// <dataDir>/ca.json (mode 0600) and is never returned or logged. The SHA-256 of the public key (SPKI, hex)
// is the fingerprint the pairing QR carries.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256Hex } from './ids.ts';

export type CaInfo = { fingerprint: string; publicJwk: JsonWebKey };

export async function loadOrCreateCa(dataDir: string): Promise<CaInfo> {
  const file = join(dataDir, 'ca.json');
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    return { fingerprint: saved.fingerprint, publicJwk: saved.publicJwk };
  }
  const subtle = globalThis.crypto.subtle;
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicJwk = await subtle.exportKey('jwk', pair.publicKey);
  const privateJwk = await subtle.exportKey('jwk', pair.privateKey);
  const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  const fingerprint = await sha256Hex(spki);
  writeFileSync(file, JSON.stringify({ fingerprint, publicJwk, privateJwk }), { mode: 0o600 });
  return { fingerprint, publicJwk };
}
