# Recall — Health digest and morning checklist

## Exercise 1 — Staleness calculation (3 min)

**What to do:** A backup ran at time 1000. The current time is 175_000_000 (milliseconds). The staleness threshold is 48 hours (172_800_000 ms). Is the backup stale?

Show your math.

**The answer (check after):** 175_000_000 - 1000 = 174_999_000. Is 174_999_000 > 172_800_000? Yes. The backup is stale.

## Exercise 2 — Null vs false (3 min)

**What to do:** You're running a morning checklist offline. The checklist has 4 checks: 2 offline (disk, ca-valid), 2 online (sync, backup-s3). Both offline checks pass. Neither online check runs.

Fill in the results table:

| id | kind | ok | ranAt | lastKnownAt |
|---|---|---|---|---|
| disk | offline | ? | ? | ? |
| ca-valid | offline | ? | ? | ? |
| sync | online | ? | ? | 60000 |
| backup-s3 | online | ? | ? | null |

**The answer (check after):**

| id | kind | ok | ranAt | lastKnownAt |
|---|---|---|---|---|
| disk | offline | true | NOW | undefined |
| ca-valid | offline | true | NOW | undefined |
| sync | online | **null** | **null** | 60000 |
| backup-s3 | online | **null** | **null** | null |

The key: offline checks run (ok is a real value, ranAt is set). Online checks are skipped (ok and ranAt are null). The lastKnownAt is preserved exactly as it came in.

## Cards

**Q:** What is the 48-hour staleness threshold for backups?

**A:** A backup older than 48 hours cannot be trusted to restore less than a day-old data. Two full 24-hour backup windows means you have a 24-hour rolling recovery window. At 48 hours, your risk of unrecoverable loss is too high.

---

**Q:** Why does `isBackupStale` return `true` for `lastSuccessAt === null`?

**A:** If a backup has never succeeded, you have no fallback. It's immediately stale (or never "fresh" in the first place). Treating null as stale tells the UI: "You don't have a working backup for this target."

---

**Q:** Why run offline checks first in the morning checklist instead of all at once with `Promise.all()`?

**A:** Offline-first is a guarantee that local checks complete before any online attempt. If you run them concurrently, a slow offline check might start after a fast online check, breaking the order. Sequential loops ensure offline always finishes first.

---

**Q:** What does `ok: null` mean in a checklist result?

**A:** It means "this check was not run because we're offline." It's different from `ok: false` (the check ran and failed). The UI can show this with a clock icon and "Last checked X ago" instead of a red X.

---

**Q:** If a backup has `lastSuccessAt: 0` (the Unix epoch), is it stale?

**A:** Only if the current time is more than 48 hours after the epoch. In practice: if your system's `now` is January 2, 1970 or later, and the backup claims success at January 1, 1970, yes, it's stale. (But your system's clock is probably very wrong if `now` is that old!)
