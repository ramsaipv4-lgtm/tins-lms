# Instructor script — Study groups, estimation poker, stand-up bot, explain-it-back
### Total runtime: **50 minutes**

> Say/Do teleprompter. `[SAY]` lines are read aloud; `[DO]`, `[TYPE]`, `[BOARD]`, `[PAUSE]` are actions;
> `LIKELY CROSS-Q` marks questions students usually ask. Tell the room at the start that this step was written after the build by the course editor, and that the original builder read hidden tests (docs/build-journal/AUDIT.md).

## Hook (0:00 — 0:05)
[SAY] Four classroom habits, four small functions. None of them calls an AI and none keeps hidden state.
[DO] Ask: "How would you split 7 people into groups of about 3?" Take two answers.
[BOARD] Write 3, 3, 1 and 3, 2, 2. Ask which one the SPEC allows (sizes differ by at most 1).

## Faulty first (0:05 — 0:20)
[SAY] This is the real mistake from the build. The first version rounded the group size up.
[TYPE] Show `groupSize = Math.ceil(n / numGroups)` on the board and let learners compute 10 people, size 4.
[PAUSE] Wait for 4, 4, 2, then reveal the correct 4, 3, 3.
[SAY] Now the stand-up bot. Predict the result for "Blocked, nothing else works".
[DO] Run `parseStandup` on it in the terminal. It returns `blocked: false`.
LIKELY CROSS-Q: Is that in the SPEC tests? — Answer: No. AC-33 does not list it, so the suite is green; it is a limitation the editor found.

## Fix and explain (0:20 — 0:42)
[SAY] Walk through the four functions in order.
[DO] groups.ts: seeded shuffle, floor size plus remainder, then the swap pass.
[DO] poker.ts: positions in 1, 2, 3, 5, 8, 13. Show {3, 5} agree, {3, 8} do not, {1, 2, 2, 3} discuss.
[DO] standup.ts: negations first, then whole-word keywords. Say why order matters.
[DO] explain.ts: punctuation to spaces, then `\b` around the phrase. Show "cached" against `cache`.
LIKELY CROSS-Q: Why is `Math.random` not used? — Answer: the same seed must give the same groups on every phone.
[SAY] Reinforcement: fix scenario B and keep every AC-33 example green.

## Check yourself (0:42 — 0:50)
[SAY] Read the four questions aloud and let learners answer before you open the details.
[DO] Remind them to implement from SPEC §4.14 to §4.17, not from this code.
