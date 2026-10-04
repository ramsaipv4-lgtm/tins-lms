# Activity key — Section keys and teleprompter-paced release

**Trainer-only.**

## Reinforcement activity

```js
const plan = releasePlan(0, [{ id: 'g', plannedSec: 10, graded: true }]);
assert.equal(isReleased({ id: 'g', graded: true }, plan, { now: 9e12, reachedIds: [], releaseAll: false }), false);
```

## Check yourself

1. Yes. 2. It throws. 3. null. 4. No.
