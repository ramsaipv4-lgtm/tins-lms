import { P, at, STANDARD } from '../lib/people.mjs';
import { populateDay0 } from '../lib/populate.mjs';

export default {
  name: '11-classroom-tools',
  persona: 'Trainer and learners',
  shows: 'Exit-ticket tally, doubt queue, stand-up summary, estimation poker reveal, at-risk digest, pair programming, Heading Strike, team wall.',
  title: 'Classroom tools',
  subtitle: 'Exit tickets, doubts, stand-up, estimation poker, at-risk digest, pair programming, Heading Strike',
  profile: 'desktop',
  seeds: [...STANDARD, 'digest'],
  async prepare(hub) {
    await populateDay0(hub); // doubts, exit tickets, cards, notes: day 0 has happened
    await hub.clock(at(0, '18:30'));
  },
  async run(s, hub) {
    const page = s.page;

    await s.signInAs(P.trainer, '/teach/exit-ticket');
    await s.scene('Exit tickets: the tally', 'Exit tickets: at the end of the day learners say what is still unclear. The trainer sees the tally', async () => {
      await s.tid('exit-tally').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
      await s.pause(3500);
      await s.scroll(250);
      await s.pause(2500);
      await s.say('The most common "still unclear" topics come first, with the learners\' own comments below');
      await s.toTop();
    });
    await s.scene('Doubt queue', 'Doubts: learners post questions (anonymously if they like) and upvote the ones they share', async () => {
      await hub.clock(at(1, '09:20'));
      await s.signInAs(P.s5, '/learn/doubts');
      await s.type(page.getByLabel('Your doubt'), 'What does the weight key in front matter do?', { delay: 40 });
      await s.check(page.getByLabel('Post anonymously'));
      await s.click(s.button('Post'));
      await s.pause(2000);
      await s.say('Upvote a doubt you share, and it moves up the queue');
      await s.click(s.button('Upvote').first());
      await s.pause(2000);
    });

    await s.scene('Stand-up summary', 'Stand-up: the summary highlights anyone who is blocked, so the trainer sees it at a glance', async () => {
      await hub.clock(at(1, '09:12'));
      const su = [
        ['l2', 'Built the home page', 'Add the about page', ''],
        ['s1', 'Set up the Kettle site', 'Write the README', 'Waiting on the theme folder from Aarav'],
        ['s2', 'Read the deep dive', 'Pair on the build step', ''],
        ['s5', 'Fixed the kettle.toml title', 'Try a custom theme', 'Blocked: build fails on page two'],
      ];
      for (const [k, y, t, b] of su) await hub.api(P[k], '/api/rituals/standup', 'POST', { yesterday: y, today: t, blockers: b });
      await s.signInAs(P.trainer, '/teach/standup');
      await s.tid('standup-summary').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
      await s.pause(3500);
      await s.scroll(250);
      await s.pause(2000);
      await s.toTop();
    });

    await s.scene('Estimation poker', 'Estimation poker: the trainer starts an item, everyone picks a card, and the cards stay hidden until the reveal', async () => {
      await s.go('Poker');
      await s.type(page.getByLabel('Item to estimate'), 'Add a health endpoint', { delay: 40 });
      await s.click(s.button('Start'));
      await s.pause(1200);
      await s.signInAs(P.l1, '/learn/poker');
      await s.say('A learner picks a card; nobody can see the others\' votes yet');
      await s.click(page.getByRole('group', { name: 'Estimate cards' }).getByRole('button', { name: '1', exact: true }));
      await s.pause(1500);
      for (const [k, v] of [['s1', 8], ['s2', 3], ['s5', 5]]) await hub.api(P[k], '/api/rituals/poker/vote', 'POST', { points: v });
    });
    await s.scene('Poker reveal with a spread', 'On the reveal, a wide spread asks the lowest and highest voters to explain their reasoning', async () => {
      await s.signInAs(P.trainer, '/teach/poker');
      await s.click(s.tid('poker-reveal'));
      await s.tid('poker-result').waitFor({ state: 'visible', timeout: 20_000 });
      await s.pause(4500);
    });

    await s.scene('At-risk digest', 'The Friday digest lists learners by level with the reasons, and a prefilled message for each', async () => {
      await s.go('Friday digest');
      await s.tid('digest').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
      await s.pause(4500);
      await s.scroll(250);
      await s.pause(2000);
    });

    await s.scene('Pair programming', 'Pair programming is a class setting. Switch it on and labs show who is paired, with a 15-minute swap timer', async () => {
      await s.go('Class settings');
      await s.pause(1000);
      await s.check(page.getByLabel('Pair programming'));
      await s.pause(1500);
      await s.signInAs(P.l2, '/learn/lab');
      await s.tid('pair-panel').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
      await s.pause(4000);
    });

    await s.scene('Heading Strike', 'Heading Strike: a five-question warm-up game about Markdown headings', async () => {
      await s.go('Heading Strike');
      await s.click(s.button('Start round'));
      for (let i = 0; i < 5; i++) {
        const right = page.getByRole('list').getByRole('button').filter({ hasText: /^#{1,6} \S/ }).first();
        await s.click((await right.count()) ? right : page.getByRole('list').getByRole('button').first(), { after: 700 });
      }
      await s.pause(2500);
    });
    await s.scene('Teams, not rankings', 'The celebration wall shows team badges and merged pull requests, never a ranking of individual learners', async () => {
      await s.go('Celebration wall');
      await s.pause(4000);
    });
    s.skip('Study groups', 'there is no study-group screen in the app (the grouping logic exists in the core library only)');
    s.skip('Auto-FAQ from repeated doubts', 'the app has no screen that lists FAQ groups (the grouping logic exists in the core library only)');
  },
};
