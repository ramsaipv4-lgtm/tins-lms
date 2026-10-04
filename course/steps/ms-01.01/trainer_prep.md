# Trainer prep — Core scaffold, shared byte helpers, feature switches, version compat

## Before you start (prerequisites)

Learners should be familiar with:
- **Node.js and TypeScript:** can read async/await and simple type signatures
- **Web APIs:** have heard of globalThis, understand that browsers and Node both have Web APIs
- **Hashing:** know that SHA-256 takes input bytes and produces a fixed-size digest
- **Basic cryptography terminology:** know what "encryption" and "authentication" mean at a high level

If any learner is new to async/await, spend 5 minutes on the difference between sync and async functions before diving into the crypto helpers.

---

## 45-minute self-study path

### 1. Read the lesson (15 minutes)
- **Conceptual understanding** section: focus on the three groups (util, switches, compat)
- **Walkthrough of the real code** section: read each code snippet and understand the comments
- **Technical glossary** section: note the terms you'll explain to learners

### 2. Run the tests (10 minutes)
```bash
npm test -- packages/core/test/util.test.mjs
npm test -- packages/core/test/switches.test.mjs
npm test -- packages/core/test/compat.test.mjs
```
Watch all 43 tests pass. Look at one test file to understand the test structure (assertion patterns, async handling).

### 3. Trace one code path (15 minutes)
- Pick a learner scenario: "A trainer seals a new section for the class."
- Trace which functions are called:
  - aesGcmSeal() is called with the section plaintext
  - Inside, globalThis.crypto.getRandomValues() generates a fresh IV
  - The result is IV + ciphertext + 16-byte tag
  - This sealed section is stored in the class database
- Understand: Why randomness? Why is the IV included in the output?
- Understand: Where do other modules call into util.ts? (Hint: search for `await sha256` or `await hmacSha256` in other test files.)

### 4. Set up your examples (5 minutes)
- Open the instructor script (say/do outline)
- Prepare to show the aesGcmSeal code and run a test live
- Prepare the feature switch examples (org, program, class)
- Prepare the version compat examples (X=2,3,4,5,6 with hub=5)

---

## Worked example → faded example

### Worked Example 1: Async crypto in action

**Full version (trainer explains every step):**

```ts
// A learner's profile is sealed before it leaves the device
const profilePlaintext = new TextEncoder().encode(JSON.stringify({
  personId: "alice",
  notes: "Coach observation: struggles with recursion"
}));

const key = new Uint8Array(32).fill(42); // In real code, this is derived with HKDF

// Seal the profile
const sealed = await aesGcmSeal(key, profilePlaintext);

console.log('Original bytes:', profilePlaintext.length);
console.log('Sealed bytes:', sealed.length); // 32 + plaintext + 16 (tag)
console.log('First 12 bytes (IV):', hexEncode(sealed.slice(0, 12)));

// To decrypt: extract the IV, pass to aesGcmOpen
const decrypted = await aesGcmOpen(key, sealed);
console.log('Decrypted matches:', areEqual(decrypted, profilePlaintext));
```

**Learner questions at each step:**
- "Why does the sealed output have 48 bytes when the plaintext has 20? What are the 12 extra bytes? The 16 after that?"
- "What happens if we change one byte of the sealed output and try to decrypt?"
- "Could we reuse the same IV? Why or why not?"

**Faded version (learner fills in blanks):**

```ts
const profilePlaintext = utf8Encode(JSON.stringify({ personId: "alice", ... }));
const key = new Uint8Array(32).fill(42);

// TODO: seal the profile with aesGcmSeal
const sealed = await ___________(____, ________);

console.log('Sealed bytes:', sealed.length);

// TODO: extract the IV and decrypt
const decrypted = await aesGcmOpen(____, sealed);
```

**Learner success:** Can fill in the blanks and explain why sealed.length ≠ profilePlaintext.length.

---

### Worked Example 2: Feature switch traversal

**Full version (trainer explains the precedence):**

```ts
const defaults = switchDefaults(); // { jira: false, storyMode: false, ... }

const org = { jira: true, secretScan: false };
const program = { jira: false };
const classLayer = {}; // empty

console.log(isOn('jira', { org, program, class: classLayer })); // false
// Why false? Check class (no), check program (yes: false), return false
// program overrides org

console.log(isOn('storyMode', { org, program, class: classLayer })); // false
// Why false? Check class (no), check program (no), check org (no), return defaults (false)
```

**Learner questions:**
- "What if program hadn't set jira? Would it use org's value?"
- "Why does class override program even though program affects more learners?"
- "What would happen if I call `isOn('unknown', ...)`?"

**Faded version:**

