import { Suggestions } from './TAnalytics.tsx';
import { t } from '../../strings/index.ts';

export default function TMisconceptions() {
  return (
    <section aria-labelledby="mi-h">
      <h1 id="mi-h">{t('classroom.nav.misconceptions')}</h1>
      <Suggestions />
    </section>
  );
}
