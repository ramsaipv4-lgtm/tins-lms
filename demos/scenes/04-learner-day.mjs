import { P, at } from '../lib/people.mjs';

const KEY = ['kettle init', 'kettle.toml', 'public', 'kettle build', '--version', 'pages', 'kettle clean', '.md'];

export default {
  name: '04-learner-day',
  persona: 'Learner',
  shows: 'Join with a code, terms, setup check, content released live, quick-learn audio, daily cards, error notebook, diagnostic, explain-it-back, exit ticket.',
  title: 'Learner: a day on the phone',
  subtitle: 'Join with a code, today\'s content, cards, diagnostic, explain it back, exit ticket',
  profile: 'phone',
  seeds: ['base', 'demo-extra', 'cards', 'explain'],
  async prepare(hub) { await hub.clock(at(0, '08:30')); },
  async run(s, hub) {
    const page = s.page;
    await s.enablePasskeys();
    await s.open('/');
    await s.scene('Join with a code', 'A learner opens the app for the first time and joins with the code from the trainer', async () => {
      await s.pause(1500);
      await s.click(s.button(/join a class/i).or(s.link(/join a class/i)));
      await s.type(page.getByLabel(/class code|join code/i), 'JOIN-C1-0001');
      await s.click(s.button(/^(continue|next|join)/i));
      await s.tid('tnc-accept').waitFor({ state: 'visible', timeout: 30_000 });
    });
    await s.scene('Terms and conditions', 'Accept the terms, then your name and date of birth', async () => {
      await s.focusHeading();
      await s.check(s.tid('tnc-accept'));
      await s.type(page.getByLabel('Full name'), 'Ravi Joiner');
      await s.type(page.getByLabel('Roll number'), 'R-101');
      await page.getByLabel('Date of birth').fill('2001-05-14');
      await s.pause(800);
      await s.say('The date of birth is only used to apply the right protections for learners under 18');
      await s.click(s.button('Create account'));
      await s.tid('setup-check').waitFor({ state: 'visible', timeout: 30_000 });
    });
    await s.scene('Day −1 setup check', 'The setup check: green means this phone is ready for class', async () => {
      await s.focusHeading();
      await s.pause(3500);
      await s.click(s.button('Go to my home').or(s.link('Go to my home')));
      await s.pause(1500);
    });

    await s.scene('Today\'s content', 'Now Lena, who joined last week: today\'s content appears section by section as the trainer releases it', async () => {
      await hub.clock(at(0, '09:20'));
      await s.signInAs(P.l1, '/learn');
      await s.go('Today');
      await s.pause(2500);
      await s.scroll(420);
      await s.pause(1500);
    });
    await s.scene('A section is released live', 'The trainer taps "Next" on the teleprompter: the next section appears on the phone by itself, with no reload', async () => {
      const secs = (await hub.api(P.l1, '/api/classes/c1/days/0')).json.sections;
      const locked = secs.find((x) => !x.key);
      await s.toTop();
      await hub.api(P.trainer, '/api/classes/c1/teleprompter', 'POST', { sectionId: locked.id });
      await s.waitForText(/Break \(1:15/, 20_000).catch(() => {});
      await s.focusHeading();
      await s.scroll(520);
      await s.pause(2500);
    });
    await s.scene('Quick-learn audio', 'Quick-learn: a ten-minute summary you can read, or listen to at your own speed', async () => {
      await s.go('Quick-learn');
      await s.pause(1500);
      await s.click(s.button('Play'));
      await s.pause(2000);
      await page.getByLabel('Speed').fill('1.5');
      await s.say('Speed from 0.5 to 2 times');
      await s.click(s.button('Stop'));
    });
    await s.scene('Daily cards', 'Daily cards: a few minutes of spaced review. Show the answer, then rate how well you remembered', async () => {
      await hub.clock(at(0, '12:40'));
      await s.go('Daily cards');
      await s.click(s.tid('card-show'));
      await s.pause(900);
      await s.click(s.tid('rate-good'));
      await s.pause(700);
      await s.click(s.tid('card-show'));
      await s.click(s.tid('rate-again'));
      await s.say('"Again" brings a card back sooner');
    });
    await s.scene('Error notebook', 'Wrong answers are collected in the error notebook, grouped by subtopic', async () => {
      await s.go('Error notebook');
      await s.pause(3000);
      await s.scroll(380);
      await s.pause(2000);
    });
    await s.scene('The diagnostic', 'The day\'s diagnostic: eight questions to check what stuck', async () => {
      await s.go('Diagnostic');
      await s.click(s.button('Take the diagnostic'));
      await s.tid('diag-q-1').waitFor({ state: 'visible' });
      for (let n = 1; n <= 8; n++) {
        const q = s.tid(`diag-q-${n}`);
        const radios = q.getByRole('radio');
        if (await radios.count()) {
          await s.pause(300);
        } else {
          const answer = n === 6 ? 'src' : KEY[n - 1];
          if (n <= 3) await s.type(q.getByRole('textbox').first(), answer, { delay: 45 }); else await s.fill(q.getByRole('textbox').first(), answer);
        }
      }
      await s.focusHeading();
    });
    await s.scene('Explain it back', 'Explain it back: say the idea in your own words and get feedback on what you covered', async () => {
      await s.go('Explain it back');
      await s.type(page.getByLabel('Your explanation'), 'Kettle build reads each page and writes HTML into the public folder.', { delay: 40 });
      await s.click(s.button('Check'));
      await s.pause(3000);
      await s.scroll(300);
      await s.pause(2000);
    });
    await s.scene('Exit ticket', 'The exit ticket tells the trainer what is still unclear', async () => {
      await hub.clock(at(0, '12:55'));
      await s.go('Exit ticket');
      await s.check(page.getByLabel('Still unclear: Lab'));
      await s.check(page.getByLabel('The pace was too fast'));
      await s.type(page.getByLabel(/Anything else/), 'More time on the clean command please', { delay: 40 });
      await s.click(s.button('Submit'));
      await s.pause(2000);
    });
  },
};
