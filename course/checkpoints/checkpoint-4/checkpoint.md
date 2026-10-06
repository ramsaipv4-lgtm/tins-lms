# Checkpoint 4: the web app (after module 7)

**Covers:** ms-07.01 to ms-07.09. **Rows used:** AC-81, AC-82, AC-83, AC-85, AC-95, AC-96, AC-161, AC-164 (any journey in the module will do for the run). **Time:** about 75 minutes.

## Build

You have nine feature groups merged into one shell. This checkpoint is about the failures that only appear when they meet (see [Appendix A](../../appendix/A-post-ship-fixes.md)).

1. **Run a journey alone.** Run one journey on your build, for example `node --test acceptance/journeys/learner-join.journey.mjs` (AC-81). It runs on a desktop and a phone profile. Note both results. Do not read the journey source; use the UI contract in SPEC Appendix D for names and test ids.
2. **Run the nav-collision check.** Run `node scripts/navcheck.mjs .` and read its one-line summary. In your own words, say what a "collision" is and why a path-only uniqueness check would not find the one in integration item I-2.
3. **Find the collision by hand.** Two groups both register a learner screen called "Today" (as in I-1) and a journey looks for a link matching `/today/i`. Which one does the learner reach, what decides it, and give two ways to fix it.
4. **Loading state.** A "Deploy to prod" button is rendered disabled while the change requests are still loading, and a throttled phone test clicks it right after navigation (I-10). Write the smallest change to the component, in words or code, that makes the button's disabled state mean only "no approved change request".
5. **Two Reacts.** Your app passes in a task worktree and fails in the main checkout with `Cannot read properties of null (reading 'useRef')` from the board chunk. State the cause and the two changes that fix it (I-8).

## Verify

1. For (1), paste the TAP summary line for each profile.
2. For (2), paste the line `navcheck:` prints and say whether it exits 0.
3. For (3) to (5), check your answer against the rubric's key after you have written it.

## Pass

14 of 20 points on [the rubric](rubric.md).
