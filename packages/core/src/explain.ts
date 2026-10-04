// Explain-it-back concept check (SPEC §4.17, B-3, P-16, offline default)

export interface Checklist {
  concepts: { id: string; anyOf: string[] }[];
  misconceptions: { id: string; anyOf: string[] }[];
}

export function checkExplanation(transcript: string, checklist: Checklist):
  { covered: string[]; missing: string[]; misconceptions: string[] } {

  const covered: string[] = [];
  const missing: string[] = [];
  const misconceptionsFound: string[] = [];

  // Normalize transcript: lowercase and remove punctuation for matching
  const normalizedTranscript = transcript.toLowerCase();

  // Check concepts
  for (const concept of checklist.concepts) {
    let isCovered = false;

    for (const phrase of concept.anyOf) {
      if (phraseMatches(normalizedTranscript, phrase.toLowerCase())) {
        isCovered = true;
        break;
      }
    }

    if (isCovered) {
      covered.push(concept.id);
    } else {
      missing.push(concept.id);
    }
  }

  // Check misconceptions
  for (const misconception of checklist.misconceptions) {
    for (const phrase of misconception.anyOf) {
      if (phraseMatches(normalizedTranscript, phrase.toLowerCase())) {
        misconceptionsFound.push(misconception.id);
        break;
      }
    }
  }

  return { covered, missing, misconceptions: misconceptionsFound };
}

// Helper function to match a phrase as whole words/phrases (case-insensitive, ignoring punctuation)
function phraseMatches(transcript: string, phrase: string): boolean {
  // Remove punctuation from both transcript and phrase for comparison
  const cleanTranscript = transcript.replace(/[.,!?;:\-'"()[\]{}]/g, ' ').replace(/\s+/g, ' ');
  const cleanPhrase = phrase.replace(/[.,!?;:\-'"()[\]{}]/g, ' ').replace(/\s+/g, ' ');

  // Split phrase into words
  const phraseWords = cleanPhrase.trim().split(/\s+/);

  if (phraseWords.length === 0) return false;

  // For multi-word phrases, check if all words appear consecutively
  if (phraseWords.length > 1) {
    const phraseRegex = new RegExp(`\\b${phraseWords.join('\\s+')}\\b`, 'g');
    return phraseRegex.test(cleanTranscript);
  } else {
    // For single words, use word boundary
    const wordRegex = new RegExp(`\\b${cleanPhrase}\\b`, 'g');
    return wordRegex.test(cleanTranscript);
  }
}
