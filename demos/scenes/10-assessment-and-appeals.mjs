import { P, at, STANDARD } from '../lib/people.mjs';
import { populateDiagnosticMatrix, populateGradedWork } from '../lib/populate.mjs';
import { changedPackageTar } from '../lib/files.mjs';

export default {
  name: '10-assessment-and-appeals',
  persona: 'Learner and trainer',
  shows: 'Grades with score history, appeal with evidence pack, AI policy and unread suggestions, corrected score kept beside the original, item analysis, misconceptions, mistake clusters, changed-package check.',
  title: 'Graded work, appeals and test quality',
  subtitle: 'Score history, appeals with evidence, AI policy, item analysis, mistake clusters, package changes',
  profile: 'desktop',
  seeds: [...STANDARD, 'appeal', 'digest'],
  async prepare(hub) {
    await populateDiagnosticMatrix(hub);
    await populateGradedWork(hub);
    await hub.clock(at(1, '14:00'));
  },
  async run(s, hub) {
    const page = s.page;
    const card = (item) => page.locator('article').filter({ hasText: item }).first();

    await s.signInAs(P.l1, '/learn/grades');
    await s.scene('Published grades', 'A learner sees the scores the trainer has published, each with its history', async () => {
      await s.pause(2500);
      await s.scroll(300);
      await s.pause(1500);
      await s.toTop();
    });
    await s.scene('The learner appeals', 'Think a score is wrong? Appeal it within 7 days and say why', async () => {
      const c = card('day0:quiz');
      await c.scrollIntoViewIfNeeded();
      await s.type(c.getByLabel('Reason'), 'Question 4: my answer matches the answer key', { delay: 40 });
      await s.click(c.getByTestId('appeal-open'));
      await s.pause(2000);
      await s.say('The appeal is now open and waiting for the trainer');
    });

    await s.scene('Trainer: appeals with evidence', 'The trainer sees the appeal with its evidence pack: the question seed, mode and event log', async () => {
      await s.signInAs(P.trainer, '/teach/appeals');
      await s.pause(2500);
      await s.say('Appeals from learners are listed with the learner\'s reason. An appeal not handled in 7 days is escalated to a second reviewer.');
    });
    await s.scene('AI policy: unread suggestions', 'During graded work the AI policy applies. A learner with unread, confirmed AI suggestions wins the appeal automatically', async () => {
      const a = page.locator('article').filter({ hasText: 'day1:quiz' }).first();
      await a.scrollIntoViewIfNeeded();
      await s.pause(3000);
      await s.say('The evidence pack counts confirmed AI suggestions that the learner never read');
    });
    await s.scene('Uphold with a corrected score', 'Upholding the first appeal: enter the corrected score and confirm', async () => {
      const a = page.locator('article').filter({ hasText: 'day0:quiz' }).first();
      await a.scrollIntoViewIfNeeded();
      await s.type(a.getByLabel('Corrected score'), '6');
      await s.click(a.getByRole('button', { name: 'Uphold' }));
      const confirm = a.getByRole('button', { name: 'Confirm' });
      if (await confirm.count()) await s.click(confirm);
      await s.pause(2500);
    });
    await s.scene('Corrected score, original kept', 'The learner sees the corrected score, and the original is kept in the history (nothing is overwritten)', async () => {
      await s.signInAs(P.l1, '/learn/grades');
      await card('day0:quiz').scrollIntoViewIfNeeded();
      await s.pause(4000);
    });

    await s.scene('Item analysis', 'Item analysis: how each question performed. Questions everyone gets right, or that do not separate strong from weak, are flagged', async () => {
      await s.signInAs(P.trainer, '/teach/item-analysis');
      await s.tid('item-analysis').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
      await s.pause(4000);
    });
    await s.scene('Suggested misconceptions', 'When many learners give the same wrong answer it is suggested as a misconception. Accept it and it joins the explain-it-back checklist', async () => {
      await s.go('Misconceptions');
      await s.tid('misconception-suggestions').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
      await s.pause(2500);
      await s.click(s.button('Accept').first());
      await s.pause(2500);
    });
    await s.scene('Mistake clusters', 'Lab results are grouped by failing checks: one comment reaches every learner in a cluster', async () => {
      await s.go('Lab results');
      await s.tid('lab-clusters').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
      await s.pause(2500);
      const first = page.getByLabel('Comment for this group').first();
      await s.type(first, 'Check the port in kettle.toml, and add a README title.', { delay: 40 });
      await s.click(s.button('Send').first());
      await s.pause(2500);
    });
    await s.scene('What changes in a new package', 'Before replacing the course package, check which days and questions would change', async () => {
      await s.go('Packages');
      await page.locator('#pkg-file').scrollIntoViewIfNeeded();
      await s.pause(800);
      await page.locator('#pkg-file').setInputFiles(changedPackageTar());
      await s.tid('package-diff').waitFor({ state: 'visible', timeout: 30_000 });
      await s.tid('package-diff').scrollIntoViewIfNeeded();
      await s.pause(4500);
    });
    s.skip('Taking a graded quiz in the app', 'the app has no learner screen for sitting a graded quiz; graded attempts (timing, AI usage, accommodations) reach it through the API, so this video shows the grades, evidence and appeals that follow');
  },
};
