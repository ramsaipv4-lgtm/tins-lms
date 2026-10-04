// Estimation poker (SPEC §4.15)

const ALLOWED_CARDS = [1, 2, 3, 5, 8, 13];

export function pokerRound(votes: Record<string, number>):
  | { result: 'consensus'; points: number }
  | { result: 'discuss'; low: string[]; high: string[] } {

  const voterIds = Object.keys(votes);

  // Validate votes
  const uniqueVotes = new Set<number>();
  const votersByVote = new Map<number, string[]>();

  for (const [voterId, vote] of Object.entries(votes)) {
    if (!ALLOWED_CARDS.includes(vote)) {
      throw new Error(`Invalid vote: ${vote}. Allowed cards are: ${ALLOWED_CARDS.join(', ')}`);
    }
    uniqueVotes.add(vote);
    if (!votersByVote.has(vote)) {
      votersByVote.set(vote, []);
    }
    votersByVote.get(vote)!.push(voterId);
  }

  const sortedVotes = Array.from(uniqueVotes).sort((a, b) => a - b);
  const lowestVote = sortedVotes[0];
  const highestVote = sortedVotes[sortedVotes.length - 1];

  // Check if consensus: highest and lowest are same or neighboring in Fibonacci sequence
  const lowestIdx = ALLOWED_CARDS.indexOf(lowestVote);
  const highestIdx = ALLOWED_CARDS.indexOf(highestVote);
  const isConsensus = highestIdx - lowestIdx <= 1;

  if (isConsensus) {
    // Find most common value (ties -> higher)
    const voteCounts = new Map<number, number>();
    for (const vote of Object.values(votes)) {
      voteCounts.set(vote, (voteCounts.get(vote) || 0) + 1);
    }

    let mostCommon = lowestVote;
    let maxCount = voteCounts.get(lowestVote) || 0;

    for (const [vote, count] of voteCounts) {
      if (count > maxCount || (count === maxCount && vote > mostCommon)) {
        mostCommon = vote;
        maxCount = count;
      }
    }

    return { result: 'consensus', points: mostCommon };
  } else {
    // Discuss: return low and high voters
    const lowVoters = votersByVote.get(lowestVote) || [];
    const highVoters = votersByVote.get(highestVote) || [];

    return {
      result: 'discuss',
      low: lowVoters,
      high: highVoters
    };
  }
}
