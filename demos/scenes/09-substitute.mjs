import { P, at, STANDARD } from '../lib/people.mjs';
import { populateDay0, populateRituals } from '../lib/populate.mjs';

export default {
  name: '09-substitute',
  title: 'A substitute takes the day',
  subtitle: 'Hand a day over, read the handover pack, run the class',
  profile: 'desktop',
  seeds: [...STANDARD, 'digest'],
  async prepare(hub) {
    await populateDay0(hub);
    await populateRituals(hub);
    await hub.clock(at(0, '15:00'));
  },
  async run(s, hub) {
    const page = s.page;
    await s.signInAs(P.trainer, '/teach/schedule');
    await s.scene('The trainer cannot take a day', 'Tara cannot take day 1. She picks it on the schedule and chooses a substitute', async () => {
      await s.pause(1500);
      await s.click(s.button(/can.?t take day 1/i));
      await s.pause(1200);
      const sel = page.getByLabel(/substitute/i);
      if (await sel.count()) {
        const tag = await sel.first().evaluate((e) => e.tagName.toLowerCase());
        if (tag === 'select') await s.select(sel, { label: 'Sam Substitute' });
        else await s.click(page.getByText('Sam Substitute').first());
      } else {
        await s.click(page.getByText('Sam Substitute').first());
      }
      await s.pause(800);
      await s.say('Without a substitute, "self-learn mode" can play the day\'s script as text for the learners');
      await s.click(s.button(/^(confirm|save|send|hand over)/i));
      await s.pause(2000);
    });
    await s.scene('The handover pack', 'Sam signs in and finds the handover pack: script, board pages, quick-learn, class status, at-risk list and trainer notes', async () => {
      await s.signInAs(P.sub, '/teach/handover');
      await s.tid('handover-pack').waitFor({ state: 'visible', timeout: 30_000 });
      await s.pause(2500);
      await s.scroll(350);
      await s.pause(2500);
      await s.scroll(350);
      await s.pause(2500);
      await s.toTop();
    });
    await s.scene('Mark as read', 'Sam marks the pack as read, so the trainer knows the handover landed', async () => {
      const btn = s.button(/mark (as )?read/i);
      await s.click(btn);
      await s.pause(2500);
    });
    await s.scene('Sam runs the day', 'On day 1, Sam has the same teleprompter, attendance and board as the trainer', async () => {
      await hub.clock(at(1, '09:10'));
      await s.click(s.link('Teleprompter'));
      await s.pause(3000);
      await s.click(s.button('Next section'));
      await s.pause(2000);
      await s.click(s.link('Attendance'));
      await s.pause(2500);
    });
    await s.scene('Sam wraps up', 'At the end, Sam wraps up the day with one tap', async () => {
      await hub.clock(at(1, '12:55'));
      await s.click(s.link('Teleprompter'));
      await s.pause(800);
      const wrap = s.tid('wrap-up');
      if (!(await wrap.isVisible().catch(() => false))) await s.click(s.link('Today').or(s.link('Home')));
      await s.click(s.tid('wrap-up').or(s.button('Wrap up the day')));
      await s.pause(3000);
    });
    await s.scene('The report records who taught', 'The delivery report records who actually taught day 1', async () => {
      await s.signInAs(P.trainer, '/teach/delivery-reports');
      await s.pause(4000);
    });
  },
};
