# Trainer prep — The board, its pages and a PDF with notebook ruling

## Before you start (prerequisites)
Learners know feature groups (ms-07.01) and have seen a lazy `import()`.

## 45-minute self-study path
Read the lesson, open `pdf.ts` and run `node --test packages/web/test/board.test.mjs`, then rebuild the web app and compare the chunk list with and without the board route.

## Worked example → faded example
Worked: trace `rulingYs()` for the A4 defaults. Faded: change the gap to 30 and predict the count before running the test.

## Top misconceptions
- "Fork means copy the source": here it means own the page model, UI trimming and export around the pinned package.
- "Lazy loading is a library setting": it is decided by where `import()` sits.
- "A PDF needs a library": a minimal PDF is text with exact byte offsets.

## Questions students will ask (with answers)
- *Why JPEG in the PDF?* It embeds directly (`DCTDecode`) without a compressor.
- *Can learners edit the board?* No; phones get the PDF (D-36).

## Your mastery check (private)
Ask the learner to explain why the first-load bundle does not contain Excalidraw and to name the test that proves the ruling.
