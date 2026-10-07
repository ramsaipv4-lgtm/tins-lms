import { P, at, STANDARD } from '../lib/people.mjs';
import { populateDay0, populateRituals } from '../lib/populate.mjs';

export default {
  name: '06-coordinator',
  persona: 'Coordinator and admin',
  shows: 'Read-only batch view, schedule and anonymous feedback, college reports (PDF and CSV), certificates, public verify page.',
  title: 'Coordinator and college reports',
  subtitle: 'Batch view, reports, certificates and the verify link',
  profile: 'desktop',
  seeds: [...STANDARD, 'demo-att-d12', 'portfolio'],
  async prepare(hub) {
    await populateDay0(hub);
    await populateRituals(hub);
    await hub.clock(at(3, '14:00'));
  },
  async run(s, hub) {
    const page = s.page;
    const download = async (target) => {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), s.click(target)]);
      await dl.path();
    };
    await s.signInAs(P.coord, '/teach');
    await s.scene('Batch view', 'The coordinator sees the whole batch, read-only: who attended how many of the four days', async () => {
      await s.tid('batch-view').waitFor({ state: 'visible', timeout: 20_000 });
      await s.pause(2500);
      await s.scroll(250);
      await s.pause(2500);
      await s.toTop();
    });
    await s.scene('Schedule and feedback', 'The class schedule and the learners\' anonymous weekly feedback. The coordinator cannot change anything.', async () => {
      await s.click(s.link('Schedule'));
      await s.pause(2500);
      await s.click(s.link('Feedback'));
      await s.pause(3000);
    });
    await s.scene('College reports', 'The admin produces the college\'s sheets in the organisation\'s layout: PDF and CSV', async () => {
      await s.signInAs(P.admin, '/admin/reports');
      await s.pause(1500);
      await download(s.button('Attendance sheet (PDF)'));
      await s.say('Attendance sheet, completion report and CO-PO attainment, each a single click');
      await download(s.button('Completion report (CSV)'));
      await download(s.button('CO-PO attainment (CSV)'));
    });
    let certId = null;
    await s.scene('Certificates', 'Certificates: issue one for a learner who completed the program', async () => {
      await s.click(s.link('Certificates'));
      await s.pause(1500);
      await s.click(s.button('Issue certificate').first());
      const id = s.tid('certificate-id').filter({ hasNotText: '7KQ2M9X4TB1R' });
      await id.waitFor({ state: 'visible', timeout: 20_000 });
      certId = (await id.first().innerText()).trim();
      await s.pause(2500);
      await download(s.button('Download certificate PDF').first());
      await s.say('The certificate PDF carries a QR code and a 12-character id anyone can check');
    });
    await s.scene('Verify link', 'Anyone can verify a certificate with its public link, without signing in', async () => {
      await s.context.clearCookies();
      await s.open(`/verify/${certId}`);
      await s.pause(4000);
    });
  },
};
