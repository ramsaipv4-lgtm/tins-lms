# Coach LMS (tins-lms)

A learning system for a trainer, their learners and a college coordinator: attendance, a teleprompter
for live classes, sealed day content released on schedule, flash cards, catch-up, Shift practice,
appeals, accommodations, a whiteboard, a personal Coach space, file exchange for phones with no
network, and exports. It runs on a laptop in a classroom (the **hub**), on an internet server, or on
phones alone after the first load.

- **What it must do:** [`SPEC.md`](SPEC.md) (the contract) · build status: [`CONTINUE.md`](CONTINUE.md)
- **How it was built, mistakes included:** [`course/`](course/README.md) (a 42-step rebuild course),
  [`docs/build-journal/`](docs/build-journal/) (journals, [`integration.md`](docs/build-journal/integration.md), [`AUDIT.md`](docs/build-journal/AUDIT.md))
- **Product demo videos:** [`demos/README.md`](demos/README.md) (`node demos/run.mjs`)
- **Acceptance tests** (separate repo, 134 automated rows): https://github.com/ramsaipv4-lgtm/tins-lms-tests

---

## 1. Requirements

| Need | Version | Notes |
|---|---|---|
| Node.js | **22.18 or newer** (built and tested on 22.22) | the server runs TypeScript files directly (type stripping); no compile step |
| npm | the one that ships with Node | dependencies are pinned exactly (SPEC D-pins) |
| Chromium for Playwright | only for the browser tests | `npx playwright install chromium` |
| Disk / RAM | ~1 GB / 2 GB for running; 16 GB recommended for the full test suite | the full suite starts browsers and servers one file at a time |

No database server is needed: data is stored by PouchDB in the data folder; phones sync with the hub
over the CouchDB replication protocol at `/db`.

## 2. Run it on your computer (5 minutes)

```bash
git clone https://github.com/ramsaipv4-lgtm/tins-lms.git
cd tins-lms
npm ci
npm run build -w packages/web          # builds the web app into packages/web/dist
LMS_TLS=off npm start                  # http://localhost:8080
```

The first start prints two lines:

```text
ADMIN_INVITE ADM-XXXX-XXXX     ← shown once; copy it
LISTENING 8080
```

Open `http://localhost:8080/join/ADM-XXXX-XXXX` (with your code), accept the terms and create the
admin account. From the admin space you create the program, cohort and class, upload a content
package, and get join codes for trainers and learners. `GET /api/health` answers
`{"ok":true,"profile":"hub",…}`.

Everything is kept in the data folder (default `.lms-data/` in the repo). Delete it to start over.

### Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | port to listen on |
| `LMS_DATA_DIR` | `<repo>/.lms-data` | all data: databases, keys, `tls/`, `tessdata/` |
| `LMS_PROFILE` | `hub` | `hub` (classroom server; also creates the pairing/package signing key), `cloud`, `hybrid`, `phone` (SPEC D-20) |
| `LMS_TLS` | `on` | `off` = plain HTTP. With `on`, HTTPS is used **if** `<data>/tls/cert.pem` and `key.pem` exist, else plain HTTP with a log line |
| `LMS_ORIGIN`, `LMS_RP_ID` | taken from the request | the public URL and host name for passkeys; set them behind a reverse proxy |
| `LMS_FORGEJO_URL`, `LMS_FORGEJO_TOKEN`, `LMS_FORGEJO_ORG` | unset | practice forge for learners without GitHub |
| `LMS_GOOGLE_CLIENT_ID`, `LMS_GOOGLE_ACCESS_TOKEN`, `LMS_GOOGLE_CALENDAR_ID` (+ `_URL` overrides) | unset | Google sign-in, Calendar sync, Forms export; all off until the admin also turns their switches on |
| `LMS_TESSDATA_DIR` | unset | folder with `eng.traineddata(.gz)` for screenshot OCR; by default the pinned `@tesseract.js-data/eng` package is used |
| `LMS_TEST_MODE` | unset | `1` enables the `/__test/*` routes the test suite uses. **Never set this on a live server.** |

Keep tokens in the environment of the service (or a file only that user can read), never in the repo.

## 3. Test it

### Quick checks (minutes)

```bash
node --test packages/*/test/*.test.mjs        # builder unit tests (~330)
node scripts/navcheck.mjs                     # nav-name collision check (journeys find screens by name)
```

