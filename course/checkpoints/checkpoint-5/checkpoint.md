# Checkpoint 5: budgets and load (after module 9)

**Covers:** ms-09.01 (and the lazy-loading ideas from ms-07.01 and ms-08.01). **Rows:** AC-100, AC-102, AC-103 (AC-101 is checked in module 11). **Time:** about 45 minutes.

## Build

1. **Measure the shell, not the app.** Build the web package. List the JavaScript the app shell loads: the scripts and module preloads that `dist/index.html` references, plus every chunk they import statically, followed transitively. Do not follow `import()` targets. Add up the gzip sizes and compare with the 300 KB budget of AC-102. Then add up every `.js` file in `dist/assets` and compare. Say which number the budget means and why the other is misleading (integration I-4).
2. **Compression.** Request the shell's main script with and without `Accept-Encoding: br, gzip`. Which sizes do you see, and why does the budget test care about the size on the wire (b9-1, decision 2; I-8)?
3. **Load test.** Start a hub in test mode and run the CLI with a small number of learners:

```bash
node packages/cli/src/main.ts loadtest --learners 20 --target http://127.0.0.1:4599
```

   Read the last stdout line. Which fields decide `pass`, and what does the SPEC say each threshold is (AC-103)?
4. **A load test that fails only on a busy machine.** Your 200-learner run fails with a high p95 while a second process is running. Give two causes, one in the test and one in the machine, and what you would change in the test (b9-1, M3).
5. **Claiming rows.** You changed a chunking option and AC-102 passed once. When may you add AC-102 to `build/progress/<task>.json`?

## Verify

Paste your numbers for (1) and the JSON line for (3). For (2) paste the two `content-length` values.

## Pass

14 of 20 points on [the rubric](rubric.md).
