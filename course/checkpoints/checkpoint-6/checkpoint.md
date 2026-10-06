# Checkpoint 6: the last rows and a clean gate (after module 12)

**Covers:** the end of the build: AC-153 (accommodations in the Shift timer), AC-94 (screenshot import on the phone profile), and the full gate. **Rows:** AC-153, AC-94, then every row you have claimed. **Time:** about 60 minutes, plus the gate run.

**Note.** When this course was assembled, task b12-1 (AC-153 and AC-94) was still in progress, so module 12 has no lesson. This checkpoint therefore asks you to reason from the SPEC and the journals, and then to run the full gate on your own build. It does not tell you how b12-1 ended.

## Build

1. **AC-153, by reasoning.** SPEC §4.26 gives `effectiveLimitMs(baseMs, accommodation)`. Where must the *accommodated* limit be shown in the app, according to SPEC Appendix C (test id `shift-timer`) and AC-153? List the three screens or flows involved: where a learner requests an accommodation, where an admin approves it, and where the timer reads it. Why does the journey fail with `no visible link/button/tab named /^(shift|the shift)$/i` when the Shift group is not merged (journal b11-2)?
2. **AC-94, by reasoning.** The journey uploads the fixture diet screenshot and waits for `shot-confirm`. List the three things that must be true on the hub and in the page for OCR to finish in time: where the English OCR data comes from (D-11), why the shell budget forbids bundling the OCR scripts, and why nothing may be saved before the learner confirms (P-16). Then explain the two failures recorded in journal b11-1 (mistakes 6 and 7): a phone timeout at `shot-confirm` and a desktop `1 !== 0`.
3. **The full gate.** On your build, with every row you claimed, run `node .tins/kit/bin/kit.mjs gate` once, alone on the machine. Record: the final line, how long it took, and whether any row failed that passed alone. If a row fails only in the full run, apply the integration checklist from the [strategy](../../01-strategy.md): nav collisions, shared build output, two Reacts, controls rendered before data, memory.
4. **Continuity.** Open `CONTINUE.md` in your repository. Does it name the last green task, the next task and the gate command (SPEC AC-130)? Run `npm ci` and the gate from a fresh clone (AC-131) and say whether it reproduces the last green state.

## Pass

14 of 20 points on [the rubric](rubric.md).
