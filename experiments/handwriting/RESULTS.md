# Handwriting → Markdown test (iteration 11)

**Question (owner):** does handwriting recognition work on the Notebook board, including writing
near, on top of, or behind shapes? Does it need an MCP-connected AI?

## Setup

- **Input:** page 2 of the owner's real whiteboard PDF (handwritten C code, a drawn grid with
  stars, a hand-drawn trace table, multiple pen colours, ruled paper), rendered at 2134×1200.
- **Four variants**, built with `make-variants.sh`:
  - **v1** original;
  - **v2** an opaque shape drawn **over** the `if / printf("*") / else` lines;
  - **v3** a translucent highlight shape over the code;
  - **v4** the writing sitting **on top of** a filled, outlined shape.
- **Ground truth:** 22 checkpoints transcribed by hand from the page (section labels, all 10 code
  lines, observations, assumptions, trace-table cells and header, example digits), scored by
  `score.mjs`. For v2 the 3 covered checkpoints are excluded from recall and instead checked for
  **hallucination** (did the model invent text it could not see?).
- **Methods:**
  - Claude **Sonnet 5.5** and **Haiku 4.5**, each reading the image (this is what a connected AI
    over MCP would do);
  - **Tesseract.js 7** OCR as the no-AI baseline.
- **Prompt:** transcribe faithfully to Markdown, headings per labelled section, code exactly as
  written, tables as Markdown tables, `[obscured]` instead of guessing.

## Results (VERIFIED: outputs and `scores.jsonl` in this folder)

| Method | v1 original (3 runs) | v2 shape over writing | v3 translucent highlight | v4 writing over filled shape |
|---|---|---|---|---|
| **Sonnet 5.5** | **22, 21, 22 / 22** | 14 / 19 visible; **0 hidden lines invented**; wrote `[obscured]` | 21 / 22 | **22 / 22** |
| **Haiku 4.5** | 14, 15, 11 / 22 | 12 / 19 visible; 0 hidden lines invented | 14 / 22 | 14 / 22 |
| **Tesseract (no AI)** | **0 / 22** (also 0 at 2.5× resolution) | 0 | 0 | 0 |

## What it shows

1. **Handwriting needs a strong vision model.**
   - Sonnet-class models read this page almost perfectly.
   - Haiku-class models misread code (`n`→`m`, `int main`→`pint main`, `printf("*")`→`printf("*d")`),
     so they are not good enough for code.
   - Classical OCR is useless on handwriting (0/22).
   - **So in practice, handwriting → text needs the connected AI (MCP) with a strong model.**
2. **Shapes behind writing (v4) and translucent shapes (v3) did not hurt Sonnet.**
3. **An opaque shape over writing (v2)** hides that text (expected). The good news: neither model
   invented the hidden lines; both marked them `[obscured]`. The bad news: Sonnet's accuracy on
   *neighbouring* lines dropped in that one run (it misread `n` as `m`, 14/19). Occlusion can
   distract the model as well as hide text.
4. **Hand-drawn stars in the trace table** were the hardest part for every method; output cells
   were often wrong or marked `[obscured]`.
5. **Variance is real** (Haiku 11–15 across three identical runs), so the trainer review step stays
   mandatory.

## Not tested (say so honestly)

- **Writing with a mouse** (jaggier strokes): no sample was available.
- **Stroke-based ("online") recognition** from Excalidraw's vector strokes, e.g. an on-device ink
  recogniser on Android. Unverified; OQ-15 stays open.
- **Real Excalidraw elements:** the shapes here were raster overlays. In the real board the app
  *knows* which elements are freehand strokes, shapes, text, tables or images (next section).

## Design consequence (goes into PLAN §6.4)

Because the board stores every element separately, the recogniser does **not** have to read a
cluttered page:

1. **Typed text, stamps, tables and dragged-in Mermaid are already text.** They go straight to
   Markdown with no recognition.
2. **Only freehand strokes are recognised.** The board renders them on their own (shapes, grid
   lines and images removed, strokes that were *under* a shape restored), section by section
   (per stamp), and sends those images to the connected AI. This removes the occlusion problem
   tested in v2.
3. **Model floor:** recognition is offered only when the connected model is Sonnet-class or better
   (configurable); otherwise the page exports as PDF and images and the handwriting stays as images.
4. **Trainer review** before publishing, with low-confidence lines highlighted.
