# Recall — Study groups, estimation poker, stand-up bot, explain-it-back

## Exercise 1 — Group sizes (5 min)
**What to do:** Closed book, write the group sizes for 10 people with size 4, for 5 people with size 2 and for 2 people with size 5.
**The answer (check after):** 4, 3, 3; then 2, 2, 1; then 2 (one group). Checked by running `formGroups` on the merged code.

## Exercise 2 — Poker votes (5 min)
**What to do:** Give the result for the votes {3, 8}, for {1, 2, 2, 3} and for {8, 13, 13, 8}.
**The answer (check after):** discuss with low [voter of 3] and high [voter of 8]; discuss with low [voter of 1] and high [voter of 3] (1 and 3 are not neighbours); consensus 13 (tie goes to the higher card).

## Exercise 3 — Stand-up and explain (5 min)
**What to do:** Say whether `Waiting for review`, `not blocked` and `Blocked, nothing else works` count as blocked in the merged code, and whether "It is cached." covers a concept listing only `cache`.
**The answer (check after):** true, false and false (the third is the known limitation); missing, because only whole words match.

## Cards
**Q:** How are group sizes kept within 1 of each other?
**A:** A floor size for everyone and the first `n mod groups` groups get one extra person.

**Q:** Why does `formGroups` take a seed?
**A:** So the same seed gives the same groups on every device and tests can replay it.

**Q:** Which cards may be voted in estimation poker?
**A:** 1, 2, 3, 5, 8 and 13. Any other value throws.

**Q:** When is a poker round a consensus?
**A:** When the lowest and highest vote are the same card or neighbours in the card list.

**Q:** Who wins a tie in the consensus points?
**A:** The higher card.

**Q:** Why does "unblocked yesterday" not count as blocked?
**A:** Keywords match whole words only.

**Q:** What does `checkExplanation` return?
**A:** The ids of covered concepts, missing concepts and found misconceptions.

**Q:** Does "cached" match a concept listing only "cache"?
**A:** No. Only whole words or phrases match unless "cached" is listed.

**Q:** What does `applyGroupOverrides` do to people who are not named?
**A:** Nothing: they stay in their groups in the same relative order.
