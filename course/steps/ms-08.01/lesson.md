---
id: ms-08.01
title: The board, its pages and a PDF with notebook ruling
module: 8
est_minutes: 45
prereqs: [ms-07.01]
objectives: 3
new_terms: 6
skills: [lazy-loading, wrapper-over-library, file-formats]
source_refs: [{ path: packages/board/src/pdf.ts, commit: 4505e3f }, { path: packages/board/src/BoardCanvas.tsx, commit: 4505e3f }, { path: packages/web/src/features/board/index.tsx, commit: 4505e3f }, { path: packages/server/src/routes/features/board.ts, commit: 4505e3f }]
next: end
---

# MS 8.1 — The board, its pages and a PDF with notebook ruling

*Step 1 of N*

## Prerequisites

You already understand:
- How a feature group adds routes and strings (ms-07.01)
- What a lazy `import()` does

## You already understand this

- A classroom whiteboard photographed at the end of the lesson, then printed on lined paper: the lines belong to the paper, not to the board.
- A heavy textbook kept in the cupboard until a lesson needs it, so the school bag stays light.

## The detective question

**Problem:** The trainer needs a projector whiteboard with several pages, a diagram file dropped onto it, and a PDF for the phones with notebook ruling, but the board is a very large library that must not slow down the first screen.

**Options considered:**
1. Copy all of Excalidraw into our package and edit it
2. Wrap the installed Excalidraw package, trim it with options and CSS, and load it only on its route
3. Paint the ruling on the canvas so the export needs no extra work

**Choice:** Option 2, with our own tiny PDF writer.

**Why:** Only the installed package exists here and no new dependency is allowed, so a wrapper is what can be built and tested. The ruling must appear only in the PDF, so the PDF writer draws it and the canvas stays plain.

## Learning objectives

After this step you will be able to:
1. Keep a large library out of the first download with a route-level `load()`
2. Turn a dropped `.mmd` file into canvas shapes without touching the library's own drop handler
3. Write a valid one-dependency-free PDF with vector ruling lines

## Conceptual understanding

The app shell finds feature routes with `import.meta.glob`. The board's route only holds a function `() => import('./Board.tsx')`, so the board code, its stylesheet and Excalidraw become a separate chunk fetched when `/teach/board` opens. A page is one Excalidraw scene; the screen remounts the canvas with `key={page.id}` and saves each page as a `board:<id>` document in the class database, which the substitute handover already lists. A dropped `.mmd` is caught in the capture phase of the `drop` event, converted by `@excalidraw/mermaid-to-excalidraw` (itself imported on demand) and appended to the scene. Export renders each page to a JPEG and `buildPdf` lays it on an A4 page; the ruling is a loop of `m`/`l` drawing operators, so a test can count the lines.

## Walkthrough of the real code

### The route is the lazy boundary

```tsx packages/web/src/features/board/index.tsx
export const routes: FeatureRoute[] = [
  { path: '/teach/board', space: 'teach', label: 'board.nav', order: 25, roles: ['trainer', 'substitute', 'admin'], load: () => import('./Board.tsx') },
];
```

Nothing in this file imports the board, so the shell never pulls it in (AC-101, AC-102).

### Ruling is geometry, not paint

```ts packages/board/src/pdf.ts
export function rulingYs(height: number = A4.height, gap: number = RULING.gap, top: number = RULING.top, bottom: number = RULING.bottom): number[] {
  const ys: number[] = [];
  for (let y = height - top; y >= bottom; y -= gap) ys.push(round(y));
  return ys;
}
```

With the default 24-point gap an A4 page gets 30 evenly spaced lines.

### Drawing a Mermaid file

```tsx packages/board/src/BoardCanvas.tsx
export async function dropMermaid(api: any, text: string): Promise<void> {
  const { elements, files } = await mermaidToElements(text);
  const fileList = Object.values(files ?? {});
  if (fileList.length) api.addFiles(fileList);
  api.updateScene({ elements: [...api.getSceneElements(), ...elements] });
  api.scrollToContent(elements, { fitToContent: true, animate: false });
}
```

### Fonts from our own server

```ts packages/server/src/routes/features/board.ts
    const file = resolve(FONT_ROOT, rel);
    if (!file.startsWith(FONT_ROOT + sep) || extname(file) !== '.woff2' || !existsSync(file)) return new Response('not found', { status: 404 });
```

The path check stops `..` escapes and serves only `.woff2` files; the board never calls a CDN.

## Your turn: faulty first

Faulty attempt 1: a test clicked `toolbar-rectangle` and waited 30 seconds with `<path …> from <div class="ToolIcon__icon">…</div> subtree intercepts pointer events`. Why? (Upstream keeps the radio input invisible and click-through under an icon. Fix by making the input the top layer of its label.)

Faulty attempt 2: the "hidden" diamond tool was still on screen after a CSS rule on `[data-testid="toolbar-diamond"]`. What did the screenshot show and what is the right selector? (The visible button is the parent label: `label:has([data-testid="toolbar-diamond"])`.)

## Technical glossary

- **Lazy chunk**: code the browser downloads only when it is needed.
- **Scene**: the list of drawn elements of one board page.
- **Capture phase**: the first part of an event's trip, where a parent can act before the target.
- **xref table**: the PDF index of byte offsets of every object.
- **Vector line**: a line stored as drawing operators, not as pixels.
- **Notebook ruling**: evenly spaced horizontal lines across the page.

## Common questions

- *Why is the ruling not on the canvas?* The trainer draws on a plain board; ruling belongs to the printed handout.
- *Why does the PDF writer escape brackets?* In a PDF text string `(`, `)` and `\` end or alter the string.

## Reinforcement activity

An A4 page is 841.89 points high, the ruling starts 72 points from the top and stops at 60 points from the bottom with a 24-point gap. How many lines? (Answer: 30.)

## Check yourself

1. What keeps the board out of the shell download?
<details>The route's `load: () => import('./Board.tsx')`; nothing eagerly imported references the board.</details>
2. Why is the ruling drawn by the PDF writer and not on the canvas?
<details>The requirement is plain canvas and ruled PDF; the writer adds the lines as vector operators so a test can count them.</details>
3. Why does the drop handler run in the capture phase?
<details>So a `.mmd` file is handled before Excalidraw's own drop handler, which would reject it.</details>
4. What happens when the path asked of `/board-assets/` leaves the font folder?
<details>The `startsWith(FONT_ROOT + sep)` check fails and the route answers 404.</details>

## Quick reference

`rulingYs`, `buildPdf` in `packages/board/src/pdf.ts`; `dropMermaid` in `packages/board/src/BoardCanvas.tsx`; routes in `packages/server/src/routes/features/board.ts`.

## Connection to the bigger picture

The class-database documents are listed in the substitute handover (ms-07.04); the performance budgets that count the shell bundle are checked in the next batch.

## Next

End of this unit for now.
