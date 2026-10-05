// Shared by the learner's exit ticket and the trainer's tally.
import { t } from '../../strings/index.ts';

export interface TicketChoice { id: string; kind: 'unclear' | 'fast' | 'slow' | 'clear'; title: string; count: number }
export interface TicketData { day: number; choices: TicketChoice[]; submitted: boolean; total: number; comments: string[] }

export function choiceLabel(c: { kind: string; title: string }): string {
  return t(`learn.exit.choice.${c.kind}`, { title: c.title });
}
