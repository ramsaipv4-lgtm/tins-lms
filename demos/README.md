# Product demo videos

`node demos/run.mjs` starts a throw-away Coach LMS hub, fills it with invented people and a few days of plausible activity,
and records walkthrough videos of the real app with Playwright. Each video is converted to H.264 `.mp4` with a title card.
Nothing on screen is mocked up: it is the app, driven the way a person would drive it, with a visible cursor and a caption bar.

```bash
node demos/run.mjs                              # every video (about 20 minutes)
node demos/run.mjs --only 04                    # one video, by number or name (04, 04-learner-day, "learner")
node demos/run.mjs --only 08 --headed           # show the browser window while it records
node demos/run.mjs --pace slow                  # pauses and typing twice as long (for screen recording, see below)
node demos/run.mjs --only 12 --pace fast        # developer mode: runs the scene very quickly, no video, reports failures
```

Output goes to `demos/out/` (not committed; `.gitignore` lists it):

| File | What |
|---|---|
| `<name>.mp4` | the finished video: title card, then the walkthrough (H.264, yuv420p, 25 fps, faststart) |
| `<name>.webm` | the raw Playwright recording |
| `<name>.json` | scene list with times, skipped scenes and failures |
| `index.md` | table of videos (file, persona, device, duration, what it shows) and the coverage table (SPEC feature to video and time, or why it is not shown) |

`index.md` is rebuilt from every `.json` found, so running one video with `--only` keeps the rows of the others.
The exit code is 1 if any scene failed.

## Requirements

- **Node 22.18 or newer** and the repository's dependencies (`npm ci`); the web app is built automatically if `packages/web/dist` is missing.
- **Chromium** for Playwright. The runner uses `/opt/pw-browsers/chromium` when it exists, otherwise Playwright's own download
  (`npx playwright install chromium`); set `PLAYWRIGHT_CHROMIUM=/path/to/chrome` to choose another.
- **ffmpeg** with libx264 at `/usr/bin/ffmpeg` (and `ffprobe` next to it); set `FFMPEG` and `FFPROBE` for other locations.
- About 2 GB of free RAM. One browser and one hub run at a time; the hub is stopped and its temporary data folder deleted after every video.

## What it does

1. Starts the hub (`packages/server/src/main.ts`) with `LMS_TEST_MODE=1`, `LMS_TLS=off`, a temporary `LMS_DATA_DIR` and a free port.
2. Seeds the base data from `demos/seed/fixtures/` (organisation, staff, learners, class `c1`, the demo course package) through the
   test-mode seed route. The seed files are copies kept in this folder, so the demos need nothing from the tests repository.
3. Adds activity through the app's own HTTP API, acting as the invented people (`demos/lib/populate.mjs`): attendance, cards,
   practice, stand-ups, poker, doubts, exit tickets, an appeal, graded work. The clock is moved with the test-mode clock so each
   video happens on the class day it is about.
4. Opens the app in Chromium (desktop 1280x720, or a 360x740 phone at device scale factor 2, recorded at 720x1480) and plays a scene
   script from `demos/scenes/`, with an injected cursor and click pulse, mouse travel, typing delays, a caption bar and pauses.
5. Converts the recording to `.mp4` with a 2 second title card, checks the result decodes cleanly, and writes `index.md`.

## WARNING: test mode is for demos only

`LMS_TEST_MODE=1` switches on `/__test/*` routes that let anyone sign in as any person, load seed data and move the clock.
**The demo runner uses it on a throw-away hub on `127.0.0.1` and nowhere else. Never set `LMS_TEST_MODE` on a server that holds
real data or is reachable by other people.** The recordings say so on screen: the sign-in scenes use a demo shortcut because a
passkey prompt cannot be driven unattended (the join scene does create a real passkey, with a virtual authenticator).

All people, codes and tokens in the demos are invented. Never put a real credential in a scene or a seed file.

## The videos

| # | Video | Device | About |
|---|---|---|---|
| 01 | `01-overview` | desktop | sign-in and a tour of the four spaces |
| 02 | `02-admin-setup` | desktop | create a class, upload the package, content gate, publish |
| 03 | `03-trainer-class-day` | desktop | attendance, teleprompter, doubts, board, wrap-up |
| 04 | `04-learner-day` | phone | join, today's content, cards, diagnostic, explain it back, exit ticket |
| 05 | `05-learner-practice` | desktop | stand-up, poker, peer review, accommodations, the Shift |
| 06 | `06-coordinator` | desktop | batch view, college reports, certificates |
| 07 | `07-coach-space` | phone | PIN, plan, timeline, screenshot import, portfolio |
| 08 | `08-offline-and-files` | phone | offline use, sync, file exchange, kiosk mode |
| 09 | `09-substitute` | desktop | handover pack, substitute runs the day, self-learn mode |
| 10 | `10-assessment-and-appeals` | desktop | grades, appeals, AI policy, item analysis, clusters |
| 11 | `11-classroom-tools` | desktop | exit tickets, doubts, stand-up, poker, digest, pair programming |
| 12 | `12-data-and-admin` | desktop | export, signed package, drop a learner, syllabus, switches |
| 13 | `13-first-run-and-catch-up` | phone | first start, pairing, check-in, catch-up gates |
| 14 | `14-trainer-prep` | desktop | trainer pack, rehearsal, voice notes, fire drill |
| 15 | `15-corporate-practice` | desktop | tickets, change requests, templates, demo day, key drill |

## Adding or changing a video

A scene file in `demos/scenes/` named `NN-name.mjs` exports `{ name, persona, shows, title, subtitle, profile, seeds, prepare(hub), run(stage, hub) }`.
`run` uses the stage helpers in `demos/lib/stage.mjs` (`s.click`, `s.type`, `s.go('Nav name')`, `s.say(caption)`, `s.scene(title, caption, fn)`, ...).
A scene that throws is recorded as failed (with a screenshot in `out/.raw/`) and the video continues; `s.skip(title, reason)` lists
something the app has no screen for, so nothing is faked. Add the feature to `demos/lib/coverage.mjs` so `index.md` shows where it appears.
Use `--pace fast` to try a scene in seconds.

## Optional: polish with Recordly

The built-in videos are complete on their own. For a more polished desktop video (smooth zoom into the part of the screen being
discussed, a background, a webcam bubble), record the run with Recordly, a GUI
Electron desktop screen recorder (AGPL-licensed; get it from the project's own releases page, it is not part of this repository):

1. On a desktop with a screen, run `node demos/run.mjs --only 03 --headed --pace slow`. The browser opens at the staff-screen size
   and the pauses are twice as long, which leaves room for zooms and edits.
2. Start a Recordly capture of the browser window just before the run starts and stop it when the terminal prints the `wrote ...` line.
3. Add zoom and cursor emphasis in Recordly and export. The caption bar and cursor are part of the page, so they appear in your capture too.

Recordly needs a real display, so it cannot be used in a headless container; the Playwright videos are what the runner produces.
