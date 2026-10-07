import { P, at } from '../lib/people.mjs';

const KEY = ['kettle init', 'kettle.toml', 'public', 'kettle build', '--version', 'pages', 'kettle clean', '.md'];

export default {
  name: '13-first-run-and-catch-up',
  persona: 'New learner',
  shows: 'Four ways to start, pairing code, attendance on the phone, missed days unlocked in order, error notebook.',
  title: 'First start, check-in and catch-up',
  subtitle: 'Four ways to start, pairing code, attendance on the phone, missed days unlocked in order',
  profile: 'phone',
  seeds: ['base', 'demo-extra', 'late-joiner'],
  async prepare(hub) { await hub.clock(at(3, '08:50')); },
  async run(s, hub) {
    const page = s.page;
    await s.open('/');
    await s.tid('first-run').waitFor({ state: 'visible', timeout: 20_000 });
    await s.focusHeading();
    await s.scene('First start: four choices', 'A fresh app offers four ways to start: join a class, connect to a hub, use the hosted service, or use this phone only', async () => {
      await s.tid('first-run').waitFor({ state: 'visible', timeout: 20_000 });
      await s.focusHeading();
      await s.pause(3500);
    });
    await s.scene('Connect with a pairing code', 'Connecting to a classroom hub takes a one-time pairing code that the trainer shows on the hub. A wrong code is refused', async () => {
      await s.click(s.button('Connect to a hub'));
      await s.focusHeading();
      await s.type(page.getByLabel('Pairing code'), '000000');
      await s.click(s.button('Connect'));
      await s.pause(2500);
    });
    await s.scene('The right code', 'The right code connects this device. Each code works once and expires', async () => {
      const r = await hub.api(P.trainer, '/api/pairing', 'POST', {});
      await s.type(page.getByLabel('Pairing code'), String(r.json.code));
      await s.click(s.button('Connect'));
      await s.page.getByTestId('app-ready').waitFor({ timeout: 30_000 });
      await s.settle();
      await s.pause(2500);
    });
    await s.scene('Hosted service and phone only', 'The other two choices: sign in to a hosted service, or keep everything on this phone', async () => {
      await s.context.clearCookies();
      await s.open('/');
      await s.focusHeading();
      await s.click(s.button('Use the hosted service'));
      await s.focusHeading();
      await s.pause(2500);
      await s.click(s.button('Back'));
      await s.focusHeading();
      await s.click(s.button('Use on this phone only'));
      await s.page.getByTestId('app-ready').waitFor({ timeout: 30_000 });
      await s.settle();
      await s.pause(2500);
    });

    await s.scene('Check in with the code', 'In class, the learner types the code the trainer shows on the projector and is marked present', async () => {
      const code = (await hub.api(P.trainer, '/api/classes/c1/attendance-code')).json.code;
      await s.signInAs(P.l1, '/learn/attendance');
      await s.focusHeading();
      await s.type(page.getByLabel('Attendance code'), String(code), { delay: 110 });
      await s.click(s.button('Mark present'));
      await s.pause(3000);
    });

    await s.scene('Joined late: gates', 'A learner who joined on day 3 has missed three days. They unlock in order, by passing each day\'s diagnostic', async () => {
      await s.signInAs(P.l4, '/learn/catch-up');
      await s.focusHeading();
      await s.pause(3500);
      await s.tid('gate-day-0').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
    });
    await s.scene('Not yet: 5 of 8', 'Five of eight is not enough: the pass mark is six', async () => {
      await s.click(s.button('Start the diagnostic'));
      for (let n = 1; n <= 8; n++) { const box = s.tid(`diag-q-${n}`).getByRole('textbox'); const v = n <= 5 ? KEY[n - 1] : 'not sure'; if (n <= 2) await s.type(box, v, { delay: 30 }); else await s.fill(box, v); }
      await s.click(s.button('Submit answers'));
      await s.tid('diag-result').waitFor({ state: 'visible', timeout: 20_000 });
      await s.focusHeading();
      await s.pause(3000);
    });
    await s.scene('Retry: 6 of 8', 'Try again: six of eight passes, day 0 unlocks, and the next gate appears', async () => {
      await s.click(s.button('Try again'));
      const startBtn = s.button('Start the diagnostic');
      if (await startBtn.isVisible().catch(() => false)) await s.click(startBtn);
      await s.tid('diag-q-1').waitFor({ state: 'visible', timeout: 10_000 });
      for (let n = 1; n <= 8; n++) { const box = s.tid(`diag-q-${n}`).getByRole('textbox'); const v = n <= 6 ? KEY[n - 1] : 'not sure'; if (n <= 2) await s.type(box, v, { delay: 30 }); else await s.fill(box, v); }
      await s.click(s.button('Submit answers'));
      await s.tid('diag-result').waitFor({ state: 'visible', timeout: 20_000 });
      await s.focusHeading();
      await s.pause(2500);
      await s.scroll(300);
      await s.pause(2500);
    });
    await s.scene('Error notebook', 'Wrong answers go to the error notebook, grouped by subtopic, for review later', async () => {
      await s.go('Error notebook');
      await s.pause(3500);
      await s.scroll(300);
      await s.pause(2000);
    });
  },
};
