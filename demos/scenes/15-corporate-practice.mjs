import { P, at, STANDARD } from '../lib/people.mjs';

export default {
  name: '15-corporate-practice',
  persona: 'Learner and trainer',
  shows: 'Tickets with acceptance criteria, change request and approval before a prod deploy, runbook and ADR templates, demo day, leaked-key drill.',
  title: 'Practising like a real team',
  subtitle: 'Tickets with acceptance criteria, change requests, runbook and ADR templates, demo day, the leaked-key drill',
  profile: 'desktop',
  seeds: [...STANDARD],
  async prepare(hub) { await hub.clock(at(2, '10:00')); },
  async run(s, hub) {
    const page = s.page;

    await s.signInAs(P.l1, '/learn/tickets');
    await s.scene('Tickets need acceptance criteria', 'Tickets: a ticket says what "done" means. Acceptance criteria are part of the ticket, not an afterthought', async () => {
      await s.pause(1500);
      await s.click(s.button('New ticket'));
      await s.type(page.getByLabel('Title'), 'Add an about page', { delay: 40 });
      await s.type(page.getByLabel('Acceptance criteria'), 'The page builds; it is linked from the menu; it has a title', { delay: 30 });
      await s.click(s.button('Create'));
      await s.pause(2500);
    });

    await s.scene('Prod needs a change request', 'Deployments: staging is free, but prod needs an approved change request', async () => {
      await s.go('Deployments');
      await s.click(s.button('Deploy to staging'));
      await s.pause(1800);
      await s.moveTo(s.button('Deploy to prod'));
      await s.say('The prod button stays disabled until a change request is approved');
      await s.pause(1500);
    });
    await s.scene('Request approval', 'The learner writes a change request with a summary and a rollback plan', async () => {
      await s.click(s.button('New change request'));
      await s.type(page.getByLabel('Summary'), 'Publish the about page', { delay: 40 });
      await s.type(page.getByLabel('Rollback plan'), 'Revert the commit and rebuild', { delay: 40 });
      await s.click(s.button('Submit'));
      await s.pause(2500);
    });
    await s.scene('Trainer approves', 'The trainer reviews the change request and approves it', async () => {
      await s.signInAs(P.trainer, '/teach/change-requests');
      await s.pause(2500);
      await s.click(s.button('Approve').first());
      await s.pause(2500);
    });
    await s.scene('Deploy to prod', 'With the approval in place, the deploy to prod goes through and is recorded in the history', async () => {
      await s.signInAs(P.l1, '/learn/deployments');
      await s.click(s.button('Deploy to prod'));
      await s.pause(2500);
      await s.scroll(300);
      await s.pause(2500);
    });

    await s.scene('Runbook template', 'Runbook and decision-record templates are graded against a rubric, row by row', async () => {
      await s.go('Templates');
      const runbook = page.getByLabel('Runbook', { exact: true });
      await s.type(runbook, 'When: the site returns 404 on /pricing.\nSteps:\n1. Check the last build log\n2. Re-run kettle build\nRollback: redeploy the previous build.\nContact: the on-call trainer.', { delay: 12 });
      await s.click(s.button('Submit').first());
      await s.pause(3500);
    });
    await s.scene('Decision record', 'The same for an architecture decision record: context, options, decision and consequences', async () => {
      const adr = page.getByLabel('Architecture decision record', { exact: true });
      await s.type(adr, 'Context: we need a theme.\nOptions: the default theme or a custom one.\nDecision: start with the default theme.\nConsequences: faster start, less branding.', { delay: 12 });
      await s.click(s.button('Submit').nth(1));
      await s.pause(3500);
    });

    await s.scene('Demo day', 'Demo day: each team books one presentation slot', async () => {
      await s.go('Demo day');
      await s.click(s.button('Book 14:15'));
      await s.pause(3500);
    });

    await s.scene('Leaked key drill: trainer', 'The leaked-key drill: the trainer starts it, and every team gets the alert', async () => {
      await s.signInAs(P.trainer, '/teach/drills');
      await s.pause(1500);
      await s.click(s.button('Start drill'));
      await s.pause(3000);
    });
    await s.scene('Leaked key drill: the team responds', 'Teams work through the response in order: revoke, rotate, scrub history, write the incident report', async () => {
      await s.signInAs(P.l1, '/learn/key-drill');
      await s.pause(2500);
      for (let i = 0; i < 4; i++) {
        const mark = page.getByRole('button', { name: /^Mark done/ }).first();
        if (!(await mark.count())) break;
        await s.click(mark, { after: 800 });
      }
      await s.pause(2500);
    });
  },
};
