---
id: ms-06.08
title: Sign-out, passkeys and the sign-in gate
module: 6
est_minutes: 45
prereqs: [ms-06.01]
objectives: 4
new_terms: 6
skills: [webauthn, challenge-response, ecdsa-verify, session-cookie]
source_refs: [{ path: packages/server/src/routes/accounts.ts, commit: c791c7e }]
next: ms-07.01
---

# MS 6.8 — Sign-out, passkeys and the sign-in gate
*Step 25 of 41*

## Prerequisites

You already understand:
- The shared `ctx`, session cookies and role guards from the server foundation
- That a public key checks a signature made by a private key (D-26, ECDSA P-256)
- What a nonce (a number used once) is

## You already understand this

- A door lock with a key you never hand over: the lock sends a random question, your key signs the answer, and the lock checks it with the public half
- A raffle ticket that is torn in half when used: a challenge works once only

## The detective question

**Problem:** Learners have no passwords and no SMS. They must still sign back in on a new day, and the server must be sure the person holds the key that was registered, without ever seeing a secret.

**Options considered:**
1. Keep a long-lived cookie and never ask again
2. A one-time code sent by SMS or email
3. WebAuthn passkeys: the server stores only a public key and checks an ECDSA signature over a fresh challenge

**Choice:** Option 3, attestation `none`, ES256 only, checked with Web Crypto and a tiny CBOR reader (SPEC §5.2, D-26). No new dependency.

**Why:** Nothing secret is stored or sent, so D-28 holds. A fresh challenge means a recorded login cannot be replayed. Options 1 and 2 need either a lasting secret or a channel (SMS) we ruled out.

## Learning objectives

After this step you will be able to:
1. Name the checks a passkey registration and a passkey sign-in must pass (challenge, origin, rpIdHash, flags, signature)
2. Explain why a challenge is removed before it is checked
3. Explain why a DER signature must become raw `r||s` for Web Crypto
4. Say why `/api/signin/*` needs its own mount in this build

## Conceptual understanding

`POST /api/passkeys/register/options` (session needed) returns a challenge. The browser makes a key pair and sends back `clientDataJSON` and an `attestationObject`. The server decodes the CBOR, reads `authData` (rpIdHash, flags, counter, credential id, COSE key), requires kty 2, alg -7, crv 1 and stores the public key as a JWK in the private database.

`POST /api/signin/passkey/options` (no session) returns a fresh challenge. `POST /api/signin/passkey` receives `authenticatorData`, `clientDataJSON` and a DER signature. The server verifies the signature over `authenticatorData` followed by SHA-256 of `clientDataJSON`, then creates the session cookie. `POST /api/signout` destroys it. `POST /api/signin/google` answers `501 not-configured` unless `LMS_GOOGLE_CLIENT_ID` is set.

Also in this step: `name` and `rollNumber` are optional on `POST /api/join`, and with `LMS_PSEUDO_LOCALE=1` the server injects `<meta name="lms-pseudo-locale" content="1">` into the HTML it serves.

## Walkthrough of the real code

### A challenge works once

```ts packages/server/src/routes/accounts.ts
  const consume = (challenge: string, purpose: Challenge['purpose']): Challenge => {
    const rec = challenges.get(challenge);
    challenges.delete(challenge);
    if (!rec || rec.purpose !== purpose) throw http.fieldError('challenge', 'unknown');
    if (rec.expires <= ctx.clock.now()) throw http.fieldError('challenge', 'expired');
    return rec;
  };
```

The challenge is deleted from the map before any test runs. A failed attempt therefore burns it too, so an attacker cannot keep guessing against one challenge. Expiry is five minutes on the injected clock, which is why a test can move time.

### From DER to raw