To see how one acceptance row is doing without running the whole gate, use `scripts/rowcheck.mjs` (SPEC D-66). It
finds the row's check file in SPEC.md, runs only the tests whose names start with that AC id (with
`--part <gameId or shared>`, only that part of a cross-game row), prints each as ok or not ok with the gate's
failure detail (no stack lines into `acceptance/`), and counts passed and failed per id. A filter that matches no test
is a failure (`no tests matched AC-207 nosuchgame`, exit 1); an unknown id, a manual row or a check file outside
`acceptance/` is exit 2. Run it under the shared lock, because it is as heavy as the tests it runs (a journey row
builds the web app first unless you pass `--no-build`). The full TAP is left in `.tins/state-rowcheck-last.tap`.
It is feedback only: `kit gate` is still the proof.

```bash
flock ~/tins-orch/gate.lock node scripts/rowcheck.mjs AC-217 AC-218          # whole rows
flock ~/tins-orch/gate.lock node scripts/rowcheck.mjs AC-207 --part syntax-drop   # one game's part of a cross-game row
```

### Acceptance suite (the contract)

```bash
# once: clone the tests next to this repo (or point LMS_ACCEPTANCE_DIR at its acceptance/ folder)
git clone https://github.com/ramsaipv4-lgtm/tins-lms-tests.git ../tins-lms-tests
npx playwright install chromium
node scripts/setup.mjs                         # links ./acceptance (and nested node_modules in worktrees)
npm run build -w packages/web

node --test --test-concurrency=1 acceptance/journeys/attendance.journey.mjs   # one journey, desktop + phone
npm run smoke                                                                 # smoke set
node .tins/kit/bin/kit.mjs gate                                               # everything claimed green (~30–40 min)
```

The gate writes its full output to `.tins/state-gate-last.tap`. Journeys run each screen on a desktop
profile and on a throttled 360×740 phone profile; screenshots and videos land in
`acceptance/.artifacts/`. Run one heavy suite at a time on a small machine.

### Load test (200 learners)

```bash
LMS_TLS=off npm start &                                                   # a hub to test against
node packages/cli/src/main.ts loadtest --learners 200 --target http://localhost:8080
```

It signs 200 simulated learners in, marks attendance, answers a live quiz and syncs; it passes when
95% of requests finish within 1 s and no write is lost (SPEC AC-103). Point it only at a server you run.

## Product demo videos

`node demos/run.mjs` records walkthrough videos of the real app (admin, trainer, learner phone, coordinator, Coach space, offline use and
more) against a throw-away hub filled with invented people, and writes `demos/out/*.mp4` plus an `index.md` that says which SPEC feature
appears in which video and when. It needs ffmpeg and Chromium, and it runs the hub in test mode, which is for demos only and must never
be used on a live server. See [`demos/README.md`](demos/README.md) for options, requirements and an optional Recordly workflow.

## 4. Use it live

Two things decide the setup: **phones need HTTPS** (browsers allow the offline service worker,
installing the app and passkeys only on `https://` or `localhost`), and **where the records live**.

### A. Classroom, no cloud (the hub)

A laptop or mini PC on the classroom Wi-Fi (or the trainer's phone hotspot) runs the hub; phones join
over the LAN and keep working when the network drops (content is sealed per section and released on
schedule; cards, diagnostic and mastery work offline; changes sync on reconnect).

1. Give the hub a fixed LAN address (router DHCP reservation), e.g. `192.168.1.20`.
2. HTTPS on the LAN, pick one:
   - **Own certificate authority (no internet needed):** create a local CA and a certificate for the
     hub's address with a tool such as `mkcert`, put them in `<data>/tls/cert.pem` and `key.pem`, and
     install the CA's root certificate on each phone once (Android: Settings → Security → Install a
     certificate). Works fully offline; the install step is per phone.
   - **A real certificate for a free domain name** (see C below) whose DNS points at the LAN address:
     nothing to install on phones, but renewing needs internet every ~60 days.
3. Run the server as a service so it starts with the machine (Linux `systemd` example):

   ```ini
   # /etc/systemd/system/coach-lms.service
   [Unit]
   Description=Coach LMS hub
   After=network-online.target
   [Service]
   WorkingDirectory=/opt/tins-lms
   Environment=PORT=443 LMS_PROFILE=hub LMS_DATA_DIR=/var/lib/coach-lms
   ExecStart=/usr/bin/node packages/server/src/main.ts
   Restart=on-failure
   User=coach
   AmbientCapabilities=CAP_NET_BIND_SERVICE
   [Install]
   WantedBy=multi-user.target
   ```

   On Windows or macOS, a terminal window with `npm start` is enough for a class day.
