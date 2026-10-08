# Coach LMS — SPEC v2-G (learning games)

The games add-on for Coach LMS. Same rules as [`SPEC.md`](SPEC.md): `D-n` rows are decisions, `AC-n`
rows are acceptance checks naming a test in the acceptance suite (`acceptance/games/…`), and where
this file and SPEC.md disagree on a game, this file wins. Everything in SPEC.md §8 (cross-cutting
rules) still holds: offline-first, no individual leaderboards (AC-168), test clock, `en.json`
strings, accessible names.

Eight games share one engine, one code interpreter and one content-pack format. **A new subject or
new levels are a new pack (data), not new code.** A new kind of preview or machine is a small
plug-in (one file implementing one interface).

| Id | Game | Teaches | Kind |
|---|---|---|---|
| `syntax-drop` | Syntax Drop | what each piece of syntax does (HTML/CSS, charts, Python output, regex, patterns) | 2D, keyboard or tap |
| `maze-coder` | Maze Coder | loops, conditionals, functions, pattern programming, search | 3D diorama, write code |
| `breakout` | Breakout | data structures and algorithms, story + timed escapes | 3D third person, write code |
| `raid` | Seal the Beast | any topic, as a whole class in teams | 2D projector + phones, multiplayer |
| `sniper` | Snippet Sniper | predicting output | 2.5D, binoculars + shots |
| `whack-a-bug` | Whack-a-Bug | finding the line that causes a wrong result | 2D |
| `aftershock` | Aftershock | ordering and indenting lines (Parsons problems) | 2D |
| `garage` | Complexity Garage | time and space complexity | 3D race, choose parts or write code |

---

## G1. Decisions

| ID | Decision | Status |
|---|---|---|
| D-G1 | **Light by default.** 2D games draw on one `<canvas>` with Canvas 2D. 3D games use **three 0.186.1** (core only, named imports so unused parts are tree-shaken). No physics engine (movement is grid or axis-aligned-box collision), no game framework. | locked |
| D-G2 | **No downloaded art or sound.** Models are built in code from boxes (block style, like Minecraft/Roblox) and merged per object; textures are drawn on small canvases (≤ 256 px, one atlas per game); sounds are synthesized with WebAudio. The only files a game loads are its code chunk and its pack JSON. | locked |
| D-G3 | **One code language first: "Snek", a Python subset** interpreted by our own small interpreter in `packages/games/src/lang` (pure TypeScript, no dependencies, runs in the browser and in Node). Chosen over Pyodide (≈10 MB, slow start on weak CPUs) and Skulpt (unmaintained since 2022) because the games need stepping (animate each move), deterministic operation and memory counts (fair on any CPU), hard limits and friendly errors. A Java-subset front end on the same evaluator is a later decision. | locked |
| D-G4 | **Fair on any CPU.** Nothing a learner is scored on depends on wall-clock speed of their device: complexity is measured in Snek operations and memory cells; timers use the game clock (pauses when the tab is hidden; the test clock in test mode). | locked |
| D-G5 | **Packs are JSON** files inside the course package at `games/<gameId>/<packId>.json`, validated against `packages/games/schema/<gameId>.schema.json`. The package content gate (SPEC §4.29) runs the pack check on import. Packs are released with the day they belong to (`day` field), like other content. | locked |
| D-G6 | **Results stay in the LMS.** Each finished round writes one `gameResult` document; each mistake becomes a card tagged with its concept and feeds the mastery map. Scores are shown to the learner; anything other people see is team-level only (AC-168). | locked |
| D-G7 | **Multiplayer only through the hub.** `raid` (and optional garage challenges) use the existing sync (`/db`) for votes and the hub as the authority that resolves turns. No new server, no WebSocket requirement. | locked |
| D-G8 | Each game has a feature switch (SPEC §4.27), default **on**: `game.syntaxDrop`, `game.mazeCoder`, `game.breakout`, `game.raid`, `game.sniper`, `game.whackABug`, `game.aftershock`, `game.garage`, plus `games` (the whole arcade). | locked |

## G2. Performance budgets