```ts packages/server/src/routes/accounts.ts
export function derToRaw(der: Uint8Array): Uint8Array {
  let p = 0;
  if (der[p++] !== 0x30) throw new Error('bad-der');
  if (der[p] & 0x80) p += der[p] & 0x7f;
  p += 1;
  const out = new Uint8Array(64);
  for (let i = 0; i < 2; i++) {
    if (der[p++] !== 0x02) throw new Error('bad-der');
    let len = der[p++];
    let start = p;
    p += len;
    while (len > 32 && der[start] === 0) { start++; len--; }
    if (len > 32) throw new Error('bad-der');
    out.set(der.slice(start, start + len), i * 32 + (32 - len));
  }
  return out;
}
```

Authenticators send an ASN.1 DER signature (two integers, with possible leading zero bytes). Web Crypto wants 64 bytes: r then s, each padded to 32.

### The signature check

```ts packages/server/src/routes/accounts.ts
    let ok = false;
    try {
      const key = await crypto.subtle.importKey('jwk', rec.publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const signed = new Uint8Array([...authData, ...(await sha256(clientDataJSON))]);
      ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(signature), signed);
    } catch { ok = false; }
    if (!ok) throw new http.ApiError(401, { error: { signature: 'invalid' } });
    if ((p.counter !== 0 || rec.counter !== 0) && p.counter <= rec.counter) throw new http.ApiError(401, { error: { counter: 'replayed' } });
```

Anything that throws counts as a failed check. The counter is stored so a cloned authenticator that replays an old counter is refused.

## Your turn: faulty first

**Mistake 1:** After SPEC made `name` optional on join, the older foundation test still asserted that an invalid join body reports a `name` error. The gate showed `assert.ok(invalid.json.error.name && invalid.json.error.tncVersion)` failing. Which side is wrong, the test or the code, and which file do you change first (AGENTS rule 2)?

**Mistake 2:** My pseudo-locale test said the page without the flag must not contain `lms-pseudo-locale`, but the real built `index.html` has a comment that mentions the meta tag. Predict why the test failed, and what else the same string search would have broken in the server.

**Mistake 3 (predict):** If the challenge were deleted only after a successful signature, what attack becomes possible?

## Technical glossary

- **Passkey:** a key pair held by the user's device, the server stores only the public half
- **Challenge:** random bytes the server asks to be signed, used once, valid 5 minutes
- **Attestation `none`:** the device does not prove which hardware made the key
- **COSE key:** the CBOR form of a public key; here kty 2, alg -7, crv 1, with x and y
- **authenticatorData:** rpIdHash, flags, counter, plus key data at registration
- **DER signature:** the ASN.1 form of an ECDSA signature

## Common questions

**Why not mount sign-in on the main app?** Its session gate lists `/api/sign-in`, not `/api/signin`, so it would answer 401; main.ts gives these routes their own small app.

**Why check the rpIdHash?** It ties the signature to this site, so a key used on another site cannot sign in here.

## Reinforcement activity

Write a software authenticator in a node test: make a P-256 key, build `authenticatorData` and `clientDataJSON`, sign, register, then sign in. Flip one byte of the signature and predict the status.

## Check yourself

1. **Why is the challenge removed before the signature is checked?**

<details>
So a failed attempt cannot be retried against the same challenge; every challenge is single use.
</details>

2. **What exactly is signed in a sign-in?**

<details>
`authenticatorData` followed by SHA-256 of `clientDataJSON`.
</details>

3. **Which status does `/api/signin/google` give with no Google client id?**

<details>
501 with `{ error: { code: 'not-configured' } }`.
</details>

4. **What happens to the counter check if both counters are zero?**

<details>
It is skipped, because many authenticators never count.
</details>

## Quick reference

```ts
POST /api/signout
POST /api/passkeys/register/options -> register
POST /api/signin/passkey/options -> signin/passkey
```

## Connection to the bigger picture

AC-62 says anonymous requests get 401 except health, join, sign-in and pairing claim; AC-81 is the learner join, now with optional name and roll number. Later web steps call these routes.

## Next

Before you continue, do [Checkpoint 3](../../checkpoints/checkpoint-3/checkpoint.md).

Next: [MS 7.1 — Web foundation](../ms-07.01/lesson.md).
