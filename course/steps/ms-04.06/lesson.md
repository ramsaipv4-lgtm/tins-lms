---
id: ms-04.06
title: Screenshot rules, FAQ, at-risk, item analysis, clusters, re-flow
module: 4
est_minutes: 60
prereqs: [ms-04.05]
objectives: 4
new_terms: 8
skills: [ocr-parsing, text-similarity, statistical-analysis, clustering, scheduling]
source_refs: [{ path: packages/core/src/screenshot.ts, commit: cc0cbd7de02076991c810ef6aceacb31e5f4426d }, { path: packages/core/src/faq.ts, commit: cc0cbd7de02076991c810ef6aceacb31e5f4426d }, { path: packages/core/src/atrisk.ts, commit: cc0cbd7de02076991c810ef6aceacb31e5f4426d }, { path: packages/core/src/items.ts, commit: cc0cbd7de02076991c810ef6aceacb31e5f4426d }, { path: packages/core/src/cluster.ts, commit: cc0cbd7de02076991c810ef6aceacb31e5f4426d }, { path: packages/core/src/reflow.ts, commit: cc0cbd7de02076991c810ef6aceacb31e5f4426d }]
next: end
---

# MS 4.6 — Screenshot rules, FAQ, at-risk, item analysis, clusters, re-flow

*Step 1 of N*

## Prerequisites

- Regular expressions (case-insensitive matching, character classes)
- String parsing and number extraction
- Set operations and Jaccard similarity
- Basic statistics (percentiles, means)
- Array sorting and grouping algorithms

## You already understand this

- OCR sometimes produces garbled text, but anchoring on keywords and extracting nearby numbers is reliable.
- Similar questions asked different ways can be grouped by their word overlap.
- A learner's risk level combines multiple signals: locked topics, overdue cards, stalled progress, and recent low scores.
- Test items vary in difficulty; those that everyone gets right or everyone gets wrong teach nothing.
- When the same learners make the same mistakes, it's often a systematic misunderstanding worth addressing.
- Lesson plans need to flex when coverage falls behind but stay ordered.

## The detective question

**Problem:** Trainers need quick insights into learner progress, assessments, and content delivery. Screenshots encode real-world data (meal nutrition, expense receipts) that must be parsed. Exit tickets reveal common confusions. Some learners fall behind. Some test items are broken. Cohorts make repeated mistakes. And pacing sometimes needs adjustment.

**Options considered:**
1. Parse every screenshot manually; skip FAQ grouping; poll learners one-by-one for risk.
2. Use AI vision APIs; call external servers; re-run analysis after every event.
3. Define parsing rules locally; compute all signals from offline data; keep text matching offline.

**Choice:** Option 3 for all six modules. Parsing is regex-based. FAQ uses word-set similarity. Risk combines four thresholds. Item analysis uses the 27-percentile discrimination method. Clustering is signature-based. Reflow is deterministic.

**Why:** Rules run offline on any device; no external calls, no latency. Regex parsing is auditable. Jaccard similarity on stop-word-filtered text is simple and gives the trainer control over grouping sensitivity. Thresholds are transparent and can be tuned per context. Item discrimination uses the standard psychometric method. Clustering finds exact-match groups, easy to spot. Reflow respects the original order and only moves what must move.

## Learning objectives

1. Parse OCR text using regex anchors and numeric extraction rules.
2. Group similar questions by word overlap (Jaccard similarity).
3. Combine four risk signals into a three-level alert.
4. Calculate item discrimination from top/bottom percentile performance.
5. Identify cohort misunderstandings by clustering failing test submissions.
6. Adjust a lesson plan when daily coverage falls short.

## Conceptual understanding

**Screenshot parsing:** A rule has a regex anchor (case-insensitive, up to 200 chars) that matches a line, then picks either that line or the next line to extract a number. Numbers may have thousands separators and currency signs; parse after stripping both.

