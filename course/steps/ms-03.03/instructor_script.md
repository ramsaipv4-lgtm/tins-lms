# Say/Do script — Append-only hash-chained ledger

**Total runtime: 30 minutes**

---

## Introduction (0:00 — 0:05) [5 min]

**Say:**
"Grades must be correctable but never silently rewritten. Today we build a ledger where an edit to the past is detectable."

**Do:**
- Show the detective question and the three options.

---

## The chain (0:05 — 0:15) [10 min]

**Say:**
"Each entry stores the hash of the one before it. The hash covers everything except itself, using canonical JSON so key order cannot matter."

**Do:**
- Show appendEntry from the walkthrough.
- Ask: why do we only set reason when it is present?

---

## Verify and correct (0:15 — 0:25) [10 min]

**Say:**
"verifyLedger walks from the start and names the first broken entry. A correction is just another entry that points back."

**Do:**
- Show verifyLedger.
- Run `node --test packages/core/test/ledger.test.mjs`.
- Edit one field in a copy and show brokenAt.

---

## Wrap-up (0:25 — 0:30) [5 min]

**Say:**
"The chain shows tampering but a full rewrite needs an outside anchor for the last hash."

**Do:**
- Ask the four check-yourself questions.
