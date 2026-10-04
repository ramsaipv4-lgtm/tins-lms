# Trainer prep — Health digest and morning checklist

## Before you start (prerequisites)

Learners should understand:
- Async/await patterns (they'll read `await check.run()`)
- Time arithmetic and millisecond values
- The difference between null, undefined, and false
- Why a system should report "not checked" vs "checked and failed"

Pre-requisite step: ms-01.01 (basic pure functions and time arguments)

## 30-minute self-study path

1. **5 min**: Read the lesson up to "Your turn: faulty first". Pay special attention to why null is used for skipped online checks.
2. **10 min**: Run the test cases from the lesson against the real code. Change the time values and see how staleness changes.
3. **5 min**: Trace through the morning checklist with pen and paper: draw the offline checks on one lane, online checks on another, and show how they merge (offline first).
4. **10 min**: Write your own check function (e.g., `async function checkDiskSpace() { ... }`). Plug it into a checklist and run it. Feel how the separation of concerns works: the checklist orchestrates, the check function does the actual work.

## Worked example → faded example

**Worked example:** A backup was last successful 46 hours ago. Now is 47 hours later.

```ts
// Worked: we show all the math
const lastSuccessAt = someTime;
const now = lastSuccessAt + 47 * 3_600_000;
const THRESHOLD = 48 * 3_600_000;
const ageMs = now - lastSuccessAt; // 47 * 3_600_000
const isStale = ageMs > THRESHOLD; // false (47 < 48)
```

**Faded example:** A backup was last successful at timestamp 1000. Now is 172_800_001 (48 hours + 1 ms).

```ts
// Faded: use the real function
const lastSuccessAt = 1000;
const now = 172_800_001;
const isStale = isBackupStale(now, lastSuccessAt); // fill this in
```

**Blank example:** A backup has never run (lastSuccessAt is null). Is it stale?

```ts
const isStale = isBackupStale(now, null); // call the function, predict the result
```

## Top misconceptions

1. **"Online checks should also run when offline, but just fail."** — Wrong. The whole point of offline-first is to avoid failures. We run what we can (offline checks), skip what we can't (online checks), and show the last-known value. The user gets useful info without being told things are broken.

2. **"I'll use `Promise.all()` to run all checks at once."** — This breaks offline-first. You lose the guarantee that offline checks complete before online ones. Use a sequential loop.

3. **"If lastSuccessAt is null, I'll just use Date.now() as a fallback."** — Never. Null means "it never happened." Inventing a time is a lie that will hide real problems.

4. **"The 48-hour threshold is arbitrary."** — It's not. It represents two full 24-hour backup windows. Before 48 hours, you have a 24-hour rolling recovery window. At 48+ hours, you're in the danger zone.

5. **"I'll mark a backup as stale only if the last attempt failed."** — Backups can succeed and still be old. Age is separate from success. An old successful backup is still stale.

## Questions students will ask (with answers)

**Q: Can I make the 48-hour threshold configurable?**

A: The spec locks it to 48 hours. If your deployment needs a different threshold, that's a new decision that should go in SPEC as a D-row. For now, keep it at 48.

**Q: What if a check's `run()` function throws an error?**

A: The checklist doesn't catch it (that's up to the caller). In practice, the adapter layer should wrap each run function in a try/catch and return `ok: false` on error. The checklist just calls the function it was given.

**Q: Should I sort the results by status (all passes first, then failures)?**

A: No. Return offline checks first, then online checks. Don't re-sort by ok/not-ok. The UI will handle highlighting failures.

**Q: If I'm offline and a check has no lastKnownAt, what do I show?**

A: The result will have `lastKnownAt: undefined`. The UI should show "Never checked" or omit that check from the list.

**Q: Can a check be both offline and online (e.g., "check local cache, verify online")?**

A: Not with this function. A check is one kind or the other. If you need both, make two checks: `cache-fresh` (offline) and `cache-synced` (online).

## Your mastery check (private)

1. Implement `isBackupStale` from memory, without looking at the code. Test it with:
   - `now=100, lastSuccessAt=null` → should be true
   - `now=173_000_000, lastSuccessAt=100` → should be true (> 48 h)
   - `now=172_800_000, lastSuccessAt=0` → should be false (exactly 48 h)
   - `now=172_800_001, lastSuccessAt=0` → should be true (> 48 h)

2. Write the logic for separating checks by kind and running offline first. Don't use `Promise.all()`.

3. Explain to a learner why we return `ok: null` for skipped online checks instead of just omitting them.

If you can do all three, you're ready to teach this.
