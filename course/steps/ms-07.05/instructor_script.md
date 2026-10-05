# Instructor script - Learner day: catch-up, cards, exit ticket, explain-it-back, first run, audio
### Total runtime: **45 minutes**

> `[SAY]` lines are read aloud; `[DO]`, `[TYPE]`, `[BOARD]`, `[PAUSE]` are actions.

## Hook (0:00 - 0:05)
[SAY] You missed three days. Which day do you have to catch up on first, and who decides?
[DO] Open the catch-up screen as the late joiner and show the day 0 gate.

## Faulty first (0:05 - 0:20)
[SAY] My retry worked on the laptop and timed out on the phone profile.
[TYPE] Show the failing line: `waiting for getByRole('button', { name: /^(start|take)( the)?( diagnostic| quiz)?$/i })`.
⚠️ LIKELY CROSS-Q: Why not make the test wait longer? - Answer: the button was replaced, so waiting would never help.

## Fix and explain (0:20 - 0:40)
[SAY] Show one action at a time and keep the questions for the retry.
[BOARD] Draw the browser (questions only) and the server (questions and key).

## Check yourself (0:40 - 0:45)
[SAY] Answer the three questions in the lesson.
