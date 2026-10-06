---
id: ms-03.05
title: Recovery words and crypto-shredding
module: 3
est_minutes: 25
prereqs: []
objectives: 3
new_terms: 5
skills: [recovery-key, crypto-shredding]
source_refs: [{ path: packages/core/src/keys.ts, commit: 3c4f923f66810152e55cb83088241066a64e62a0 }]
next: ms-04.01
---

# MS 3.5 — Recovery words and crypto-shredding
*Step 10 of 41*

## Prerequisites
You know what a byte is (0 to 255) and that AES-GCM seals data with a key (ms-01.01).

## You already understand this
A house key can be copied onto paper as a long code, and burning the only key makes the safe unreadable. This step does both with data.

## The detective question
**Problem:** A person's data must be erasable on request, and a learner who loses their device must still be able to recover their key by writing it down.
**Options considered:** (1) Hunt down and delete every copy of the person's data, backups included. (2) Encrypt each person's data with their own key and delete only the key. (3) Show the key as hex.
**Choice:** Option 2, with the key's 32 bytes shown as 32 words from a 256-word list.
**Why:** One byte is exactly one of 256 words, so words convert to bytes with no loss and no checksum maths. Deleting one wrapped key makes every copy of that person's data unreadable.

## Learning objectives
1. Convert 32 bytes to 32 words and back.
2. Wrap and unwrap a person key under a wrapping key.
3. Shred a person without touching anyone else.

## Conceptual understanding
A byte has 256 values and the list has 256 words, so a word's position in the list is the byte. Wrapping means sealing the person key with another key, so the keyring can be stored safely. Shredding removes the wrapped key; the sealed data stays but can never be opened.

## Walkthrough of the real code
Bytes to words, with a length check:

```ts packages/core/src/keys.ts
export function recoveryWords(entropy: Uint8Array): string[] {
  if (entropy.length !== 32) throw new Error('recovery entropy must be 32 bytes');
  return Array.from(entropy, (b) => RECOVERY_WORDS[b]);
}
```

Wrapping reuses the shared AES-GCM helpers:

```ts packages/core/src/keys.ts
export async function wrapPersonKey(personKey: Uint8Array, wrappingKey: Uint8Array): Promise<Uint8Array> {
  return aesGcmSeal(wrappingKey, personKey);
}
```

Shredding returns a new keyring:

```ts packages/core/src/keys.ts
export function shred(keyring: Record<string, Uint8Array>, personId: string): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const [id, key] of Object.entries(keyring)) {
    if (id !== personId) out[id] = key;
  }
  return out;
}
```

## Your turn: faulty first
**Scenario 1: the short word list.** I typed 248 words, then added 7 and believed I had 256. The test said `expected: 256 actual: 255`, and `unknown recovery word: undefined` for high bytes.
**Predict:** which bytes break? **Run it:** any byte at or above the list length. **Diagnose:** I counted by eye. **Fix:** assert length and uniqueness in a test, then add words until it passes.

**Scenario 2: mutating the keyring.** Using `delete keyring[id]` changes the caller's object; a caller who still holds the old keyring can still decrypt. Return a fresh object.

## Technical glossary
- **Entropy:** random bytes a key is made from.
- **Recovery words:** the entropy written as words.
- **Wrapping key:** a key that seals another key.
- **Keyring:** map of person id to wrapped key.
- **Crypto-shredding:** deleting a key so data cannot be read.

## Common questions
**Q: Why no checksum word?** The spec fixes one byte per word; a misspelt word already throws.
**Q: Does shredding delete the data?** No, it makes it unreadable.

## Reinforcement activity
Write a test that seals a string with a person key, shreds the person, and shows no key remains to open it.

## Check yourself
1. How many words represent 32 bytes?
<details>32, one per byte.</details>
2. What happens with the word "zzzz"?
<details>wordsToEntropy throws unknown recovery word.</details>
3. Does shred change the keyring you pass in?
<details>No, it returns a new object.</details>

## Quick reference
recoveryWords, wordsToEntropy, wrapPersonKey, unwrapPersonKey, shred.

## Connection to the bigger picture
Learner erasure (F-24) and recovery (F-20) both depend on this.

## Next

Next: [MS 4.1 — Teleprompter pacing and script parsing](../ms-04.01/lesson.md).
