---
id: ms-01.01
title: Core scaffold, shared byte helpers, feature switches, version compat
module: 1
est_minutes: 50
prereqs: []
objectives: 3
new_terms: 6
skills: [core-crypto, feature-switches, version-compat]
source_refs: []
next: end
---

# MS 1.1 — Core scaffold, shared byte helpers, feature switches, version compat
*Step 1 of N*

## Prerequisites

You already understand:
- JavaScript's async/await syntax
- What a hash is (SHA-256, MD5)
- Basic cryptography concepts: encryption, authentication, keys
- TypeScript type syntax (Uint8Array, Record, Promise)

## You already understand this

- How the web (browsers) and Node.js both have APIs like fetch, globalThis, and Web Crypto
- Why randomness is important in cryptography (different output each time, unlike hashing)
- What a module is and why importing helps organize code

## The detective question

**Problem:** Coach LMS v1 needs three foundational systems: (1) crypto utilities for other core modules to use (SHA-256, HMAC, HKDF, AES-GCM), (2) a feature-switch mechanism to gate phase-2 features off in v1, and (3) version compatibility checking to handle schema upgrades gracefully.

**Options considered:**
1. Copy-paste crypto code into each module that needs it
2. Use a heavyweight crypto library (tweetnacl, libsodium) as a dependency
3. Build a centralized util.ts that wraps the platform's Web Crypto.subtle API, plus switches and compat modules

**Choice:** Option 3 — one util.ts with zero dependencies (Web Crypto is built into Node and browsers), one switches.ts module, one compat.ts module.

**Why:** This approach gives us:
- **Consistency:** every crypto call uses the same helpers and tests
- **Maintainability:** crypto algorithms live in one place; easier to update if needed
- **No new dependencies:** SPEC D-3 says core has zero runtime deps except ts-fsrs (D-3 reviewed)
- **Async by design:** Web Crypto is inherently async; we embrace that from the start

## Learning objectives

After this step, you will understand:
1. How Coach LMS wraps Web Crypto for consistent, testable byte operations
2. How feature switches stack with class > program > org > default precedence
3. How the version compatibility window (2 old versions allowed) shapes sync decisions

## Conceptual understanding

### Crypto helpers (util.ts)

Coach LMS encrypts learner data before it leaves the device. This module provides the low-level building blocks:

