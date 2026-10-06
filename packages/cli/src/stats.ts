// Small statistics helpers for the load test (SPEC Appendix B summary line).

/** Nearest-rank percentile of a list of numbers; 0 for an empty list. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

/** Share of values at or under the limit, as a percentage with one decimal. */
export function withinPct(values: number[], limitMs: number): number {
  if (values.length === 0) return 0;
  const ok = values.filter((v) => v <= limitMs).length;
  return Math.round((ok / values.length) * 1000) / 10;
}
