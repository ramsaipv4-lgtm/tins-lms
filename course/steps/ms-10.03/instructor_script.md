# Instructor script — Health digest and morning checklist
### Total runtime: **30 minutes**

> Say/Do teleprompter. `[SAY]` lines are read aloud; `[DO]`, `[TYPE]`, `[BOARD]`, `[PAUSE]` are actions;
> `⚠️ LIKELY CROSS-Q` marks questions students usually ask.

## Hook (0:00 — 0:03)

[SAY] A backup that's a week old isn't a backup—it's a monument. In the next 30 minutes we're building the health digest: a status board that tells you if your Coach system is actually ready for training today.

[DO] Show a screenshot of a green health digest on the board.

## Faulty first (0:03 — 0:10)

[SAY] Let's say you write a health check like this:

[TYPE]
```ts
export async function healthDigest(backups, checks) {
  return {
    status: 'green',
    backups: backups,
    checks: checks,
  };
}
```

[SAY] What's wrong? The digest doesn't actually check if backups are stale. A backup from last month looks the same as one from this morning.

[DO] Pause. Let learners spot it.

⚠️ LIKELY CROSS-Q: Should every backup older than 24 hours be red? — Answer: The spec says 48 hours. Why? A 24-hour full backup plus a 24-hour rolling window means you have two days of data. At 48 hours you're asking for trouble.

## Fix and explain (0:10 — 0:25)

[SAY] The digest needs to know what "now" is, and do the math:

[TYPE]
```ts
const STALENESS_THRESHOLD_MS = 48 * 3_600_000;

function isBackupStale(now, lastSuccessAt) {
  if (lastSuccessAt === null) return true;
  return now - lastSuccessAt > STALENESS_THRESHOLD_MS;
}
```

[SAY] Every backup gets a `.stale` flag. If any backup is stale, the digest turns red.

[DO] Walk to the board. Draw a timeline:

```txt
Now ────────────────────────────────────────
                                      ↑ 47h ago: S3 backup (green)
                                  ↑ 49h ago: Folder backup (red!)
                                ↑ null: Drive backup (never completed, red!)
```

[SAY] The folder backup and the drive backup make the whole digest red because you can't recover from them.

[PAUSE]

[SAY] The morning checklist is different. It runs local checks first, then asks for the network. When you're offline, it doesn't fail—it just says "I didn't check that online thing, but here's what I remember from before."

[TYPE]
```ts
if (online) {
  for (const check of onlineChecks) {
    const ok = await check.run();
    // result with ok and ranAt
  }
} else {
  for (const check of onlineChecks) {
    // result with ok: null, ranAt: null, lastKnownAt: check.lastKnownAt
  }
}
```

[SAY] Notice: null means "didn't check", not "checked and failed". It's the difference between not knowing and knowing something is broken.

## Check yourself (0:25 — 0:30)

[SAY] Let's test this:

1. [DO] Show the code for `isBackupStale`. [ASK] If a backup ran exactly 48 hours ago and now is exactly 48 hours and 1 millisecond later, is it stale?

   [ANSWER] Yes, because `>` not `≥`. At exactly 48 hours it's still safe.

2. [ASK] Why does the morning checklist return null instead of just omitting the online check results when offline?

   [ANSWER] Because the UI needs to show something. With null, you can show a clock icon and "Last checked 2 hours ago". With an omitted field, the UI doesn't know whether you're offline or the check just hasn't run yet.

3. [ASK] If you have 3 offline checks and 2 online checks, and you run the morning checklist offline, in what order do the results come back?

   [ANSWER] All 3 offline results first (in their original order), then both online results. Not interleaved, not sorted by status. Offline-first is a guarantee.

[PAUSE]

[SAY] That's the health digest and morning checklist. They're adapter functions: they sit between the core logic and the UI layer, translating system state into something humans can act on. Go build your own checks—disk space, network latency, certificate expiry—and plug them in.
