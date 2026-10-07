import { P, at } from '../lib/people.mjs';

const KEY = ['kettle init', 'kettle.toml', 'public', 'kettle build', '--version', 'pages', 'kettle clean', '.md'];

export default {
  name: '08-offline-and-files',
  persona: 'Learner and trainer',
  shows: 'Offline use with the hub off, sync on reconnect, signed day package by file, submission export and import, kiosk mode.',
  title: 'No network? Still learning',
  subtitle: 'Offline use, sync on reconnect, file exchange and kiosk mode',
  profile: 'phone',
  seeds: ['base', 'demo-extra', 'cards'],
  async prepare(hub) { await hub.clock(at(0, '11:00')); },
  async run(s, hub) {
    const page = s.page;
    const waitSw = () => page.evaluate(() => navigator.serviceWorker?.ready.then(() => !!navigator.serviceWorker.controller)).catch(() => false);
    await s.signInAs(P.l1, '/learn/phone-day');
    await s.scene('First load online', 'With a connection, the phone keeps a copy of the class content and your cards', async () => {
      await s.focusHeading();
      await s.pause(2500);
      await s.go('Review');
      await s.pause(1500);
      for (let i = 0; i < 20 && !(await waitSw()); i++) await s.sleep(500);
      await s.say('The app is installed on the phone, so it keeps working without the hub');
    });
    await s.scene('The hub goes down', 'The classroom hub is switched off. The phone still works.', async () => {
      await hub.stop();
      await page.reload();
      await page.getByTestId('app-ready').waitFor({ timeout: 30_000 });
      await s.settle();
      await s.focusHeading();
      await s.pause(2000);
      await s.go('Day 0');
      await s.pause(3000);
      await s.scroll(380);
      await s.pause(1500);
    });
    await s.scene('Cards offline', 'Review cards: your answers are kept on the phone and sent later', async () => {
      await s.go('Review');
      await s.click(s.tid('card-show'));
      await s.pause(900);
      await s.click(s.tid('rate-good'));
      await s.pause(1500);
    });
    await s.scene('Diagnostic offline', 'The diagnostic works offline too', async () => {
      await s.go('Diagnostic');
      await s.click(s.button(/^(start|take)( the)?( diagnostic)?$/i));
      await s.tid('diag-q-1').waitFor({ state: 'visible' });
      for (let n = 1; n <= 8; n++) { const box = s.tid(`diag-q-${n}`).getByRole('textbox').first(); if (n <= 3) await s.type(box, KEY[n - 1], { delay: 30 }); else await s.fill(box, KEY[n - 1]); }
      await s.click(s.button(/^(submit|check|finish)/i));
      await s.pause(2500);
    });
    await s.scene('Mastery map offline', 'And the mastery map shows what you have learned', async () => {
      await s.go('Mastery');
      await s.pause(3000);
    });
    await s.scene('The hub comes back', 'The hub is back: what you did offline is sent to it automatically', async () => {
      await hub.restart();
      await s.context.request.post(`${hub.url}/__test/login`, { data: { personId: P.l1[0], roles: P.l1[1] } });
      await page.reload();
      await page.getByTestId('app-ready').waitFor({ timeout: 30_000 });
      await s.focusHeading();
      await s.go('Day 0');
      await s.pause(2500);
      // wait (off camera) until the offline review has reached the hub, so the caption is true
      const end = Date.now() + 40_000; let synced = false;
      while (Date.now() < end && !synced) {
        const cookies = await s.context.cookies(hub.url);
        const r = await fetch(`${hub.url}/db/person-l1/_all_docs?include_docs=true`, { headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') } });
        const rows = r.ok ? (await r.json()).rows : [];
        synced = rows.some((x) => x.doc?.type === 'card' && (x.doc.fsrs?.reps ?? 0) >= 1);
        if (!synced) await s.sleep(1000);
      }
      if (!synced) throw new Error('the offline card review did not reach the hub within 40 s');
      await s.say('Synced: the hub now has the review done offline');
    });

    await s.scene('File exchange: the trainer\'s package', 'No network at all? The trainer exports a signed day package to share by file', async () => {
      await hub.api(P.trainer, '/api/classes/c1/teleprompter', 'POST', { releaseAll: true }); // the day's sections are out, so the package carries them
      await s.signInAs(P.trainer, '/teach/files');
      await s.focusHeading();
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), s.click(s.tid('pkg-download'))]);
      s._pkg = await dl.path();
      await s.pause(1500);
    });
    await s.scene('File exchange: the phone imports it', 'A phone-only learner imports the package file: the content appears, with no hub', async () => {
      await s.signInAs(P.l3, '/learn/files');
      await s.context.setOffline(true);
      await s.focusHeading();
      await s.pause(1500);
      await s.tid('pkg-import').scrollIntoViewIfNeeded();
      await s.pause(600);
      await s.tid('pkg-import').setInputFiles(s._pkg);
      await s.pause(2500);
      await s.say('The signature is checked and the day\'s sections open right here, with no hub');
      await s.scroll(380);
      await s.pause(1500);
      await s.scroll(380);
      await s.pause(1500);
    });
    await s.scene('Export a submission', 'The learner exports their work as a file and sends it to the trainer', async () => {
      await s.toTop();
      await s.go('File exchange');
      const exp = page.getByRole('button', { name: /export submission|submission file|export my work/i });
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), s.click(exp)]);
      s._sub = await dl.path();
      await s.pause(1500);
      await s.context.setOffline(false);
    });
    await s.scene('The trainer imports the submission', 'The trainer imports the submission file and it is accepted', async () => {
      await s.signInAs(P.trainer, '/teach/files');
      await s.focusHeading();
      await s.tid('submission-import').scrollIntoViewIfNeeded();
      await s.pause(600);
      await s.tid('submission-import').setInputFiles(s._sub);
      await s.pause(3500);
    });
    await s.scene('Kiosk mode', 'Kiosk mode for shared devices: Coach is hidden and the device signs out after 30 idle minutes', async () => {
      await s.signInAs(P.l1, '/learn/settings');
      await s.focusHeading();
      await s.pause(1500);
      await s.check(page.getByRole('checkbox', { name: /kiosk/i }));
      await s.pause(1500);
      await s.say('The Coach link in the header is gone while kiosk mode is on');
      await page.evaluate(() => window.scrollTo(0, 0));
      await s.pause(2500);
    });
  },
};
