# Recall — Core scaffold, shared byte helpers, feature switches, version compat

## Exercise 1 — Implement and test a crypto function (10 min)

**What to do:**
Write a TypeScript function `hmacSha256(key: Uint8Array, data: Uint8Array)` that computes a message authentication code. The function must:
1. Import a key using `globalThis.crypto.subtle.importKey`
2. Call `globalThis.crypto.subtle.sign` with the key and data
3. Return the signature as a Uint8Array

Then write two tests:
- Test 1: Same key and data → same signature (deterministic)
- Test 2: Different keys → different signatures (key-sensitive)

**The answer (check after):**

```ts
export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await globalThis.crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(signature);
}

// Tests
const sig1 = await hmacSha256(key, data);
const sig2 = await hmacSha256(key, data);
assert.deepEqual(sig1, sig2); // deterministic

const sig3 = await hmacSha256(differentKey, data);
assert.notEqual(hexEncode(sig1), hexEncode(sig3)); // key-sensitive
```

---

## Exercise 2 — Feature switch precedence (5 min)

**What to do:**
Given the layers:
- Defaults: `storyMode: false`, `githubPass: true`
- Org: `storyMode: true`, `jira: false`
- Program: `githubPass: false`
- Class: (not set)

For each query, predict the return value:
1. `isOn('storyMode', { class, program, org })`
2. `isOn('githubPass', { class, program, org })`
3. `isOn('jira', { class, program, org })`

**The answer (check after):**

1. `storyMode` = true
   - Org sets it to true (not overridden by program or class)
2. `githubPass` = false
   - Program sets it to false (overrides org's default, class not set)
3. `jira` = false
   - Org sets it to false (not overridden by program or class)

---

## Exercise 3 — Version compatibility decisions (5 min)

**What to do:**
A learner's phone has schema version X. The hub has schema version 5. For each X, what does `canSync(X, 5)` return, and is `ok` true or false?

1. X = 5
2. X = 4
3. X = 3
4. X = 2
5. X = 6

**The answer (check after):**

1. X = 5: `{ ok: true, action: 'sync' }`
2. X = 4: `{ ok: true, action: 'upgrade-on-hub' }` (client is 1 version behind)
3. X = 3: `{ ok: true, action: 'upgrade-on-hub' }` (client is 2 versions behind)
4. X = 2: `{ ok: false, action: 'update-app' }` (client is 3 versions behind; app must update)
5. X = 6: `{ ok: false, action: 'update-hub' }` (client is ahead; hub must update)

---

## Cards

**Q:** What is the IV in AES-GCM, and why must it be random?
**A:** The IV (Initialization Vector) is a random 96-bit (12-byte) nonce. It must be random and unique for each message to ensure that identical plaintexts produce different ciphertexts. Reusing the same IV with the same key breaks the security of GCM.

**Q:** Name the four layers of feature switches in order of precedence (highest to lowest).
**A:** 1. Class, 2. Program, 3. Org, 4. Defaults

**Q:** What does HKDF stand for, and when would you use it instead of HMAC?
**A:** HKDF is HMAC-based Key Derivation Function. Use HKDF when you need to **derive** multiple or longer keys from one master key (e.g., generating per-section encryption keys). Use HMAC when you need to **authenticate** a message with a shared key.

**Q:** Explain the 2-version compatibility window. Why allow 2 old versions but not 3?
**A:** A client can sync if it is at most 2 versions behind the hub. This balance allows a grace period for learners who don't update their app immediately, while preventing the system from supporting unbounded old versions. Supporting 3+ versions means writing compatibility code that scales with time; limiting to 2 keeps maintenance manageable.

**Q:** What is canonical JSON, and why is it important for ledger hashing?
**A:** Canonical JSON is JSON with sorted keys and no whitespace (e.g., `{"a":1,"b":2}` instead of `{ "b": 2, "a": 1 }`). It is important for ledger hashing because two people encoding the same data must produce identical bytes, so their SHA-256 hashes match. If key order varied, the hash chain would break.

**Q:** Why are all util.ts crypto operations async?
**A:** Web Crypto's operations (globalThis.crypto.subtle) are async because cryptographic operations can be computationally heavy and are often run on a background thread for security. Using async/await ensures the main thread isn't blocked.

**Q:** What happens if you call `isOn('unknownSwitch', {})`?
**A:** The function throws an error with the message "Unknown switch: unknownSwitch". This fail-fast design catches typos and ensures that only predefined switches in switchDefaults() are used.

**Q:** How does aesGcmSeal encode the IV in its output?
**A:** aesGcmSeal generates a random 12-byte IV and returns it **prepended** to the ciphertext. The output format is: [12-byte IV][ciphertext + 16-byte GCM tag]. When decrypting (aesGcmOpen), the first 12 bytes are extracted as the IV and used in the decryption call.

**Q:** If a learner's app is 5 versions behind the hub (schema v1 on phone, v6 on hub), what happens when they try to sync?
**A:** `canSync(1, 6)` returns `{ ok: false, action: 'update-app' }`. The learner must update their app before syncing. The hub cannot bring the phone forward when the gap is this large (more than 2 versions).
