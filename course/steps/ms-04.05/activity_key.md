# Activity key — Study groups, estimation poker, stand-up bot, explain-it-back (trainer only)

## Reinforcement activity: answer
Match negations and keywords as whole words, then decide by position. One workable approach: find each keyword hit and each negation hit as whole-word matches; the answer is blocked when a keyword hit lies outside every negation phrase. With that rule `Blocked, nothing else works` is blocked (the keyword `blocked` is not part of a negation phrase), while `None`, `no blockers`, `not blocked`, `Nothing` and the empty string are not blocked, and `unblocked yesterday` stays not blocked because `blocked` inside `unblocked` is not a whole word. Note that `I am not stuck` is also reported as blocked by the merged code, because `not stuck` is not in the negation list; a learner may add it, but SPEC §4.16 does not require it. The row to run is AC-33.

Check yourself: 1) 3, 2, 2. 2) consensus 5. 3) whole-word keywords. 4) missing.

## Marking guide
| Criterion | Full marks when | Common partial answer |
|---|---|---|
| Sizes | Uses a floor size and a remainder and gets 3, 2, 2 | Rounds the size up and gets 3, 3, 1 |
| Poker | Compares card positions and breaks ties upward | Compares point values |
| Stand-up | Whole-word matching and a justified order for negations | Substring matching so "unblocked" is flagged |
| Honesty | Implements from SPEC and notes the editor's disclosure | Copies this lesson's code without reading the SPEC |
