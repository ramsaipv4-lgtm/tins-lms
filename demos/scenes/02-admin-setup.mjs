import { P, at, IST } from '../lib/people.mjs';
import { packageTar } from '../lib/files.mjs';

export default {
  name: '02-admin-setup',
  title: 'Admin: set up a class',
  subtitle: 'Create a program, cohort and class, upload the package, publish',
  profile: 'desktop',
  seeds: ['org-only'],
  async prepare(hub) { await hub.clock(IST('2026-10-26', '10:30')); },
  async run(s, hub) {
    const page = s.page;
    await s.signInAs(P.admin, '/admin/classes');
    await s.scene('Create the program, cohort and class', 'The admin starts with an empty organisation: create a program, a cohort and a class', async () => {
      await s.type(page.getByLabel('Program name'), 'Kettle Track (demo)');
      await s.type(page.getByLabel('Cohort name'), 'Batch J1');
      await s.type(page.getByLabel('Class name'), 'Class J1');
      await s.say('The start date decides the class days');
      await page.getByLabel('Start date').fill('2026-11-02');
      await s.pause(900);
      await s.click(s.tid('create-class'));
      await s.say('The program, cohort and class now exist. Next comes the course content.');
    });
    await s.scene('Upload the course package', 'Upload the course package: one file with every day\'s material', async () => {
      const input = page.getByLabel('Course package', { exact: false }).or(page.locator('#su-package')).first();
      await input.scrollIntoViewIfNeeded();
      await s.pause(600);
      await input.setInputFiles(packageTar());
      await s.tid('gate-report').waitFor({ state: 'visible', timeout: 60_000 });
      await s.pause(800);
    });
    await s.scene('The content gate', 'The content gate checks the package before anyone can see it', async () => {
      await s.tid('gate-report').scrollIntoViewIfNeeded();
      await s.pause(2500);
      await s.say('Eight checks: files, readme, diagnostic, script times, links, code languages, graded items, cards');
      await s.scroll(250);
      await s.say('A package that fails a check cannot be published, so learners never see broken material');
    });
    await s.scene('Publish and see the schedule', 'All checks pass, so the admin publishes: the class schedule appears', async () => {
      await s.click(s.button(/^publish/i));
      await s.tid('class-schedule').waitFor({ state: 'visible', timeout: 30_000 });
      await s.tid('class-schedule').scrollIntoViewIfNeeded();
      await s.pause(2500);
    });
    await s.scene('Feature switches', 'Feature switches turn optional features on or off for the whole organisation', async () => {
      await s.click(s.link('Feature switches'));
      await s.pause(1500);
      await s.check(page.getByLabel('Pair programming'));
      await s.pause(800);
      await s.say('For example: pair programming in labs. Google connections stay off until you turn them on.');
      await s.scroll(300);
      await s.say('Switches change what trainers and learners see across the whole organisation');
      await s.toTop();
    });
    s.skip('Join codes', 'the app has no admin screen for creating or listing join codes (the codes exist only as an API call); the join flow itself is shown in 04-learner-day');
  },
};
