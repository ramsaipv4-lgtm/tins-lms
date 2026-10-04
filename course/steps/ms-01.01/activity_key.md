# Activity key — Core scaffold, shared byte helpers, feature switches, version compat

**Trainer-only. Answers to lesson activities and check-yourself questions.**

---

## Exercise 1 — Implement and test a crypto function

### Expected implementation

```ts
export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(signature);
}
```

### Test 1: Determinism

```ts
import { hmacSha256, hexEncode } from '../src/util.ts';

const key = utf8Encode('secret');
const data = utf8Encode('message');
const sig1 = await hmacSha256(key, data);
const sig2 = await hmacSha256(key, data);
assert.deepEqual(sig1, sig2);
assert.equal(sig1.length, 32); // SHA-256 is always 32 bytes
```

**Learner success indicators:**
- The function returns a Uint8Array
- Two calls with the same inputs produce identical results
- Signature length is 32 bytes

### Test 2: Key sensitivity

```ts
const key1 = utf8Encode('key1');
const key2 = utf8Encode('key2');
const data = utf8Encode('message');
const sig1 = await hmacSha256(key1, data);
const sig2 = await hmacSha256(key2, data);
assert.notEqual(hexEncode(sig1), hexEncode(sig2));
```

**Learner success indicators:**
- Changing the key produces a different signature
- The signature is completely different, not just one byte changed

### Common mistakes:
1. **Forgetting `await`:** Returns a Promise instead of Uint8Array
   - Fix: Make the function async and await both importKey and sign
2. **Using 'verify' instead of 'sign' in importKey's usages:** Web Crypto requires the right usage array
   - Fix: Pass `['sign']` as the last argument to importKey
3. **Returning the signature as-is from sign without wrapping in Uint8Array:** sign() returns an ArrayBuffer
   - Fix: Wrap with `new Uint8Array(...)`

---

## Exercise 2 — Feature switch precedence

### Expected answers

1. `isOn('storyMode', { class, program, org })`
   - **Answer: true**
   - **Reasoning:** The org layer sets storyMode to true. The program layer doesn't set it, and the class layer doesn't set it, so org's value wins.

2. `isOn('githubPass', { class, program, org })`
   - **Answer: false**
   - **Reasoning:** The program layer sets githubPass to false, which overrides the org layer's silence (org doesn't mention githubPass, so it falls through to program). The class layer is not set.

3. `isOn('jira', { class, program, org })`
   - **Answer: false**
   - **Reasoning:** The org layer sets jira to false. Program and class don't override it, so org's value wins.

### Common mistakes:
1. **Reversing the precedence:** Thinking "org overrides program" instead of "program overrides org"
   - Fix: Remember: class > program > org > defaults. Each layer is checked from highest to lowest.
2. **Assuming missing values use the default:** Forgetting that we must check all layers in order
   - Fix: Trace through the precedence carefully; if a layer doesn't set the switch, move to the next one.
3. **Returning defaults for switches the org didn't set:** If org doesn't mention a switch, check the next layer, not the default
   - Fix: The default is only used if all three layers omit the switch.

---

## Exercise 3 — Version compatibility decisions

### Expected answers

1. X = 5: `{ ok: true, action: 'sync' }`
   - **Reasoning:** Client and hub are the same version; they can sync normally.

2. X = 4: `{ ok: true, action: 'upgrade-on-hub' }`
   - **Reasoning:** Client is 1 version behind (within the 2-version window). The hub's replication code can bring the client forward.

3. X = 3: `{ ok: true, action: 'upgrade-on-hub' }`
   - **Reasoning:** Client is 2 versions behind (at the edge of the window, still allowed). The hub upgrades.

4. X = 2: `{ ok: false, action: 'update-app' }`
   - **Reasoning:** Client is 3 versions behind (outside the window). The app is too old to sync; the learner must update it.

5. X = 6: `{ ok: false, action: 'update-hub' }`
   - **Reasoning:** Client is ahead of the hub. The hub's code is too old to understand the client's messages; the hub must update.

### Common mistakes:
1. **Confusing the 2-version window with a symmetric window:** Thinking the hub can also be 2 versions behind
   - Fix: The window is one-sided: client can be 1–2 versions behind, but if the client is ahead, the hub must update immediately (no window).
2. **Returning `ok: true` for `update-hub`:** Forgetting that "ok" is true only for sync and upgrade-on-hub
   - Fix: The system can only proceed (ok: true) if no software update is required. update-app and update-hub both require an update.