**FAQ grouping:** Words (lowercase, no punctuation, removing stop words like "the", "how", "is") form a set. Two questions are similar if their word-set Jaccard similarity ≥ 0.6. Group all mutually similar questions; only report groups with at least `minRepeats` members (default 3).

**At-risk assessment:** One point each for: locked missed days ≥ 1; overdue cards ≥ 50; days since a commit ≥ 5; last shift score < 50%. Sum the points: 0 = ok, 1 = watch, 2+ = risk. `null` values never add points. Each metric is optional.

**Item analysis:** Rank all learners by total-correct count. The top and bottom 27% (rounded down, at least 1) form the mastery groups. For each item, compute `p` = share-correct. `discrimination` = p(mastery) − p(low). Flag if p < 0.2 (too hard), p > 0.95 (trivial), or discrimination < 0.2 (not diagnostic).

**Submission clustering:** Group submissions by their exact set of failing checks (order-independent). All-passing submissions form one cluster with an empty signature. Sort by cluster size (largest first), ties by signature.

**Plan re-flow:** Topics planned on days 0 through `throughDay` that were not covered are moved to the start of day `throughDay + 1` in their original order. Days after keep their topics. Return both the new plan and a list of what moved, with source and destination.

## Walkthrough of the real code

Screenshot validation rejects anchors longer than 200 chars, invalid regexes, and duplicate field names.

```ts packages/core/src/screenshot.ts
export function validateRules(rules: ParseRules): string[] {
  const problems: string[] = [];
  const seenNames = new Set<string>();

  for (const field of rules.fields) {
    // Check anchor length
    if (field.anchor.length > 200) {
      problems.push(`field "${field.name}": anchor longer than 200 characters`);
    }

    // Check anchor is valid regex
    try {
      new RegExp(field.anchor, 'ui');
    } catch {
      problems.push(`field "${field.name}": invalid regex in anchor`);
    }

    // Check for duplicate field names
    if (seenNames.has(field.name)) {
      problems.push(`field "${field.name}": duplicate field name`);
    }
    seenNames.add(field.name);
  }

  return problems;
}
```

FAQ grouping builds word sets and finds clusters above the repeat threshold.

```ts packages/core/src/faq.ts
function getWords(text: string): Set<string> {
  const words = text.toLowerCase().split(/\W+/);
  return new Set(words.filter((w) => w.length > 0 && !STOP_WORDS.has(w)));
}

function jaccardSimilarity(words1: Set<string>, words2: Set<string>): number {
  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 1;
  return intersection.size / union.size;
}
```

At-risk assessment counts points and maps to level.

```ts packages/core/src/atrisk.ts
export function atRisk(s: {
  lockedMissedDays: number;
  overdueCards: number;
  daysSinceCommit: number | null;
  lastShiftScorePct: number | null;
}): {
  level: 'ok' | 'watch' | 'risk';
  reasons: string[];
} {
  const reasons: string[] = [];
  let points = 0;

  // Check locked missed days >= 1
  if (s.lockedMissedDays >= 1) {
    reasons.push('locked missed days');
    points++;
  }

  // Check overdue cards >= 50
  if (s.overdueCards >= 50) {
    reasons.push('overdue cards');
    points++;
  }

  // Check days since commit >= 5
  if (s.daysSinceCommit !== null && s.daysSinceCommit >= 5) {
    reasons.push('days since commit');
    points++;
  }

  // Check last shift score < 50%
  if (s.lastShiftScorePct !== null && s.lastShiftScorePct < 50) {
    reasons.push('last shift score');
    points++;
  }

  // Determine level
  let level: 'ok' | 'watch' | 'risk';
  if (points === 0) {
    level = 'ok';
  } else if (points === 1) {
    level = 'watch';
  } else {
    level = 'risk';
  }

  return { level, reasons };
}
```

Item analysis ranks learners and calculates discrimination for each item.

