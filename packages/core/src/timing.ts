// Graded timing and accommodations (SPEC §4.26)

export function gradedTiming(t: {
  hubStart: number | null;
  hubEnd: number | null;
  monotonicMs: number;
  deviceStart: number;
  deviceEnd: number;
}): { durationMs: number; flags: ('offline-attempt' | 'clock-skew')[] } {
  const flags: ('offline-attempt' | 'clock-skew')[] = [];

  let durationMs: number;

  // Hub times win when both exist
  if (t.hubStart !== null && t.hubEnd !== null) {
    durationMs = t.hubEnd - t.hubStart;
  } else {
    // Otherwise use monotonic duration with offline-attempt flag
    durationMs = t.monotonicMs;
    flags.push('offline-attempt');
  }

  // Check for clock skew: device wall-clock duration vs monotonic duration
  const deviceWallClockDurationMs = t.deviceEnd - t.deviceStart;
  const skewMs = Math.abs(deviceWallClockDurationMs - t.monotonicMs);
  if (skewMs > 60_000) {
    flags.push('clock-skew');
  }

  return { durationMs, flags };
}

export function effectiveLimitMs(
  baseMs: number,
  accommodation: { timeMultiplier?: number } | null
): number {
  let multiplier = 1;

  if (accommodation !== null && accommodation.timeMultiplier !== undefined) {
    // Clamp to 1-3
    multiplier = Math.max(1, Math.min(3, accommodation.timeMultiplier));
  }

  return baseMs * multiplier;
}