- **Text ↔ UTF-8 bytes:** `utf8Encode` and `utf8Decode` (JavaScript's built-in TextEncoder/Decoder)
- **Hex encoding:** `hexEncode` and `hexDecode` (for human-readable hashes, like git shas)
- **Base64 encoding:** `base64Encode` and `base64Decode` (for the web, JSON payloads)
- **Hashing:** `sha256(bytes)` returns the hex string (async); used in ledger chains and package verification
- **HMAC:** `hmacSha256(key, data)` for authentication (used in attendance codes, certificate ids)
- **HKDF:** `hkdfSha256(ikm, salt, info, length)` for key derivation (used to generate per-section keys)
- **AES-GCM:** `aesGcmSeal` and `aesGcmOpen` for authenticated encryption (used to seal learner profiles, sealed sections); IV is always 12 bytes and random
- **Canonical JSON:** `canonicalJson` produces sorted-key, zero-whitespace JSON (used for ledger hashing; order matters for verification)

All crypto operations use `globalThis.crypto.subtle` from Web Crypto (async). No randomness, clock reads or side effects—time and secrets are passed as arguments.

### Feature switches (switches.ts)

Phase-2 features (Jira, story mode, calendar sync, etc.) are built into v1 but switched off by default. The switch system has **three layers**:

1. **Defaults** (built-in): `secretScan` on, `planVsActual` off, etc.
2. **Org layer:** overrides defaults for the whole organization
3. **Program layer:** overrides org for one program (e.g., trial cohorts might test story mode)
4. **Class layer:** overrides program for one class (e.g., one trainer uses pair programming)

Precedence: class > program > org > default.

Unknown switch names throw an error (good for catching typos).

### Version compatibility (compat.ts)

When a client and hub have different schema versions, they need to decide what to do. The system tolerates a **2-version gap**:

- Client and hub same version → `sync` (ok: true)
- Client 1–2 versions behind → upgrade on hub (`upgrade-on-hub`, ok: true)
- Client 3+ versions behind → client must update app (`update-app`, ok: false)
- Client ahead of hub → hub must update (`update-hub`, ok: false)

## Walkthrough of the real code

### util.ts: AES-GCM encryption

The `aesGcmSeal` function encrypts a plaintext and returns the sealed output (IV + ciphertext + tag). Key design decisions:
- **Fresh random IV every call:** Each encryption generates a new 12-byte random IV
- **IV front-loaded:** The IV is prepended to the output, so decryption knows which IV was used
- **Async operation:** Uses Web Crypto, which runs safely on a background thread
- **Web Crypto details:** imports the key, calls encrypt with GCM mode, returns the result

The `aesGcmOpen` function decrypts by extracting the IV from the first 12 bytes and passing it to the decrypt operation. If the key is wrong or the data is tampered with, an error is thrown.

### switches.ts: Precedence example

The `switchDefaults` function returns a Record of 18 boolean switches (secretScan on, planVsActual off, etc.). The `isOn` function implements layered precedence:

1. Check if the switch name exists in defaults; throw if unknown (catches typos)
2. Check the class layer; if set, return that value
3. Check the program layer; if set, return that value
4. Check the org layer; if set, return that value
5. Return the default value

Why this order? Because class is most specific (one learner's class), program is broader (all learners in one program), org is broadest (the whole organization), and defaults are the fallback. Each layer can override the ones below it.

## Your turn: faulty first

**Scenario 1: The IV that repeats**

A learner writes AES-GCM encryption like this:

```ts
const iv = new Uint8Array(12).fill(0); // static IV!
const ciphertext = await globalThis.crypto.subtle.encrypt(
  { name: 'AES-GCM', iv: iv },
  cryptoKey,
  plaintext
);
```

**Predict:** What goes wrong?
**Run it:** Same plaintext, same IV, same key → always the same ciphertext. An observer can detect repeated messages.
**Diagnose:** Reusing IVs breaks the one-time-pad assumption of GCM. The spec demands a "fresh 96-bit IV per message" (D-26).
**Fix:** Use `globalThis.crypto.getRandomValues(new Uint8Array(12))` every time.

---

**Scenario 2: The forgotten precedence**

A learner implements switches like this:

```ts
export function isOn(name: string, layers: any): boolean {
  return (layers.org && layers.org[name]) ?? 
         (layers.program && layers.program[name]) ?? 
         (layers.class && layers.class[name]) ?? 
         switchDefaults()[name];
}
```

**Predict:** What goes wrong?
**Run it:** A learner in a class where `pairProgramming` is true (class layer), but the org set it to false (org layer), sees `pairProgramming` on (because org is checked first).
**Diagnose:** The precedence is backwards. Class should override org, not vice versa.
**Fix:** Flip the order: `class > program > org > default`.

## Technical glossary

- **Web Crypto API:** The platform's built-in crypto (globalThis.crypto.subtle). Async, no dependencies.
- **IV (Initialization Vector):** A random value that makes each encryption unique, even for identical plaintexts. GCM's IV is 96 bits (12 bytes).
- **HMAC (Hash-based Message Authentication Code):** A keyed hash that proves a message is authentic (you have the key iff you can produce the same HMAC).
- **HKDF (HMAC-based Key Derivation Function):** Stretch a short key into a longer one, or derive multiple keys from one master key (without using randomness).
- **Canonical JSON:** JSON with sorted keys and no whitespace. Ensures two people encoding the same data get identical bytes, so hashes match.
- **Schema version:** A number in a document that says "I was written by code version N". A large gap between client and hub means the client is too old to understand the hub's data.

## Common questions

**Q: Why is aesGcmSeal async but canonicalJson is sync?**
A: Web Crypto is inherently async (crypto operations can be slow). canonicalJson just rearranges and stringifies — no crypto, so it can be sync.

**Q: What happens if I try `isOn('unknownSwitch', {})`?**
A: It throws. The builder designed it that way to catch typos early. If you need a new switch, add it to `switchDefaults()` first.

**Q: How many versions back can a client fall behind?**
A: Two. The third version back requires an app update. This balance trades backward compatibility against the pain of supporting 4+ old versions.

## Reinforcement activity

### Part 1: Implement a crypto function

Write your own `hmacSha256` test (you can copy the pattern from the real tests). Verify:
1. Same key and data → same signature
2. Different keys → different signatures
3. Signature is 32 bytes

### Part 2: Feature switch decision tree

You are given:
- Org: `jira: false`
- Program: `jira: true`
- Class: (not set)

**Question:** What does `isOn('jira', { org, program })` return?
**Answer:** true. Program overrides org.

## Check yourself

1. **True or false:** If I seal the same plaintext twice with the same key, I get the same ciphertext.
   <details>False. The IV is random, so even identical inputs produce different sealed outputs.</details>

2. **Name the four layers of feature switches, in order of precedence.**
   <details>Class (highest), program, org, defaults (lowest).</details>

3. **A client is schema version 3; the hub is version 6. What action does `canSync` return, and is `ok` true?**
   <details>`update-app` (client is 3 versions behind, more than the 2-version window), and `ok: false` (the client cannot proceed without an app update).</details>

4. **Why does canonicalJson sort keys?**
   <details>So two people encoding the same data get identical JSON strings, which means their hashes match. This is critical for the ledger's hash chain: if order varies, the hash chain breaks.</details>

5. **What does "SPEC D-26" say, and why is it relevant here?**
   <details>D-26 says "Encryption: AES-GCM 256 with a fresh 96-bit IV per message." It's relevant because aesGcmSeal must generate a new random IV every call, never reuse.</details>

## Quick reference

```ts
// Crypto
const bytes = utf8Encode('text');
const hex = hexEncode(bytes);
const b64 = base64Encode(bytes);
const hash = await sha256(bytes);
const sig = await hmacSha256(key, data);
const key32 = await hkdfSha256(ikm, salt, info, 32);
const sealed = await aesGcmSeal(key, plaintext);
const plaintext = await aesGcmOpen(key, sealed);
const json = canonicalJson({ b: 2, a: 1 }); // '{"a":1,"b":2}'

// Switches
const defaults = switchDefaults();
const on = isOn('secretScan', { class: { secretScan: false } }); // false

// Compat
const decision = canSync(3, 5); // { ok: true, action: 'upgrade-on-hub' }
```

## Connection to the bigger picture

These three modules form the foundation that every other core module builds on:
- **util.ts** provides crypto building blocks for sealed sections (§4.7), ledger hashing (§4.9), pairing (§4.6), and package signatures (§4.24).
- **switches.ts** controls which phase-2 features are visible (SPEC §0, D-38).
- **compat.ts** gates sync decisions when clients and hubs are out of version sync (SPEC D-23, §5.6).

Without these three, the rest of the system cannot run.

## Next

This is the first step of the core logic rebuild. Next (later tasks): seeded randomness, cards and spaced repetition, catch-up gate, graded timing.
