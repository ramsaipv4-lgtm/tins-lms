# Rubric: Checkpoint 3

| # | Criterion | Points | Full marks when | Partial |
|---|---|---|---|---|
| 1 | Start-up | 4 | Names the admin invite code printed once, the certificate fingerprint and where the CA is created | Two of three |
| 2 | Status codes | 4 | 200, 401, 404 with predictions written before the run | Right codes, predictions written after |
| 3 | Guard mismatch | 4 | Says an anonymous call to the wrong prefix gets 401, names ms-06.08 for the workaround and ms-11.01 for the fix | Right code, no step named |
| 4 | Sync version rule | 4 | `update-app` answer, local data untouched, reason (older clients are told to update and are never wiped) | Answer without reason |
| 5 | Sealed release | 4 | Key derivation per section, AES-GCM seal, key released by the teleprompter, graded sections need a person | Missing the graded rule |

14 of 20 is a pass.

## Answer key

**1. Start-up** (SPEC AC-61, D-25; ms-06.01). On first start the hub creates an org, prints one line `ADMIN_INVITE <code>` on stdout (once only: never log it again, D-28), and in the hub profile creates its own certificate authority. `GET /api/pairing/fingerprint` returns the fingerprint, and the pairing QR carries the hub id, the current address and that fingerprint. When this course was assembled, a hub started without a certificate under `<data>/tls` printed `no certificate under <data>/tls; serving plain HTTP` and then `LISTENING <port>`; do not mark a different log wording wrong as long as the three facts are present. The CA private key is kept out of the org database (ms-06.01, check question 2).

**2. Status codes** (AC-60, AC-62, AC-78). Verified against the merged tree with the three calls: `GET /api/health` 200 with `{"ok":true,"profile":"hub","schema":1,"version":"0.1.0"}` (no secrets); `GET /api/me` 401; `GET /__test/anything` 404 because `LMS_TEST_MODE` is not set.

**3. Guard mismatch** (journal b6-8, mistake 4; ms-06.08 and ms-11.01). A public route under the wrong prefix answers 401. In b6-8, `core/guard.ts` listed `/api/sign-in` while the SPEC said `/api/signin`; the guard was out of the builder's scope, so the sign-in routes were mounted on a second small app in `main.ts`. Task b11-1 changed the guard to follow the SPEC and deleted the second app (ms-11.01).

**4. Sync version rule** (AC-71, D-23; ms-06.04). The hub refuses with `update-app` and the client's local data is untouched. The SPEC allows a client within 2 schema versions; older clients are told to update and are never wiped.

**5. Sealed release** (AC-68, D-38; ms-03.02 and ms-06.03). Each section is sealed with its own key derived from the day key and the section index (HKDF-SHA-256), using AES-GCM with a fresh IV. Learners receive sealed bodies; the hub releases a section's key to the class when the trainer taps next, or at the planned time for ungraded sections. Graded sections never unlock by time alone, so a late or absent trainer cannot leak an exam.

**Evidence.** The hardest failure is usually a gate failure from `kit gate` with an exact line such as `gate: AC-70: 1 failing test(s)`. Accept any real output you can find in the learner's terminal history.
