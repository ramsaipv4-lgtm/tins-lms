// Two doorways between the spaces. The shell's /coach home is its own page, so the learner-nav "Coach" entry sends the
// learner straight to the conversation, where the PIN gate (F-05) asks for the PIN. The Coach-nav "Today" entry goes the
// other way, to the course content, which never asks for a PIN.
import { useEffect } from 'react';
import { navigate } from '../../app/router.tsx';
import { t } from '../../strings/index.ts';

function Go({ to }: { to: string }) {
  useEffect(() => { navigate(to, true); }, [to]);
  return <p role="status">{t('app.loading')}</p>;
}
export default function Enter() { return <Go to="/coach/plan" />; }
export function ToToday() { return <Go to="/learn/today" />; }
