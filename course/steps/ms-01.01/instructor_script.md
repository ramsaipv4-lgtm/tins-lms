# Say/Do script — Core scaffold, shared byte helpers, feature switches, version compat

**Total runtime: 50 minutes**

---

## ## Introduction (0:00 — 0:05) [5 min]

**Say:**
"Today we're building the three foundational systems that every other module in Coach LMS depends on. By the end of this lesson, you'll understand how we use Web Crypto for authenticated encryption, how we gate phase-2 features with a layered switch system, and how we handle version mismatches between clients and the hub."

**Do:**
- Show the lesson's Detective question on screen
- Highlight the three SPEC requirements:
  - D-3: zero runtime dependencies except ts-fsrs
  - D-26: AES-GCM with fresh IV per message
  - D-23: schema version compatibility

---

## ## Crypto helpers: Building with Web Crypto (0:05 — 0:20) [15 min]

**Say:**
"Let's start with util.ts. We're wrapping the platform's Web Crypto API—it's built into Node and all modern browsers, and it's designed for security-sensitive code.

The module gives us eight groups of helpers:
1. **UTF-8:** text to and from bytes (JavaScript's built-in TextEncoder/Decoder)
2. **Hex:** for human-readable values like git shas
3. **Base64:** for JSON payloads and the web
4. **SHA-256 hashing:** produces a 64-character hex string (async)
5. **HMAC-SHA-256:** authenticated hashing with a key (used in attendance codes and certificate IDs)
6. **HKDF:** key derivation (used to generate per-section encryption keys)
7. **AES-GCM:** authenticated encryption (seals learner profiles and sections)
8. **Canonical JSON:** sorted keys, no whitespace (critical for ledger hashing)

All operations are async because Web Crypto runs safely on a background thread."

**Do:**
- Show the aesGcmSeal function code (lesson Walkthrough)
- Highlight: `globalThis.crypto.getRandomValues(new Uint8Array(12))` — fresh random IV every call
- Point out: IV is front-loaded in the output (first 12 bytes), then ciphertext, then the 16-byte GCM tag
- Show a test: seal the same plaintext twice, verify different outputs
- Run `npm test -- packages/core/test/util.test.mjs` to show 23 passing tests

**Ask the learner:** "What would happen if we used a static IV instead of a random one?"
(Expected answer: repeated plaintext → repeated ciphertext; an observer detects repetition.)

---

## ## Feature switches: Layered precedence (0:20 — 0:30) [10 min]

**Say:**
"Next: switches.ts. Phase-2 features like Jira, story mode, and calendar sync are in the code but off by default. The switch system has **four layers**:

1. **Defaults** (hardcoded): secretScan on, planVsActual off, etc.
2. **Org layer:** an administrator sets switches for the whole organization
3. **Program layer:** a trainer gates switches for one program (trial cohorts, for example)
4. **Class layer:** a trainer gates switches for one class

Precedence is simple: **class > program > org > default**. Each layer can veto the layers below it."

**Do:**
- Show switchDefaults() — the 18 defaults
- Show the isOn() function (lesson Walkthrough)
- Walk through an example:
  - Org says `pairProgramming: false`
  - Program says `pairProgramming: true`
  - Class doesn't set it
  - `isOn('pairProgramming', { org, program })` returns true (program overrides org)
- Show a test: change all three layers, verify the class layer wins
- Run `npm test -- packages/core/test/switches.test.mjs` to show 11 passing tests, including AC-49

---

## ## Version compatibility: The 2-version window (0:30 — 0:40) [10 min]

**Say:**
"Last: compat.ts. When a learner's phone and the hub have different schema versions, they need to decide whether to sync. The spec allows a **2-version tolerance**:

- Same version → sync (ok: true)
- Client 1–2 versions behind → upgrade on the hub (ok: true; the hub brings the client forward)
- Client 3+ versions behind → client must update the app (ok: false; too much has changed)
- Client ahead of the hub → hub must update (ok: false; the hub needs new code)

This balance trades off: we support old clients for a while, but not forever. Supporting 4+ old versions is too much maintenance."

**Do:**
- Show the canSync function
- Walk through the four cases:
  1. `canSync(5, 5)` → `{ ok: true, action: 'sync' }`
  2. `canSync(4, 5)` or `canSync(3, 5)` → `{ ok: true, action: 'upgrade-on-hub' }`
  3. `canSync(2, 5)` → `{ ok: false, action: 'update-app' }`
  4. `canSync(6, 5)` → `{ ok: false, action: 'update-hub' }`
- Highlight: `ok` is true only for sync and upgrade-on-hub
- Run `npm test -- packages/core/test/compat.test.mjs` to show 9 passing tests, including AC-50

---

## ## Walkthrough: A real use case (0:40 — 0:48) [8 min]

**Say:**
"Let's tie these together. Imagine a trainer uploads a new practice assignment (a sealed section). Here's what happens:

1. **util.ts:** The section is encrypted with AES-GCM. Each sealed section has a different ciphertext (fresh IV) even though the plaintext is identical.
2. **switches.ts:** The trainer has `jira` off for the class. Jira integrations are never shown, even though the code is there.
3. **compat.ts:** A learner on an old phone (schema v3) tries to sync with the hub (schema v5). canSync returns 'upgrade-on-hub'—the hub's replication code brings the phone's data forward without the app updating.

These three modules work invisible to the user, but they're running on every request."

**Do:**
- Show a code snippet that imports all three modules (from index.ts)
- Show a quick example ledger entry hash (uses sha256 and canonicalJson)
- Mention: "The next modules (rng, cards, catchup) will all import util.ts for hashing and crypto."

---

## ## Summary and questions (0:48 — 0:50) [2 min]

**Say:**
"Three modules:
- **util.ts:** Web Crypto helpers (no dependencies)
- **switches.ts:** Feature gates with class > program > org > default precedence
- **compat.ts:** Version compatibility with a 2-version window

Every other core module depends on these."

**Ask for questions.**
