# Recall — Appeals and AI policy

## Exercise 1 — Appeal states (5 min)

**What to do:** An appeal goes through several states. List them in order, and write a one-word summary of who acts at each step.

**The answer (check after):**
1. `open` — learner (opens the appeal)
2. `upheld` / `rejected` — trainer (uphold or reject)
3. `escalated` — learner (unhappy) or system (timeout)
4. `final-upheld` / `final-rejected` — reviewer (final decision)

## Exercise 2 — AI policy matrix (5 min)

**What to do:** Fill in whether each policy allows each tool:

| Policy | Chat | Repo-write | Run-command |
|---|---|---|---|
| `off` | ? | ? | ? |
| `allowed` | ? | ? | ? |
| `explain-only` | ? | ? | ? |

**The answer (check after):**

| Policy | Chat | Repo-write | Run-command |
|---|---|---|---|
| `off` | ✗ | ✗ | ✗ |
| `allowed` | ✓ | ✓ | ✓ |
| `explain-only` | ✓ | ✗ | ✗ |

## Exercise 3 — Immutable state (5 min)

**What to do:** You call `appealStep(appeal, { kind: 'uphold', by: 'trainer', at: now, outcome: 'uphold' })`. You get back a new appeal. What's in the `history` of the new appeal?

**The answer (check after):**
The `history` is a new array with one entry: `{ kind: 'uphold', by: 'trainer', at: now, outcome: 'uphold' }`. The old appeal's `history` (if it had entries) is copied first, then the new step is appended.

## Cards

**Q:** What is the 7-day appeal window?

**A:** The time from when the attempt was published until the learner can no longer open an appeal. After 7 days (7 × 24 × 60 × 60 × 1000 milliseconds), `openAppeal` returns `{ ok: false, reason: 'window-closed' }`.

**Q:** Why does `appealStep` return a new appeal instead of changing the one you passed in?

**A:** Immutable state makes functions pure and deterministic. Tests can check both the old and new state. And the caller controls when to save the new version.

**Q:** What happens if you call `appealTick` on an appeal that is already `escalated`?

**A:** It returns the appeal unchanged. Escalation only happens from the `open` state.

**Q:** What does `aiUsageSummary` count?

**A:** The number of tool uses in the `events` array. It doesn't care about time (`at`), only the count.

**Q:** Why is `'explain-only'` policy useful in teaching?

**A:** It lets learners ask questions and get explanations without getting a finished answer. They still have to write the code themselves.
