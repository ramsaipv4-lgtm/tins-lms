// /teach/teleprompter (AC-83): the trainer's (or substitute's) teleprompter with SPEC 4.7 release.
import { useEffect, useState } from 'react';
import { t } from '../../strings/index.ts';
import { Prompter } from './Prompter.tsx';
import { useClass } from './lib.tsx';
import { SelfLearn } from './SelfLearn.tsx';

export default function Teleprompter() {
  const { cls, ready } = useClass();
  const [day, setDay] = useState<number | null>(null);
  useEffect(() => { if (cls && day === null) setDay(cls.todayIndex); }, [cls, day]);
  if (!ready) return <p role="status">{t('app.loading')}</p>;
  if (!cls || day === null) return <p role="status">{t('tele.noClass')}</p>;
  const mode = cls.days.find((d) => d.index === day)?.mode;
  return (
    <>
      <h1>{t('tele.prompter.title')}</h1>
      {mode === 'self-learn' && <SelfLearn cls={cls} dayIndex={day} />}
      <Prompter cls={cls} dayIndex={day} onDay={setDay} />
    </>
  );
}
