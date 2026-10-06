---
id: ms-07.01
title: Web foundation
module: 7
est_minutes: 45
prereqs: []
objectives: 3
new_terms: 6
skills: [web-shell, feature-registry, pseudo-locale]
source_refs: [{ path: packages/web/src/features/registry.ts, commit: 9c21b82 }, { path: packages/web/src/strings/index.ts, commit: 9c21b82 }]
next: ms-07.02
---

# MS 7.1 — Web foundation
*Step 26 of 42*

## Prerequisites

You already understand:
- What a React component and a URL path are
- What a JSON file of strings is

## You already understand this

- A building's reception desk: everyone enters through it, then goes to their own floor. The shell is the desk, role spaces are floors.
- A shared notice board with a fixed format: each team pins its own cards without touching the board's frame.

## The detective question

**Problem:** Eight later builders each add screens to the same web app at the same time. If they all edit the router, the menu and the strings file, they collide on every merge.

**Options considered:**
1. One shared router file that every builder edits
2. A registry that discovers one folder per feature group and reads a `routes` array and a strings file from it
3. A separate app per group

**Choice:** Option 2: `import.meta.glob` finds every `features/<group>/index.tsx` and `strings.en.json`.

**Why:** Each builder only touches their own folder, so merges never conflict. Option 1 collides constantly; option 3 breaks the single installable offline app (D-5) and the shared session.

## Learning objectives

After this step you will be able to:
1. Say how a feature group adds a screen, a menu entry and a string without editing the shell
2. Explain why every visible string goes through `t()` and what the pseudo-locale proves
3. Explain why the shell chunk stays small and heavy code sits behind `load()`

## Conceptual understanding

The shell renders a header with one `<nav>` per role space and loads the person from `/api/me`. `app-ready` appears only after the session answer arrived, so a journey never races it. Paths are real URLs (History API), so a journey can open any menu link directly.

The join page at `/join/<code>` shows the Terms and Conditions, asks for a date of birth, creates the account, then runs the Day −1 setup check whose rows carry `data-state="pass|fail"`.

## Walkthrough of the real code

### One route type for every group

```ts packages/web/src/features/registry.ts
export interface FeatureRoute {
  path: string;
  space: Space;
  label: string;
  nav?: boolean;
  order?: number;
  roles?: Role[];
  load: () => Promise<{ default: ComponentType<{ params: Record<string, string> }> }>;
}

const modules = import.meta.glob('./*/index.tsx', { eager: true }) as Record<string, { routes?: FeatureRoute[] }>;

export const featureRoutes: FeatureRoute[] = Object.keys(modules).sort().flatMap((k) => modules[k].routes ?? []);
```

`load` is a dynamic import, so a screen's code (the board's, above all) is downloaded only when its route opens.

### Strings and the pseudo-locale

```ts packages/web/src/strings/index.ts
export function t(key: string, params?: Record<string, string | number>): string {
  let s = strings[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? ''));
  pseudo ??= pseudoLocale();
  return pseudo ? `⟦${s}⟧` : s;
}
```

With the pseudo-locale on, any text on screen without ⟦…⟧ is a hard-coded literal.

## Your turn: faulty first

Faulty attempt 1: the home screen used `data-testid="home-learn"` (the URL space name). The journey contract says `home-learner`, and the test timed out waiting for it. What is the fix? (Map the space to the role name in one table.)

Faulty attempt 2: a test started the server before launching the browser; the browser failed to launch and the server was never stopped. How do you order the setup so cleanup always runs?

## Technical glossary

- **Shell**: the always-loaded frame (header, navs, session).
- **Role space**: Admin, Teach, Learn or Coach area with its own menu.
- **Registry**: the list of routes gathered from feature folders.
- **Pseudo-locale**: every string wrapped in ⟦…⟧ to expose hard-coded text.
- **Deep link**: a URL that opens a screen directly.
- **Precache**: files the service worker stores so the app opens offline.

## Common questions

- *Why no router library?* D-14 forbids new dependencies; the History API is enough.
- *Where does the server set the pseudo-locale?* It does not yet; see the gap in the journal.

## Reinforcement activity

Add a fake route to the `learn` group with `nav: true` and say which files you edit. (Answer: only that group's `index.tsx` and `strings.en.json`.)

## Check yourself

1. Which two files does a group own?
<details>Index.tsx exporting routes, and strings.en.json.</details>
2. Why does `app-ready` wait for the session?
<details>So a journey that logs in first never looks for the menu before it exists.</details>
3. How does the pseudo-locale find a literal?
<details>Every string from `t()` is wrapped in ⟦…⟧, so unwrapped text is hard-coded.</details>

## Quick reference

`routes`, `FeatureRoute`, `t(key)`, `api()`, `syncDb()`, `useSession()`.

## Connection to the bigger picture

Every later screen task plugs into this shell.

## Next

Next: [MS 7.2 — Admin class setup, syllabus, college outputs, Google opt-in](../ms-07.02/lesson.md).
