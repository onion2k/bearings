# Bearing: working on it

A marble run game: eight marbles let go down a run, and the run decides it.
TypeScript, Vite, and WebGPU through
[artshape-render](https://github.com/onion2k/artshape-render). The README
says what the game is; this file says how it is made. The house rules in
`~/.claude/CLAUDE.md` apply too.

The marbles ride a track solver of the game's own, in `src/marbles.ts`, and
not artshape-physics, which the template came with: its floor is flat tiers,
one height a tile, so a marble on it never feels a slope, and a marble run is
nothing but slopes. The template's stub, a sled shoving balls into a hole, is
gone; the gates it held have each been handed the race instead.

## The factory

This repo is a line that turns ideas into a browser game that loads fast,
draws fast and has no bugs, one feature at a time, and it holds those three
properties as numbers from the first commit. Every change goes down the same
line: a spec agreed, tests written and seen failing, the change built, every
gate run, the result looked at, the report made with evidence, then a
commit. The line does not skip a station, and it stops when a gate is red:
a red gate is fixed before anything else lands, never skipped with
`--no-verify` and never made green by moving its baseline.

The three properties, and what holds each:

- **Bug free.** Every rule that must always hold is in `src/invariants.ts`,
  and the fuzzer hunts for it. Every bug found becomes a test that would
  have caught it and, where it is a rule, an invariant; there is no list of
  known issues, because a bug found is fixed before the next feature. The
  same seed gives the same game, so every failure can be played again.
- **Loads fast.** Boot time and the gzipped download are measured by
  `npm run perf` in headless Chromium and held to a budget and a baseline.
- **Draws fast.** A frame's cost at the standard view is measured by the
  same gate, and the race's by `npm run bench`. A feature that cannot fit
  the budget gets a rung the game steps down to on a slower machine, not a
  pass.

## Budgets

Numbers, held by gates, on this machine at 1280×800:

| Property                                               | Budget                         | Held by      |
| ------------------------------------------------------ | ------------------------------ | ------------ |
| Boot, page start to the frame loop running             | 3000 ms                        | `perf`       |
| Download, scripts and styles gzipped                   | 400 kB                         | `perf`       |
| A frame drawn, lower quartile at the standard view     | 8 ms                           | `perf`       |
| The race, a frame, against the reference arithmetic    | baseline ± 20%                 | `bench`      |
| Pace, the autopilot's minutes to see ten races through | baseline ± 20%                 | `pace:check` |
| Anything kept: marbles, track, save, heap              | ceilings in `scripts/leaks.ts` | `leaks`      |

A budget is what the game may cost at all; a baseline is what it cost at
the last commit, held both ways, so a step toward a budget is noticed as
much as a step over it. The perf tolerances are the measured wobble of a
headless boot and a GPU frame, and say so in the file.

## Commands

    npm run dev            the game at http://localhost:5198
    npm run check:quick    formatting, types, lint, unit tests (the pre-commit hook; ~10 s)
    npm run check          all of it: check:quick, fuzz, determinism, leaks, pace, bench, smoke with perf and look (~20 s)
    npm test               unit tests (Vitest, test/)
    npm run fuzz           the game played at random, rules checked; -- --seed N plays one failure again
    npm run determinism    the same seed played twice, hashed, to catch chance not from the seed
    npm run leaks          an hour of play, watching what must stay bounded (10 min of it in check)
    npm run pace           the autopilot's pace, seed by seed; pace:check holds it to its baseline
    npm run bench          the race's frame time held to scripts/bench-baseline.json
    npm run perf           boot, frame and download held to smoke/perf-baseline.json and the budget
    npm run smoke          the game in headless Chromium on the real GPU (Playwright, smoke/)
    npm run look           the scenes held to the pictures in smoke/screens

`--update` on `pace:check` or `bench`, `npm run perf:update` and `npm run
look:update` write a baseline again. Only through `/gate-moved`, only for a
change meant to move it, and the commit says why. Look at every picture.

## How the code is laid out

- `src/game.ts` is the game without the picture: a run put on, a field on
  its gate, and the race, a step at a time. It tells what happened through
  `GameEvents`, and knows nothing of the renderer or the page.
- `src/marbles.ts` is the race itself: every marble as how far along its
  segment it is and how far across the channel, with gravity taken along the
  track. `src/track.ts` works a run of pieces out into that track — the
  lattice, the kinds of piece, the segments with their frames, and what may
  be wrong with a run. Neither takes anything from the renderer, so the same
  run is drawn, raced and measured from one working out.
- `src/main.ts` is the page. It turns events into words on the board and
  draws the frame. There is no game logic here. `src/scene.ts` sweeps the
  channel along the track's own samples and places the marbles.
- `src/debug.ts` is `window.game`, the test API. `src/invariants.ts` lists
  the rules that must always hold. `src/autopilot.ts` plays the game by
  itself, for the gates.
- Content is `src/runs.ts`, the runs that come with the game, and
  `src/field.ts`, what the eight marbles are called and look like. A run the
  player designs will be the same shape as one that comes with the game. The
  save lives in `progress.ts`. Chance comes from `random.ts`, handed in.

## Skills

In `.claude/skills`, and they come with every game copied from here:
**/feature** builds one, spec and tests first; **/bug** fixes one,
reproduction first; **/gate-moved** decides what a moved baseline means
before anything is written; **/commit** commits in the house style.

## Model features

What to copy the shape of, when building something new:

- **On the run: a marble.** Its state is typed arrays in `marbles.ts`,
  stepped by `game.ts`, drawn by `scene.ts` with its look from `field.ts`,
  its rules in `checkMarbles` and `invariants.ts`, read by `marbles()` in
  `debug.ts`, hashed in `scripts/determinism.ts`, counted in
  `scripts/leaks.ts`, and pictured in `smoke/look.spec.ts`. One kind of
  thing, eight places, and a new thing on the run goes to all of them.
- **A kind of piece:** `src/track.ts`. A kind is one line in `SHAPES` — where
  it hands a marble on, and the curve it follows — and every path over the
  kinds gets it for nothing, because they are a `Record<Kind, Shape>` and not
  a switch anyone can forget to add to. Copy that shape for anything the game
  has several of.
- **Tools:** the fuzzer (`scripts/fuzzer.ts`) and the pace gate
  (`scripts/pace.ts`). Each has unit tests of its own working parts, and the
  fuzzer's reload is tried against a save that forgets, in
  `test/fuzz-reload.test.ts`, since a correct save never makes it fire.
- **Test helpers:** `newGame(seed)` and `race(game)` in `test/helpers.ts`,
  and `memoryStore` in `src/progress.ts` for a save that is not the player's.

## What comes next

The race runs; what makes it a game is still to come, each through
`/feature`: more runs and a way to choose between them, the bet, the
designer, and patterns on the marbles, which want a change to artshape-render
since it has no textures. Two things are open and belong with those:

- **Pole is strong.** The front of the grid wins about 63 races in 100 on
  First Drop, because only the leader ever has clean air. A wider channel
  makes it worse, not better: traffic is what shuffles a field. The bet
  either prices that with odds or wants a design change, not more tuning.
- **Overlap is a solver's business.** Two marbles are parted across the
  channel and then along it for whatever a wall refuses, over several
  passes. A new piece that pinches the channel meets this first.

## Rules for the code

- **No tight coupling.** A module takes what it needs as arguments or
  options. It does not import game state, and lower modules do not import
  content. `main.ts` is the only place that wires everything together.
- **Chance is handed in.** `Game` takes a `random`; nothing in `src/` calls
  `Math.random` itself.
- **Nothing is made each frame.** Pools are sized once and written into;
  the renderer's groups are fixed and `move` writes them. A per-frame
  allocation is a frame-time bug and a garbage-collection stutter.
- **Nothing is kept for ever.** A list, map or cache that is added to has to
  be emptied somewhere, and its ceiling named in `scripts/leaks.ts`.
- **Loading is the first frame's business.** Everything the first frame
  needs is built before `ready`; everything else after it. A dependency is
  weighed against the download budget before it is added.
- **Every kind of thing is handled everywhere.** A new body kind, event,
  save field or scene has to work in every path it can reach.
- **Save compatibility.** A new save field needs a default in `progress.ts`
  and a save in the new shape in `test/saves/`; the corpus test fails until
  it is there.
- **Match the style.** Comments are full sentences in the house voice,
  saying why and not what. Prettier decides the formatting.

## Definition of done

The house's nine points, in `~/.claude/CLAUDE.md`. Here, they mean: unit
tests in `test/`, a stage in `smoke/progress.spec.ts`, an action in
`scripts/fuzzer.ts` and a rule in `src/invariants.ts`, a size in
`scripts/leaks.ts` for anything kept, the perf figures before and after in
the report and within budget, `measureFrame` in any other scene touched, and
a picture in `smoke/look.spec.ts`. `npm run check` green, and
`npm run fuzz -- --seeds 1-24` clean.

## Edge-case checklist

For anything new in the run, check what it does:

- **a marble on it:** rolled onto gently, at rest on it, and hit at the
  fastest a marble gets anywhere on the run; never passed through, however
  fast it arrives
- **a join:** where it meets the piece above and the piece below, both ways
  round; a seam a marble catches on, and a gap it drops through
- **many marbles:** a train of them nose to tail, a clump of three pressed
  together, and one pinned on a wall by another; all eight at once
  (`MARBLES`), and what it costs a frame at that many
- **stuck:** a marble that settles on it, wedges against it, or circles it
  for ever. A run that cannot finish has to be noticed and said, not waited
  on
- **off the run:** a marble that leaves sideways or over an edge, and where
  it ends up when it does
- **building:** placed, moved, turned and taken away; placed overlapping
  what is already there, and placed with nothing underneath it
- **let go and again:** the run released, stopped part way down, and
  released again from the same seed to the same result, marble for marble
- **save:** saved, reloaded, and loaded from an old save without the field
- **phone:** narrow screen, and a slower GPU: which rung it steps down to
- **another run:** put on part way through a race, and the one before it
  thrown away cleanly

## Verifying in a browser

Use headless Playwright (`start()` in `smoke/game.ts`) for anything seen or
measured; the in-app browser pane pauses when hidden. Control time through
the API: `pause()`, `seed(n)`, then `step(frames)`, never a timeout. Never
write over the player's save; a test save goes in through `start(page, {
save })`.

## Commits

Commit only when asked, through `/commit`: a sentence summary in the house
voice, a body saying what changed and why, two commits when a refactor and
a feature land together. The pre-commit hook runs `check:quick`.
