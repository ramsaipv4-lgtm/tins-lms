// Which feature is shown where. Every row either lists the scenes (video + scene title) that show it on screen, or says why it is
// not shown. The time next to each scene is looked up in the recording's scene list when index.md is written, so it cannot drift;
// a scene that is missing from the recordings is flagged "UNVERIFIED" instead of being trusted.

const V = {
  overview: '01-overview', admin: '02-admin-setup', trainer: '03-trainer-class-day', learner: '04-learner-day', practice: '05-learner-practice',
  coord: '06-coordinator', coach: '07-coach-space', offline: '08-offline-and-files', sub: '09-substitute', assess: '10-assessment-and-appeals',
  tools: '11-classroom-tools', data: '12-data-and-admin', first: '13-first-run-and-catch-up', prep: '14-trainer-prep', corp: '15-corporate-practice',
};
const at = (v, scene) => [V[v], scene];
const no = (reason) => ({ no: reason });

const NO_UI_CORE = 'no screen: the logic exists in the core library and is exercised by the acceptance tests, but the app has no page for it';
const NOT_VISUAL = 'not visual: it is behaviour inside the server or the sync layer, with nothing on screen to record';
const EXTERNAL = 'needs a real external account or server (and the adapters are tested against fakes), so it cannot be shown in a self-contained recording';