```ts
const org = { jira: true };
const program = { jira: false };

// Fill in the expected results and explain why:
isOn('jira', { org, program, class: {} }); // _____ because _____
isOn('storyMode', { org, program, class: {} }); // _____ because _____
```

---

## Top misconceptions

### Misconception 1: "The IV doesn't matter; it's random noise."

**What learners think:** The IV is just a random number added for padding or complexity.

**Reality:** The IV is critical. Using the same IV + key twice means the GCM keystream is identical, so `C1 XOR C2 = P1 XOR P2`, leaking information about the plaintext. The IV must be random and unique for each message.

**How to address it:** Show a concrete example:
- Seal "alice" twice with the same key. The outputs differ (different IVs).
- Explain: An attacker who sees two ciphertexts cannot tell if the plaintexts are the same. This is intentional.
- Ask: "What would happen if we used a static IV like `new Uint8Array(12)`?" (Answer: Same plaintext → same ciphertext every time, which leaks information.)

### Misconception 2: "The switch system is just a set of booleans in a config file; why is precedence complicated?"

**What learners think:** Switches are global configuration; all learners in the org see the same switches.

**Reality:** Switches are layered. A trainer for one class can enable a feature for that class, even if the org disabled it. This flexibility is why precedence matters.

**How to address it:** Use a concrete example:
- "The org disables pair programming because most trainers aren't ready."
- "But the trainer for Monday's class wants to try it. They can enable it at the class level."
- "Learners in Monday's class see pair programming enabled, because class overrides org."
- "Learners in Tuesday's class (where the trainer didn't change it) see it disabled."

### Misconception 3: "If the client is 2 versions behind, the hub can always upgrade it."

**What learners think:** The 2-version window is symmetric; the hub can also be 2 versions behind.

**Reality:** The window is one-sided. A client can be up to 2 versions behind and still sync. But if the client is ahead, the hub has no window; it must update immediately.

**How to address it:** Show all four cases:
- Client == hub: sync
- Client 1–2 behind: upgrade-on-hub (ok: true)
- Client 3+ behind: update-app (ok: false)
- Client ahead: update-hub (ok: false, no window)

---

## Questions students will ask (with answers)

### "Why don't we just use OpenSSL or another library instead of Web Crypto?"

**Answer:** D-3 says core has zero runtime dependencies. Web Crypto is built into Node 22+ and all browsers, so we have it "for free." Using a library like OpenSSL adds a dependency, a security surface, and complexity. We prefer the platform's built-in crypto.

### "What if the IV happens to be the same as the one I generated last time?"

**Answer:** Theoretically possible but astronomically unlikely. The IV is 96 bits (2^96 possibilities). Generating a million IVs per second, you'd expect a collision after about 1 trillion years. In practice, the CSPRNG (cryptographically secure random generator) ensures uniqueness for any reasonable timeline.

### "Can I export the canonicalJson output as my JSON?"

**Answer:** canonicalJson is for hashing and verification (when order matters). For human-readable JSON, use JSON.stringify. They're semantically equivalent but look different: canonicalJson sorts keys and removes whitespace.

### "What if I need a new feature switch? Do I have to change every layer?"

**Answer:** No. Add the switch to `switchDefaults()` with its default value. Org, program, and class layers override only the switches they mention. Unknown switches throw an error (to catch typos), but missing switches fall through to the default.

### "How long does a hub have to support old clients?"

**Answer:** The system supports clients up to 2 versions behind. This is typically 6–12 months of app releases (depending on release cadence). If you're supporting quarterly releases, it's about 2 releases back.

---

## Your mastery check (private)

Before teaching, verify you can answer these without looking at the code:

1. **AES-GCM:** What are the three components of the sealed output? (IV, ciphertext, tag) What size is each?
   - IV: 12 bytes (always)
   - Ciphertext: same size as plaintext
   - Tag: 16 bytes (always)

2. **Switches:** Draw the precedence diagram:
   - Class > Program > Org > Defaults
   - Each layer overrides the ones below it.

3. **Version compat:** What is the rule?
   - Client can be ≤ 2 versions behind and sync (with upgrade-on-hub action).
   - Client 3+ behind: must update app (ok: false).
   - Client ahead: hub must update (ok: false).

4. **Canonical JSON:** Why does it need sorted keys?
   - For hash chains: two people encoding the same data must produce identical JSON, so their SHA-256 hashes match.

5. **Import and usage:** Which util.ts functions are async?
   - sha256, hmacSha256, hkdfSha256, aesGcmSeal, aesGcmOpen (all crypto operations)
   - Sync: utf8Encode/Decode, hexEncode/Decode, base64Encode/Decode, canonicalJson

If you struggled with any of these, re-read the lesson and run the tests again before teaching.
