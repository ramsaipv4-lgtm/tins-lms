// The coaching conversation (PLAN 7.0): pure rules that need no React, so unit tests can run them.
// Stages: 0 context, 1 goal, 2 constraints and risks, 3 pathway, 4 final versioned plan; 5 review cadence replays 2-4.
export type Domain = 'career' | 'money' | 'fitness' | 'relationships' | 'habits' | 'problem';
export type Energy = 'low' | 'medium' | 'high';
export type PathwayId = 'light' | 'standard' | 'intense';

export const DOMAINS: Domain[] = ['career', 'money', 'fitness', 'relationships', 'habits', 'problem'];
export const ENERGIES: Energy[] = ['low', 'medium', 'high'];
export const PATHWAYS: PathwayId[] = ['light', 'standard', 'intense'];
export const MODIFIERS = ['evenings', 'noWeekends', 'shortBlocks'] as const;
// Rule table: a pitfall chip, its counter-measure, and the energy level that makes it likely (the coach pre-ticks it).
export const PITFALLS: { id: string; likelyAt: Energy | null }[] = [
  { id: 'lateScroll', likelyAt: null },
  { id: 'skipMorning', likelyAt: 'low' },
  { id: 'tooMuch', likelyAt: 'high' },
  { id: 'noTime', likelyAt: null },
];
export const GOALS_PER_DOMAIN = 4;
export const WORK_HOURS_TO_GOAL = 90; // the measurable goal is sized as 90 hours of focused work
export const STAGES = ['context', 'goal', 'constraints', 'pathway', 'final'] as const;
export type Stage = (typeof STAGES)[number];

export interface Answers {
  domain: Domain;
  goal: string; // a strings key ("coach.goal.career.1") or the person's own sentence
  goalIsKey: boolean;
  hours: number; // hours per week the person can give
  energy: Energy;
  pitfalls: string[];
  pathway: PathwayId;
  modifiers: string[];
  cadence: 'weekly';
}
export interface Plan { version: number; createdAt: number; answers: Answers; hoursPerWeek: number; finishDate: string; adopted: string[] }

export const goalKeys = (d: Domain): string[] => Array.from({ length: GOALS_PER_DOMAIN }, (_, i) => `coach.goal.${d}.${i + 1}`);

export function defaultAnswers(domain: Domain = 'career'): Answers {
  return { domain, goal: goalKeys(domain)[0], goalIsKey: true, hours: 8, energy: 'medium', pitfalls: [], pathway: 'standard', modifiers: [], cadence: 'weekly' };
}

// Moving to another domain resets the goal to that domain's first suggestion; everything else is kept.
export function withDomain(a: Answers, domain: Domain): Answers {
  return a.domain === domain ? a : { ...a, domain, goal: goalKeys(domain)[0], goalIsKey: true };
}

export function suggestedPitfalls(energy: Energy): string[] {
  return PITFALLS.filter((p) => p.likelyAt === energy).map((p) => p.id);
}

export function hoursFor(pathway: PathwayId, available: number): number {
  const h = Number.isFinite(available) ? Math.max(1, Math.min(40, Math.round(available))) : 8;
  if (pathway === 'light') return Math.max(1, Math.round(h * 0.5));
  if (pathway === 'intense') return Math.min(40, Math.round(h * 1.5));
  return h;
}

export function finishDate(hoursPerWeek: number, now: number): string {
  const weeks = Math.ceil(WORK_HOURS_TO_GOAL / Math.max(1, hoursPerWeek));
  return new Date(now + weeks * 7 * 86_400_000).toISOString().slice(0, 10);
}

export function pathwayCards(available: number, now: number): { id: PathwayId; hoursPerWeek: number; finishDate: string }[] {
  return PATHWAYS.map((id) => { const hoursPerWeek = hoursFor(id, available); return { id, hoursPerWeek, finishDate: finishDate(hoursPerWeek, now) }; });
}

// What changed against the previous answers (or against the defaults for plan v1): the coach says what it adopted.
export function adoptedChanges(prev: Answers | null, a: Answers): string[] {
  const base = prev ?? defaultAnswers(a.domain);
  const out: string[] = [];
  if (a.domain !== base.domain) out.push('domain');
  if (a.goal !== base.goal) out.push('goal');
  if (a.hours !== base.hours) out.push('hours');
  if (a.energy !== base.energy) out.push('energy');
  if (a.pitfalls.join() !== base.pitfalls.join()) out.push('pitfalls');
  if (a.pathway !== base.pathway) out.push('pathway');
  if (a.modifiers.join() !== base.modifiers.join()) out.push('modifiers');
  return out;
}

export function buildPlan(a: Answers, version: number, now: number, prev: Answers | null): Plan {
  const hoursPerWeek = hoursFor(a.pathway, a.hours);
  return { version, createdAt: now, answers: a, hoursPerWeek, finishDate: finishDate(hoursPerWeek, now), adopted: adoptedChanges(prev, a) };
}

export const nextVersion = (versions: readonly number[]): number => (versions.length ? Math.max(...versions) + 1 : 1);

export function validAnswers(a: any): a is Answers {
  return !!a && DOMAINS.includes(a.domain) && typeof a.goal === 'string' && a.goal.length > 0 && ENERGIES.includes(a.energy)
    && PATHWAYS.includes(a.pathway) && Number.isFinite(a.hours) && Array.isArray(a.pitfalls) && Array.isArray(a.modifiers);
}