```ts packages/core/src/items.ts
  // Rank people by score
  const rankedPeople = Array.from(personScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([personId]) => personId);

  const totalPeople = rankedPeople.length;
  const groupSize = Math.max(1, Math.floor(totalPeople * 0.27));

  const topGroup = new Set(rankedPeople.slice(0, groupSize));
  const bottomGroup = new Set(rankedPeople.slice(totalPeople - groupSize));
```

Clustering groups submissions with identical failing-check sets.

```ts packages/core/src/cluster.ts
export function clusterSubmissions(
  subs: readonly { id: string; failing: readonly string[] }[],
): { signature: string[]; ids: string[] }[] {
  // Create clusters by signature (sorted failing checks)
  const clusterMap = new Map<string, string[]>();

  for (const sub of subs) {
    // Sort the failing checks to create a canonical signature
    const sorted = Array.from(sub.failing).sort();
    const key = JSON.stringify(sorted);

    if (!clusterMap.has(key)) {
      clusterMap.set(key, []);
    }
    clusterMap.get(key)!.push(sub.id);
  }

  // Convert to result format
  const result = Array.from(clusterMap.entries()).map(([key, ids]) => ({
    signature: JSON.parse(key) as string[],
    ids,
  }));

  // Sort by cluster size (descending), then by signature
  result.sort((a, b) => {
    if (a.ids.length !== b.ids.length) {
      return b.ids.length - a.ids.length;
    }
    // Compare signatures lexicographically
    const aKey = JSON.stringify(a.signature);
    const bKey = JSON.stringify(b.signature);
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });

  return result;
}
```

Reflow moves uncovered topics to the next day.

```ts packages/core/src/reflow.ts
export function reflow(
  plan: readonly { dayIndex: number; topics: string[] }[],
  covered: Record<number, string[]>,
  throughDay: number,
): {
  plan: { dayIndex: number; topics: string[] }[];
  moved: { topic: string; from: number; to: number }[];
} {
  const moved: { topic: string; from: number; to: number }[] = [];
  const newPlan = plan.map((day) => ({ ...day, topics: [...day.topics] }));

  // Create a set of covered topics for quick lookup
  const coveredTopics = new Set<string>();
  for (const dayTopics of Object.values(covered)) {
    for (const topic of dayTopics) {
      coveredTopics.add(topic);
    }
  }

  // Collect uncovered topics from days up to throughDay
  const uncoveredTopics: string[] = [];
  for (const day of newPlan) {
    if (day.dayIndex <= throughDay) {
      day.topics = day.topics.filter((topic) => {
        if (!coveredTopics.has(topic)) {
          uncoveredTopics.push(topic);
          moved.push({ topic, from: day.dayIndex, to: throughDay + 1 });
          return false;
        }
        return true;
      });
    }
  }

  // Add uncovered topics to the start of day throughDay + 1
  if (uncoveredTopics.length > 0) {
    const nextDayIndex = throughDay + 1;
    const nextDay = newPlan.find((day) => day.dayIndex === nextDayIndex);

    if (nextDay) {
      nextDay.topics = [...uncoveredTopics, ...nextDay.topics];
    } else {
      newPlan.push({ dayIndex: nextDayIndex, topics: uncoveredTopics });
    }
  }

  // Sort the plan by dayIndex
  newPlan.sort((a, b) => a.dayIndex - b.dayIndex);

  return { plan: newPlan, moved };
}
```

## Your turn: faulty first

Real mistakes from the build journal.

1. Regex number extraction failed because it only stripped currency signs from the start of the line, not before the number. Fixed by changing `/^[₹Rs$\s]+/` to `/[₹Rs$]*\s*([0-9,]+\.?[0-9]*)/`.

2. A test file used TypeScript generic syntax `new Set<string>()` in a `.mjs` file. Fixed by removing the generic: `new Set()`.

