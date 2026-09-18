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

| Property                                            | Budget                         | Held by      |
| --------------------------------------------------- | ------------------------------ | ------------ |
| Boot, page start to the frame loop running          | 3000 ms                        | `perf`       |
| Download, scripts and styles gzipped                | 400 kB                         | `perf`       |
| A frame drawn, lower quartile, on every run         | 8 ms                           | `perf`       |
| The race, a frame, against the reference arithmetic | baseline ± 20%                 | `bench`      |
| Pace, each run's minutes to see ten races through   | baseline ± 20%, run by run     | `pace:check` |
| Anything kept: marbles, track, save, heap           | ceilings in `scripts/leaks.ts` | `leaks`      |

A budget is what the game may cost at all; a baseline is what it cost at
the last commit, held both ways, so a step toward a budget is noticed as
much as a step over it. The perf tolerances are the measured wobble of a
headless boot and a GPU frame, and say so in the file.

## Commands

    npm run dev            the game at http://localhost:5198
    npm run check:quick    formatting, types, lint, unit tests (the pre-commit hook; ~10 s)
    npm run check          all of it: check:quick, fuzz, determinism, leaks, pace, bench, smoke with perf and look (~30 s)
    npm test               unit tests (Vitest, test/)
    npm run fuzz           the game played at random, rules checked; -- --seed N plays one failure again
    npm run determinism    the same seed played twice, hashed, to catch chance not from the seed
    npm run leaks          an hour of play, watching what must stay bounded (10 min of it in check)
    npm run pace           each run's pace, seed by seed; pace:check holds every run to its baseline
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
  track; what stands in the way on a piece, pegs and moving parts, as
  capsules in the piece's own plane; and a funnel's bowl as a plane of its
  own, where a marble circles until it is slow enough to drop. `src/track.ts`
  works a run of pieces out into that track — the lattice, the kinds of
  piece, the segments with their frames, how wide each is at every sample,
  what stands on it and how it moves (`pose`), and what may be wrong with a
  run. Neither takes anything from the renderer, so the same run is drawn,
  raced and measured from one working out.
- `src/main.ts` is the page. It turns events into words on the board, puts
  a run on from the arrows either side of its name, frames each run to fit
  the screen whatever its shape, and draws the frame. There is no game logic
  here. `src/scene.ts` sweeps the channel along the track's own samples, as
  wide as the track says at each; turns each funnel's bowl from the height
  the marbles roll on; stands the pegs; and places the marbles and, every
  frame, the sweepers, gates and wheels from the same `pose` the solver
  meets them in, so what is drawn is what a marble hits.
- `src/debug.ts` is `window.game`, the test API. `src/invariants.ts` lists
  the rules that must always hold. `src/autopilot.ts` plays the game by
  itself, for the gates.
- Content is `src/runs.ts`, the runs that come with the game, and
  `src/field.ts`, what the eight marbles are called and look like. A run's
  `id` is what the save knows it by, and never changes once a run has
  shipped; a run the player designs will be the same shape. The save lives
  in `progress.ts`: the races run, the run last put on, and the best time on
  each run. Chance comes from `random.ts`, handed in.

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
  a switch anyone can forget to add to. A jump is the same plus `flies`: it
  ends in the air, and the solver takes a marble off its lip. A board is the
  same plus `width`; pegs and moving parts are `obstacles`, each with a
  `Motion` that `pose` turns into where it is at a moment, from a phase the
  race draws from its seed; a funnel is `bowl`. Copy that shape for anything
  the game has several of.
- **A run:** a list of placements with an id, in `src/runs.ts`. Every run is
  held by `test/runs.test.ts` — sound; raced on 24 seeds with every marble
  home, none lost, none stopped, and none fast enough to step through another
  in a frame; and a race, not a procession, over 60 races: the grid tells
  little of who wins (Kendall's tau of grid against finish within ±0.4), and
  the back half of the grid wins between a fifth and four fifths of them —
  and paced on its own by `pace:check`. A new run is a new entry and nothing
  else, and then the gates hold it. Lay one out with `exitOf` and race it
  before shipping it: The Leap lost three marbles in five hundred races off a
  jump on to a chute, and none once it landed on a peg board. A run rebuilt
  enough to change its races gets a new id, so a best set on the old one is
  not held against the new; the game drops bests for ids it no longer has.
- **Tools:** the fuzzer (`scripts/fuzzer.ts`) and the pace gate
  (`scripts/pace.ts`). Each has unit tests of its own working parts, and the
  fuzzer's reload is tried against a save that forgets, in
  `test/fuzz-reload.test.ts`, since a correct save never makes it fire.
- **Test helpers:** `newGame(seed)` and `race(game)` in `test/helpers.ts`,
  and `memoryStore` in `src/progress.ts` for a save that is not the player's.

## What comes next

Five runs race, and the player picks between them. Still to come, each
through `/feature`: the bet, the designer, and patterns on the marbles, which
want a change to artshape-render since it has no textures. Open, and
belonging with those:

- **Where on the grid still counts for something.** Over sixty races each,
  pole wins 7% on The Tower, 12% on First Drop, 13% on Switchback, 15% on
  The Chute and 22% on The Leap, down from 27% to 85% before the pegs, pens
  and funnel; and the back half of the grid wins 70% on The Tower, whose
  gate lets the back of a pen go first as often as the front. The bet prices
  this with odds, run by run.
- **Marbles stay on the track over a crest.** Only a jump's lip lets one
  leave it; a fast marble over the top of a drop would, in life, fly.
- **Overlap is a solver's business.** Two marbles are parted across the
  channel and then along it for whatever a wall refuses, over sixteen
  passes (`SETTLE`), and a marble a moving part would crush against a wall
  is let out along the piece instead. A marble cannot drop out of a funnel
  on to one sat under the hole; it waits in the hole. A new piece that
  pinches the channel meets all of this first.
- **Nothing is quite level.** A straight or a curve leans down by a
  twentieth (`LEAN`), as a real run is set up to, so a queue behind a pen
  always drains; a truly level piece let a crowd come to rest on it.
- **A wheel is a gate that turns.** A marble that catches a paddle up is
  held until the paddle lifts out; one that arrives between paddles runs on
  under it. It holds a marble anything from nothing to two thirds of a
  second, and that spread is what it is for.

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
  together, and one pinned on a wall by another; a pile held at a gate; all
  eight at once (`MARBLES`), and what it costs a frame at that many
- **in the way of it:** a peg hit dead on, and a marble rolled square on to
  one's crown; a moving part met at every point of its turn (the phase is
  the seed's), and one that would crush a marble against a wall; a marble
  dropping out of a funnel on to one below it
- **stuck:** a marble that settles on it, wedges against it, or circles it
  for ever — a bowl's patience is `BOWL_PATIENCE`, a channel's `PATIENCE`. A
  run that cannot finish has to be noticed and said, not waited on
- **off the run:** off a jump's lip, a marble that comes down wide of the
  channel, short of the landing or beyond everything the lip can reach; it is
  lost, told of, given no place, and the race still ends
- **building:** placed, moved, turned and taken away; placed overlapping
  what is already there, and placed with nothing underneath it
- **let go and again:** the run released, stopped part way down, and
  released again from the same seed to the same result, marble for marble
- **save:** saved, reloaded, and loaded from an old save without the field
- **phone:** narrow screen, and a slower GPU: which rung it steps down to
- **another run:** put on part way through a race, and the one before it
  thrown away cleanly; framed to fit the screen, whatever its shape; and put
  back on after a reload

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
