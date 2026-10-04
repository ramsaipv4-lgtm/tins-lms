// Appeals (SPEC §4.11, F-07, DEC-42). Pure: every call returns a new appeal.

export type AppealStep = {
  kind: 'uphold' | 'reject' | 'escalate' | 'decide-final';
  by: string;
  at: number;
  outcome?: 'uphold' | 'reject';
};

export type Appeal = {
  state: 'open' | 'upheld' | 'rejected' | 'escalated' | 'final-upheld' | 'final-rejected';
  reason?: 'unread-confirmation';
  openedAt: number;
  history: AppealStep[];
};

const APPEAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function openAppeal(
  attempt: { id: string; publishedAt: number; unreadConfirmations: number },
  now: number,
): { ok: true; appeal: Appeal } | { ok: false; reason: 'window-closed' } {
  // Check if appeal window is still open (within 7 days of publishedAt)
  if (now - attempt.publishedAt > APPEAL_WINDOW_MS) {
    return { ok: false, reason: 'window-closed' };
  }

  // If attempt has unread confirmations, open as upheld with unread-confirmation reason
  if (attempt.unreadConfirmations > 0) {
    return {
      ok: true,
      appeal: {
        state: 'upheld',
        reason: 'unread-confirmation',
        openedAt: now,
        history: [],
      },
    };
  }

  // Otherwise, open as open
  return {
    ok: true,
    appeal: {
      state: 'open',
      openedAt: now,
      history: [],
    },
  };
}

export function appealStep(appeal: Appeal, action: { kind: 'uphold' | 'reject' | 'escalate' | 'decide-final'; by: string; at: number; outcome?: 'uphold' | 'reject' }): Appeal {
  // Cannot change a final decision
  if (appeal.state === 'final-upheld' || appeal.state === 'final-rejected') {
    return appeal;
  }

  // Create the new step
  const step: AppealStep = {
    kind: action.kind,
    by: action.by,
    at: action.at,
  };

  if (action.outcome !== undefined) {
    step.outcome = action.outcome;
  }

  // Determine the new state based on the action kind
  let newState: Appeal['state'];
  switch (action.kind) {
    case 'uphold':
      newState = 'upheld';
      break;
    case 'reject':
      newState = 'rejected';
      break;
    case 'escalate':
      newState = 'escalated';
      break;
    case 'decide-final':
      if (action.outcome === 'uphold') {
        newState = 'final-upheld';
      } else if (action.outcome === 'reject') {
        newState = 'final-rejected';
      } else {
        // Should not happen based on SPEC
        return appeal;
      }
      break;
  }

  return {
    state: newState,
    reason: appeal.reason,
    openedAt: appeal.openedAt,
    history: [...appeal.history, step],
  };
}

export function appealTick(appeal: Appeal, now: number): Appeal {
  // Only escalate open appeals
  if (appeal.state !== 'open') {
    return appeal;
  }

  // Check if 7 days have passed since the appeal opened
  if (now - appeal.openedAt >= APPEAL_WINDOW_MS) {
    // Automatically escalate
    return appealStep(appeal, {
      kind: 'escalate',
      by: 'system',
      at: now,
    });
  }

  return appeal;
}