| ID | Budget | Check |
|---|---|---|
| AC-200 | **Bundle:** gzip sizes in `packages/web/dist`: shared game engine chunk ≤ 60 KB; Snek chunk ≤ 40 KB; each 2D game chunk ≤ 60 KB; the three.js chunk ≤ 180 KB; each 3D game chunk ≤ 90 KB (excluding three). No game chunk (and not three) is requested before the learner opens the arcade (a service worker may precache in the background). | `acceptance/games/budgets.test.mjs` |
| AC-201 | **2D frame rate:** on the low-end phone profile (4× CPU slowdown) each 2D game, played by its test driver for 20 s at the hardest level of its sample pack, reports p50 frame time ≤ 20 ms and p95 ≤ 34 ms from `__game.stats()` | `acceptance/games/perf2d.journey.mjs` |
| AC-202 | **3D scene cost** (headless GPUs are software, so frame rate is not measured): at every checkpoint of each 3D game's sample pack, `__game.stats()` reports ≤ 120 draw calls, ≤ 150 000 triangles and ≤ 4 textures; the quality tier drops to `low` when the measured frame time stays above 33 ms for 2 s, and `low` uses a pixel ratio ≤ 0.75 and no shadow maps | `acceptance/games/perf3d.journey.mjs` |
| AC-203 | **Start and memory:** from opening a game to first playable frame ≤ 3 s on the phone profile for 2D games and ≤ 5 s on desktop for 3D games; JS heap after 60 s of play ≤ 150 MB; leaving a game releases its WebGL context and stops its loop (no animation frames after leaving) | `acceptance/games/lifecycle.journey.mjs` |

