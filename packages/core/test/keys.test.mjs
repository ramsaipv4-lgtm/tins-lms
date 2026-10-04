import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECOVERY_WORDS, recoveryWords, wordsToEntropy, wrapPersonKey, unwrapPersonKey, shred } from '../src/keys.ts';
import { aesGcmSeal, aesGcmOpen, utf8Encode, utf8Decode } from '../src/util.ts';

test('word list has 256 unique lowercase words', () => {
  assert.equal(RECOVERY_WORDS.length, 256);
  assert.equal(new Set(RECOVERY_WORDS).size, 256);
  for (const w of RECOVERY_WORDS) assert.match(w, /^[a-z]+$/);
});

test('32 bytes round-trip through 32 words', () => {
  const e = Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 5) % 256);
  const words = recoveryWords(e);
  assert.equal(words.length, 32);
  assert.deepEqual(wordsToEntropy(words), e);
});

test('every byte value round-trips', () => {
  for (let b = 0; b < 256; b++) {
    const e = new Uint8Array(32).fill(b);
    assert.deepEqual(wordsToEntropy(recoveryWords(e)), e);
  }
});

test('misspelt word or wrong count throws', () => {
  const words = recoveryWords(new Uint8Array(32));
  assert.throws(() => wordsToEntropy([...words.slice(0, 31), 'zzzz']));
  assert.throws(() => wordsToEntropy(words.slice(0, 31)));
  assert.throws(() => recoveryWords(new Uint8Array(31)));
});

test('wrap/unwrap then data sealed with person key opens', async () => {
  const wrapping = new Uint8Array(32).fill(7);
  const personKey = new Uint8Array(32).fill(9);
  const sealed = await aesGcmSeal(personKey, utf8Encode('hello'));
  const wrapped = await wrapPersonKey(personKey, wrapping);
  const back = await unwrapPersonKey(wrapped, wrapping);
  assert.deepEqual(back, personKey);
  assert.equal(utf8Decode(await aesGcmOpen(back, sealed)), 'hello');
  await assert.rejects(unwrapPersonKey(wrapped, new Uint8Array(32).fill(8)));
});

test('shred removes only that person and does not mutate input', () => {
  const ring = { a: new Uint8Array([1]), b: new Uint8Array([2]) };
  const out = shred(ring, 'a');
  assert.equal('a' in out, false);
  assert.deepEqual(out.b, ring.b);
  assert.equal('a' in ring, true);
});
