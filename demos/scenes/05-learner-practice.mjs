import { P, at, STANDARD } from '../lib/people.mjs';
import { populateDay0, populateRituals } from '../lib/populate.mjs';

export default {
  name: '05-learner-practice',
  title: 'Learner: practice',
  subtitle: 'Stand-up, peer review, accommodations, the Shift and the practice forge',
  profile: 'desktop',
  seeds: [...STANDARD, 'cards', 'peer', 'appeal'],
  async prepare(hub) {
    await populateDay0(hub);
    await populateRituals(hub);
    await hub.clock(at(1, '09:40'));
  },
  async run(s, hub) {
    const page = s.page;
    await s.signInAs(P.l1, '/learn/standup');
    await s.scene('Daily stand-up', 'Daily stand-up: say what you did, what you will do, and what blocks you', async () => {
      await s.pause(1500);
      await s.type(page.getByLabel('Yesterday'), 'Set up the Kettle site');
      await s.type(page.getByLabel('Today'), 'Add the about page');
      await s.type(page.getByLabel('Blockers'), "Waiting on Liam's PR");
      await s.click(s.button('Post'));
      await s.say('The summary highlights anyone who is blocked, so the trainer sees it at a glance');
      await s.scroll(300);
      await s.pause(2000);
      await s.toTop();
    });
    await s.scene('Estimation poker and retro', 'Team rituals: estimation poker reveals every vote together, and the retro turns ideas into tickets', async () => {
      await s.click(s.link('Poker'));
      await s.pause(3000);
      await s.click(s.link('Retro'));
      await s.pause(1500);
      await s.click(s.button('Turn into ticket').first());
      await s.pause(2000);
    });
    await hub.clock(at(1, '14:00'));
    await s.scene('Peer review', 'Peer review: check a classmate\'s pull request against a checklist', async () => {
      await s.click(s.link('Peer review'));
      await s.pause(1200);
      const boxes = s.tid('review-checklist').getByRole('checkbox');
      for (let i = 0; i < await boxes.count(); i++) await s.check(boxes.nth(i));
      await s.type(page.getByLabel('Comment'), 'Builds fine; please rename page2.md to about.md.', { delay: 40 });
      await s.click(s.button('Submit review'));
      await s.tid('review-score').waitFor({ state: 'visible', timeout: 20_000 });
      await s.pause(2500);
    });
    await s.scene('Request an accommodation', 'Need extra time? Request an accommodation; an admin approves it', async () => {
      await s.click(s.link('Accommodations'));
      await s.click(s.button('Request an accommodation'));
      await s.type(page.getByLabel(/extra time|time multiplier/i), '1.5');
      await s.type(page.getByLabel(/reason/i), 'Documented need for extra time', { delay: 40 });
      await s.click(s.button(/^(submit|send|request)$/i));
      await s.pause(2000);
    });
    await s.scene('Admin approves', 'The admin sees the request and approves it', async () => {
      await s.signInAs(P.admin, '/admin/accommodations');
      await s.pause(1500);
      await s.click(s.button('Approve'));
      await s.pause(2000);
    });
    await s.scene('The Shift', 'The Shift: a timed practice shift where tickets arrive and each has an SLA clock. The extended limit now shows.', async () => {
      await s.signInAs(P.l1, '/learn/shift');
      await s.pause(2500);
      await hub.clock(at(1, '14:00'));
      await s.click(s.tid('shift-start'));
      await s.tid('sla-T1').waitFor({ state: 'visible', timeout: 20_000 });
      await s.pause(2000);
      await s.say('The first ticket arrives now. Acknowledge it, then resolve it with an answer.');
      await s.click(s.tid('sla-T1').getByRole('button', { name: /^(acknowledge|ack)$/i }));
      await s.pause(1200);
      await hub.clock(at(1, '14:07'));
      await s.say('Seven minutes in: a second ticket has arrived');
      await s.tid('sla-T2').waitFor({ state: 'visible', timeout: 25_000 }).catch(() => {});
      await s.click(s.tid('sla-T1').getByRole('button', { name: /^resolve$/i }));
      await s.type(s.tid('sla-T1').getByLabel(/answer|resolution/i).or(page.getByRole('dialog').getByLabel(/answer|resolution/i)), 'missing build step', { delay: 40 });
      const submit = page.getByRole('button', { name: /^(submit|resolve|confirm|save)$/i });
      if (await submit.count()) await s.click(submit);
      await s.pause(2000);
    });
    await s.scene('Shift score', 'End the shift: the score shows the mode and one row per ticket', async () => {
      await s.click(s.button(/^(end shift|finish shift|submit shift|finish)$/i));
      const confirm = page.getByRole('button', { name: /^(confirm|yes|end)$/i });
      if (await confirm.count()) await s.click(confirm);
      await s.tid('shift-score').waitFor({ state: 'visible', timeout: 20_000 });
      await s.tid('shift-score').scrollIntoViewIfNeeded();
      await s.pause(3500);
    });
    await s.scene('Practice forge', 'The practice forge: rehearse the pull-request flow before the real GitHub, no account needed', async () => {
      await s.click(s.link('Forge'));
      await s.pause(3500);
      await s.say('The exercise: open your practice repository, make a change on a branch, open a pull request, then check your work');
    });
    s.skip('Practice forge check', 'completing the exercise provisions a repository on a Forgejo server, and the demo hub has none (the app would only record a simulated pass, which is not shown)');
  },
};
