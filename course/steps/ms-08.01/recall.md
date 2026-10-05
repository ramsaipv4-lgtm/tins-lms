# Recall — The board, its pages and a PDF with notebook ruling

## Exercise 1 — Find the lazy boundary (5 min)
**What to do:** In `packages/web/src/features/board/index.tsx` find the one line that keeps the board out of the shell.
**The answer (check after):** `load: () => import('./Board.tsx')` inside the route entry.

## Cards
**Q:** Where does the notebook ruling exist?
**A:** Only in the exported PDF, as vector `m`/`l` lines written by `buildPdf`; the canvas stays plain.

**Q:** Why click `toolbar-rectangle` through the input itself?
**A:** Upstream hides that radio input under an icon, so a plain click is intercepted; the fork makes the input the top layer.

**Q:** How is a dropped `.mmd` file kept away from Excalidraw's drop handler?
**A:** A capture-phase `drop` listener handles it and stops the event.

**Q:** Where are board pages stored?
**A:** As `board:<id>` documents in the class database via `PUT /api/board/classes/:id/pages/:pid`.
