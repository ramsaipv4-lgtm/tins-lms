// One-time pairing codes (SPEC 4.6). Pure: every call returns a new state.

export type PairingEntry = {
  expiresAt: number;
  usedBy: string | null;
};

export type PairingState = {
  codes: Record<string, PairingEntry>;
};

export type PairingResult = 'ok' | 'expired' | 'used' | 'unknown';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function emptyPairingState(): PairingState {
  return { codes: {} };
}

export function issuePairing(
  state: PairingState,
  code: string,
  now: number,
  ttlMs: number = DEFAULT_TTL_MS,
): PairingState {
  return { codes: { ...state.codes, [code]: { expiresAt: now + ttlMs, usedBy: null } } };
}

export function claimPairing(
  state: PairingState,
  code: string,
  deviceId: string,
  now: number,
): { state: PairingState; result: PairingResult } {
  const entry = Object.prototype.hasOwnProperty.call(state.codes, code) ? state.codes[code] : undefined;
  if (!entry) return { state, result: 'unknown' };
  if (entry.usedBy !== null) return { state, result: 'used' };
  if (now >= entry.expiresAt) return { state, result: 'expired' };
  return {
    state: { codes: { ...state.codes, [code]: { expiresAt: entry.expiresAt, usedBy: deviceId } } },
    result: 'ok',
  };
}
