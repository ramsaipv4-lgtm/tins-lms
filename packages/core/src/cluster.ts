// Mistake clustering (SPEC §4.22)

export function clusterSubmissions(
  subs: readonly { id: string; failing: readonly string[] }[],
): { signature: string[]; ids: string[] }[] {
  // Create clusters by signature (sorted failing checks)
  const clusterMap = new Map<string, string[]>();

  for (const sub of subs) {
    // Sort the failing checks to create a canonical signature
    const sorted = Array.from(sub.failing).sort();
    const key = JSON.stringify(sorted);

    if (!clusterMap.has(key)) {
      clusterMap.set(key, []);
    }
    clusterMap.get(key)!.push(sub.id);
  }

  // Convert to result format
  const result = Array.from(clusterMap.entries()).map(([key, ids]) => ({
    signature: JSON.parse(key) as string[],
    ids,
  }));

  // Sort by cluster size (descending), then by signature
  result.sort((a, b) => {
    if (a.ids.length !== b.ids.length) {
      return b.ids.length - a.ids.length;
    }
    // Compare signatures lexicographically
    const aKey = JSON.stringify(a.signature);
    const bKey = JSON.stringify(b.signature);
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });

  return result;
}
