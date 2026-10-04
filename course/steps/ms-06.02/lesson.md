---
id: ms-06.02
title: Pairing, devices, attendance
module: 6
est_minutes: 45
prereqs: []
objectives: 3
new_terms: 6
skills: [one-time-codes, device-revocation, rotating-code-verification]
source_refs: [{ path: packages/server/src/routes/pairing.ts, commit: 8970f8bb537d9814580216136512c2c5c0fdf66a }, { path: packages/server/src/routes/attendance.ts, commit: 8970f8bb537d9814580216136512c2c5c0fdf66a }]
next: end
---

# MS 6.2 — Pairing, devices, attendance

*Step 2 of N*

## Prerequisites

You already understand:
- Status codes and cookies (step ms-06.01)
- What a pure function is: same inputs, same output, nothing mutated

## You already understand this

- A hotel key card handed over once at the desk: the pairing code works one time, then it is spent
- A bus ticket checked by the conductor: a rotating code proves you are in the room now

## The detective question

**Problem:** A trainer must connect a learner's phone to the hub without passwords, and must know who is really in the room. Codes can leak, so a code that works forever, or twice, is a hole.

**Options considered:**
1. A long-lived shared class password for pairing and attendance
2. One-time pairing codes (5 minutes) plus a rotating 6-digit attendance code, with the decisions made by core functions and the server only storing state
3. Trusting the learner's device to say "I am present"

**Choice:** Option 2. `issuePairing` and `claimPairing` return a new state each call; the server keeps that state in the private database. `verifyAttendanceCode` accepts the current and previous minute only.

**Why:** Core stays pure and testable (D-22). A spent code answers `used`, a late one `expired`. A printed fallback code exists for a dead projector, but it records `verified: false` so the coach can tell the difference.

## Learning objectives

After this step you will be able to:
1. Explain why pairing claims are serialised and codes are stored only as hashes
2. Say which status a used, expired and unknown code each get (AC-65)
3. Explain why the printed attendance code gives `verified: false` (AC-66)

## Conceptual understanding

`POST /api/pairing` (trainer) makes an 8-character code and returns it with a QR payload: hub id, the address the request came in on, and the CA fingerprint from step ms-06.01. `POST /api/pairing/claim` needs no session (the code is the credential) and gives back a device session. `DELETE /api/devices/:deviceId` marks the device revoked and removes every session carrying that device id, so its next request is `401`.

Each class has a random secret kept in the private database. `GET /api/classes/:id/attendance-code` returns the rotating code and the seconds left. A learner posts it; the server checks enrolment, verifies, and writes `attendance:<person>-<day>`. Rotating codes are 6 digits and printed codes 8 digits, so the two never get confused.

## Walkthrough of the real code

### Claiming a code once

```ts packages/server/src/routes/pairing.ts
    const out = await serial(async () => {
      const { doc, state } = await loadState();
      const r = claimPairing(state, hash, b.deviceId, now);
      if (r.result !== 'ok') return { result: r.result, bind: null as any };
      await store.put(store.priv, { ...doc, id: STATE_ID, type: 'pairingState', state: r.state });
      return { result: 'ok', bind: doc?.bind?.[hash] ?? {} };
    });
```

Everything inside `serial` runs one at a time, so two claims of the same code cannot both read "unclaimed". `claimPairing` is the pure core function; the server only loads and saves its state.

### Rotating or printed

```ts packages/server/src/routes/attendance.ts
    let method: 'rotating' | 'printed' | null = null;
    let dayIndex = await todayIndex(db, now);
    if (/^\d{6}$/.test(b.code) && await verifyAttendanceCode(b.code, secret, now, PERIOD_SEC)) {
      method = 'rotating';
    } else if (/^\d{8}$/.test(b.code)) {
      const candidates = b.day !== undefined ? [b.day] : [dayIndex];
      for (const d of candidates) if (b.code === await printedCode(key, d)) { method = 'printed'; dayIndex = d; }
    }
    if (!method) throw http.fieldError('code', 'invalid', 400);
```

## Your turn: faulty first

No command failed while building this task: the code and tests passed the gate on the first run. So there is no real mistake to replay; this is a design hazard we avoided on purpose, and the journal says so.

**Hazard:** Remove the `serial` wrapper. Two phones claim the same code in the same instant. Predict what each gets back, then explain why the pure core function alone does not prevent it (hint: both read the old state before either saves).

## Technical glossary

- **One-time code:** a credential that works for one claim only
- **TTL:** time to live; pairing codes live 5 minutes
- **QR payload:** hub id, address and CA fingerprint a phone needs to trust the hub
- **Device session:** a session that carries a device id so it can be revoked
- **Rotating code:** a 6-digit code that changes every 60 seconds
- **Verified:** true only when the rotating code was used

## Common questions

**Why is the pairing code stored hashed?** A copy of the private database should not hand out working codes.

**Why does the previous minute still count?** A learner who reads the code at second 59 would otherwise fail.

## Reinforcement activity

Predict, then run: issue a code, claim it twice, move the test clock 6 minutes and claim a fresh one. Write the three statuses.

## Check yourself

1. **Which status does a used code get, and an expired one?**

<details>
409 for used, 410 for expired (404 for unknown); the body names the word.
</details>

2. **What happens to a device's next request after DELETE /api/devices/:id?**

<details>
Its sessions are removed, so it gets 401.
</details>

3. **Why does the printed code record verified false?**

<details>
Anyone with a photo of the printed code can use it, so it proves less than the live code.
</details>

## Quick reference

```ts
const r = claimPairing(state, hash, deviceId, now); // { state, result }
```

## Connection to the bigger picture

Pairing feeds the hub path in the first-run journeys; attendance verified flags feed the at-risk digest later.

## Next

[Next step — fill in when sequences are known]
