// Version compatibility (SPEC §4.28)

export function canSync(clientSchema: number, hubSchema: number): { ok: boolean; action: 'sync' | 'upgrade-on-hub' | 'update-app' | 'update-hub' } {
  const diff = clientSchema - hubSchema;

  if (diff === 0) {
    return { ok: true, action: 'sync' };
  }
  if (diff >= -2 && diff < 0) {
    return { ok: true, action: 'upgrade-on-hub' };
  }
  if (diff < -2) {
    return { ok: false, action: 'update-app' };
  }
  if (diff > 0) {
    return { ok: false, action: 'update-hub' };
  }

  throw new Error('Unexpected schema comparison result');
}
