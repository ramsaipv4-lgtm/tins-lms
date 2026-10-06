---
id: ms-05.01
title: Package import and content gate
module: 5
est_minutes: 45
prereqs: [ms-02.04]
objectives: 3
new_terms: 6
skills: [content-validation, layout-tolerant-parsing, expiring-waivers]
source_refs: [{ path: packages/core/src/gate.ts, commit: 0d69d2fe3e0bb1525f66b2624049bedb6679e7a6 }]
next: ms-06.01
---

# MS 5.1 — Package import and content gate
*Step 18 of 42*

## Prerequisites

- Reading Markdown headings and tables
- The teleprompter parser from the pacing step (`parseScriptSections`, `scriptTotalSec`)
- Regular expressions at a basic level

## You already understand this

- A checklist at a loading dock: the pallet is accepted only if every line is ticked.
- A pass you can borrow for a day: it expires, and some doors never accept it.
- Two shelf layouts for the same books: the library finds the same book either way.

## The detective question

**Problem:** A trainer imports a course package. It may be laid out the old way (companions in the track folder, files named with a day suffix) or the new way (one folder per day). Broken packages must be caught before class: a missing file, a README that lies, a script that does not fit its slot, a graded question with no answer.

**Options considered:**
1. Trust the author and parse whatever is there.
2. Walk the folder tree on disk and check it.
3. Take a plain map of path to text, accept both layouts into one day shape, and run eight named checks over it.

**Choice:** Option 3: `parsePackage` and `runGate` both take `Record<string, string>`.

**Why:** A map needs no file system, so the same code runs on the server, in the browser and in tests. Eight named checks make a failure say exactly what to fix, and waivers let a trainer ship with a known, time-limited gap.

## Learning objectives

1. Group files into days from two different folder layouts.
2. Write a check as a pure function that returns a named pass or fail with a detail.
3. Apply an expiring waiver that cannot cover graded content.

## Conceptual understanding

A day is found from a path in one of two ways: its parent folder is `day{N}`, or its name ends in `_dayNN.md`. Both give the same key (track folder plus number), so a day split across both places is still one day. Each file is stored under its kind, the name without the day suffix, so `quicklearn.md` and `quicklearn_day01.md` are both `quicklearn`.

The eight checks are G1 to G8. Each returns an id, a pass flag and a detail sentence. Nothing here reads a clock; `now` is an argument. A waiver names a check, a reason, a person and an expiry. It applies only while `now` is before the expiry, and an expiry more than seven days away is cut back to seven days from `now`. `G7-graded` skips waivers entirely.

## Walkthrough of the real code

Finding the day from a path accepts both layouts.

```ts packages/core/src/gate.ts
    const folderMatch = folder.match(/^day0*(\d+)$/i);
    const nameMatch = name.match(/[_-]day0*(\d+)\.md$/i);
    if (folderMatch) {
      // v1.2: companions inside day{N}/
      index = parseInt(folderMatch[1], 10);
      trackDir = dirOf(dir);
      key = trackDir + '|' + index;
    } else if (nameMatch && isCompanionKind(kindOf(name))) {
      // v1.1: companions in the track root, *_dayNN.md
      index = parseInt(nameMatch[1], 10);
      trackDir = dir;
      key = trackDir + '|' + index;
    } else {
      continue;
    }
```

A check is a small pure function. G6 walks the fences and reports each opening fence with no language.

```ts packages/core/src/gate.ts
function g6(files: Record<string, string>): GateCheck {
  const problems: string[] = [];
  for (const path of Object.keys(files).filter((p) => /\.md$/i.test(p)).sort()) {
    let open: { marker: string; len: number } | null = null;
    const lines = files[path].split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
      if (!m) continue;
      if (open === null) {
        open = { marker: m[1][0], len: m[1].length };
        if (m[2].trim() === '') problems.push(`${path}:${i + 1} code block has no language`);
      } else if (m[1][0] === open.marker && m[1].length >= open.len && m[2].trim() === '') {
        open = null;
      }
    }
  }
  return result('G6-code-lang', problems, 'every code block has a language');
}
```

Waivers are applied after the checks run, so the checks stay simple.

```ts packages/core/src/gate.ts
  const checks = raw.map((c) => {
    if (c.pass || c.id === 'G7-graded') return c;
    const w = waivers.find((x) => {
      if (x.check !== c.id) return false;
      if (typeof x.reason !== 'string' || x.reason.trim() === '') return false;
      if (typeof x.by !== 'string' || x.by.trim() === '') return false;
      const expires = Math.min(x.expiresAt, now + WAIVER_CAP_MS);
      return now < expires;
    });
    return w ? { ...c, waived: true, detail: `${c.detail} (waived by ${w.by}: ${w.reason})` } : c;
  });
```

## Your turn: faulty first

Real mistakes from the build journal. Find the bug before reading the fix.

1. A test said a waiver stops working eight days later, but the gate passed. Why?
2. The same package in the v1.1 layout gave 6 days instead of 3. What did the grouping key get wrong?
3. A clean fixture failed G5. The deep dive linked to `printable_handout.md`, which the v1.1 layout renames. What should the link point to?

## Technical glossary

- **Companion file:** a day file such as the quick-learn or the handout.
- **Layout v1.1 / v1.2:** companions in the track root with day suffixes, or in a folder per day.
- **Check id:** a stable name like `G3-diagnostic`.
- **Waiver:** a signed, expiring permission to pass a failed check.
- **Drift:** a README table that no longer matches its folder.
- **Fence:** the triple-backtick lines around code in Markdown.

## Common questions

**Q: Why can G7 never be waived?** A: A graded item without an answer key cannot be marked fairly.

**Q: Why a map of strings and not a folder?** A: The same code then runs anywhere and is easy to test.

## Reinforcement activity

In a scratch script, build a tiny two-file package, break one check, then waive it with an expiry 30 days out and print the result. Then try the same waiver on a broken exam bank.

## Check yourself

1. Which two paths name the same day: `t/day1/quicklearn.md` and what?
<details>`t/quicklearn_day01.md`; both group under track `t`, day 1.</details>
2. A waiver expires in 30 days. How long does it really last?
<details>Seven days from the `now` passed to `runGate`.</details>
3. Can `G7-graded` be waived?
<details>No. The waiver is ignored.</details>
4. What does G2 compare?
<details>The file names in each README table against the files that exist in that folder, including the README itself.</details>

## Quick reference

- `parsePackage(files)` returns `{ days, problems }`
- `runGate(files, waivers?, now?)` returns `{ pass, checks }`
- Checks `G1-files` to `G8-cards`

## Connection to the bigger picture

The server's import route (SPEC 5.8) runs this gate on an uploaded package before it is released to a class.

## Next

Next: [MS 6.1 — Server foundation](../ms-06.01/lesson.md).
