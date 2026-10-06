// Trainer: today's stand-up summary with blocked answers highlighted (AC-87).
import { t } from '../../strings/index.ts';
import { usePoll } from './lib.tsx';
import { Summary } from './Standup.tsx';

export default function TeachStandup() {
  const { data } = usePoll<any[]>('/api/rituals/standup', 3000);
  return (
    <section aria-labelledby="ts-h">
      <h1 id="ts-h">{t('shift.standup.title')}</h1>
      <Summary data={data} />
    </section>
  );
}
