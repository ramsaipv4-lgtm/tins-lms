// Shift engine (SPEC 4.10, M-10, DEC-1): a timed pack of tickets with SLAs, scored by a rubric.
// Pure functions: time arrives as monotonic ms since shift start (D-27); randomness comes from the seed.

export type ShiftMode = 'live' | 'recorded' | 'emulated';
export type ShiftTicketSpec = {
  id: string;
  title: string;
  arrivesAtMin: number;
  slaMin: number;
  priority: 'p1' | 'p2' | 'p3';
  variants?: string[];
  check: { kind: 'answer' | 'command' | 'file'; expected: string };
};
export type ShiftPack = {
  id: string;
  durationMin: number;
  tickets: ShiftTicketSpec[];
  rubric: { mode: ShiftMode; rows: { id: string; weight: number }[] }[];
};
export type ShiftStatus = 'waiting' | 'acked' | 'resolved' | 'breached';
export type ShiftTicketState = {
  id: string;
  variant: string | null;
  status: ShiftStatus;
  arrivesAtMs: number;
};
export type ShiftEvent = {
  kind: 'ack' | 'resolve' | 'escalate';
  ticketId: string;
  atMs: number;
  answer?: string;
};
type Progress = { ackedAtMs: number | null; resolvedAtMs: number | null; escalated: boolean };
export type ShiftState = {
  packId: string;
  seed: string;
  startedAt: number;
  nowMs: number;
  tickets: ShiftTicketState[]; // every pack ticket from the start, in arrival order
  pack: ShiftPack;
  variants: Record<string, string | null>;
  progress: Record<string, Progress>;
};

// Private deterministic generator (rng.ts is an empty stub in this worktree): xmur3 string hash
// feeding mulberry32. One generator per shift, consumed once per pack ticket in pack order.
function makeRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  let a = (h ^ (h >>> 16)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN = 60_000;

function arrivalOrder(pack: ShiftPack): ShiftTicketSpec[] {
  return pack.tickets
    .map((t, i) => ({ t, i }))
    .sort((a, b) => a.t.arrivesAtMin - b.t.arrivesAtMin || a.i - b.i)
    .map((x) => x.t);
}

function statusOf(spec: ShiftTicketSpec, p: Progress, elapsedMs: number): ShiftStatus {
  const deadline = (spec.arrivesAtMin + spec.slaMin) * MIN;
  if (p.resolvedAtMs !== null) return p.resolvedAtMs <= deadline ? 'resolved' : 'breached';
  if (elapsedMs > deadline) return 'breached';
  return p.ackedAtMs !== null ? 'acked' : 'waiting';
}

function view(state: Omit<ShiftState, 'tickets'>, nowMs: number): ShiftTicketState[] {
  return arrivalOrder(state.pack)
    .map((t) => ({
      id: t.id,
      variant: state.variants[t.id] ?? null,
      status: statusOf(t, state.progress[t.id], nowMs),
      arrivesAtMs: t.arrivesAtMin * MIN,
    }));
}

export function startShift(pack: ShiftPack, seed: string, startedAt: number): ShiftState {
  const variants: Record<string, string | null> = {};
  const progress: Record<string, Progress> = {};
  const rng = makeRng(seed);
  for (const t of pack.tickets) {
    const vs = t.variants ?? [];
    const r = rng(); // consumed for every ticket so one ticket's variants never shift another's choice
    variants[t.id] = vs.length > 0 ? vs[Math.floor(r * vs.length)] : null;
    progress[t.id] = { ackedAtMs: null, resolvedAtMs: null, escalated: false };
  }
  const base = { packId: pack.id, seed, startedAt, nowMs: 0, pack, variants, progress };
  return { ...base, tickets: view(base, 0) };
}

export function applyShiftEvent(state: ShiftState, event: ShiftEvent): ShiftState {
  const nowMs = Math.max(state.nowMs, event.atMs);
  const spec = state.pack.tickets.find((t) => t.id === event.ticketId);
  const progress: Record<string, Progress> = { ...state.progress };
  // Events for unknown tickets, or tickets that have not arrived yet, change nothing but the clock.
  if (spec && spec.arrivesAtMin * MIN <= event.atMs) {
    const p = { ...progress[spec.id] };
    if (p.resolvedAtMs === null) {
      if (event.kind === 'ack') {
        if (p.ackedAtMs === null) p.ackedAtMs = event.atMs;
      } else if (event.kind === 'escalate') {
        p.escalated = true;
        if (p.ackedAtMs === null) p.ackedAtMs = event.atMs;
      } else if (answerAccepted(spec, event.answer)) {
        p.resolvedAtMs = event.atMs;
      }
      // A wrong answer leaves the ticket open: it scores like an unresolved one.
    }
    progress[spec.id] = p;
  }
  const base = { ...state, nowMs, progress };
  return { ...base, tickets: view(base, nowMs) };
}

// No answer supplied means the caller is not testing the check; a supplied answer must match.
function answerAccepted(spec: ShiftTicketSpec, answer: string | undefined): boolean {
  if (answer === undefined) return true;
  return answer.trim() === spec.check.expected.trim();
}

export function slaReport(
  state: ShiftState,
  elapsedMs: number,
): { ticketId: string; status: ShiftStatus; minutesLeft: number | null }[] {
  return arrivalOrder(state.pack)
    .filter((t) => t.arrivesAtMin * MIN <= elapsedMs)
    .map((t) => {
      const status = statusOf(t, state.progress[t.id], elapsedMs);
      const open = status === 'waiting' || status === 'acked';
      const deadline = (t.arrivesAtMin + t.slaMin) * MIN;
      return { ticketId: t.id, status, minutesLeft: open ? (deadline - elapsedMs) / MIN : null };
    });
}

export function scoreShift(
  state: ShiftState,
  mode: ShiftMode,
): { score: number; max: number; rows: { id: string; earned: number }[]; modeFlag: boolean } {
  const rubric = state.pack.rubric.find((r) => r.mode === mode);
  const rows = (rubric ? rubric.rows : []).map((row) => {
    const spec = state.pack.tickets.find((t) => t.id === row.id);
    let earned = 0;
    if (spec && state.progress[spec.id].resolvedAtMs !== null) {
      if (statusOf(spec, state.progress[spec.id], state.nowMs) === 'resolved') earned = row.weight;
    }
    return { id: row.id, earned };
  });
  const max = (rubric ? rubric.rows : []).reduce((s, r) => s + r.weight, 0);
  const score = Math.min(max, rows.reduce((s, r) => s + r.earned, 0));
  const first = state.pack.rubric[0];
  return { score, max, rows, modeFlag: first ? first.mode !== mode : false };
}
