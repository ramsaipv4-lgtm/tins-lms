import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  utf8Encode,
  utf8Decode,
  hexEncode,
  hexDecode,
  base64Encode,
  base64Decode,
  sha256,
  hmacSha256,
  hkdfSha256,
  aesGcmSeal,
  aesGcmOpen,
  canonicalJson,
} from '../src/util.ts';

test('utf8 encode/decode', () => {
  const text = 'Hello, 世界!';
  const encoded = utf8Encode(text);
  const decoded = utf8Decode(encoded);
  assert.equal(decoded, text);
  assert.ok(encoded instanceof Uint8Array);
});

test('hex encode/decode roundtrip', () => {
  const original = new Uint8Array([0xff, 0x00, 0xaa, 0xbb]);
  const hex = hexEncode(original);
  const decoded = hexDecode(hex);
  assert.deepEqual(decoded, original);
  assert.equal(hex, 'ff00aabb');
});

test('hex encode leading zeros', () => {
  const bytes = new Uint8Array([0x00, 0x01, 0x0f]);
  const hex = hexEncode(bytes);
  assert.equal(hex, '00010f');
});

test('base64 encode/decode roundtrip', () => {
  const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const encoded = base64Encode(original);
  const decoded = base64Decode(encoded);
  assert.deepEqual(decoded, original);
});

test('base64 with binary data', () => {
  const bytes = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]);
  const encoded = base64Encode(bytes);
  const decoded = base64Decode(encoded);
  assert.deepEqual(decoded, bytes);
});

test('sha256 deterministic', async () => {
  const data = utf8Encode('test data');
  const hash1 = await sha256(data);
  const hash2 = await sha256(data);
  assert.equal(hash1, hash2);
  assert.match(hash1, /^[0-9a-f]{64}$/);
});

test('sha256 different inputs give different hashes', async () => {
  const hash1 = await sha256(utf8Encode('test1'));
  const hash2 = await sha256(utf8Encode('test2'));
  assert.notEqual(hash1, hash2);
});

test('hmacSha256 deterministic', async () => {
  const key = utf8Encode('secret');
  const data = utf8Encode('message');
  const sig1 = await hmacSha256(key, data);
  const sig2 = await hmacSha256(key, data);
  assert.deepEqual(sig1, sig2);
  assert.equal(sig1.length, 32);
});

test('hmacSha256 key sensitivity', async () => {
  const data = utf8Encode('message');
  const sig1 = await hmacSha256(utf8Encode('key1'), data);
  const sig2 = await hmacSha256(utf8Encode('key2'), data);
  assert.notEqual(hexEncode(sig1), hexEncode(sig2));
});

test('hkdfSha256 basic derivation', async () => {
  const ikm = utf8Encode('input key material');
  const salt = utf8Encode('salt');
  const info = utf8Encode('info');
  const key = await hkdfSha256(ikm, salt, info, 32);
  assert.equal(key.length, 32);
  assert.ok(key instanceof Uint8Array);
});

test('hkdfSha256 different length', async () => {
  const ikm = utf8Encode('ikm');
  const salt = utf8Encode('salt');
  const info = utf8Encode('info');
  const key16 = await hkdfSha256(ikm, salt, info, 16);
  const key32 = await hkdfSha256(ikm, salt, info, 32);
  assert.equal(key16.length, 16);
  assert.equal(key32.length, 32);
});

test('hkdfSha256 deterministic', async () => {
  const ikm = utf8Encode('ikm');
  const salt = utf8Encode('salt');
  const info = utf8Encode('info');
  const key1 = await hkdfSha256(ikm, salt, info, 32);
  const key2 = await hkdfSha256(ikm, salt, info, 32);
  assert.deepEqual(key1, key2);
});

test('aesGcmSeal and aesGcmOpen roundtrip', async () => {
  const key = new Uint8Array(32).fill(1);
  const plaintext = utf8Encode('secret message');
  const sealed = await aesGcmSeal(key, plaintext);
  const decrypted = await aesGcmOpen(key, sealed);
  assert.deepEqual(decrypted, plaintext);
});

test('aesGcmSeal returns IV + ciphertext', async () => {
  const key = new Uint8Array(32).fill(1);
  const plaintext = utf8Encode('message');
  const sealed = await aesGcmSeal(key, plaintext);
  assert.ok(sealed.length >= 12);
  assert.equal(sealed.length, 12 + plaintext.length + 16);
});

test('aesGcmSeal produces different ciphertexts (fresh IV)', async () => {
  const key = new Uint8Array(32).fill(1);
  const plaintext = utf8Encode('same message');
  const sealed1 = await aesGcmSeal(key, plaintext);
  const sealed2 = await aesGcmSeal(key, plaintext);
  assert.notEqual(hexEncode(sealed1), hexEncode(sealed2));
});

test('aesGcmOpen throws on wrong key', async () => {
  const key1 = new Uint8Array(32).fill(1);
  const key2 = new Uint8Array(32).fill(2);
  const plaintext = utf8Encode('message');
  const sealed = await aesGcmSeal(key1, plaintext);
  await assert.rejects(aesGcmOpen(key2, sealed));
});

test('aesGcmOpen throws on tampered data', async () => {
  const key = new Uint8Array(32).fill(1);
  const plaintext = utf8Encode('message');
  const sealed = await aesGcmSeal(key, plaintext);
  const tampered = sealed.slice();
  tampered[15] ^= 1;
  await assert.rejects(aesGcmOpen(key, tampered));
});

test('canonicalJson simple objects', () => {
  const obj = { b: 2, a: 1 };
  const json = canonicalJson(obj);
  assert.equal(json, '{"a":1,"b":2}');
});

test('canonicalJson nested objects', () => {
  const obj = { x: { z: 3, y: 2 }, a: 1 };
  const json = canonicalJson(obj);
  assert.equal(json, '{"a":1,"x":{"y":2,"z":3}}');
});

test('canonicalJson arrays', () => {
  const obj = { items: [3, 1, 2] };
  const json = canonicalJson(obj);
  assert.equal(json, '{"items":[3,1,2]}');
});

test('canonicalJson primitives', () => {
  assert.equal(canonicalJson(null), 'null');
  assert.equal(canonicalJson(true), 'true');
  assert.equal(canonicalJson(false), 'false');
  assert.equal(canonicalJson(42), '42');
  assert.equal(canonicalJson('text'), '"text"');
});

test('canonicalJson with strings needing escaping', () => {
  const obj = { key: 'value"with"quotes' };
  const json = canonicalJson(obj);
  assert.match(json, /{"key":/);
  const parsed = JSON.parse(json);
  assert.equal(parsed.key, 'value"with"quotes');
});

test('canonicalJson deterministic order', () => {
  const obj1 = canonicalJson({ z: 1, a: 2, m: 3 });
  const obj2 = canonicalJson({ a: 2, m: 3, z: 1 });
  assert.equal(obj1, obj2);
});