3. A reflow test expected the wrong result (didn't account for uncovered topics from all days through `throughDay`). Fixed by updating the test expectation to match the correct logic.

## Technical glossary

- **Anchor:** a regex pattern that identifies the line containing or preceding a value.
- **Jaccard similarity:** the size of intersection divided by union for two sets; ranges 0–1.
- **Stop words:** common words (a, the, how, is) removed before similarity matching.
- **Discrimination:** the difference in success rate between high-scorers and low-scorers on an item.
- **Percentile:** the rank of a value within a sorted set; the 27th percentile is the cutoff for the bottom 27%.
- **Signature:** the sorted set of failing checks defining a submission cluster.
- **Reflow:** dynamic adjustment of a lesson plan to account for slower-than-planned progress.

## Common questions

**Q: Why reject anchors longer than 200 characters?** A: Long regexes are often mistakes and slow to compile. Most real data needs much shorter patterns.

**Q: What if two questions have exactly the same words?** A: They'll be in the same group if there are at least `minRepeats` of them.

**Q: Why 27%?** A: Educational research shows that the top and bottom 27% maximize discrimination variance and reduce noise.

**Q: Can an item be flagged for low discrimination even if it has high p?** A: Yes; if only the top students get it right and the bottom students also mostly get it right, the item doesn't discriminate mastery.

**Q: What if a topic is covered on day 5 but planned for day 3?** A: It stays on day 5. Reflow only moves topics that were *planned* but not *covered* within the window.

**Q: Can the same submission appear in multiple clusters?** A: No; every submission's id appears in exactly one cluster.

## Reinforcement activity

1. Build a rule to extract "total calories" from nutrition app screenshots, where the label might be "Calories", "CALORIES", or "Total Calories:" on one line, and the number on the next.

2. Group these three questions: "How do I deploy?", "what's the deploy process?", "how to deploy to azure?". Compare your result to Jaccard similarity 0.6 with stop words removed.

3. Compute at-risk levels for three learners: (locked: 2, overdue: 30, days: 2, score: 60), (locked: 0, overdue: 100, days: null, score: null), (locked: 0, overdue: 0, days: 0, score: 90).

## Check yourself

1. What happens if a screenshot field anchor matches a line but that line has no number?
<details>The field value is null. The returned object still includes the field name with value: null, line: null.</details>

2. Why are stop words removed before computing Jaccard similarity?
<details>Stop words appear in almost every question and add noise; removing them reveals the real conceptual overlap.</details>

3. How many risk factors must be present for a learner to reach "risk" level?
<details>Two or more. One factor gives "watch"; zero gives "ok".</details>

4. If 10 learners take a test and 8 pass an item, what is p and what are the groups?
<details>p = 0.8. Top 27% = 2 learners, bottom 27% = 3 learners (rounded down, at least 1). Discrimination depends on how many of each group got it right.</details>

5. What makes two submissions cluster together?
<details>They have the exact same set of failing checks (in any order). The signature is the sorted list of failing check ids.</details>

## Quick reference

- `validateRules(rules): string[]` — returns list of problems; [] = valid.
- `applyParseRules(lines, rules): Record<fieldName, {value: number | null, line: number | null}>`
- `tallyExitTickets(responses): {choiceId, count}[]` — sorted by count desc, then by id asc.
- `suggestFaq(questions, minRepeats = 3): {representative: string, ids: string[]}[]`
- `atRisk(s): {level: 'ok' | 'watch' | 'risk', reasons: string[]}`
- `itemAnalysis(rows): {itemId, p, discrimination, flag}[]`
- `clusterSubmissions(subs): {signature: string[], ids: string[]}[]`
- `reflow(plan, covered, throughDay): {plan, moved: {topic, from, to}[]}`

## Connection to the bigger picture

**Server side (SPEC §5):** The server runs these functions on data collected from learners and trainers. Screenshot rules are authored once by AI and frozen. FAQ grouping runs on exit-ticket text. At-risk feeds a learner dashboard. Item analysis powers test review. Clustering highlights systemic misunderstandings. Reflow adjusts the syllabus when pacing slips.

## Next

End of the chain for now.
