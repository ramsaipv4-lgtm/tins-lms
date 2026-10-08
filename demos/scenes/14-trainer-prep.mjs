import { P, at, STANDARD } from '../lib/people.mjs';
import { populateDay0 } from '../lib/populate.mjs';

export default {
  name: '14-trainer-prep',
  persona: 'Trainer',
  shows: 'Trainer pack, rehearsal with planned versus actual, self-check, package library, voice notes, fire drill.',
  title: 'Trainer: prepare, rehearse, keep notes',
  subtitle: 'Trainer pack, package library, rehearsal with planned versus actual, voice notes, fire drill',
  profile: 'desktop',
  seeds: [...STANDARD, 'explain'],
  async prepare(hub) {
    await populateDay0(hub);
    await hub.clock(at(0, '19:00'));
  },
  async run(s, hub) {
    const page = s.page;
    await s.signInAs(P.trainer, '/teach/trainer-pack');

    await s.scene('Trainer pack', 'Tomorrow is day 1. The trainer pack has the card deck, cheat sheet, command reference and likely questions for each day', async () => {
      await s.tid('trainer-pack').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
      await s.select(page.getByLabel('Day'), { index: 1 });
      await s.pause(2500);
      await s.scroll(380);
      await s.pause(2000);
      await s.scroll(380);
      await s.pause(2000);
      await s.toTop();
    });

    await s.scene('Rehearsal', 'Rehearsal runs the day\'s script against the clock. Nothing is released to learners', async () => {
      await s.go('Rehearsal');
      await s.select(page.getByLabel('Day'), { index: 1 });
      await s.click(s.button('Start rehearsal'));
      await s.pause(2000);
      for (let i = 0; i < 4; i++) {
        const next = s.button('Next section');
        if (!(await next.count())) break;
        await s.click(next, { after: 900 });
      }
      await s.pause(1200);
      await s.click(s.button('Finish rehearsal'));
      await s.tid('rehearsal-report').waitFor({ state: 'visible', timeout: 20_000 });
    });
    await s.scene('Planned versus actual', 'The report compares planned and actual time for every section, and checks that the lab commands are still fresh', async () => {
      await s.tid('rehearsal-report').scrollIntoViewIfNeeded();
      await s.pause(4500);
      await s.scroll(300);
      await s.pause(2500);
    });
    await s.scene('Self-check after rehearsal', 'With AI off, a self-check list follows. With AI on it would be a teach-back conversation', async () => {
      for (const box of await page.getByRole('checkbox').all()) await s.check(box);
      await s.click(s.button('Save'));
      await s.pause(2500);
    });
    await s.scene('Package library', 'The package library lists every imported package with its version and the rehearsal history', async () => {
      await s.go('Package library');
      await s.pause(4500);
    });

    await s.scene('Voice notes', 'After class, a note typed or dictated is attached to a learner. Only trainers can read it', async () => {
      await s.go('Voice notes');
      await s.select(page.getByLabel('Learner'), { label: 'Tejas Sample' });
      await s.type(page.getByLabel('Note', { exact: true }), 'Missed day 0 for a family reason. Offer the catch-up session on Thursday.', { delay: 35 });
      await s.click(s.button('Save note'));
      await s.pause(3000);
    });

    await s.scene('Fire drill: start', 'Fire drill: rehearse the hub going down during class. Phones keep working from their stored copy', async () => {
      await s.go('Fire drill');
      await s.tid('fire-drill').waitFor({ state: 'visible', timeout: 20_000 });
      await s.pause(2500);
      await s.click(s.button('Start fire drill'));
      await s.pause(2500);
    });
    await s.scene('Fire drill: hub off', 'The hub is switched off, and the drill checks what a device can still do without it', async () => {
      await hub.stop();
      await s.click(s.button('Next'));
      await s.pause(4000);
    });
    await s.scene('Fire drill: hub back', 'The hub is switched on again: phones send what they kept and catch up', async () => {
      await hub.restart();
      await s.context.request.post(`${hub.url}/__test/login`, { data: { personId: P.trainer[0], roles: P.trainer[1] } });
      await s.click(s.button('Next'));
      await s.pause(5000);
    });
  },
};
