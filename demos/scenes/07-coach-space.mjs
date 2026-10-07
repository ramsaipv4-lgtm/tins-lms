import { P, at } from '../lib/people.mjs';
import { fixturePath } from '../lib/files.mjs';

export default {
  name: '07-coach-space',
  persona: 'Learner',
  shows: 'Coach space PIN, coaching conversation with accept-defaults to a versioned plan, day timeline, screenshot import, portfolio.',
  title: 'Coach: your private space',
  subtitle: 'PIN, a study plan in a few taps, screenshot import, portfolio',
  profile: 'phone',
  seeds: ['base', 'demo-extra', 'cards', 'coach', 'portfolio'],
  async prepare(hub) { await hub.clock(at(0, '07:30')); },
  async run(s, hub) {
    const page = s.page;
    await s.signInAs(P.l1, '/learn');
    await s.scene('Open the Coach space', 'Coach is a private space. Learn is for course content; Coach is only for you', async () => {
      await s.pause(1200);
      await s.click(s.link('Coach').first());
      await s.pause(1500);
    });
    await s.scene('Set a PIN', 'Choose a PIN. It stays on this device, and course content never asks for it', async () => {
      await s.focusHeading();
      await s.type(page.getByLabel('Coach PIN', { exact: true }).or(page.getByLabel(/^pin$/i)).first(), '2468');
      await s.type(page.getByLabel(/confirm pin/i), '2468');
      await s.click(s.button('Set PIN'));
      await s.pause(1500);
    });
    await s.scene('A plan with accept defaults', 'The coaching conversation: tap "Accept defaults" and you have a plan in a few taps', async () => {
      await s.pause(1500);
      for (let i = 0; i < 12; i++) {
        if (await s.tid('coach-plan').isVisible().catch(() => false)) break;
        const b = page.getByRole('button', { name: 'Accept defaults' });
        if (!(await b.count())) break;
        await s.click(b, { after: 900 });
        await s.pause(500);
      }
      await s.tid('coach-plan').waitFor({ state: 'visible', timeout: 20_000 });
      await s.say('The plan is versioned: v1 now, and the weekly check-in can change it');
      await s.pause(1500);
    });
    await s.scene('My day timeline', 'My day: study blocks from the class schedule, and the cards that are due', async () => {
      await s.click(s.link('My day'));
      await s.pause(1500);
      await s.scroll(300);
      await s.pause(2500);
      await s.toTop();
    });
    await s.scene('Screenshot import', 'Import a screenshot from a diet app: the text is read on your phone', async () => {
      await s.click(s.link('Food'));
      await s.pause(1000);
      await page.getByLabel('Upload screenshot').setInputFiles(fixturePath('journeys/diet-screenshot.png'));
      await s.tid('shot-confirm').waitFor({ state: 'visible', timeout: 90_000 });
      await s.tid('shot-confirm').scrollIntoViewIfNeeded();
      await s.say('Nothing is saved until you check the numbers and confirm');
      await s.pause(1500);
      await s.click(s.tid('shot-confirm').getByRole('button', { name: /^(confirm|save|confirm and save)$/i }));
      await s.pause(2500);
    });
    await s.scene('Portfolio', 'Build a small portfolio site from your repositories, badges and certificate', async () => {
      await s.signInAs(P.l1, '/learn/portfolio');
      await s.focusHeading();
      await s.click(s.button('Build my portfolio'));
      await s.tid('portfolio-preview').waitFor({ state: 'visible', timeout: 30_000 });
      await s.tid('portfolio-preview').scrollIntoViewIfNeeded();
      await s.pause(4000);
    });
  },
};