/** [ref in SPEC, feature, scenes[] | { no: reason }] */
export const COVERAGE = [
  // ---- SPEC section 4: core features ----
  ['4.2', 'Cards and spaced repetition: review, rating, due count', [at('learner', 'Daily cards'), at('offline', 'Cards offline')]],
  ['4.3', 'Catch-up gate for missed days (pass mark 6 of 8, unlock in order)', [at('first', 'Joined late: gates'), at('first', 'Not yet: 5 of 8'), at('first', 'Retry: 6 of 8')]],
  ['4.4', 'Mastery map', [at('offline', 'Mastery map offline')]],
  ['4.5', 'Rotating attendance code (trainer shows it, learner enters it, roll shows verified)', [at('trainer', 'Attendance with the rotating code'), at('trainer', 'The roll fills in'), at('first', 'Check in with the code')]],
  ['4.5', 'Printed fallback code (present but not verified)', [at('trainer', 'Attendance with the rotating code')]],
  ['4.6', 'One-time pairing codes: the learner side (connect a device, wrong code refused)', [at('first', 'Connect with a pairing code'), at('first', 'The right code')]],
  ['4.6', 'One-time pairing codes: the trainer side (issue a code, list and remove devices)', no('no screen: issuing codes and listing devices is API only (POST /api/pairing, GET /api/devices)')],
  ['4.7', 'Content release in step with the teleprompter', [at('trainer', 'Teleprompter release'), at('learner', 'A section is released live')]],
  ['4.8', 'Teleprompter pacing (ahead or behind plan)', [at('trainer', 'Teleprompter release')]],
  ['4.8', 'Rehearsal: planned versus actual, teach-back or self-check, freshness check', [at('prep', 'Rehearsal'), at('prep', 'Planned versus actual'), at('prep', 'Self-check after rehearsal')]],
  ['4.9', 'Append-only ledger (a corrected score keeps the original)', [at('assess', 'Corrected score, original kept')]],
  ['4.10', 'Shift engine: tickets over time, SLA clocks, acknowledge and resolve, score by rubric row', [at('practice', 'The Shift'), at('practice', 'Shift score')]],
  ['4.11', 'Appeals: open, evidence pack, uphold with a corrected score', [at('assess', 'The learner appeals'), at('assess', 'Trainer: appeals with evidence'), at('assess', 'Uphold with a corrected score')]],
  ['4.11', 'Appeal escalation after 7 days and second reviewer', no('not visual: it is a timed state change (a 7-day wait); the inbox text that explains it is shown in 10-assessment-and-appeals')],
  ['4.12', 'AI policy during graded work (unread confirmed AI suggestions)', [at('assess', 'AI policy: unread suggestions')]],
  ['4.13', 'Conflict merge of offline edits', no(NOT_VISUAL)],
  ['4.14', 'Study groups', no(NO_UI_CORE)],
  ['4.15', 'Estimation poker: hidden votes, reveal, spread asks low and high voters to explain', [at('tools', 'Estimation poker'), at('tools', 'Poker reveal with a spread'), at('practice', 'Estimation poker and retro')]],
  ['4.16', 'Stand-up bot: post, summary with "blocked" highlighted', [at('practice', 'Daily stand-up'), at('tools', 'Stand-up summary')]],
  ['4.17', 'Explain-it-back concept check (offline checklist)', [at('learner', 'Explain it back')]],
  ['4.18', 'Screenshot parsing: read calories and protein, confirm before saving', [at('coach', 'Screenshot import')]],
  ['4.19', 'Exit tickets and the tally', [at('learner', 'Exit ticket'), at('tools', 'Exit tickets: the tally')]],
  ['4.19', 'Auto-FAQ from repeated doubts', no(NO_UI_CORE)],
  ['4.20', 'At-risk digest (levels, reasons, prefilled message)', [at('tools', 'At-risk digest')]],
  ['4.21', 'Item analysis (flags weak questions)', [at('assess', 'Item analysis')]],
  ['4.22', 'Mistake clustering of lab results; one comment reaches a cluster', [at('assess', 'Mistake clusters'), at('assess', 'Learners see the cluster comment')]],
  ['4.23', 'Plan versus actual re-flow (off by default)', no('only the switch is on screen (turned on in 12-data-and-admin); the app has no page that shows the re-flowed plan')],
  ['4.24', 'Export: a learner\'s own data as one archive', [at('data', 'Export my data')]],
  ['4.24', 'Signed class (day) packages: export and import by file', [at('offline', 'File exchange: the trainer\'s package'), at('offline', 'File exchange: the phone imports it'), at('data', 'Signed day package')]],
  ['4.24', 'Whole-hub export and import', no('no screen: GET /api/export and POST /api/import are API only')],
  ['4.25', 'Recovery key and crypto-shredding', no('no screen: server-side operations without a UI')],
  ['4.26', 'Graded timing: hub-signed times, offline attempt flag, clock skew', no('no learner screen for sitting a graded quiz; the timing is stored with the attempt (shown only as part of the grade and appeal screens)')],
  ['4.26', 'Accommodations: request, admin approval, extended Shift limit', [at('practice', 'Request an accommodation'), at('practice', 'Admin approves'), at('practice', 'The Shift')]],
  ['4.27', 'Feature switches (organisation-wide, Google ones off by default)', [at('admin', 'Feature switches'), at('data', 'Feature switches'), at('data', 'Integration buttons appear')]],
  ['4.28', 'Version compatibility (old clients told to update)', no(NOT_VISUAL)],
  ['4.29', 'Package import and the content gate (eight checks, publish blocked on a failure)', [at('admin', 'Upload the course package'), at('admin', 'The content gate'), at('admin', 'Publish and see the schedule')]],
  ['4.29', 'Changed-package check (days and questions that would change)', [at('assess', 'What changes in a new package')]],
  ['4.30', 'Dropping a learner: confirmation lists the actions; switching back restores', [at('data', 'Drop: the confirmation'), at('data', 'Drop: switch back')]],
  ['4.31', 'Retention', no('no screen: a server rule with no settings page')],
  ['4.32', 'Messages for other apps: prefilled WhatsApp links, copy all', [at('trainer', 'Absentees and messages'), at('tools', 'At-risk digest')]],
  ['4.33', 'Certificate ids, QR and public verification', [at('coord', 'Certificates'), at('coord', 'Verify link')]],

  // ---- SPEC section 5: server ----
  ['5.1', 'Health endpoint', [at('data', 'Health check')]],
  ['5.1', 'First-run admin invite and set-up', no('shown differently: the demo hub starts in test mode with its staff already created; the admin set-up screens are in 02-admin-setup')],
  ['5.2', 'Accounts, passkey sign-in and roles', [at('overview', 'The sign-in screen'), at('learner', 'Terms and conditions')]],
  ['5.2', 'Passkey registration at join (virtual authenticator)', [at('learner', 'Terms and conditions')]],
  ['5.3', 'Pairing and devices', [at('first', 'The right code')]],
  ['5.4', 'Attendance routes', [at('first', 'Check in with the code')]],
  ['5.5', 'Content and release (sealed sections, key on release)', [at('learner', 'A section is released live')]],
  ['5.6', 'Sync: phone and hub (offline changes arrive on reconnect)', [at('offline', 'The hub comes back')]],
  ['5.7', 'Grading, appeals and ledgers', [at('assess', 'Corrected score, original kept')]],
  ['5.8', 'Export, import and class packages', [at('data', 'Export my data'), at('data', 'Signed day package')]],
  ['5.9', 'Test mode', no('not a product feature: it is the shortcut these recordings use to sign in (see demos/README.md); never for a live server')],

  // ---- SPEC section 6: journeys ----
  ['AC-80', 'Admin sets up a class', [at('admin', 'Create the program, cohort and class'), at('admin', 'Upload the course package'), at('admin', 'Publish and see the schedule')]],
  ['AC-81', 'Learner joins with a code, T&C, date of birth, setup check', [at('learner', 'Join with a code'), at('learner', 'Terms and conditions'), at('learner', 'Day −1 setup check')]],
  ['AC-82', 'Attendance journey', [at('trainer', 'The roll fills in'), at('first', 'Check in with the code')]],
  ['AC-83', 'Teleprompter release reaches the learner without reload', [at('learner', 'A section is released live'), at('trainer', 'Teleprompter release')]],
  ['AC-84', 'Catch-up', [at('first', 'Not yet: 5 of 8'), at('first', 'Retry: 6 of 8')]],
  ['AC-85', 'Daily cards and the error notebook', [at('learner', 'Daily cards'), at('learner', 'Error notebook'), at('first', 'Error notebook')]],
  ['AC-86', 'Shift', [at('practice', 'The Shift'), at('practice', 'Shift score')]],
  ['AC-87', 'Sprint rituals (stand-up, poker, retro to ticket)', [at('practice', 'Daily stand-up'), at('practice', 'Estimation poker and retro'), at('tools', 'Poker reveal with a spread')]],
  ['AC-88', 'Appeal', [at('assess', 'The learner appeals'), at('assess', 'Uphold with a corrected score'), at('assess', 'Corrected score, original kept')]],
  ['AC-89', 'Wrap-up (one tap)', [at('trainer', 'Wrap up the day')]],
  ['AC-90', 'Messages (absentee WhatsApp links, copy all)', [at('trainer', 'Absentees and messages')]],
  ['AC-91', 'Doubt queue', [at('trainer', 'Doubts'), at('tools', 'Doubt queue')]],
  ['AC-92', 'Exit ticket', [at('learner', 'Exit ticket'), at('tools', 'Exit tickets: the tally')]],
  ['AC-93', 'Explain-it-back', [at('learner', 'Explain it back')]],
  ['AC-94', 'Coach screenshot import', [at('coach', 'Screenshot import')]],
  ['AC-95', 'Phone-only profile (offline, sync on reconnect)', [at('offline', 'The hub goes down'), at('offline', 'Cards offline'), at('offline', 'Diagnostic offline'), at('offline', 'The hub comes back')]],
  ['AC-96', 'File exchange', [at('offline', 'File exchange: the phone imports it'), at('offline', 'Export a submission'), at('offline', 'The trainer imports the submission')]],
  ['AC-97', 'Board (pages, rectangle and text, Mermaid, PDF export)', [at('trainer', 'The board: draw'), at('trainer', 'The board: Mermaid diagram'), at('trainer', 'Export the board as PDF')]],
  ['AC-98', 'Export my data', [at('data', 'Export my data')]],
  ['AC-99', 'Accessibility basics', no('not visual: an automated check of the screens (labels, names, contrast)')],
  ['AC-150', 'Substitute and handover pack', [at('sub', 'The trainer cannot take a day'), at('sub', 'The handover pack'), at('sub', 'Mark as read'), at('sub', 'The report records who taught')]],
  ['AC-151', 'Self-learn mode (AI-delivered day, AI off plays the script as text)', [at('sub', 'No substitute: self-learn mode'), at('sub', 'Self-learn player')]],
  ['AC-152', 'Drop switch', [at('data', 'Drop: the confirmation'), at('data', 'Drop: switch back')]],
  ['AC-153', 'Accommodations', [at('practice', 'Request an accommodation'), at('practice', 'Admin approves'), at('practice', 'The Shift')]],
  ['AC-154', 'Verbal syllabus, confirmation PDF, change log', [at('data', 'Verbal syllabus'), at('data', 'Syllabus change log')]],
  ['AC-155', 'First run (four choices)', [at('first', 'First start: four choices'), at('first', 'Hosted service and phone only')]],
  ['AC-156', 'Coach space (PIN, plan in a few taps, versioned plan, day timeline)', [at('coach', 'Set a PIN'), at('coach', 'A plan with accept defaults'), at('coach', 'My day timeline')]],
  ['AC-157', 'Trainer pack and package library', [at('prep', 'Trainer pack'), at('prep', 'Package library')]],
  ['AC-158', 'Rehearsal', [at('prep', 'Rehearsal'), at('prep', 'Planned versus actual'), at('prep', 'Self-check after rehearsal')]],
  ['AC-159', 'Voice notes (trainer only)', [at('prep', 'Voice notes')]],
  ['AC-160', 'At-risk digest and mistake clusters', [at('tools', 'At-risk digest'), at('assess', 'Mistake clusters')]],
  ['AC-161', 'Peer review with checklist', [at('practice', 'Peer review')]],
  ['AC-161', 'Pair programming with swap timer', [at('tools', 'Pair programming')]],
  ['AC-162', 'Portfolio', [at('coach', 'Portfolio')]],
  ['AC-163', 'Audio quick-learn with speed control', [at('learner', 'Quick-learn audio')]],
  ['AC-164', 'Corporate practice: incident page', [at('practice', 'The Shift')]],
  ['AC-164', 'Corporate practice: prod deploy needs an approved change request', [at('corp', 'Prod needs a change request'), at('corp', 'Trainer approves'), at('corp', 'Deploy to prod')]],
  ['AC-164', 'Corporate practice: tickets need acceptance criteria', [at('corp', 'Tickets need acceptance criteria')]],
  ['AC-164', 'Corporate practice: runbook and ADR templates graded by rubric', [at('corp', 'Runbook template'), at('corp', 'Decision record')]],
  ['AC-164', 'Corporate practice: demo day slot', [at('corp', 'Demo day')]],
  ['AC-164', 'Corporate practice: leaked-key drill', [at('corp', 'Leaked key drill: trainer'), at('corp', 'Leaked key drill: the team responds')]],
  ['AC-165', 'College outputs: attendance sheet, completion report, CO-PO (PDF and CSV)', [at('coord', 'College reports')]],
  ['AC-165', 'College outputs: anonymous weekly feedback (learner form and trainer view), coordinator read-only view', [at('coord', 'Anonymous weekly feedback'), at('coord', 'Batch view'), at('coord', 'Schedule and feedback')]],
  ['AC-165', 'College outputs: certificate PDF, verify page, certificate ids export', [at('coord', 'Certificates'), at('coord', 'Verify link')]],
  ['AC-166', 'Content improvement: item analysis flags', [at('assess', 'Item analysis')]],
  ['AC-166', 'Content improvement: suggested misconceptions (accept, edit, reject)', [at('assess', 'Suggested misconceptions')]],
  ['AC-166', 'Content improvement: changed package shows what changes', [at('assess', 'What changes in a new package')]],
  ['AC-167', 'Robustness: fire-drill wizard', [at('prep', 'Fire drill: start'), at('prep', 'Fire drill: hub off'), at('prep', 'Fire drill: hub back')]],
  ['AC-167', 'Robustness: kiosk mode, data meter, Wi-Fi only downloads', [at('offline', 'Kiosk mode')]],
  ['AC-168', 'Engagement: Heading Strike', [at('tools', 'Heading Strike')]],
  ['AC-168', 'Engagement: team badges and wall, no individual ranking', [at('tools', 'Teams, not rankings')]],
  ['AC-168', 'Engagement: story mode (off by default)', no('only the switch is on screen (listed unchecked in the feature switches); the story presentation itself is not recorded')],
  ['AC-169', 'Calendar sync and Google Forms hidden until switched on', [at('data', 'Feature switches'), at('data', 'Integration buttons appear')]],
  ['AC-170', 'Practice forge first: the exercise screen', [at('practice', 'Practice forge')]],
  ['AC-170', 'Practice forge first: completing the exercise on Forgejo, GitHub pass move', no(EXTERNAL)],
  ['AC-170', 'Linking a GitHub account', [at('data', 'Linking a GitHub account')]],

  // ---- SPEC section 7: integrations ----
  ['AC-110', 'GitHub App adapter (invite, team, template repo, branch protection)', no(EXTERNAL)],
  ['AC-111', 'AI persona bots on GitHub', no(EXTERNAL)],
  ['AC-112', 'Forgejo adapter', no(EXTERNAL)],
  ['AC-113', 'Backup targets (S3, Drive, USB)', no('no screen: backups run on the server and have no settings page; ' + EXTERNAL)],
  ['AC-114', 'Google: Meet, Calendar, Forms', no('the switches and the trainer buttons are shown (12-data-and-admin); using them needs a Google account')],
  ['AC-115', 'Secret scan on push (practice forge)', no(EXTERNAL + '; the "Secret scan" switch is listed in the feature switches')],
  ['AC-116', 'AI over MCP', no('no screen: an MCP endpoint for AI tools, with no page in the app')],
  ['AC-117', 'Health digest and morning checklist', no('no screen of its own; the first-day setup check is shown in 04-learner-day')],
  ['AC-118', 'Native shell: add study blocks to the clock app (Android)', no('manual: needs an Android device or emulator')],
  ['AC-119', 'HTTPS side-grade helper (DuckDNS)', no('manual: needs a DuckDNS account and internet')],
];

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Turns COVERAGE into table rows using the scene times in the recorded videos. */
export function coverageRows(metas) {
  const byName = new Map(metas.map((m) => [m.name, m]));
  const rows = []; let shown = 0; let notShown = 0; const unverified = [];
  for (const [ref, feature, where] of COVERAGE) {
    if (where.no) { notShown++; rows.push({ ref, feature, text: `not shown: ${where.no}`, shown: false }); continue; }
    const parts = []; let ok = 0;
    for (const [video, title] of where) {
      const m = byName.get(video);
      const sc = m?.scenes.find((x) => x.title === title);
      if (!sc || sc.failed) { parts.push(`${video} "${title}" (UNVERIFIED: ${!m ? 'video not recorded' : !sc ? 'scene not found' : 'scene failed'})`); unverified.push(`${ref} ${feature}: ${video} / ${title}`); }
      else { parts.push(`${video}@${mmss(sc.at)}`); ok++; }
    }
    if (ok) shown++; else notShown++;
    rows.push({ ref, feature, text: parts.join('<br>'), shown: ok > 0 });
  }
  return { rows, shown, notShown, unverified, total: COVERAGE.length };
}
