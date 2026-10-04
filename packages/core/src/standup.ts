// Stand-up bot (SPEC §4.16, no AI)

export function parseStandup(answers: { yesterday: string; today: string; blockers: string }):
  { blocked: boolean; blockerText: string | null } {

  const blockers = answers.blockers.toLowerCase();

  // Empty blockers field means not blocked
  if (blockers.trim() === '') {
    return { blocked: false, blockerText: null };
  }

  // Check for negations first
  const negations = ['no blockers', 'none', 'not blocked', 'nothing'];
  for (const negation of negations) {
    if (blockers.includes(negation)) {
      return { blocked: false, blockerText: null };
    }
  }

  // Check for blocker keywords (whole words)
  const blockingKeywords = ['blocked', 'stuck', 'waiting on', 'waiting for', "can't", 'cannot', 'need help'];
  for (const keyword of blockingKeywords) {
    // Use word boundary check: ensure keyword appears as whole words
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (regex.test(blockers)) {
      return { blocked: true, blockerText: answers.blockers };
    }
  }

  return { blocked: false, blockerText: null };
}
