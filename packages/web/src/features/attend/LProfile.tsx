// Learner's own profile. Trainer notes are never shown here (AC-159).
import { t } from '../../strings/index.ts';
import { useData } from './lib.ts';

export default function LProfile() {
  const { data, error } = useData<{ name: string; personId: string }>('/api/attend/my-profile');
  if (error) return <p role="alert">{t('attend.error')}</p>;
  return (
    <section aria-labelledby="lp-h">
      <h1 id="lp-h">{t('attend.profile.title')}</h1>
      <p>{t('attend.profile.name')} <strong translate="no">{data?.name ?? ''}</strong></p>
    </section>
  );
}