4. Learners open `https://<hub address>/join/<code>` (the join link the admin hands out), accept the
   terms, and add the app to the home screen. iPhones use the installed web app (no app-store app).
5. Phones with no network at all: use **File exchange** (trainer downloads a day package, learners
   import it; learners export a submission file the trainer imports).
6. **Backups:** the data folder is the whole state. Copy it daily (the hub has an export and a backup
   adapter; a USB disk or a second machine is enough). Test a restore once before the course starts.

### B. Phone only

After one visit to a running hub (or a hosted copy of the web app), a learner's phone keeps the app
and released content; it syncs when it next reaches the hub. There is no server to run in this mode,
but someone has to publish content once.

### C. On the internet (cloud or hybrid)

Use this when learners must reach the system from home, or the college wants records off the
classroom laptop. **Hybrid** = small records on the internet server, heavy content on the classroom hub.

Recommended shape (simple, cheap, nothing paid required):

```text
internet ──► Caddy (HTTPS, automatic Let's Encrypt certificates) ──► node packages/server/src/main.ts (PORT=8080, LMS_TLS=off)
                                                                       data: /var/lib/coach-lms (backed up nightly)
```

1. A small Linux VM: **2 vCPU / 2–4 GB RAM / 20 GB disk** is plenty for one batch of ~200 learners
   (the load test above is the check). Options (as of October 2026, check current terms before relying
   on them): Oracle Cloud's Always Free tier offers ARM VMs; Google Cloud and AWS have small free
   tiers with limits; any ~4 USD/month VPS works too. A home machine plus a tunnel (e.g. Cloudflare
   Tunnel, free as of October 2026) avoids a VM but depends on your home connection.
2. A name: a free DuckDNS subdomain (e.g. `mycoach.duckdns.org`) pointing at the VM's public IP, or
   your college's domain.
3. Install Node 22, clone, `npm ci`, `npm run build -w packages/web`, and the `systemd` service from A
   with `PORT=8080 LMS_PROFILE=cloud LMS_TLS=off LMS_ORIGIN=https://mycoach.duckdns.org
   LMS_RP_ID=mycoach.duckdns.org`.
4. Caddy in front (it obtains and renews the certificate by itself):

   ```text
   # /etc/caddy/Caddyfile
   mycoach.duckdns.org {
       reverse_proxy 127.0.0.1:8080
   }
   ```

5. Firewall: open 80 and 443 only. Never set `LMS_TEST_MODE` here.
6. Back up `/var/lib/coach-lms` every night to somewhere else (another disk, the college drive, an
   object-storage bucket) and keep 14 days.
7. Before the first class: run the load test against the server from another machine, sign in on a
   phone over mobile data, install the app, turn on airplane mode and check the day's content still opens.

Not in v1, so plan for it: the SPEC's container definition and `acme.sh` renewal helper for DuckDNS
(AC-119) were not built — Caddy above replaces them; the Android native shell (Capacitor, AC-118
clock-app alarms) needs an Android build and a phone to verify.

## 5. Repository map

| Path | What |
|---|---|
| `packages/core` | pure logic (cards, attendance, catch-up, grading, shift engine, …), no I/O |
| `packages/server` | Hono API + static web + PouchDB sync at `/db` |
| `packages/web` | React app (PWA, service worker `src/sw.ts`), feature groups in `src/features/<group>` |
| `packages/board` | whiteboard (Excalidraw 0.18.1 wrapper, PDF export) |
| `packages/adapters` | GitHub, Forgejo, Google, backup, health |
| `packages/cli` | `lms loadtest` |
| `scripts/` | `gate.mjs` (project gate), `setup.mjs`, `navcheck.mjs` |
| `course/` | the rebuild course (generated from `course/manifest.json`) |
| `.tins/kit` | tins-kit: sessions, gate, task worktrees ([how tasks run](CONTINUE.md#how-a-task-runs-orchestrator)) |

## 6. Known issues (v1)

- The stand-up bot's "blocked" detection is a plain substring match ("I am not stuck" counts as blocked).
- AC-118 (Android alarms) and AC-119 (DuckDNS renewal helper) are manual and unverified; see above.
- The full acceptance suite takes 30–40 minutes and needs a machine with ~16 GB RAM.
