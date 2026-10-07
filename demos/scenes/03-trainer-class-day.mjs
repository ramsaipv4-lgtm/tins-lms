import { readFileSync } from 'node:fs';
import { P, at, STANDARD } from '../lib/people.mjs';
import { populateDay0, populateRituals, markAttendance } from '../lib/populate.mjs';
import { fixturePath } from '../lib/files.mjs';

export default {
  name: '03-trainer-class-day',
  title: 'Trainer: a class day',
  subtitle: 'Attendance, teleprompter, board, wrap-up and the delivery report',
  profile: 'desktop',
  seeds: [...STANDARD, 'appeal'],
  async prepare(hub) {
    await populateDay0(hub);
    await populateRituals(hub);
    await hub.clock(at(1, '09:02'));
  },
  async run(s, hub) {
    const page = s.page;
    await s.signInAs(P.trainer, '/teach/attendance');

    await s.scene('Attendance with the rotating code', 'Trainer: it is day 2 of the class. Show the rotating code on the projector', async () => {
      await s.pause(2500);
      await s.say('Learners type the code on their own phones. It changes every minute, so it cannot be shared by chat.');
      await s.click(s.button('Show printed fallback code'));
      await s.say('No phones? A printed fallback code marks learners present but not verified.');
    });
    await s.scene('The roll fills in', 'Learners check in: the roll shows each one as verified', async () => {
      await markAttendance(hub, ['l1', 'l2', 's1', 's2', 's3']);
      await s.pause(2500);
      await markAttendance(hub, ['l3', 's4', 's5']);
      await s.scroll(300);
      await s.pause(2500);
      await s.toTop();
    });
    await s.scene('Absentees and messages', 'Absent learners get a prefilled WhatsApp message in one tap', async () => {
      await s.click(s.link('Absentees'));
      await s.pause(2500);
    });
    await s.scene('Teleprompter release', 'The teleprompter shows the script. "Next section" releases the content to learners\' phones', async () => {
      await s.click(s.link('Teleprompter'));
      await s.pause(2500);
      await s.click(s.button('Next section'));
      await s.say('The trainer taps Next: the section is released on every learner\'s screen, and pacing shows ahead or behind plan');
      await s.scroll(380);
      await s.pause(1500);
      await s.toTop();
    });
    await s.scene('Doubts', 'Doubts from the class are ordered by votes. An anonymous author stays anonymous.', async () => {
      await s.click(s.link('Doubts'));
      await s.pause(2000);
      await s.click(s.button('Mark answered').first());
      await s.pause(1500);
    });
    await s.scene('The board: draw', 'The board keeps the day\'s drawings: pages from earlier days are saved with the class', async () => {
      await s.click(s.link('Board'));
      const board = s.tid('board');
      await board.waitFor({ state: 'visible', timeout: 30_000 });
      await board.locator('canvas').first().waitFor({ state: 'visible', timeout: 30_000 });
      await s.pause(800);
      await s.click(page.getByRole('tab', { name: 'Day 0: themes' }));
      await s.say('Pages drawn on earlier days are kept with the class. Switch between pages here.');
      await s.pause(1500);
      await s.click(page.getByRole('tab', { name: 'Day 0: build' }));
      await s.pause(1500);
      await page.evaluate(() => { const b = document.querySelector('[data-testid="board"]'); if (b) window.scrollTo({ top: b.getBoundingClientRect().top + window.scrollY - 150, behavior: 'smooth' }); });
      await s.pause(900);
      await s.say('The board: draw a rectangle and write on it');
      await s.click(s.button('Add page'));
      await s.pause(1000);
      const box = await board.boundingBox();
      const pt = (fx, fy) => [Math.round(box.x + box.width * fx), Math.round(box.y + box.height * fy)];
      await s.click(page.locator('label:has([data-testid="toolbar-rectangle"])'));
      await s.drag(...pt(0.12, 0.3), ...pt(0.38, 0.5));
      await page.keyboard.press('Escape');
      await s.click(page.locator('label:has([data-testid="toolbar-text"])'));
      const [tx, ty] = pt(0.14, 0.62);
      await s.glideTo(tx, ty);
      await page.mouse.click(tx, ty);
      await page.keyboard.type('Build pipeline', { delay: 70 * s.k });
      await page.keyboard.press('Escape');
      await s.pause(800);
      s._board = pt;
    });
    await s.scene('The board: Mermaid diagram', 'Drop a Mermaid diagram file on the board and it becomes shapes', async () => {
      const mmd = readFileSync(fixturePath('journeys/flow.mmd'), 'utf8');
      const board = s.tid('board');
      const box = await board.boundingBox();
      const x = Math.round(box.x + box.width * 0.62), y = Math.round(box.y + box.height * 0.4);
      await s.glideTo(x, y);
      await page.evaluate(({ text, x, y }) => {
        const target = document.elementFromPoint(x, y) || document.querySelector('[data-testid="board"]');
        const dt = new DataTransfer(); dt.items.add(new File([text], 'flow.mmd', { type: 'text/plain' }));
        for (const type of ['dragenter', 'dragover', 'drop']) target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true, clientX: x, clientY: y }));
      }, { text: mmd, x, y });
      await s.pause(2500);
    });
    await s.scene('Export the board as PDF', 'Export the board as a notebook-style PDF for the learners', async () => {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), s.click(s.button('Export PDF'))]);
      await dl.path();
      await s.say('The PDF downloads; at wrap-up it is published to the class');
    });
    await s.scene('Wrap up the day', 'At the end of the day: one tap wraps up', async () => {
      await hub.clock(at(1, '12:55'));
      await s.click(s.link('Today'));
      await s.pause(1200);
      await s.click(s.button('Wrap up the day'));
      await s.pause(2500);
      await s.say('It publishes the board PDF, the quick-learn and the cards, closes attendance and drafts the delivery report');
    });
    await s.scene('Delivery report', 'The draft delivery report is ready for the college', async () => {
      await s.click(s.link('Delivery reports'));
      await s.pause(3000);
    });
  },
};
