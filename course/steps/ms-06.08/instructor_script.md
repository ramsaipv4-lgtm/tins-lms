# Instructor script — Sign-out, passkeys and the sign-in gate

**Total runtime: 45 minutes**

---

## Hook (0:00 — 0:05)

[SAY] "No password, no SMS. How does the server know it is you tomorrow?"

[DO]
- Show the Detective question

---

## Faulty first (0:05 — 0:20)

[SAY] "Three real slips from this build. Predict before I reveal."

[DO]
- Show Mistake 1 (stale test after a SPEC change) and ask which file changes first
- Show Mistake 2 (a string search matched an HTML comment)

⚠️ LIKELY CROSS-Q: "Why not skip attestation checks?" — Answer: with attestation `none` there is nothing to check; the signature at sign-in is what matters.

---

## Fix and explain (0:20 — 0:40)

[SAY] "Open accounts.ts: the challenge store, the DER conversion, the signature check."

[DO]
- Walk the three excerpts
- Flip one signature byte live and show the 401

⚠️ LIKELY CROSS-Q: "Could someone replay a recorded sign-in?" — Answer: no, the challenge is gone after first use.

---

## Check yourself (0:40 — 0:45)

[SAY] "Answer the four questions on paper, then we compare."