3. **Off-by-one errors:** Thinking "3 versions behind is still OK" or "2 versions ahead is OK"
   - Fix: Carefully test boundary cases: X=3 with hub=5 should return update-app (3 ≠ 5, and 5 - 3 > 2).

---

## Check yourself: Expected answers

### Q1: True or false — If I seal the same plaintext twice with the same key, I get the same ciphertext.

**Answer: False**

**Explanation:** AES-GCM generates a random IV on each call. Even though the plaintext and key are identical, the random IV ensures the ciphertext is different. This is a security feature: an observer who sees two identical ciphertexts cannot conclude the plaintexts are identical.

**Learner success indicator:** Recognizes that randomness in the IV is intentional and necessary.

### Q2: Name the four layers of feature switches, in order of precedence.

**Answer: Class (highest), program, org, defaults (lowest)**

**Explanation:** The system checks in this order: Is the switch set at the class level? If not, check the program level. If not, check the org level. If not, use the default.

**Learner success indicator:** Can name the layers in the correct order and explain why precedence matters.

### Q3: A client is schema version 3; the hub is version 6. What action does `canSync` return, and is `ok` true?

**Answer: `canSync(3, 6)` returns `{ ok: false, action: 'update-app' }`. The `ok` field is false.**

**Explanation:** The client is 3 versions behind (6 - 3 = 3), which exceeds the 2-version tolerance. The client app must be updated before syncing. Because an update is required, `ok` is false.

**Learner success indicator:** Calculates the version gap correctly and applies the rule (≤ 2 is OK, > 2 requires update-app).

### Q4: Why does canonicalJson sort keys?

**Answer: So two people encoding the same data get identical JSON strings, which means their hashes match.**

**Explanation:** The ledger uses SHA-256 hashes to link entries together (a hash chain). If two people encode the same data in different key orders, their hashes would differ, breaking the chain. Sorting keys ensures consistency.

**Learner success indicator:** Understands that canonical form is essential for hash chains and data integrity, not just a formatting preference.

### Q5: What does "SPEC D-26" say, and why is it relevant here?

**Answer: D-26 says "Encryption: AES-GCM 256 with a fresh 96-bit IV per message." It's relevant because aesGcmSeal must generate a new random IV every call, never reuse.**

**Explanation:** The SPEC is the contract. D-26 is a design decision that mandates the IV approach. aesGcmSeal implements D-26 by calling `globalThis.crypto.getRandomValues(new Uint8Array(12))` on every call.

**Learner success indicator:** Can cite the SPEC decision and explain how the implementation satisfies it.

---

## Trainer notes

### Misconceptions to watch for:

1. **"Crypto is deterministic."** Many learners come from hashing backgrounds (md5, sha1 for checksums). AES-GCM includes randomness by design. Emphasize: the IV is not a bug, it's the point.

2. **"Switches are just booleans in a config file."** They are layered. A learner might think that org is "more important" than class because it affects the whole organization. Clarify: class overrides org because it's more specific.

3. **"Two versions behind is always safe."** They might ask, "Why not three?" The answer is maintenance cost and app deprecation cycles. Support four versions, and in three years you're supporting code from five years ago. Limit to two, and the oldest code you support is 18 months old.

### Depth levels for Q&A:

- **Shallow:** "What is the IV?" → "A random number used in encryption."
- **Deep:** "Why does the IV need to be random and unique?" → "Because GCM builds on the assumption that the IV is never reused with the same key. Reusing the IV breaks security."
- **Deepest:** "How does reusing the IV break GCM?" → "GCM is built on CTR mode, which XORs the plaintext with a derived keystream. If the keystream is the same (same IV + key), then `C1 XOR C2 = P1 XOR P2`, which leaks information about the plaintext."

Choose the level appropriate to your group's background.

### Pacing:

- Exercise 1 (implement hmacSha256): 10 minutes is tight if learners are new to Web Crypto. Offer a stub function to get them started.
- Exercise 2 (switch precedence): 5 minutes assumes learners read the lesson. If they skipped it, allow 10 minutes.
- Exercise 3 (version compat): 5 minutes is reasonable if learners understood the 2-version window concept. Highlight the boundary cases (X=3 and X=6).

### Assessment:

- **Correctness:** All three exercises should have correct answers.
- **Reasoning:** Ask a learner to explain why, not just state the answer.
- **Application:** Ask "What would change if the window were 3 versions instead of 2?" or "How would a learner experience the update-app action?"
