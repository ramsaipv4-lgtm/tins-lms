// AI policy during graded work (SPEC §4.12, F-08, DEC-43). Pure functions.

export function aiAllowed(policy: 'off' | 'allowed' | 'explain-only', toolKind: 'chat' | 'repo-write' | 'run-command'): boolean {
  switch (policy) {
    case 'off':
      return false;
    case 'allowed':
      return true;
    case 'explain-only':
      return toolKind === 'chat';
    default:
      return false;
  }
}

export function aiUsageSummary(policy: string, events: readonly { at: number; toolKind: string }[]): string {
  if (policy === 'off') {
    return 'AI off';
  }

  const count = events.length;

  if (policy === 'allowed') {
    if (count === 0) {
      return 'AI allowed; used 0 times';
    }
    return `AI allowed; used ${count} times`;
  }

  if (policy === 'explain-only') {
    if (count === 0) {
      return 'AI explain-only; used 0 times';
    }
    return `AI explain-only; used ${count} times`;
  }

  // Unknown policy, treat as off
  return 'AI off';
}
