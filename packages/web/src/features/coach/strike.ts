// Heading Strike (G-1): a three-minute drill on one skill, spotting the real Markdown heading. Pure, seeded rounds.
import { createRng, shuffle } from '../../../../core/src/rng.ts';

export const ROUND_SIZE = 5;
const TITLES = ['Install Git', 'Create a branch', 'Write a commit message', 'Open a pull request', 'Resolve a merge conflict',
  'Run the tests', 'Read the logs', 'Restart the service', 'Check disk space', 'Back up the database'];

export interface Question { id: string; options: string[]; answer: number }

// One real heading ("## Title") hidden among two look-alikes: "#Title" (no space) and "- Title" (a list item).
export function buildRound(seed: string, size = ROUND_SIZE): Question[] {
  const rng = createRng(seed);
  return shuffle(TITLES, rng).slice(0, size).map((title, i) => {
    const level = 1 + Math.floor(rng() * 3);
    const real = `${'#'.repeat(level)} ${title}`;
    const options = shuffle([real, `${'#'.repeat(level)}${title}`, `- ${title}`], rng);
    return { id: `q${i + 1}`, options, answer: options.indexOf(real) };
  });
}

export const score = (questions: readonly Question[], picks: readonly (number | null)[]): number =>
  questions.reduce((n, q, i) => n + (picks[i] === q.answer ? 1 : 0), 0);
