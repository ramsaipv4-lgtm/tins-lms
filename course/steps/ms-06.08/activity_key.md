# Activity key — Sign-out, passkeys and the sign-in gate (trainer only)

## Reinforcement activity: software authenticator (10 min)

### Expected answers

**Flipped signature byte:** 401, body `{ "error": { "signature": "invalid" } }`, and `/api/me` still gives 401.

Marking rubric:
- Full marks: 401 and says the session was not created
- Partial: 401 without the reason
- Zero: 200

**Wrong origin in clientDataJSON:** 400 `{ "error": { "origin": "mismatch" } }`.

## Marking guide

| Criterion | Full marks when | Common partial answer |
|---|---|---|
| Challenge | single use, 5 minutes, removed first | says "random" only |
| What is signed | authenticatorData plus SHA-256(clientDataJSON) | says "the challenge" |
| Key custody | only public key stored | says "the key is stored" |
