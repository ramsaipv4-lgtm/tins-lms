import { t } from '../../strings/index.ts';
import { Link } from '../../app/router.tsx';

/** Shown for a switched-off, unreleased or locked game, and for every games route while `games` is off (SPEC §13.3). */
export default function Unavailable() {
  return (
    <section aria-labelledby="gu-h">
      <h1 id="gu-h">{t('games.nav')}</h1>
      <p data-testid="game-unavailable" role="status">{t('games.unavailable')}</p>
      <p><Link to="/learn">{t('games.back')}</Link></p>
    </section>
  );
}
