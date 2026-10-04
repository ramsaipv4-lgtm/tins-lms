// Exit tickets and auto-FAQ (SPEC §4.19)

export function tallyExitTickets(
  responses: readonly { choiceIds: string[] }[],
): { choiceId: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const response of responses) {
    for (const choiceId of response.choiceIds) {
      counts.set(choiceId, (counts.get(choiceId) || 0) + 1);
    }
  }

  const result = Array.from(counts.entries()).map(([choiceId, count]) => ({
    choiceId,
    count,
  }));

  // Sort by count descending, then by choiceId ascending
  result.sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }
    return a.choiceId < b.choiceId ? -1 : a.choiceId > b.choiceId ? 1 : 0;
  });

  return result;
}

// Stop words to remove from questions for similarity matching
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'to', 'of', 'in',
  'how', 'what', 'why', 'do', 'i',
]);

function getWords(text: string): Set<string> {
  const words = text.toLowerCase().split(/\W+/);
  return new Set(words.filter((w) => w.length > 0 && !STOP_WORDS.has(w)));
}

function jaccardSimilarity(words1: Set<string>, words2: Set<string>): number {
  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 1;
  return intersection.size / union.size;
}

export function suggestFaq(
  questions: readonly { id: string; text: string }[],
  minRepeats: number = 3,
): { representative: string; ids: string[] }[] {
  if (questions.length === 0) return [];

  // Create word sets for each question
  const wordSets = questions.map((q) => ({
    id: q.id,
    text: q.text,
    words: getWords(q.text),
  }));

  const grouped = new Map<number, string[]>();
  const grouped_map = new Map<string, number>();

  // Group similar questions
  for (let i = 0; i < wordSets.length; i++) {
    if (grouped_map.has(wordSets[i].id)) continue;

    const group: string[] = [wordSets[i].id];
    grouped_map.set(wordSets[i].id, i);

    for (let j = i + 1; j < wordSets.length; j++) {
      if (grouped_map.has(wordSets[j].id)) continue;

      const similarity = jaccardSimilarity(wordSets[i].words, wordSets[j].words);
      if (similarity >= 0.6) {
        group.push(wordSets[j].id);
        grouped_map.set(wordSets[j].id, i);
      }
    }

    if (group.length >= minRepeats) {
      grouped.set(i, group);
    }
  }

  // Convert to result format
  const result = Array.from(grouped.entries()).map(([idx, ids]) => ({
    representative: questions.find((q) => q.id === wordSets[idx].id)!.text,
    ids,
  }));

  return result;
}
