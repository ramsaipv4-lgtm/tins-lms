# Rubric: Checkpoint 4

| # | Criterion | Points | Full marks when | Partial |
|---|---|---|---|---|
| 1 | Journey run | 3 | Both profiles reported, honest about any failure | One profile |
| 2 | Nav check | 4 | Summary pasted, collision defined by meaning (a pattern matching two labels one role sees), path-only check explained | Definition without the I-2 point |
| 3 | Collision by hand | 5 | Names the entry that sorts first by `order`, then by label; gives two fixes (compose one screen with panels, or change `order`) and says which the course chose | One fix |
| 4 | Loading state | 4 | Renders a loading status until the data arrives, so disabled never means "not loaded" | Adds a delay or a retry |
| 5 | Two Reacts | 4 | Hoisted React 18 for Excalidraw plus a pinned React 19 in `packages/web`; dedupe in the bundler config and linking nested `node_modules` in worktrees | Only one of the two fixes |

14 of 20 is a pass.

## Answer key

**2. Nav check** (integration I-1, I-2, I-5 to I-7; ms-11.02). On the tree this course was assembled from, the script printed `navcheck: 87 nav labels, 74 Appendix D nav patterns; 0 new collision(s), 23 reviewed, 0 unmatched` and exited 0. Your counts will differ in your own build; the shape of the line is what matters. A collision is a journey's nav pattern that matches two labels one role sees in one space; the journey clicks whichever sorts first (by `order`, then by label text). In I-2 the learner's "schedule" link resolved to tele's "Class schedule" (`/teach/substitute`) instead of admin's "Schedule" (`/teach/schedule`): the two screens had different paths and the same meaning, so a path-only check would pass.

**3. Collision by hand** (I-1, journal b7-3 and b7-4). The entry that sorts first wins: lower `order`, then alphabetical by label. Fix A: compose. The tele group's "Today" page embeds the attend group's wrap-up panel, so there is one nav entry for one idea. Fix B: reorder the nav entries so the right one sorts first. The course chose composition for I-1 and I-2, because renaming breaks the journeys' accessible names, and used order-only fixes for I-5 to I-7, where no journey matched the wrong entry by mistake.

**4. Loading state** (I-10, journal b7-6). Show a loading status in place of the button until the change requests have arrived. In the trace for AC-164 the trainer's approval returned 200 and the learner page re-fetched the list 48 times while the button never read as enabled, because it had been rendered disabled before the data arrived. The earlier guess of `cache: 'no-store'` was not the cause. Sibling case: I-12, a settings checkbox reset by its first poll; fix: render after load and ignore poll answers while a save is in flight.

**5. Two Reacts** (I-8). npm workspaces hoisted React 18.3.1 to the root `node_modules` (pulled in for Excalidraw) and kept `packages/web`'s pinned React 19.3.0 in `packages/web/node_modules`. Task worktrees linked only the root `node_modules`, so every worktree build used React 18 for everything, while the main checkout used React 19 for the app and React 18 inside Excalidraw. Fix: `resolve.dedupe` for `react`, `react-dom` and `scheduler` in the Vite config, and `scripts/setup.mjs` links each package's own `node_modules` into worktrees.

**1. Journey run.** No fixed answer: the result is yours. A pass is both profiles green or a failing line quoted exactly. Reject "it passed" with no output.
