import { P, at, STANDARD } from '../lib/people.mjs';
import { populateDay0 } from '../lib/populate.mjs';

export default {
  name: '12-data-and-admin',
  persona: 'Learner, trainer and admin',
  shows: 'Export my data, signed package, drop a learner and switch back, verbal syllabus and change log, feature switches and integration buttons, GitHub link, health check.',
  title: 'Your data, and running the organisation',
  subtitle: 'Export, signed packages, dropping a learner, syllabus, feature switches and integrations',
  profile: 'desktop',
  seeds: [...STANDARD, 'peer'],
  async prepare(hub) {
    await populateDay0(hub);
    await hub.clock(at(1, '10:00'));
  },
  async run(s, hub) {
    const page = s.page;
    const download = async (target) => {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), s.click(target)]);
      await dl.path();
    };

    await s.signInAs(P.l2, '/learn/settings');
    await s.scene('Export my data', 'Every learner can download everything the hub holds about them as one archive. It contains only their own records', async () => {
      await s.pause(1800);
      await download(s.button('Export my data'));
      await s.say('The archive has a manifest, so anything missing or altered can be detected');
    });

    await s.scene('Signed day package', 'For classes with no network, the trainer exports a signed day package; phones check the signature on import', async () => {
      await s.signInAs(P.trainer, '/teach/files');
      await s.pause(1500);
      await download(s.tid('pkg-download'));
      await s.say('Submission files that learners send back are imported here');
      await s.pause(1500);
    });

    await s.scene('Drop a learner', 'When a learner leaves, the drop switch lists exactly what will happen before anything changes', async () => {
      await s.go('Roster');
      const row = s.tid('roster-person:l2');
      await row.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
    });
    await s.scene('Drop: the confirmation', 'The confirmation lists the open tickets to unassign and the reviews that need a new reviewer', async () => {
      await s.click(s.tid('roster-person:l2').getByRole('button', { name: 'Drop' }));
      await s.tid('drop-confirm').waitFor({ state: 'visible', timeout: 20_000 });
      await s.pause(4000);
      await s.click(s.tid('drop-confirm').getByRole('button').filter({ hasText: /confirm|drop/i }).first());
      await s.pause(2500);
      await s.say('The learner leaves the roll and the live quiz');
      await s.pause(1500);
    });
    await s.scene('Drop: switch back', 'Changed their mind? Switching back restores the team and the repository access', async () => {
      await s.click(s.tid('roster-person:l2').getByRole('button', { name: /undo|restore|back/i }));
      await s.pause(4000);
    });

    await s.scene('Verbal syllabus', 'The college gave the topics by phone? Type them in, one per line: the app drafts a syllabus', async () => {
      await s.signInAs(P.admin, '/admin/syllabus');
      await s.type(page.getByLabel('Topic notes'), 'Install Kettle and make a site\nPages and templates\nThemes and partials\nPublishing the site', { delay: 30 });
      await s.click(s.button('Draft syllabus'));
      await s.pause(3500);
      await download(s.button('Download PDF for the college'));
      await s.say('A confirmation PDF goes to the college');
    });
    await s.scene('Syllabus change log', 'Later changes are saved as new versions, and every change is dated in the cohort change log', async () => {
      await s.click(s.button('Save syllabus'));
      await s.pause(1500);
      await s.type(page.getByLabel('Topic notes'), 'Install Kettle and make a site\nPages and templates\nThemes and partials\nPublishing the site\nAccessibility checks', { delay: 20 });
      await s.click(s.button('Draft syllabus'));
      await s.click(s.button('Save syllabus'));
      await s.pause(1500);
      await s.tid('change-log').scrollIntoViewIfNeeded().catch(() => {});
      await s.pause(3500);
    });

    await s.scene('Feature switches', 'Optional features are organisation switches. Integrations with Google stay hidden until an admin turns them on', async () => {
      await s.go('Feature switches');
      await s.pause(1500);
      for (const name of ['Calendar sync', 'Google Forms', 'Meet links', 'Plan versus actual re-flow']) await s.check(page.getByLabel(name, { exact: true }));
      await s.say('Calendar sync, Google Forms, Meet links and plan-versus-actual are now on');
      await s.pause(1500);
    });
    await s.scene('Integration buttons appear', 'With the switches on, the trainer\'s schedule offers calendar sync and each quiz offers a Google Forms export', async () => {
      await s.signInAs(P.trainer, '/teach/schedule');
      await s.pause(3000);
      await s.go('Quizzes');
      await s.pause(3500);
    });
    await s.scene('Linking a GitHub account', 'A learner can link a GitHub account later; practice repositories can then move to it', async () => {
      await s.signInAs(P.l1, '/learn/accounts');
      await s.type(page.getByLabel('GitHub username'), 'demo-learner-lena', { delay: 45 });
      await s.click(s.button('Link GitHub'));
      await s.pause(3000);
    });
    await s.scene('Health check', 'Anyone running the server can check it is up: the health address answers with the hub profile', async () => {
      await s.context.clearCookies();
      await page.goto(`${hub.url}/api/health`);
      await s.pause(3500);
    });

    s.skip('Whole-hub export and import', 'there is no admin screen for it; it is an API call (GET /api/export, POST /api/import)');
    s.skip('Device pairing codes (issuing)', 'the trainer-side screen that creates pairing codes and lists paired devices does not exist (API only); the learner side is shown in 13-first-run-and-catch-up');
    s.skip('Recovery key and crypto-shredding', 'no screen: the recovery key and the shredding of a dropped learner\'s keys are server-side operations without a UI');
    s.skip('Retention', 'no screen: retention runs as a server rule with no settings page');
    s.skip('Integration credentials (Forgejo, Google, GitHub App tokens)', 'they are server environment variables and need real external accounts, so there is nothing to show on screen');
  },
};
