---
id: ms-07.08
title: Coach space, screenshot import, portfolio, engagement
module: 7
est_minutes: 45
prereqs: [ms-07.07]
objectives: 4
new_terms: 6
skills: [client-side-encryption, state-machines, lazy-loading]
source_refs: [{ path: packages/web/src/features/coach/lib.ts, commit: 691c2077d12443afe8315f07dbd5a9460ce12b54 }, { path: packages/web/src/features/coach/strike.ts, commit: 691c2077d12443afe8315f07dbd5a9460ce12b54 }]
next: end
---

# MS 7.8 — Coach space, screenshot import, portfolio, engagement

*Step 1 of N*

## Prerequisites

- Web Crypto basics (AES-GCM, PBKDF2)
- React state and lazy routes
- Journeys as Playwright scripts

## You already understand this

- A phone lock screen: a PIN opens the phone, and the apps inside are not rewritten.
- A safe with a key inside: the PIN opens the box that holds the real key.
- A quiz round: five questions, one score.

## The detective question

**Problem:** The Coach space holds private plans and trackers. It needs its own PIN, the data must be unreadable on the hub, and the coaching conversation must reach a plan in at most 25 taps.

**Options considered:** Encrypt with a key made straight from the PIN; keep the data on the server; wrap a random data key with the PIN.

**Choice:** Wrap a random data key with a PBKDF2 key made from the PIN. Entries are sealed with the data key and sent to the hub as `enc` only.

**Why:** Changing the PIN re-wraps one key instead of re-encrypting every entry, and the hub never sees plaintext.

## Learning objectives

1. Explain how a PIN unlocks a wrapped data key.
2. Run the coaching conversation with defaults and version the plan.
3. Load OCR lazily so the shell bundle stays small.
4. Keep engagement features team-level and presentation-only.

## Conceptual understanding

The PIN is stretched with PBKDF2-SHA-256 (600,000 iterations). A wrong PIN makes the unwrap throw, which is the whole "wrong PIN" check. The conversation has five stages (context, goal, constraints, pathway, plan); each has a default, so "Accept defaults" is one tap per stage. Each saved plan is a new encrypted entry, so versions are never overwritten. Heading Strike rounds are drawn from a seeded random generator, so a round is reproducible in tests.

## Walkthrough of the real code

Unlocking is a single unwrap; a wrong PIN throws and returns false.

```ts packages/web/src/features/coach/lib.ts
export async function unlockWithPin(person: string, pin: string): Promise<boolean> {
  const meta = await dbGet(person, META_ID);
  if (!meta) return false;
  try {
    const key = await unwrapPersonKey(base64Decode(meta.wrapped), await wrappingKey(pin, base64Decode(meta.salt)));
    setUnlocked(person, key);
    return true;
  } catch { return false; }
}
```

A Heading Strike round hides one real heading among two look-alikes.

```ts packages/web/src/features/coach/strike.ts
export function buildRound(seed: string, size = ROUND_SIZE): Question[] {
  const rng = createRng(seed);
  return shuffle(TITLES, rng).slice(0, size).map((title, i) => {
    const level = 1 + Math.floor(rng() * 3);
    const real = `${'#'.repeat(level)} ${title}`;
    const options = shuffle([real, `${'#'.repeat(level)}${title}`, `- ${title}`], rng);
    return { id: `q${i + 1}`, options, answer: options.indexOf(real) };
  });
}
```

## Your turn: faulty first

Mistake from the build: the first version used `openPersonDb` from the shared data helper. Tapping "Set PIN" showed "Something went wrong" and the console said `TypeError Class extends value #<Object> is not a constructor or null`. Find where the failing import comes from, then switch the Coach code to `fetch` against `/db/person-<key>`.

## Technical glossary

- **PBKDF2:** turns a short PIN into a key by repeating a hash many times.
- **Wrapped key:** a key encrypted by another key.
- **Lazy import:** code fetched only when first used.
- **Parse rules:** approved anchors that pull numbers out of OCR lines.
- **Team-level:** shown per team, never per person.
- **Story mode:** a switch that changes wording only.

## Common questions

**Why does course content never ask for the PIN?** Only Coach data is private; F-05 says content stays open.

**Why can a minor not save entries?** The hub refuses `coachEntry` for under-18 accounts (D-33).

## Reinforcement activity

Add a fourth pathway card to `pathwayCards` in `plan.ts` and write a unit test for its hours.

## Check yourself

1. What does a wrong PIN cause inside `unlockWithPin`?
<details>The unwrap throws, the function returns false and no key is stored.</details>
2. Why is the plan saved as a new entry each time?
<details>Versions must be kept; entries are never overwritten.</details>
3. Why is `tesseract.js` imported inside a function?
<details>So it is a separate chunk and stays out of the shell bundle.</details>

## Quick reference

PIN → PBKDF2 → unwrap data key → seal entries as `enc`.

## Connection to the bigger picture

This step uses the keys from the core (ms-04) and the sync guard that refuses plaintext coach entries.

## Next

End of the chain for now.
