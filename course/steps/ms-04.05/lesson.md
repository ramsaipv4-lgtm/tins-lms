---
id: ms-04.05
title: Study groups, estimation poker, stand-up bot, explain-it-back
module: 4
est_minutes: 50
prereqs: [ms-01.01]
objectives: 4
new_terms: 7
skills: [deterministic-grouping, whole-word-matching, rule-based-checks]
source_refs: [{ path: packages/core/src/groups.ts, commit: 8290dbd5bd95da0511fef6ea91a643825ca0e6b9 }, { path: packages/core/src/poker.ts, commit: 8290dbd5bd95da0511fef6ea91a643825ca0e6b9 }, { path: packages/core/src/standup.ts, commit: 8290dbd5bd95da0511fef6ea91a643825ca0e6b9 }, { path: packages/core/src/explain.ts, commit: 8290dbd5bd95da0511fef6ea91a643825ca0e6b9 }]
next: ms-04.06
---

# MS 4.5 — Study groups, estimation poker, stand-up bot, explain-it-back
*Step 15 of 41*

> **Read this first.** The builder of task b4-5 never wrote this step. The course editor wrote it afterwards, from the merged code (`packages/core/src/groups.ts`, `poker.ts`, `standup.ts`, `explain.ts`), their unit tests and `docs/build-journal/b4-5.md`. The audit in `docs/build-journal/AUDIT.md` also found that the original builder read hidden acceptance tests for these four functions, which SPEC D-40 forbids. So treat the code below as one working answer, not as proof that a clean build from the SPEC gets there. **Implement from SPEC §4.14 to §4.17 only**, and use the acceptance suite as your check.

## Prerequisites
You can run `node --test` on a `.ts` file under Node 22 and read short TypeScript (ms-01.01). No other step is needed: all four functions are pure and import nothing from `packages/core`.

## You already understand this
Four small classroom habits. A teacher splits a class into groups of about the same size and tries to mix strong and weak people. A team votes on how big a task is by showing cards together. A manager reads "Blockers: waiting on Ravi" and knows to chase it. A tutor listens to a student explain an idea and ticks off the key points. Each habit becomes one function that decides from its arguments alone.

## The detective question
**Problem:** Four rituals (SPEC §4.14 to §4.17) must run on a phone with no network and no AI: form study groups, settle an estimation vote, spot a blocker in a stand-up answer, and check an explanation against a list of concepts. Each must give the same answer for the same input, and each has an edge where a naive version gives a wrong answer.
**Options considered:** (1) Ask an AI model each time. (2) Hand-written rules inside each screen. (3) One pure function per ritual in `packages/core`, using plain data in and out, whole-word matching for text and a seed for anything random.
**Choice:** Option 3. `formGroups` shuffles with a seeded generator and then splits into near-equal groups; `pokerRound` compares the lowest and highest card by position in the allowed card list; `parseStandup` and `checkExplanation` match whole words only.
**Why:** SPEC D-22 says everything that decides lives in core as a pure function, and D-32 (P-16) says rules are written once and run offline. A function with no hidden state can be tested with a seed instead of a classroom.

## Learning objectives
1. Split n people into groups whose sizes differ by at most 1, deterministically for a seed.
2. Decide poker consensus by neighbouring card positions, not by numeric gap.
3. Match whole words and phrases, ignoring case and punctuation.
4. Order checks so a negation can be tested without hiding a real blocker.

## Conceptual understanding
**Groups (AC-30, AC-31).** Shuffle the people with a seeded generator, cut the list into `ceil(n / size)` groups, give the first `n mod groups` groups one extra person, then try swaps that raise a diversity score (a skill counts when a group holds both a mastered and a not-yet person). `applyGroupOverrides` moves exactly the named people and leaves every other person where they were.

**Poker (AC-32).** The allowed cards are 1, 2, 3, 5, 8, 13 and anything else throws. Consensus means the lowest and highest vote are the same card or neighbours in that list, so 3 and 5 agree and 5 and 8 agree, but 3 and 8 do not. The points are the most common vote, and a tie goes to the higher card. Otherwise the result is `discuss`, naming the voters of the lowest and highest card.

**Stand-up (AC-33).** An empty answer is not blocked. Otherwise the answer is blocked when it contains one of *blocked, stuck, waiting on, waiting for, can't, cannot, need help* as whole words, unless it is a negation.

**Explain-it-back (AC-34).** For every concept the transcript must contain one of its `anyOf` phrases. Matching ignores case and punctuation and needs whole words, so "cached" does not match "cache" unless "cached" is listed.

## Walkthrough of the real code
Group sizes: the first `remainder` groups take one extra person.

```ts packages/core/src/groups.ts
  const numGroups = Math.ceil(shuffled.length / size);
  const baseSize = Math.floor(shuffled.length / numGroups);
  const remainder = shuffled.length % numGroups;
```

Poker consensus is a distance in the card list, not in points:

```ts packages/core/src/poker.ts
  const lowestIdx = ALLOWED_CARDS.indexOf(lowestVote);
  const highestIdx = ALLOWED_CARDS.indexOf(highestVote);
  const isConsensus = highestIdx - lowestIdx <= 1;
```

