# Activity key — Screenshot rules, FAQ, at-risk, item analysis, clusters, re-flow

## Activity 1: Screenshot rule for nutrition data

Build a rule to extract "total calories" from screenshots where the label is on one line and the number on the next.

**Solution:**
```ts
{
  name: 'calories',
  anchor: 'total\\s*calories',
  pick: 'next-line-number',
}
```

The anchor matches "Total Calories:", "TOTAL CALORIES", or variants (case-insensitive by default). The number is on the next line.

## Activity 2: FAQ grouping

Group "How do I deploy?", "what's the deploy process?", "how to deploy to azure?" by Jaccard similarity.

**Solution:**

Stop words: a, an, the, is, are, to, of, in, how, what, why, do, i

- Q1: `{ deploy }`
- Q2: `{ deploy, process }`
- Q3: `{ deploy, azure }`

Jaccard(Q1, Q2) = 1/2 = 0.5 (not ≥ 0.6; different group)
Jaccard(Q1, Q3) = 1/2 = 0.5 (not ≥ 0.6; different group)
Jaccard(Q2, Q3) = 1/3 ≈ 0.33 (not ≥ 0.6; different group)

Result: Three separate groups (or three groups of size 1, which are below `minRepeats = 3`).

## Activity 3: At-risk levels

Compute levels for:
1. (locked: 2, overdue: 30, days: 2, score: 60) → watch
2. (locked: 0, overdue: 100, days: null, score: null) → watch
3. (locked: 0, overdue: 0, days: 0, score: 90) → ok

**Solution:**

1. Locked ≥ 1 (1 pt), overdue < 50 (0 pt), days < 5 (0 pt), score ≥ 50% (0 pt) = 1 pt → watch
2. Locked = 0 (0 pt), overdue ≥ 50 (1 pt), days = null (0 pt), score = null (0 pt) = 1 pt → watch
3. All signals < threshold = 0 pt → ok

## Activity 4: Item discrimination on a 10-learner test

Learners ranked by total correct: [8, 7, 7, 6, 5, 5, 4, 3, 2, 1]
Top 27% = 3 learners; bottom 27% = 3 learners.

For an item where the top group gets [yes, yes, no] and bottom gets [no, no, no]:
- p(top) = 2/3 ≈ 0.67
- p(bottom) = 0/3 = 0
- discrimination = 0.67

Flag? p is 0.67 (not extreme), discrimination is 0.67 (≥ 0.2) → Not flagged. The item discriminates well.

## Activity 5: Submission clustering

Three submissions:
- s1: failing = ['check-a', 'check-b']
- s2: failing = ['check-b', 'check-a']
- s3: failing = ['check-c']

**Solution:**

Signature for s1 and s2: ['check-a', 'check-b'] (sorted)
Signature for s3: ['check-c']

Clusters:
1. Signature ['check-a', 'check-b'], ids: [s1, s2] (size 2, biggest first)
2. Signature ['check-c'], ids: [s3] (size 1)

## Activity 6: Lesson plan re-flow

Plan:
- Day 0: [A, B, C]
- Day 1: [D, E]
- Day 2: [F]

Covered:
- Day 0: [A]
- Day 1: [D]

`throughDay` = 1

**Solution:**

Uncovered by day 1: B, C (day 0), E (day 1)
These move to day 2 in order: [B, C, E, F]

Result:
- Day 0: [A]
- Day 1: [D]
- Day 2: [B, C, E, F]
- Moved: [{B, from: 0, to: 2}, {C, from: 0, to: 2}, {E, from: 1, to: 2}]
