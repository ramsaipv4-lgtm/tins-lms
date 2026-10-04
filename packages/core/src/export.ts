// Export: manifest, ustar archives and signed class packages (SPEC §4.24)
import { utf8Encode, utf8Decode, sha256, canonicalJson } from './util.ts';

export type FileEntry = { path: string; bytes: Uint8Array };
export type Manifest = { version: 1; files: { path: string; sha256: string; size: number }[] };

function byPath(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ===== Manifest =====

export async function buildManifest(files: readonly FileEntry[]): Promise<Manifest> {
  const entries = [];
  for (const f of files) {
    entries.push({ path: f.path, sha256: await sha256(f.bytes), size: f.bytes.length });
  }
  entries.sort((a, b) => byPath(a.path, b.path));
  return { version: 1, files: entries };
}

export async function verifyManifest(
  files: readonly FileEntry[],
  manifest: Manifest,
): Promise<{ missing: string[]; extra: string[]; changed: string[] }> {
  const expected = new Map(manifest.files.map((f) => [f.path, f]));
  const seen = new Set<string>();
  const extra: string[] = [];
  const changed: string[] = [];
  for (const f of files) {
    seen.add(f.path);
    const want = expected.get(f.path);
    if (!want) {
      extra.push(f.path);
    } else if (want.size !== f.bytes.length || want.sha256 !== (await sha256(f.bytes))) {
      changed.push(f.path);
    }
  }
  const missing = manifest.files.map((f) => f.path).filter((p) => !seen.has(p));
  return { missing: missing.sort(byPath), extra: extra.sort(byPath), changed: changed.sort(byPath) };
}

// ===== POSIX ustar =====

const BLOCK = 512;

function writeOctal(buf: Uint8Array, offset: number, width: number, value: number): void {
  // width includes the trailing NUL
  const text = value.toString(8).padStart(width - 1, '0');
  if (text.length > width - 1) throw new Error('tar: value too large for field');
  buf.set(utf8Encode(text), offset);
  buf[offset + width - 1] = 0;
}

function splitName(path: string): { name: Uint8Array; prefix: Uint8Array } {
  const full = utf8Encode(path);
  if (full.length <= 100) return { name: full, prefix: new Uint8Array(0) };
  for (let i = full.length - 1; i > 0; i--) {
    if (full[i] === 0x2f && full.length - i - 1 <= 100 && i <= 155 && full.length - i - 1 > 0) {
      return { name: full.slice(i + 1), prefix: full.slice(0, i) };
    }
  }
  throw new Error(`tar: path too long: ${path}`);
}

export function tarPack(files: readonly FileEntry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const f of files) {
    const h = new Uint8Array(BLOCK);
    const { name, prefix } = splitName(f.path);
    h.set(name, 0);
    writeOctal(h, 100, 8, 0o644);
    writeOctal(h, 108, 8, 0);
    writeOctal(h, 116, 8, 0);
    writeOctal(h, 124, 12, f.bytes.length);
    writeOctal(h, 136, 12, 0);
    h.fill(0x20, 148, 156); // checksum counts as spaces
    h[156] = 0x30; // '0' regular file
    h.set(utf8Encode('ustar'), 257); // magic "ustar\0"
    h.set(utf8Encode('00'), 263); // version
    h.set(prefix, 345);
    let sum = 0;
    for (let i = 0; i < BLOCK; i++) sum += h[i];
    writeOctal(h, 148, 7, sum); // six digits + NUL, then a space
    h[155] = 0x20;
    parts.push(h);
    const padded = new Uint8Array(Math.ceil(f.bytes.length / BLOCK) * BLOCK);
    padded.set(f.bytes);
    parts.push(padded);
  }
  parts.push(new Uint8Array(BLOCK * 2));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function readField(h: Uint8Array, offset: number, width: number): Uint8Array {
  let end = offset;
  while (end < offset + width && h[end] !== 0) end++;
  return h.slice(offset, end);
}

function readOctal(h: Uint8Array, offset: number, width: number): number {
  const text = utf8Decode(readField(h, offset, width)).trim();
  if (!/^[0-7]+$/.test(text)) throw new Error('tar: bad octal field');
  return parseInt(text, 8);
}

export function tarUnpack(archive: Uint8Array): FileEntry[] {
  const out: FileEntry[] = [];
  let at = 0;
  while (at + BLOCK <= archive.length) {
    const h = archive.subarray(at, at + BLOCK);
    if (h.every((b) => b === 0)) return out;
    const stored = readOctal(h, 148, 8);
    let sum = 0;
    for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i];
    if (sum !== stored) throw new Error('tar: bad checksum');
    const size = readOctal(h, 124, 12);
    const type = h[156];
    const name = utf8Decode(readField(h, 0, 100));
    const prefix = utf8Decode(readField(h, 345, 155));
    at += BLOCK;
    if (at + size > archive.length) throw new Error('tar: truncated');
    if (type === 0x30 || type === 0) {
      out.push({ path: prefix ? `${prefix}/${name}` : name, bytes: archive.slice(at, at + size) });
    }
    at += Math.ceil(size / BLOCK) * BLOCK;
  }
  throw new Error('tar: missing end marker');
}

