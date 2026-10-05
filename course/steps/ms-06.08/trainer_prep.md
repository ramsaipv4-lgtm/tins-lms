# Trainer prep — Sign-out, passkeys and the sign-in gate

## Before you start (prerequisites)

Learners should have finished ms-06.01 (ctx, guards, test mode). Have `packages/server/test/signin.test.mjs` open: it contains the software authenticator.

## 45-minute self-study path

1. Read the Detective question (5 min)
2. Study the three code excerpts (15 min)
3. Do Faulty first (10 min)
4. Reinforcement activity (8 min)
5. Check yourself (7 min)

## Worked example → faded example

Worked: register and sign in with the test authenticator. Faded: learners change one field of `clientDataJSON` and predict the failing check.

## Top misconceptions

- "The server stores the passkey": it stores only the public half
- "The signature covers only the challenge": it covers authenticatorData and the hash of clientDataJSON, which contains the challenge
- "A passkey works on any site": the rpIdHash binds it to one site

## Questions students will ask (with answers)

**Why is Google sign-in only a stub?** It needs a Google client id and network access; without them it answers 501.

**Why is attestation none enough?** We trust the person who joined with a code, not the hardware brand.

## Your mastery check (private)

Explain, without notes, why a recorded successful sign-in request cannot be replayed.
