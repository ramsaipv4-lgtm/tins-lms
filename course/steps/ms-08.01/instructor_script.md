# Instructor script — The board, its pages and a PDF with notebook ruling
### Total runtime: **45 minutes**

> Say/Do teleprompter. `[SAY]` lines are read aloud; `[DO]`, `[TYPE]`, `[BOARD]`, `[PAUSE]` are actions;
> `⚠️ LIKELY CROSS-Q` marks questions students usually ask.

## Hook (0:00 — 0:05)
[SAY] A trainer wants a whiteboard, but the whiteboard library is bigger than our whole app. How do we ship it without slowing everyone?
[DO] Show the build output with the `Board-` chunk next to `index-`.

## Faulty first (0:05 — 0:20)
[SAY] Our first test clicked the rectangle tool and froze for thirty seconds.
[TYPE] node --test packages/web/test/board.test.mjs
[BOARD] Write the error line: "subtree intercepts pointer events".
⚠️ LIKELY CROSS-Q: Why not just force the click? — Answer: A real user cannot force a click; fix the page, not the test.

## Fix and explain (0:20 — 0:40)
[SAY] Open `board.css`: the input becomes the top layer. Then open `pdf.ts` and read `rulingYs`.
[DO] Export a PDF and open it; count the lines.
[PAUSE] Ask: why is the ruling not on the canvas?

## Check yourself (0:40 — 0:45)
[SAY] Work through the four questions in the lesson.
