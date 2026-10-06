---
id: ms-03.01
title: Rotating attendance code, pairing codes, certificate ids
module: 3
est_minutes: 40
prereqs: [ms-01.01]
objectives: 3
new_terms: 6
skills: [hotp-codes, immutable-state, keyed-ids]
source_refs: [{ path: packages/core/src/attendance.ts, commit: 31ac940a3b80ae74f9b54663ff5bba3f816fcc26 }, { path: packages/core/src/pairing.ts, commit: 31ac940a3b80ae74f9b54663ff5bba3f816fcc26 }, { path: packages/core/src/certificate.ts, commit: 31ac940a3b80ae74f9b54663ff5bba3f816fcc26 }]
next: ms-03.02
---

# MS 3.1 — Rotating attendance code, pairing codes, certificate ids
*Step 6 of 42*

## Prerequisites

- Async/await and `Uint8Array` in TypeScript
- What an HMAC is (step ms-01.01 shows `hmacSha256`)
- Spread syntax for copying objects

## You already understand this

- A phone authenticator app shows a 6-digit code that changes every 30 seconds. Attendance codes work the same way.
- A one-time ticket can be used once, and stops working after a deadline.
- A signed receipt can be checked by anyone holding the key.

## The detective question

**Problem:** A trainer shows a code on the projector so learners can prove they are in the room. The code must change, be checkable offline, and not be reusable later. Devices also need one-time pairing codes, and finished programs need certificate ids that cannot be forged.

**Options considered:**
1. Store every issued attendance code in a table and look it up.
2. Derive the code from a shared secret and the current time period (HOTP style), and accept the current and previous period.
3. Use random codes and trust the learner's clock.

**Choice:** Option 2 for attendance. Pairing uses an immutable state object. Certificate ids are an HMAC cut to 12 Crockford base32 characters.

**Why:** Derived codes need no storage and work offline; accepting one previous period covers a learner typing at the boundary. Core may not read the clock (SPEC section 2), so `now` is an argument everywhere.

## Learning objectives

1. Compute a 6-digit HOTP-style code from a secret and a time counter.
2. Model one-time claims as pure functions that return new state.
3. Build a deterministic, verifiable id from an HMAC.

## Conceptual understanding

The counter is `floor(now / 1000 / periodSec)`, written as 8 big-endian bytes. HMAC-SHA-256 of those bytes gives 32 bytes. The last nibble picks an offset; four bytes from there, with the top bit cleared, become a number; modulo 1,000,000 and left-padded with zeros gives the code.

Pairing state is a record of codes, each with an expiry and who used it. `issuePairing` and `claimPairing` return new objects and never change their input, so a caller can keep the old state for undo or tests.

A certificate id is `HMAC(secret, canonicalJson({issuedAt, personId, programId, v}))`, and the first 60 bits are written as 12 characters of Crockford base32 (no I, L, O, U). Verification recomputes and compares in constant time.

## Walkthrough of the real code

Verification accepts exactly two counters.

```ts packages/core/src/attendance.ts
export async function verifyAttendanceCode(
  code: string,
  secret: Uint8Array,
  now: number,
  periodSec: number = 60,
): Promise<boolean> {
  const counter = counterAt(now, periodSec);
  const current = await codeForCounter(secret, counter);
  const previous = await codeForCounter(secret, counter - 1);
  return code === current || code === previous;
}
```

Claiming a pairing code checks unknown, then used, then expired, and only then writes a new state.

```ts packages/core/src/pairing.ts
export function claimPairing(
  state: PairingState,
  code: string,
  deviceId: string,
  now: number,
): { state: PairingState; result: PairingResult } {
  const entry = Object.prototype.hasOwnProperty.call(state.codes, code) ? state.codes[code] : undefined;
  if (!entry) return { state, result: 'unknown' };
  if (entry.usedBy !== null) return { state, result: 'used' };
  if (now >= entry.expiresAt) return { state, result: 'expired' };
  return {
    state: { codes: { ...state.codes, [code]: { expiresAt: entry.expiresAt, usedBy: deviceId } } },
    result: 'ok',
  };
}
```

The `hasOwnProperty` check matters: a plain lookup of `"toString"` would find an inherited function and not report `unknown`.

## Your turn: faulty first

Three real mistakes from the build journal. Find the bug before reading the fix.

1. A test computed the code with the default period, then verified it with `periodSec` 120. Result: `false !== true`. Fix: pass `p` to both calls.
2. A `sed` that added `, p` to every line ending in `attendanceCode(secret, t);` also changed the AC-11 test where `p` does not exist. Result: `ReferenceError: p is not defined`. Fix: revert that one line.
3. `node --test packages/core/test/` (a directory) failed with a test failure on the folder itself. Fix: pass the glob `packages/core/test/*.test.mjs`.

## Technical glossary

- **HOTP:** counter-based one-time password (RFC 4226).
- **Dynamic truncation:** picking 4 bytes of the MAC at an offset given by its last nibble.
- **Period:** the length of time one code stays valid, 60 seconds by default.
- **TTL:** time to live; how long a pairing code can be claimed.
- **Crockford base32:** a base32 alphabet without look-alike letters.
- **Constant-time compare:** comparing without stopping at the first difference.

## Common questions

**Q: Why accept the previous period?** A: A learner may read the code just before it rolls over.

**Q: Why not mutate the pairing state?** A: Pure functions are easy to test and to replay.

## Reinforcement activity

Change `periodSec` to 120 in a scratch script and print the code at three times within one period and one time in the next.

## Check yourself

1. How many periods does verification accept?
<details>Two: the current and the previous.</details>
2. What does `claimPairing` return for a code that was never issued?
<details>`unknown`, with the state returned unchanged.</details>
3. Why are leading zeros kept in the attendance code?
<details>The code is a string of exactly 6 digits; a number would lose them.</details>
4. Why is the certificate id deterministic?
<details>It is an HMAC of fixed inputs, so the same inputs and secret always give the same id and anyone with the secret can verify it.</details>

## Quick reference

- `attendanceCode(secret, now, periodSec = 60)`
- `verifyAttendanceCode(code, secret, now, periodSec = 60)`
- `issuePairing(state, code, now, ttlMs = 300000)`, `claimPairing(state, code, deviceId, now)`, `emptyPairingState()`
- `certificateId(secret, personId, programId, issuedAt)`, `verifyCertificateId(id, ...)`

## Connection to the bigger picture

The server's attendance and pairing routes (SPEC 5.3, 5.4) call these functions with the server clock.

## Next

Next: [MS 3.2 — Section keys and teleprompter-paced release](../ms-03.02/lesson.md).
