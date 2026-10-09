// Starter packs for `games new <gameId> <packId>` (SPEC §13.5, AC-216). Each one passes `games check`.
// Only the four first-wave games have a pack format so far.
import { FIRST_WAVE } from './packs.ts';

export const PACK_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export function isStarterGame(gameId: string): boolean {
  return (FIRST_WAVE as readonly string[]).includes(gameId);
}

export function starterPack(gameId: string, packId: string): Record<string, unknown> {
  const head = {
    game: gameId, id: packId, title: `Starter pack ${packId}`, day: 0, language: 'en',
  };
  switch (gameId) {
    case 'syntax-drop':
      return {
        $comment: 'Starter pack for Syntax Drop. "day" is the 0-based class day the pack is released on. Each slot names the pieces it accepts; pieces marked decoy must be let through (strike) or refused (fill).',
        ...head, concepts: ['css.display', 'css.flexbox'],
        levels: [{
          id: '1', title: 'Three boxes in a row',
          $comment: 'Fill mode: the learner drops pieces into the {{slot}} gaps of the template. Lesson cards (280 characters at most) show between stages.',
          lesson: [
            { concept: 'css.display', text: 'display: flex puts the children of a box side by side in a row.' },
            { concept: 'css.flexbox', text: 'justify-content: center gathers the row\'s children in the middle.' },
          ],
          mode: 'fill', renderer: 'html',
          template: '<div style="display: {{s1}}; justify-content: {{s2}}">\n  <div class="box">A</div>\n  <div class="box">B</div>\n  <div class="box">C</div>\n</div>',
          slots: [{ id: 's1', accepts: ['p-flex'] }, { id: 's2', accepts: ['p-center'] }],
          pieces: [
            { id: 'p-flex', text: 'flex', concept: 'css.display' },
            { id: 'p-center', text: 'center', concept: 'css.flexbox' },
            { id: 'p-block', text: 'block', concept: 'css.display', decoy: true },
            { id: 'p-middle', text: 'middle', concept: 'css.flexbox', decoy: true },
          ],
          stages: 1,
        }],
      };
    case 'sniper':
      return {
        $comment: 'Starter pack for Snippet Sniper. Outputs are computed by Snek when the pack is checked, so a pack cannot carry a wrong answer. Each bounty output must be printed by exactly one monster.',
        ...head, concepts: ['python.arithmetic'],
        levels: [{
          id: '1', title: 'First patrol',
          lesson: [{ concept: 'python.arithmetic', text: '* multiplies, ** raises to a power, // divides and drops the remainder.' }],
          lang: 'snek',
          snippets: [
            { id: 's-add', code: 'print(2 + 3)', concept: 'python.arithmetic' },
            { id: 's-mul', code: 'print(2 * 3)', concept: 'python.arithmetic' },
            { id: 's-pow', code: 'print(2 ** 3)', concept: 'python.arithmetic' },
          ],
          monsters: ['s-add', 's-mul', 's-pow'],
          bounties: [{ snippetId: 's-add' }, { snippetId: 's-mul' }],
          speed: 1,
        }],
      };
    case 'whack-a-bug':
      return {
        $comment: 'Starter pack for Whack-a-Bug. "program" is the buggy program (at most 9 lines); each bug names its 1-based line and the fixed text of that line. Expected and actual output are computed with Snek.',
        ...head, concepts: ['loops.range'],
        levels: [{
          id: '1', title: 'Sum to four',
          lesson: [{ concept: 'loops.range', text: 'range(a, b) stops just before b, so range(1, 4) gives 1, 2 and 3.' }],
          lang: 'snek',
          program: 'total = 0\nfor i in range(1, 4):\n    total += i\nprint(total)',
          bugs: [{ line: 2, fix: 'for i in range(1, 5):', concept: 'loops.range', why: 'range(1, 4) stops before 4, so 4 is never added.' }],
          upTimeMs: 2500, hint: 'color', molesAtOnce: 1,
        }],
      };
    case 'aftershock':
      return {
        $comment: 'Starter pack for Aftershock. "lines" are the program in the right order with their indents; "altOrders" lists other orders (indexes into lines) that also pass the tests; decoys are slabs that do not belong.',
        ...head, concepts: ['functions.def', 'functions.return'],
        levels: [{
          id: '1', title: 'Area of a rectangle',
          lesson: [{ concept: 'functions.return', text: 'return sends a value back to the caller; area(2, 3) should give 6.' }],
          lang: 'snek', concept: 'functions.def', entry: 'area',
          lines: [
            { text: 'def area(w, h):', indent: 0 },
            { text: 'a = w', indent: 1 },
            { text: 'b = h', indent: 1 },
            { text: 'return a * b', indent: 1 },
          ],
          altOrders: [[0, 2, 1, 3]],
          decoys: [{ text: 'return a + b', why: 'adds the sides instead of multiplying them', concept: 'functions.return' }],
          tests: [{ args: [2, 3], expect: 6 }, { args: [4, 5], expect: 20 }],
          shockSec: 20, fallSpeed: 1,
        }],
      };
    default:
      throw new Error(`no starter pack for ${gameId}`);
  }
}

export function starterJson(gameId: string, packId: string): string {
  return JSON.stringify(starterPack(gameId, packId), null, 2) + '\n';
}