// ===== Signed class packages =====
// Container: "LMSP1\n" | u32be keyLen | public JWK (canonical JSON) | 64-byte signature | archive

const MAGIC = utf8Encode('LMSP1\n');
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIG = { name: 'ECDSA', hash: 'SHA-256' } as const;

export async function generateSigningKeys(): Promise<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey }> {
  const pair = await globalThis.crypto.subtle.generateKey(ECDSA, true, ['sign', 'verify']);
  return {
    publicJwk: await globalThis.crypto.subtle.exportKey('jwk', pair.publicKey),
    privateJwk: await globalThis.crypto.subtle.exportKey('jwk', pair.privateKey),
  };
}

function pubIdentity(jwk: JsonWebKey): string {
  return canonicalJson({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });
}

export async function signPackage(archive: Uint8Array, privateJwk: JsonWebKey): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey('jwk', privateJwk, ECDSA, false, ['sign']);
  const sig = new Uint8Array(await globalThis.crypto.subtle.sign(SIG, key, archive));
  const pub = utf8Encode(pubIdentity(privateJwk));
  const out = new Uint8Array(MAGIC.length + 4 + pub.length + sig.length + archive.length);
  let at = 0;
  out.set(MAGIC, at);
  at += MAGIC.length;
  new DataView(out.buffer).setUint32(at, pub.length);
  at += 4;
  out.set(pub, at);
  at += pub.length;
  out.set(sig, at);
  at += sig.length;
  out.set(archive, at);
  return out;
}

export async function openPackage(
  container: Uint8Array,
  trustedPublicJwks: readonly JsonWebKey[],
): Promise<
  | { ok: true; files: FileEntry[] }
  | { ok: false; reason: 'bad-signature' | 'untrusted' | 'corrupt' }
> {
  const corrupt = { ok: false, reason: 'corrupt' } as const;
  if (container.length < MAGIC.length + 4) return corrupt;
  for (let i = 0; i < MAGIC.length; i++) if (container[i] !== MAGIC[i]) return corrupt;
  const keyLen = new DataView(container.buffer, container.byteOffset, container.length).getUint32(MAGIC.length);
  const keyStart = MAGIC.length + 4;
  const sigStart = keyStart + keyLen;
  const archiveStart = sigStart + 64;
  if (archiveStart > container.length) return corrupt;
  let embedded: JsonWebKey;
  try {
    embedded = JSON.parse(utf8Decode(container.subarray(keyStart, sigStart)));
  } catch {
    return corrupt;
  }
  const archive = container.subarray(archiveStart);
  let valid = false;
  try {
    const key = await globalThis.crypto.subtle.importKey('jwk', embedded, ECDSA, false, ['verify']);
    valid = await globalThis.crypto.subtle.verify(SIG, key, container.subarray(sigStart, archiveStart), archive);
  } catch {
    return corrupt;
  }
  if (!valid) return { ok: false, reason: 'bad-signature' };
  const id = pubIdentity(embedded);
  if (!trustedPublicJwks.some((k) => pubIdentity(k) === id)) return { ok: false, reason: 'untrusted' };
  try {
    return { ok: true, files: tarUnpack(archive) };
  } catch {
    return corrupt;
  }
}
