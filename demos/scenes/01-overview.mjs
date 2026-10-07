import { P, at, STANDARD } from '../lib/people.mjs';

export default {
  name: '01-overview',
  title: 'Coach LMS in two minutes',
  subtitle: 'Sign in and the four spaces: Admin, Teach, Learn, Coach',
  profile: 'desktop',
  seeds: [...STANDARD, 'cards'],
  async prepare(hub) { await hub.clock(at(0, '09:30')); },
  async run(s, hub) {
    await s.scene('The sign-in screen', 'Coach LMS: one app for admins, trainers, learners and a personal coach', async () => {
      await s.open('/signin');
      await s.pause(1500);
      await s.say('You sign in with a passkey. (This recording uses a demo shortcut to sign in.)');
    });
    await s.scene('Admin space', 'Admin: set up programs, cohorts and classes, and publish course packages', async () => {
      await s.signInAs(P.admin, '/admin');
      await s.pause(1200);
      await s.click(s.link('Classes'));
      await s.pause(1500);
      await s.click(s.link('College reports'));
      await s.pause(1500);
      await s.click(s.link('Feature switches'));
      await s.pause(1500);
    });
    await s.scene('Teach space', 'Teach: the trainer\'s space for the class day', async () => {
      await s.signInAs(P.trainer, '/teach');
      await s.pause(1200);
      await s.click(s.link('Today'));
      await s.pause(1800);
      await s.click(s.link('Attendance'));
      await s.pause(1800);
      await s.click(s.link('Teleprompter'));
      await s.pause(1800);
    });
    await s.scene('Learn space', 'Learn: today\'s content, daily cards, practice, grades and doubts', async () => {
      await s.signInAs(P.l1, '/learn');
      await s.pause(1200);
      await s.click(s.link('Today'));
      await s.pause(1800);
      await s.click(s.link('Daily cards'));
      await s.pause(1800);
      await s.click(s.link('Doubts'));
      await s.pause(1800);
    });
    await s.scene('Coach space', 'Coach: a private space behind a PIN for planning your study and meals', async () => {
      await s.click(s.link('Coach').first());
      await s.page.getByText('Loading...').waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
      await s.pause(2500);
    });
  },
};
