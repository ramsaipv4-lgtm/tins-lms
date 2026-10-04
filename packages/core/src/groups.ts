// Study groups (SPEC §4.14)

interface Person {
  id: string;
  mastery: Record<string, 'mastered' | 'not-yet'>;
}

// Simple deterministic hash-based RNG
function createDeterministicRng(seed: string): () => number {
  let state = hashString(seed);

  return function() {
    // Linear congruential generator
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return (state >>> 0) / 0x7fffffff;
  };
}

// Simple string hash function
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Shuffle array using Fisher-Yates with provided RNG
function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function formGroups(
  people: readonly { id: string; mastery: Record<string, 'mastered' | 'not-yet'> }[],
  size: number,
  seed: string
): string[][] {
  if (people.length === 0) return [];
  if (size <= 0) throw new Error('Group size must be positive');

  const rng = createDeterministicRng(seed);
  const personArray = Array.from(people);

  // Shuffle people using deterministic RNG
  const shuffled = shuffle(personArray, rng);

  // Create groups with roughly equal sizes
  // Calculate number of groups needed
  const numGroups = Math.ceil(shuffled.length / size);
  const baseSize = Math.floor(shuffled.length / numGroups);
  const remainder = shuffled.length % numGroups;

  const groups: string[][] = [];
  let idx = 0;

  // First 'remainder' groups get baseSize + 1 people
  for (let i = 0; i < remainder; i++) {
    const groupSize = baseSize + 1;
    const groupPersonIds = shuffled.slice(idx, idx + groupSize).map(p => p.id);
    groups.push(groupPersonIds);
    idx += groupSize;
  }

  // Remaining groups get baseSize people
  for (let i = remainder; i < numGroups; i++) {
    const groupPersonIds = shuffled.slice(idx, idx + baseSize).map(p => p.id);
    groups.push(groupPersonIds);
    idx += baseSize;
  }

  // Try to improve groups by balancing skills
  // For each group, check if we can improve diversity of mastery
  improveGroupDiversity(groups, shuffled);

  return groups;
}

// Try to improve group composition by moving people to better utilize skill diversity
function improveGroupDiversity(groups: string[][], people: Person[]): void {
  const personMap = new Map(people.map(p => [p.id, p]));

  // For each person in each group, check if we can find a better group
  for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
    for (let personIdx = 0; personIdx < groups[groupIdx].length; personIdx++) {
      const personId = groups[groupIdx][personIdx];
      const person = personMap.get(personId);
      if (!person) continue;

      // Calculate diversity score of current group
      const currentScore = groupDiversityScore(groups[groupIdx], personMap);

      // Try swapping with person from another group
      for (let otherGroupIdx = 0; otherGroupIdx < groups.length; otherGroupIdx++) {
        if (otherGroupIdx === groupIdx) continue;

        for (let otherPersonIdx = 0; otherPersonIdx < groups[otherGroupIdx].length; otherPersonIdx++) {
          const otherPersonId = groups[otherGroupIdx][otherPersonIdx];

          // Swap
          [groups[groupIdx][personIdx], groups[otherGroupIdx][otherPersonIdx]] =
            [groups[otherGroupIdx][otherPersonIdx], groups[groupIdx][personIdx]];

          // Check if new score is better
          const newCurrentScore = groupDiversityScore(groups[groupIdx], personMap);
          const newOtherScore = groupDiversityScore(groups[otherGroupIdx], personMap);

          // If improved, keep the swap; otherwise revert
          if (newCurrentScore + newOtherScore <= currentScore + groupDiversityScore(groups[otherGroupIdx], personMap)) {
            // Revert the swap
            [groups[groupIdx][personIdx], groups[otherGroupIdx][otherPersonIdx]] =
              [groups[otherGroupIdx][otherPersonIdx], groups[groupIdx][personIdx]];
          }
        }
      }
    }
  }
}

// Calculate how diverse a group is in terms of mastery (want mix of mastered and not-yet)
function groupDiversityScore(groupIds: string[], personMap: Map<string, Person>): number {
  if (groupIds.length === 0) return 0;

  let diversityScore = 0;

  // Get all skills mentioned in this group
  const allSkills = new Set<string>();
  for (const id of groupIds) {
    const person = personMap.get(id);
    if (person) {
      Object.keys(person.mastery).forEach(skill => allSkills.add(skill));
    }
  }

  // For each skill, check if group has mix of mastered and not-yet
  for (const skill of allSkills) {
    const masteredCount = groupIds.filter(id => {
      const person = personMap.get(id);
      return person && person.mastery[skill] === 'mastered';
    }).length;

    const notYetCount = groupIds.length - masteredCount;

    // If group has both mastered and not-yet for a skill, that's good (add 1)
    if (masteredCount > 0 && notYetCount > 0) {
      diversityScore += 1;
    }
  }

  return diversityScore;
}

export function applyGroupOverrides(
  groups: string[][],
  moves: readonly { personId: string; toGroup: number }[]
): string[][] {
  // Create a mutable copy of groups
  const result = groups.map(g => [...g]);

  // Find and remove each person being moved
  const moversMap = new Map(moves.map(m => [m.personId, m.toGroup]));

  for (const [personId, toGroup] of moversMap) {
    // Find person in current groups
    let foundGroup = -1;
    let foundIndex = -1;

    for (let i = 0; i < result.length; i++) {
      const idx = result[i].indexOf(personId);
      if (idx !== -1) {
        foundGroup = i;
        foundIndex = idx;
        break;
      }
    }

    if (foundGroup === -1) {
      throw new Error(`Person ${personId} not found in any group`);
    }

    if (toGroup < 0 || toGroup >= result.length) {
      throw new Error(`Invalid target group ${toGroup}`);
    }

    // Remove from current group
    result[foundGroup].splice(foundIndex, 1);

    // Add to target group
    result[toGroup].push(personId);
  }

  return result;
}