Engine rules that make these hold (builders' guidance, not separately tested): fixed-step update
(60 Hz) with interpolated rendering; render only when something moved; pause on `visibilitychange`;
pooled objects (no allocation in the frame loop); instanced or merged meshes; one directional +
one hemisphere light; fog instead of far geometry; shadows only on `high`.

## G3. The engine (`packages/games/src/engine`)

```ts
interface GameModule {
  id: string;                                   // e.g. 'syntax-drop'
  mount(el: HTMLElement, ctx: GameContext): GameInstance;
}
interface GameContext {
  pack: Pack; level: string; seed: number;      // seeded randomness (SPEC §4.1)
  clock: GameClock;                             // game time; test clock in test mode
  input: Input;                                 // keyboard, pointer/touch, gamepad, and DOM action buttons
  audio: Sfx; quality: Quality; strings: (key: string) => string;
  finish(result: RoundResult): void;            // writes gameResult + cards (D-G6)
}
interface GameInstance { pause(): void; resume(): void; destroy(): void; act(action: string, arg?: unknown): void; state(): unknown; }
```

- **Arcade** at `/learn/games` (nav name "Games"): one tile per switched-on game with the packs
  released to the learner, last score and stars (own only). Trainers see `/teach/games` with the
  class's concept miss map and the raid controls.
- **Shared screens** every game uses: title + how to play, pause menu (resume, restart, quit,
  lesson cards, sound, quality), lesson card overlay (between stages), results (score, stars,
  each mistake with a one-line "what it does" and "added to your cards").
- **Every action has a keyboard key and an on-screen button** (`data-testid="act-<action>"`);
  the games are fully playable without a pointer and without fine motor control (an "assist" option
  slows the clock to half speed and is recorded on the result, never punished).
- **Test hooks:** when the server runs with `LMS_TEST_MODE=1` it injects
  `<meta name="lms-test-mode" content="1">`; only then games expose `window.__game` =
  `{ id, state(), act(action, arg), advance(ms), stats() }`. `advance` moves the game clock;
  `stats()` returns `{ fps50, frameP50, frameP95, drawCalls, triangles, textures, heapMB, tier }`.

| ID | Behaviour | Check |
|---|---|---|
| AC-204 | The arcade lists only switched-on games that have a released pack; switching `games` off removes the nav entry and the routes answer "not available"; each tile opens its game and quitting returns to the arcade | `acceptance/games/arcade.journey.mjs` |
| AC-205 | Finishing a round writes one `gameResult` `{ personId, classId, gameId, packId, levelId, score, stars, mistakes:[{ itemId, concept }], assist, durationMs, at }`; each mistake adds a card with that concept and the error notebook lists it; the mastery map moves for the concepts played | `acceptance/games/results.journey.mjs` |
| AC-206 | Nothing in the arcade or any game shows another learner's individual score; the celebration wall shows team totals only | `acceptance/games/privacy.journey.mjs` |
| AC-207 | Every game can be finished with keyboard only and with on-screen buttons only; pause stops the game clock; assist mode halves speed and sets `assist: true` | `acceptance/games/controls.journey.mjs` |

## G4. Snek — the Python-subset interpreter (`packages/games/src/lang`)

```ts
compile(source: string): Program | SnekError           // syntax errors with line, column and a plain message
run(p: Program, opts: { input?: unknown; globals?: Record<string, unknown>; maxOps?: number; maxDepth?: number; maxCells?: number }): RunResult
step(p: Program, opts): Generator<StepEvent, RunResult>  // one event per statement (line), and per host call
callFunction(p, name, args, opts): RunResult            // used by tests: call the learner's function
// RunResult = { ok, value?, stdout, error?, ops, peakCells, line? }
```

**Language:** `int` (arbitrary size not required; 53-bit safe range with an error beyond),
`float`, `bool`, `None`, `str` (indexing, slicing, `+`, `*`, f-strings, `len`, `upper`, `lower`,
`split`, `join`, `strip`, `replace`, `find`, `startswith`, `endswith`, `isdigit`, `isalpha`),
`list`, `tuple`, `dict`, `set`, slicing, `in`, comparisons and chained comparisons, `and/or/not`,
`if/elif/else`, `while`, `for … in`, `range`, `break`, `continue`, `pass`, `def` with defaults,
`return`, recursion, `lambda`, list/dict/set comprehensions, `class` with `__init__`, attributes
and methods (enough for nodes of lists and trees), `try/except` (one level), `print` (with `sep`,
`end`), `input()` from `opts.input`, builtins `len abs min max sum sorted reversed enumerate zip
map filter any all int float str bool list dict set tuple ord chr round isinstance`, and modules
`math` (floor, ceil, sqrt, inf), `collections.deque`, `heapq` (heappush, heappop, heapify).

**Counting (D-G4):** every evaluated expression node and statement costs 1 op; built-in calls cost
their documented complexity (`sorted` n·log2 n, `in` on list n, on set/dict 1, slicing k, …);
`peakCells` is the largest number of live list/dict/set/str elements at any point.

| ID | Behaviour | Check |
|---|---|---|
| AC-208 | The 120 programs in the fixture corpus give exactly their expected stdout/value (lists, dicts, classes, recursion, comprehensions, deque, heapq, f-strings, slicing) | `acceptance/games/snek.test.mjs` |
| AC-209 | Errors are friendly and located: a syntax error, a `NameError`, an `IndexError`, wrong indentation and a type mismatch each report the line and a one-sentence plain message from the fixture list | `acceptance/games/snek-errors.test.mjs` |
| AC-210 | Limits: an infinite loop stops at `maxOps` with "your code ran too long (more than N steps)"; deep recursion stops at `maxDepth`; building a huge list stops at `maxCells`; none hang or crash the page | `acceptance/games/snek-limits.test.mjs` |
| AC-211 | Counting is deterministic: the same program and input give the same `ops` and `peakCells` on every run; for the fixture sorts, `ops` for n = 1000 vs n = 100 grows by ≥ 80× for bubble sort and ≤ 15× for merge sort | `acceptance/games/snek-count.test.mjs` |
| AC-212 | `step` yields one event per executed line in order, with variable snapshots, and host functions (e.g. `move()`) yield an event the game can animate before continuing | `acceptance/games/snek-step.test.mjs` |
| AC-213 | The interpreter has no access to the page or Node: `open`, `import os`, `__import__`, `eval`, `exec`, attribute access to `__class__`/`__globals__` are refused with a plain message | `acceptance/games/snek-sandbox.test.mjs` |

## G5. Packs

Common fields for every pack:

```json
{ "game": "syntax-drop", "id": "html-headings", "title": "Headings and text sizes",
  "day": 2, "concepts": ["html.headings", "css.font-size"], "language": "en",
  "levels": [ { "id": "1", "title": "…", "lesson": [ { "concept": "html.headings", "text": "…" } ], "…": "game-specific" } ] }
```

- `concepts` are the tags used for cards and the mastery map.
- `lesson` cards are shown between stages; each is ≤ 280 characters plus an optional code sample.
- Every code sample, answer and test in a pack is checked by the pack check (it runs Snek where a
  pack says `"lang": "snek"`).
- CLI: `node packages/cli/src/main.ts games check <dir-or-file>` prints one line per problem and
  exits 1 on any; `games new <gameId> <packId>` writes a commented starter pack.
- Sample packs (in `packages/games/packs/`, also used by the tests) per game are listed in G6.

| ID | Behaviour | Check |
|---|---|---|
| AC-214 | `games check` passes every sample pack and fails each broken fixture pack with the expected message (missing field, unknown concept format, a snek answer that does not pass its tests, a syntax-drop slot with no correct piece, a maze with no path to the exit, a level id repeated) | `acceptance/games/packcheck.test.mjs` |
| AC-215 | Importing a course package with a broken game pack fails the content gate with the pack check's message; a valid pack is released on its `day` and appears in the arcade only from then | `acceptance/games/pack-release.journey.mjs` |
| AC-216 | `games new <gameId> x` writes a pack that passes `games check` for every game id | `acceptance/games/packnew.test.mjs` |

## G6. The games

Each game below lists its rules, its level fields, its sample packs, and its acceptance row(s).

### G6.1 Syntax Drop (`syntax-drop`)

**Screen:** left half is the game, right half is the live preview.

- The left half shows the level's code template in large type as the background, with empty
  **slots** (`{{1}}`, `{{2}}` …). **Pieces** fall from the top: each is a piece of syntax drawn at
  a size that matches what it means where that helps (`<h1>` large, `<h2>` medium, `<small>`
  tiny; `font-size: 48px` large…).
- Two modes per level:
  - **Fill:** move the falling piece left/right (arrows / A–D / drag) and drop it (Down / tap) into
    a slot. Right piece in the right slot locks in; a wrong piece is shown in the preview for 1.5 s
    (so the learner sees what it would have done) and then breaks off.
  - **Strike:** each piece kind has a key (shown on the piece and on a key strip at the bottom,
    e.g. `1` = h1, `2` = h2, `3` = small); press it before the piece reaches the line. Decoys
    (`<h7>`, `colour:`) must be let through; striking a decoy costs a life.
- The **preview** re-renders on every change with the level's renderer:
  - `html` (sandboxed iframe, `sandbox=""`, no scripts),
  - `chart` (a built-in SVG renderer for a matplotlib/seaborn subset: `plt.bar/plot/scatter/hist/pie`,
    `title/xlabel/ylabel/legend`, `sns.barplot/histplot/scatterplot/lineplot`; the code is
    displayed but drawn from the parsed calls, not by running Python),
  - `console` (runs the code with Snek and shows stdout),
  - `pattern` (Snek stdout shown as a grid of stars/characters),
  - `regex` (the pattern applied to sample text with matches highlighted).
  A renderer is one file implementing `render(code, el)`; adding one does not change the game.
- **Progression:** fall speed rises each stage (level field `speed`, default ×1.15 per stage),
  decoys increase, combos multiply score (×2 after 5 in a row, ×3 after 10). After each stage a
  lesson card for the concepts just played, then a **bonus round** where those pieces score double.
- Level fields: `mode` (`fill` | `strike`), `renderer`, `template`, `slots: [{ id, accepts:[pieceId] }]`,
  `pieces: [{ id, text, size?, key?, concept, decoy? }]`, `stages`, `speed`, `lives`.
- Sample packs: `html-headings` (strike), `css-flexbox` (fill), `matplotlib-basics` (fill, chart),
  `python-print` (fill, console), `star-patterns` (fill, pattern), `regex-starter` (strike, regex).

| ID | Behaviour | Check |
|---|---|---|
| AC-217 | Fill mode: placing the right pieces completes the template and the preview shows the expected result (fixture: the `css-flexbox` level 1 preview has three boxes in one row); a wrong piece shows its effect in the preview, then breaks off and costs a life | `acceptance/games/syntax-drop.journey.mjs` |
| AC-218 | Strike mode: the right key destroys the piece and scores; letting a decoy through is correct and striking it costs a life; the speed after stage 2 is ≥ 1.3× stage 1; the lesson card and bonus round appear between stages | `acceptance/games/syntax-drop-strike.journey.mjs` |
| AC-219 | The `chart` renderer draws the fixture calls (bar with 4 bars and a title, scatter with 10 points, a histogram) as SVG with those element counts | `acceptance/games/renderers.test.mjs` |

### G6.2 Maze Coder (`maze-coder`)

- A block-built maze diorama sits on a table (camera orbits with drag / Q–E; zoom with wheel / +–).
  A blocky character stands on the start tile. The learner writes Snek in the editor on the right
  (beginners can use the block palette, which writes the same Snek) and presses **Run**.
- Host functions: `move()`, `turn_left()`, `turn_right()`, `jump()`, `paint(color)`,
  `is_wall_ahead()`, `is_on(color)`, `at_exit()`, `pick()`, `drop()`, `look()` (returns the tile
  kind ahead). Each call animates (via `step`, AC-212), and the current line is highlighted.
- **Pattern levels** (the link to pattern programming): the floor shows a target pattern (e.g. a
  right triangle of 5 rows); painting it needs the same nested loop that prints it. A side panel
  shows the equivalent `print` output growing as the character paints.
- **Stars:** 1 = reached the exit / completed the pattern; 2 = within the level's step budget;
  3 = within the line budget. Hitting a wall or falling plays a short fail animation and shows
  the line that did it.
- Level fields: `map` (ASCII rows: `#` wall, `.` floor, `S` start with `>`/`<`/`^`/`v` facing,
  `E` exit, `0–9` heights for stairs, `r g b` colored tiles, `*` item, `~` water), `target`
  (optional pattern rows), `allowed` (host functions), `budget: { steps, lines }`, `starter`
  (starting code), `fog` (only the tile ahead is visible; needs a search).
- Sample packs: `first-steps` (sequence, loops), `star-patterns-3d` (5 pattern levels),
  `conditions` (sensors), `functions` (repeat a shape), `search` (a fog maze solved with BFS/DFS).

| ID | Behaviour | Check |
|---|---|---|
| AC-220 | Running the fixture solution reaches the exit and gives 3 stars; a solution with extra steps gives 2; code that walks into a wall stops on that line with a message; an infinite loop is stopped (AC-210) without freezing the page | `acceptance/games/maze-coder.journey.mjs` |
| AC-221 | A pattern level is complete only when the painted tiles equal the target; the side panel shows the matching `print` output; the block palette produces Snek that runs the same | `acceptance/games/maze-pattern.journey.mjs` |

### G6.3 Breakout (`breakout`)

- **World:** a block-built prison. The learner walks a blocky character in third person (WASD /
  arrows, mouse or drag to look; on touch a joystick). Cell blocks are chapters; each room's door
  is a **machine** that shows one data structure working, and each escape is a function to write.
- **Room flow** (each step can be replayed from the menu):
  1. **Story:** a short scene (text + camera move) sets the problem.
  2. **Machine:** the data structure as a 3D mechanism that animates operations (e.g. the stack lock
     pushes and pops rings on a rod; the queue is a guard line; binary search is a dial with a
     hot/cold lamp; a hash map is a wall of lockers with a key-to-locker arm; a linked list is a vent
     tunnel of linked segments; a tree is a branching elevator shaft; a graph is the corridor map;
     a heap is the meal line; two pointers is a laser grid; a sliding window is a gap in the patrol;
     DP is a power grid filling a table of lights).
  3. **Tutorial:** operate the machine by hand (click/keys: push, pop, compare, move pointer…) to
     solve a small case; the machine checks each move.
  4. **Practice:** a short coding exercise with unlimited time and hints.
  5. **Escape (time-gated):** write the function under a countdown (the guard's patrol). Each test
     is a lock on the door; locks open as tests pass. Hints cost seconds. **Full manual** mode
     gives no signature or starter: the learner writes the whole `def`. The escape succeeds when
     every test passes before the countdown ends; otherwise the guard catches them and the room
     resets with the practice step offered.
- Rooms are also **time-gated by the schedule**: a room unlocks on its pack `day`.
- **Menu:** codex (every concept seen, with its machine replay), story mode / practice mode,
  settings.
- Machine types are plug-ins (`stack`, `queue`, `deque`, `array-pointers`, `window`, `hashmap`,
  `linked-list`, `tree`, `graph`, `heap`, `grid-dp`, `binary-search`), each `{ build(scene), apply(op), check(state) }`.
- Level (room) fields: `concept`, `machine`, `story: [lines]`, `tutorial: { start, goal, ops }`,
  `practice: { prompt, signature, tests, hints }`, `escape: { prompt, signature, tests, timeSec, hints:[{ text, costSec }] }`.
- Sample packs: `cell-block-a` (stack: balanced brackets; queue: guard rotation; two pointers: pair
  sum) and `cell-block-b` (binary search, hash map, sliding window). A further `cell-block-c`
  (linked list, tree, graph BFS, heap, DP) is part of the full build.

| ID | Behaviour | Check |
|---|---|---|
| AC-222 | In the stack room: the story plays, the machine animates push/pop, the tutorial accepts the correct manual sequence and rejects a wrong pop, and the practice accepts the fixture solution | `acceptance/games/breakout-room.journey.mjs` |
| AC-223 | Escape: locks open one per passing test; a hint subtracts its cost from the countdown; with all tests passing before 0 the door opens and the result is written; at 0 (test clock) the room resets and offers practice; full manual mode shows no signature and accepts a correct full `def` | `acceptance/games/breakout-escape.journey.mjs` |
| AC-224 | The codex lists every concept met so far with a working machine replay; a room whose `day` is in the future is locked with its unlock date | `acceptance/games/breakout-menu.journey.mjs` |

### G6.4 Seal the Beast — classroom raid (`raid`)

- **Who:** the trainer starts a raid for the class with a pack and a difficulty; the class's teams
  (`class.teams`) play together against one beast. The **projector screen**
  (`/teach/raid/<raidId>/screen`) shows the beast, the seal meter, the class's chances and each
  team's banner. **Phones** (`/learn/raid`) show the team's turn.
- **Turns:** each round the beast casts a **curse** (a problem from the pack). Every team gets the
  same curse and either 3–4 candidate pieces of code to vote on, or (level setting) a write-in
  that is run with Snek against the curse's tests on the hub. Team members vote on their phones
  within the turn timer; the team's choice is the most-voted option (ties → earliest vote).
- **Resolve:** each team whose chosen code is correct **adds a seal** (seal meter +1 per correct
  team; the projector animates that team's code flying to the beast and binding it). The beast then
  attacks: damage = base × (1 − seals / sealsNeeded). Damage is taken from the **class's shared
  chances** (easy 5, normal 3, hard 2, as hearts). Seal meter full → the beast is sealed and the
  class wins; chances at 0 → the beast escapes (the class can retry).
- Shown publicly: team banners, team correct/incorrect for the round, never individual votes.
- The hub is the authority: phones write `raidVote` docs; the hub's raid module resolves when the
  timer ends or every member voted, and writes the round to the `raid` doc that every screen syncs.
- Level fields: `curses: [{ prompt, code?, options:[{ code, correct, why }] | null, tests?, concept }]`,
  `sealsNeeded`, `turnSec`, `baseDamage`.
- Sample packs: `loops-beast` (options), `dsa-beast` (write-in).

| ID | Behaviour | Check |
|---|---|---|
| AC-225 | With three teams of two (fixture), a round where two teams vote correctly adds two seals and the beast's damage is reduced by that share; the majority option is the team's choice; a tie takes the earliest vote; the projector and both phones show the same round result | `acceptance/games/raid.journey.mjs` |
| AC-226 | Difficulty sets the shared chances (5/3/2); reaching `sealsNeeded` ends in "sealed"; losing all chances ends in "escaped" with a retry; write-in code is run on the hub and judged by the curse's tests; no screen shows an individual's vote | `acceptance/games/raid-rules.test.mjs` |

### G6.5 Snippet Sniper (`sniper`)

- A side-on 2.5D landscape (parallax layers). **Monsters** wander, each carrying a sign with a code
  snippet. The **bounty board** lists targets as outputs ("Bounty: the snippet that prints `[1, 4, 9]`").
- **Binoculars** (hold Right mouse / B / the binoculars button) zoom in so snippets become readable;
  scanning reveals which monster holds what. Select a monster and fire (Space / click): if its
  snippet's output matches the bounty, the bounty is claimed; otherwise the shot is wasted. Every
  shot uses ammo. Ammo per mission = bounties + slack, slack 3 / 2 / 1 / 0 as levels rise; monsters
  move faster and snippets get closer to each other (near-miss outputs) with level.
- **Rank** rises with claimed bounties (Recruit → Marksman → Sharpshooter → Ghost). At Sharpshooter
  the **boss battle** unlocks: a boss with rotating shield plates, each plate a snippet; the sniper
  supports a squad of soldiers by shooting the plate whose snippet matches the squad's call-out
  ("open the plate that prints 6"), letting them advance.
- Outputs are computed by Snek at pack-check time (the pack stores snippets; the expected output
  is derived, so a pack cannot carry a wrong answer).
- Level fields: `bounties: [{ output? , snippetId }]`, `snippets: [{ id, code, concept }]`,
  `monsters`, `speed`, `slack`; boss: `plates: [{ snippetId }]`, `callouts`.
- Sample packs: `print-basics`, `lists-and-loops`, `strings`, `boss-recursion`.

| ID | Behaviour | Check |
|---|---|---|
| AC-227 | Firing at the monster whose snippet prints the bounty output claims it; a wrong target wastes one ammo and the miss lists the snippet's real output; ammo equals bounties + slack for the level; claimed bounties raise the rank and Sharpshooter unlocks the boss; in the boss battle the right plate opens and the squad advances | `acceptance/games/sniper.journey.mjs` |

### G6.6 Whack-a-Bug (`whack-a-bug`)

- The top shows **expected** and **actual** output side by side; below, the program's lines sit
  in a field of holes. Moles pop up, each holding one line of the program. **Whack** (click / tap /
  the line's number key) the mole holding the line that causes the difference.
- Whacking a mole that holds a **correct** line **deletes that line** from the program (the actual
  output updates and gets worse); the learner can restore one deleted line per round with the
  "undo" token. Whacking the buggy line replaces it with the fix and the round is won when actual
  equals expected.
- **Difficulty:** easy colors the buggy mole differently and moles stay up 2.5 s; levels then
  shorten the time (to 0.8 s), remove the color hint, add more moles at once, and put two bugs in a
  program.
- Level fields: `program`, `bugs: [{ line, fix, concept, why }]`, `upTimeMs`, `hint` (`color` | `none`),
  `molesAtOnce`. Expected/actual outputs are computed with Snek from the fixed and buggy program.
- Sample packs: `off-by-one`, `loop-bugs`, `string-bugs`, `dsa-bugs`.

| ID | Behaviour | Check |
|---|---|---|
| AC-228 | Whacking the buggy line's mole replaces it with the fix and the actual output becomes the expected; whacking a correct line's mole deletes it and the actual output changes; the undo token restores it once; easy mode marks the buggy mole with the hint color and hard mode does not; up-time follows the level | `acceptance/games/whack-a-bug.journey.mjs` |

### G6.7 Aftershock (`aftershock`)

- A city in an earthquake. **Slabs** fall from the collapsing buildings; each slab is one line of
  code (plus decoy slabs). The survivor at the bottom moves left/right to **catch** a slab, then
  **places** it on the growing stack (the program, top to bottom) at an indent level (Left/Right
  while holding nudges the indent; the slab's offset shows it). Decoy slabs can be kicked away.
- **Aftershocks** come every `shockSec` seconds: the topmost slab that is in the wrong place or
  indent shakes loose and falls (back into play). When the stack is complete, the program is run
  with Snek against the level's tests: if it passes (so any correct order counts, not just one),
  the stack becomes a ramp and the survivor **slides to safety**; if not, the failing test is shown
  and the next aftershock knocks off the first wrong slab.
- Level fields: `lines: [{ text, indent }]`, `decoys: [{ text, why }]`, `tests`, `shockSec`, `fallSpeed`.
- Sample packs: `loops-order`, `functions-order`, `dsa-order` (binary search, BFS).

| ID | Behaviour | Check |
|---|---|---|
| AC-229 | Catching and placing the fixture lines in a correct order with correct indents passes the tests and plays the escape; an alternative correct order (fixture) also passes; a wrong indent is knocked off by the next aftershock (test clock); kicking a decoy away is scored; placing a decoy fails the tests and shows the failing test | `acceptance/games/aftershock.journey.mjs` |

### G6.8 Complexity Garage (`garage`)

- **Garage:** build a car from parts. Each part is a programming choice:
  - **Engine** = the algorithm (from the pack's implementations, e.g. bubble / insertion / merge /
    built-in sort; linear / binary search) or **"Build your own"**, which opens the editor to write
    the function in Snek.
  - **Tyres** = the data structure (list / set / dict / deque) where the level offers a choice.
  - **Fuel tank** = the memory allowance (in cells).
  The car's look changes with the parts (block-built bodies, engine size by complexity class).
- **Race:** the track has checkpoints at growing input sizes (e.g. n = 10, 100, 1 000, 10 000).
  Each car's time to each checkpoint is its Snek **operation count** for that n (D-G4); a car whose
  `peakCells` exceeds its tank **runs out of fuel** there. Very large runs are capped: past the cap
  the count is **projected** from the smaller sizes (log-log fit) and shown as "projected".
- **Opponents:** computer cars with fixed parts, and **challenges** with a classmate (both accept;
  ghost race; the result is visible only to the two of them, AC-206).
- Results screen: the race chart (ops vs n, log scale), each car's complexity class guess, and a
  lesson card on why.
- Level fields: `task` (prompt + `signature` + `tests`), `engines: [{ id, name, code, concept }]`,
  `tyres?`, `sizes`, `inputGen` (Snek code that builds the input for n with the seeded RNG),
  `tank`, `opsCap`, `opponents`.
- Sample packs: `sorting-grand-prix`, `search-sprint`, `lookup-rally` (list vs set vs dict).

| ID | Behaviour | Check |
|---|---|---|
| AC-230 | With merge sort vs bubble sort (fixture), merge sort finishes first and its ops at each checkpoint equal Snek's counts for that input; a learner-written engine that fails a test is not allowed to race (the failing test is shown); exceeding the tank stops the car with "out of fuel"; sizes past `opsCap` are marked projected; a classmate challenge result is not visible to a third learner | `acceptance/games/garage.journey.mjs` |

## G7. Build plan

Tasks (each a tins-kit task with its own worktree and scope; every row above is claimed by exactly
one task):

| Task | Builds | Rows | Depends on |
|---|---|---|---|
| g-1 | Snek interpreter + counting + sandbox + `games check/new` CLI skeleton | AC-208 to AC-213, AC-216 (CLI) | — |
| g-2 | Engine, arcade, shared screens, results/cards/mastery hooks, switches, test hooks, budgets tooling, pack schema + check + content gate | AC-200, AC-203 to AC-207, AC-214, AC-215 | — (uses g-1's API by interface; merges after g-1) |
| g-3 | Syntax Drop + renderers | AC-201 (its part), AC-217 to AC-219 | g-1, g-2 |
| g-4 | Whack-a-Bug | AC-228 | g-1, g-2 |
| g-5 | Aftershock | AC-229 | g-1, g-2 |
| g-6 | Snippet Sniper | AC-227 | g-1, g-2 |
| g-7 | Voxel kit (block models, character, camera, quality tiers, stats) + Maze Coder | AC-202, AC-220, AC-221 | g-1, g-2 |
| g-8 | Complexity Garage | AC-230 | g-7 |
| g-9 | Breakout: world, movement, menu, codex, stack room end to end (vertical slice) | AC-222 to AC-224 | g-7 |
| g-10 | Breakout: remaining machines and `cell-block-b/c` packs | (extends AC-222–224 fixtures) | g-9 |
| g-11 | Seal the Beast (hub raid module, projector, phones) | AC-225, AC-226 | g-1, g-2 |

AC-201 is claimed by the last 2D game task to merge; earlier ones run it for their own game.

## G8. Later (not in this build)

- Java subset front end for Snek (D-G3); SQL renderer for Syntax Drop; ideas 6–9 from the design
  discussion (conveyor factory, pointer train yard, type tower defense, git platformer), pending
  the trainer's notes.