The stand-up check runs negations first, then whole-word keywords:

```ts packages/core/src/standup.ts
  const negations = ['no blockers', 'none', 'not blocked', 'nothing'];
  for (const negation of negations) {
    if (blockers.includes(negation)) {
      return { blocked: false, blockerText: null };
    }
  }
```

Phrase matching: punctuation becomes spaces first, then `\b` anchors both ends of the phrase (single words get the same anchors).

```ts packages/core/src/explain.ts
    const phraseRegex = new RegExp(`\\b${phraseWords.join('\\s+')}\\b`, 'g');
    return phraseRegex.test(cleanTranscript);
```

## Your turn: faulty first
**Scenario A, real mistake from the build (journal b4-5, evidence E9).** The first partition used `groupSize = Math.ceil(n / numGroups)` and cut the list into slices of that size. For 7 people and size 3, `numGroups` is 3 and `groupSize` is 3, so the slices are 3, 3 and 1. The unit test failed with:

```text
n=7 size=3: sizes 3,3,1 differ by more than 1
```

**Predict** the sizes for 10 people and size 4, then run the faulty idea on paper. **Diagnose:** one rounded-up size cannot be shared out evenly. **Fix:** a floor size plus a remainder, as in the walkthrough: 7 people give 3, 2, 2.

**Scenario B, a real limitation the editor found (not in the original journal).** Look at the stand-up code again. The negation list is checked with `includes` before any keyword. **Predict** `parseStandup` for the blockers answer `Blocked, nothing else works`. Then run it. The editor ran the merged code and it returns `blocked: false`, because `nothing` is a substring and wins. SPEC AC-33 does not list this input, so the tests stay green. The cause is that negations are matched as substrings while keywords are matched as whole words. A safer design matches both as whole words and lets a keyword outside the negated phrase win. Decide whether to fix it in your own build and write the test first.

**Scenario C, from the journal (E8).** The first poker rule compared card values (the journal says `diff <= 2`) and its own edge-case test failed. The journal's wording of that case is not consistent with the final code, so do not copy it: derive your cases from SPEC §4.15 (3 and 5 agree; 3 and 8 do not).

## Technical glossary
- **Seeded shuffle:** a random-looking order that is the same for the same seed string.
- **Remainder rule:** give the first `n mod groups` groups one extra member.
- **Diversity score:** how many skills a group holds both a mastered and a not-yet person for.
- **Neighbouring cards:** adjacent entries in the card list 1, 2, 3, 5, 8, 13.
- **Word boundary (`\b`):** a regex anchor between a word character and a non-word character.
- **Negation:** words such as "none" that cancel a blocker.
- **Checklist:** the concepts and misconceptions a trainer lists for one explain-it-back topic.

## Common questions
**Q: Why a seed and not `Math.random`?** The same seed must give the same groups on every device, and a test can replay it.
**Q: Why are the cards compared by position?** SPEC calls 3 and 5 neighbours; their points differ by 2, while 8 and 13 differ by 5 yet are neighbours too.
**Q: Can the explain check say how well someone explained?** No. It lists covered, missing and misconception ids; quality needs the connected AI when online (FEATURE-IDEAS B-3).

## Reinforcement activity
Write the stand-up fix from scenario B: make `Blocked, nothing else works` return `blocked: true` while `None`, `no blockers`, `not blocked`, `Nothing` and `` still return false. Keep `unblocked yesterday` not blocked. Run your own tests, then the acceptance row AC-33.

## Check yourself
1. Seven people, group size 3: what are the group sizes?
<details>3, 2 and 2: `numGroups` is 3, `baseSize` is 2 and the remainder is 1.</details>
2. Votes {3, 5} for estimation poker: what is the result?
<details>Consensus with 5. 3 and 5 are neighbouring cards and a tie goes to the higher card.</details>
3. Why does "unblocked yesterday" not count as blocked?
<details>Keywords match whole words, so `blocked` inside `unblocked` is ignored.</details>
4. Transcript "It is cached." and a concept listing only `cache`: covered or missing?
<details>Missing. Only whole words match; list `cached` as well to cover it.</details>

## Quick reference
`formGroups(people, size, seed)`, `applyGroupOverrides(groups, moves)`, `pokerRound(votes)`, `parseStandup(answers)`, `checkExplanation(transcript, checklist)`. Acceptance rows AC-30 to AC-34. Allowed cards 1, 2, 3, 5, 8, 13.

## Connection to the bigger picture
The Shift server routes (`packages/server/src/routes/features/shift.ts`, ms-07.06) call `pokerRound` and `parseStandup`, and the learner-day route (`learn.ts`, ms-07.05) calls `checkExplanation`. A search of the merged tree finds no caller of `formGroups` outside core, so study groups are tested but not yet wired into a screen. Mastery inputs come from the map in ms-02.03.

## Next

Next: [MS 4.6 — Screenshot rules, FAQ, at-risk, item analysis, clusters, re-flow](../ms-04.06/lesson.md).
