# Bearing: working on it

A marble run game: up to eight players each pick one of eight marbles, the
field is let go down a run, and whoever picked the winner wins.
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
| The race, a frame, against the reference arithmetic | baseline ± 15%                 | `bench`      |
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
  its gate, the players' picks, and the race, a step at a time. Where each
  marble starts is drawn at the off, after the picks, so a pick is one in
  eight whatever the run favours. It tells what happened through
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
- `src/cameras.ts` is the split screen's cameras, one to every picked
  marble, without the screen.
- `src/designer.ts` is a run the player builds, a piece at a time, and the
  designs they keep: what may go on the end, what is refused outright, and
  what a design read back from a save has to be before it is put on.
- `src/debug.ts` is `window.game`, the test API. `src/invariants.ts` lists
  the rules that must always hold. `src/autopilot.ts` plays the game by
  itself, for the gates.
- Content is `src/runs.ts`, the runs that come with the game;
  `src/catalog.ts`, every kind of piece named, said what it does and set
  between a start and the end, for the board's second shelf; and
  `src/field.ts`, what the eight marbles are called and look like. A run's
  `id` is what the save knows it by, and never changes once a run has
  shipped; a run the player designs is the same shape, kept in the save
  under an id of its own. The save lives in `progress.ts`: the races run,
  the run last put on, the best time on each run, and the designs kept.
  Chance comes from `random.ts`, handed in.

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
  a switch anyone can forget to add to. A piece may be two parts (`then`),
  each its own segment, so that it joins whatever is either side of it: a
  jump is its run-up, which `flies` off a lip after `felt` that brings any
  marble to the same pace, and its own landing board beyond the air; a
  funnel is a run in that `flies` off a lip over its bowl, then the bowl,
  whose rim's wall stands as high as the lip, so that whatever comes off it
  at whatever speed comes down inside, and then a ramp of its own under the
  hole, which a marble falls through the bowl's `throat` on to and is
  carried off down, a cell beyond the hole and a level below. A board is the same
  plus `width`; pegs and moving parts are `obstacles`, each with a
  `Motion` that `pose` turns into where it is at a moment, from a phase the
  race draws from its seed; a funnel is `bowl`; lumps in a floor are
  `mounds`. A width may pinch below a chute's, down to single file
  (`NARROW`), but is a chute's wherever one piece meets another. A new kind
  needs an entry in `CATALOG` too, which the compiler insists on; the
  catalog's test then races it by itself, and `test/joins.test.ts` races it
  after and before every other kind there is. `check` refuses a run whose
  parts pass through each other. Copy that shape for anything the game has
  several of.
- **A branch in the track: the splitter and the joiner.** The one place
  `compile` is a graph and not a line: a splitter's own segment carries
  `fork` — `a` to whichever side of the middle the field is on as it reaches
  it, `b` to the other — in place of the one `next` every other segment has,
  and the segments either side of it carry `branch`, a lane tag that keeps
  `settle`'s pairwise checks and `checkMarbles`'s "inside each other" from
  reading two marbles on separate branches as touching just because their
  `far` — cumulative length along the run — happens to overlap while the
  branches run in parallel. A joiner's second entry is matched to the
  splitter's own fork lane by position, the same way every other piece's
  entry is; the two are held to about the same length (`start`, within 15%
  of the longer or one unit, whichever is more), not exactly, since a lane
  moved a cell across is inherently about half again longer than a plain
  straight of the same span. Both are shown together on the catalog's
  shelf (`CATALOG`'s `laid`, an `Entry` field that lays a shelf piece out by
  hand instead of chaining `among`, since neither piece means anything
  alone). A kind at a chute's width can stand on a branch — proven by
  placing the same kind on both, which lines a joiner up with both at once
  since a facing-preserving kind hands the same lattice offset on from
  either entry — but a kind wider than the cell a splitter opens between its
  two lanes cannot, which `check` refuses rather than racing them through
  each other; nor can a kind that turns, since the joiner's own facing then
  no longer lines up with both branches' true offset. `test/joins.test.ts`'s
  `a splitter and a joiner` covers what its blanket pairwise matrix cannot.
  Both keep a chute's own width the whole way — narrowing the channel down
  to fit the lattice cell between them was tried first, and pinched two
  marbles still side by side from the wide chute before it before they had
  anywhere near enough of the piece to settle apart in. Since the channel
  itself cannot be a chute wide each while barely a lattice cell apart, the
  wall a marble looked to run through is covered instead, in `scene.ts`, by
  a solid wedge (`bar`, from `DIVIDER`/`DIVIDER_THICK`) stood on the point
  the two lanes share — the splitter's own `fork` segment's far end, or
  wherever two segments of different branches hand on to the same one next.
  A change to how it looks, not to the track or the solver, and nothing a
  test races through: only `smoke/look.spec.ts`'s own pictures see it.
- **The screen split, a view to every picked marble:** `src/cameras.ts` is
  which marbles are followed and where each camera looks, with no renderer
  in it. `Game.split` is the player's own intent, on or off; `Game.views`
  is what it comes to — as many views as marbles are picked, in player
  order, or 0 with fewer than two picked, since one marble is nothing to
  split a screen over. A camera is not assigned by anything happening in
  the race: `Game.follow()` runs only when a pick changes or the split is
  turned on, since picks are fixed once the field is away, and holds its
  marble whatever becomes of it — home, stopped or lost — with no hand-over
  to anyone else, because there is no one else to hand to. The renderer has
  one camera and draws all of what it is given, so `main.ts` makes the
  renderer one view's size, draws each camera's view into a texture of its
  own (`present`) and copies them on to the canvas, which is configured
  with `COPY_DST` for it: nothing in artshape-render changed. The grid
  follows the screen's shape and the view count (`columnsFor`), so a view
  is never a thin strip up to the eight a field can ever have. `S` and the
  board's Split tab toggle `game.split`; a pick made while it is already on
  grows or shrinks the grid on its own, without pressing `S` again. When
  `game.split` is on but `views` is 0 the page falls back to its ordinary
  chase camera exactly as if split were off — every guard in `main.ts`
  reads `game.views`, never `game.split`, for that reason, and `chase()` in
  the test API reads where that ordinary camera is looking, for a test that
  wants to tell a chase still moving from one left frozen. `split()` and
  `cameras()` are the rest of the test API. A caption in each view
  (`#tags`, `captionOf` and `swatchOf` in `field.ts`) names its marble and
  the player who picked it, over the top of the view on a wide screen and
  at the foot of it upright, and on a phone the board shrinks to its header
  while split so it covers neither a view nor its caption. A way of looking
  and nothing the race feels: not saved, no marble touched, the same seed
  the same race whatever is picked, which a test holds it to. Costs a scene
  draw a view: about 1 ms at eight views, against 0.5 whole, in the perf
  spec.
- **The designer:** `Designer` in `src/designer.ts`, driven by `Game`'s
  `build`, `lay`, `undo`, `keep`, `leave` and `forget`, on a third shelf,
  `'designs'`, whose runs are `progress.save.designs`. A piece goes on where
  the last one hands a marble on (`open`, from `exitOf`), facing the way the
  marble is going, so everything joins by construction and the turns do the
  turning; taking one off takes the last, so the pieces are the undo and
  `MAX_PIECES` its ceiling. `refuses` says no only to what the game could
  not draw or race at all — past `MAX_PIECES`, `MOVING_MOST` of a moving
  kind, or `MAX_SAMPLES` — and `check` says everything else, the same rules
  every shipped run is held to, which the board shows as the run is built.
  A run is kept only once `check` has nothing to say, so every design races;
  `MAX_DESIGNS` (20) are kept, ids are `design-N` one past the highest, and a
  design thrown away takes its best with it. While a run is being built it
  is the run on, remade at every piece, and `release` does nothing; it is not
  saved, and leaving or reloading throws it away. `readDesigns` checks every
  design a save brings back as `check` would, since anyone can write a save.
  The palette leaves out the splitter and the joiner: each opens or closes a
  second end, and a builder with one open end cannot say which to build
  from. Held by `test/designer.test.ts`, the invariants (no design id twice,
  none over the cap, nothing let go down a run being built), the fuzzer's
  `design` action, which stays at the builder three times in four while it
  is there, since one that wandered off after every piece never kept a run,
  `'designs kept'` and `'pieces being built'` in `scripts/leaks.ts`,
  `test/saves/04-designs.json`, a stage in `smoke/progress.spec.ts`, the
  `designer`, `design` and `designer-phone` pictures, and the frame of a
  design being built and raced in the perf spec. On a phone the palette is
  one row that scrolls sideways, so the builder stands no taller than the
  board over a race. Every click checks the whole run again and compiles it
  once a kind to know what to refuse: about 10 ms at a hundred pieces, on a
  click and never a frame.
- **The end of the run:** `finish` is the line and a lane one marble wide
  behind it. A marble is placed as it crosses, by which crossed first in
  the step, and rolls on down the lane (`lane` in `marbles.ts`) to wait a
  marble's length behind the one that finished before it.
- **A shelf of runs:** `Game.shelf` and `browse`. The runs are raced,
  counted and kept; the pieces from the catalog are put on the same way
  but nothing raced on them is counted or saved.
- **The players:** `Game.players`, a player number for each marble, picked
  by `claim` before the off and read by `champion` after it; kept from race
  to race and never saved. Ruled on in `invariants.ts`, read by `marbles()`
  and `state()` in `debug.ts`, done by the fuzzer's `claim`, shown on the
  board by `main.ts`, and pictured in `board.png` and `won.png`.
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
  Stitching whole existing runs together for the Stress Test's hundred
  pieces (every kind, `MAX_PIECES`'s own ceiling) found what a run ten
  times the usual length runs into. Laid out piece after piece the way a
  short run is, it needed a camera three hundred units further back than
  any other run and stood a sliver in the corner of the screen for it;
  folded into a box with turns instead — a lawnmower's own rows, stepping
  one level further down each turn rather than drifting across the world —
  what carries the length is depth, and it frames like any other run. A
  turn costs a field more time than a straight the same length, so the
  fold that fixed the screen also made the run slower, which moved
  `pace.ts`'s own `capMinutes` (`test/pace.test.ts`'s smaller one, and
  `smoke/progress.spec.ts`'s `settle` and `test/runs.test.ts`'s own race
  cap, too) a second time over — each sized to the runs that existed, not
  to whatever a future one might be, and a run long enough moves all of
  them. And a piece with something in the way keeps the field's order
  about as well as the field it meets is already spread out: a splitter
  and a joiner hand two equal lanes back on in lock step, exactly as
  evenly spaced as they went in, and the first piece with something in the
  way to meet that field afterward reads as though it did nothing,
  whatever it is and however far downstream it sits — moved to stand
  before the fork instead of tuned in place, which is where the run's
  pegboards live now, and nothing with something in the way stands between
  the joiner and the cup.
- **Tools:** the fuzzer (`scripts/fuzzer.ts`), the pace gate
  (`scripts/pace.ts`) and the race bench (`scripts/bench.ts`, its
  arithmetic in `scripts/benching.ts`). Each has unit tests of its own
  working parts, and the fuzzer's reload is tried against a save that
  forgets, in `test/fuzz-reload.test.ts`, since a correct save never makes
  it fire. The bench was blind to a race five times slower until it was
  made to fail one on purpose; a gate is trusted once it has been seen to
  fail what it is for.
- **Test helpers:** `newGame(seed)` and `race(game)` in `test/helpers.ts`,
  and `memoryStore` in `src/progress.ts` for a save that is not the player's.
  `Marbles.friction` is the solver's lever for a test that wants a marble
  that never slows (0) or cannot move (a thousand); it is 1 in every race.

## What comes next

Eight runs race, up to eight players pick a marble each, and a player can
build and keep runs of their own. Still to come, each through `/feature`:
patterns on the marbles, which want a change to artshape-render since it
has no textures; and a designer that places a piece anywhere on the
lattice, turned any way, splitters and joiners with it, where this one only
ever builds on the end. Open, and belonging with those:

- **The marbles are all the same, and are treated so.** No marble has form
  or any other property of its own. The field is stepped and parted in the
  order of the grid (`bySlot`), and a peg's tie is broken by slot: taken by
  marble number, the float arithmetic alone gave a marble an edge. A test
  swaps two marbles on the gate and holds them to swapping places at the
  finish, bit for bit.
- **The chance is in the things in the way.** A strike on a peg, paddle,
  gate or wheel comes off up to `RATTLE` (0.3 rad) off true, by the race's
  own seeded draw, taken in slot order. Without it, identical marbles
  finished in whatever order the grid and the moving parts' starts put
  them: on First Drop only four slots ever won.
- **Where on the grid still counts for something**, though a pick cannot
  use it, being made before the draw. Over 400 races, slots win 4% to 25%:
  the front of the grid more often on The Chute and The Leap, whose sweeper
  is straight off the start; the back more often on The Tower. The Chute's
  back half wins 12 of its 60 judged races, exactly the fifth the runs test
  allows, where over 400 it is 29%.
- **Marbles stay on the track over a crest.** Only a jump's lip lets one
  leave it; a fast marble over the top of a drop would, in life, fly.
- **Overlap is a solver's business.** Two marbles are parted across the
  channel and then along it for whatever a wall refuses, over as many as
  48 passes (`SETTLE`), which stop as soon as nothing moves by more than
  `MOVED`: a marble merely touching a peg once counted as moved, and a
  settled field ran every pass. A marble a moving part would crush against
  a wall is let out along the piece instead, and one pushed over the line
  has crossed it. A marble cannot drop out of a funnel on to one sat under
  the hole, nor on to one still falling; it waits in the hole. A new piece that pinches the channel
  meets all of this first, and racing every pair is what found each of
  these. Parting a pair shares the correction across the channel by the room
  each has toward its own wall, so that what the walls refuse is not left for
  the run's length to make up.
- **Nothing jumps, but a push still can.** A marble may move no further in
  a step than its own speed and what pushed it explain, give or take a
  quarter of a marble (`JUMP`): the solver reckons it every step, keeps the
  worst since the gate in `Marbles.jumped`, and `checkMarbles` rules on it.
  The funnel's two jumps, into its bowl and out of its hole, were this. A
  push is counted as explained, so a second rule holds what a thing in the
  way may do in one go: half a marble (`SHOVE`), kept per marble in
  `Marbles.shoved` with the piece that did it in `shovedOn`, and ruled on by
  `checkMarbles`. Setting a marble out of something all at once was what
  broke it: a gate's bar slides across its pen at 18 a second, a third of a
  marble in a step, and one caught between the end of it and the wall cannot
  go further across, so it went along — four hops of 0.12 in the one step,
  0.61 back up the run, further than it had come down. A shove is now taken
  as far as it goes and no further, and what is left over is seen to over
  the steps after, by which time the thing has usually gone by of its own
  accord; over every run and catalog piece on 24 seeds no marble is ever
  left sitting inside anything. Measured the same way, the worst single
  shove is now a gate's 0.45, a sweeper's 0.36, a peg's 0.34 and a wheel's
  0.29. What a whole step comes to, a shove and then the settling parting the
  crowd it pressed together, is held by a second ceiling: `HEAVE`, a marble's
  own width, kept per marble in `Marbles.pushed` and ruled on by
  `checkMarbles`. It was the parting that carried one furthest: split evenly
  and clamped to the walls, a marble already on its wall took none of the
  correction across the channel and the run made up for it along its length
  instead, which is the furthest travelling part of settling a crowd. Each of
  a pair now takes what room it has toward its own wall and whatever the
  other cannot, which halves it: the worst step was 1.12 and is 0.80, no
  marble is moved its own width any more (11 marble-steps in 3.3 million
  were), and 35 of those 3.3 million still go past half a marble, all of them
  a field squeezed in a pen or on a board. Holding every push to half a
  marble a step would mean letting marbles sit inside each other by up to
  0.14 where the rule allows 0.05, so it is not done.
  A crowd squeezing into the neck of a gate's pen was the other: held there
  by a shut gate, the whole field spread out across the pen's full width,
  and closing that down to the chute's over the last fifth of the piece
  asked one step to undo all of it at once — seed 19 once shoved a marble
  1.8, twice its own width. The gate's own shape now closes from where the
  gate itself stands (`u`) rather than later, over four times the distance,
  which cuts the worst of it by four in ten without asking less of the pen:
  nothing narrows before the gate, so the field waiting on it is exactly as
  wide as it ever was. It falls short of half a marble because that width
  is what gives some runs their mixing: narrow the pen further and The
  Chute's back half stops winning its one race in five, since the shuffle
  a `/feature` might one day give a narrower pen would need to come from
  somewhere else.
- **Nothing is quite level.** A straight or a curve leans down by a
  twentieth (`LEAN`), as a real run is set up to, so a queue behind a pen
  always drains; a truly level piece let a crowd come to rest on it.
- **A wheel is a gate that turns.** A marble that catches a paddle up is
  held until the paddle lifts out, and those that come close together are
  gathered abreast behind it and let go at once. It stands right across its
  pen, and holds every marble from about half a second to a second and a
  half; over one half of its pen, the field came down the other half after a
  bend and went by untouched. What a marble meets is the arm the scene
  draws: `pose` takes the radius of the ball put to it (`RADIUS`, from the
  solver) and works out where the arm — a rod swung from its axle, rounded
  at the tip — is solid at the height of the marbles' middles, into
  `Pose.radius`. Taken instead as that slice alone, as it was, a paddle was
  not there at all until its tip reached a marble's middle and then was
  there whole, and one coming down where a marble sat shoved it its own
  reach, 0.63, in a single step. The arm takes up more of the pen than the
  slice did, so the axle stands at 1.35 and the arm is 1.81, just long
  enough for the tip to dip to the floor: at 1.1 the true arm pressed a
  crowd into itself over 3,798 frames of 24 seeds out of a gate and into a
  funnel, and at 1.35 none. `test/track.test.ts` holds the arm to the same
  geometry worked out the long way round, a marble's middle against the rod,
  at sixty moments of the turn and eighty places along the chute.
- **The lane at the end is felt and a tilt.** Whatever a marble crosses the
  line at, it is slowed to a crawl (`LANE_PULL / LANE_BRAKE`) and creeps on
  to its place; without the tilt it stopped short of the queue, and
  without the felt it hit the stop at the speed it finished at.
- **Mounds are soft pegs.** A marble on one is pushed down its slope, which
  turns it away from the mound's middle, and is drawn riding over it. Like
  a peg they give each marble the same push from the same place; unlike a
  peg's strike, it is not scattered.
- **Nothing in the way may be missed.** A marble keeps its line through a
  pen, within a chute's width of the middle, and a bend puts a whole field
  on its outside; a thing in the way that does not reach across that
  stream, both sides, is one a layout can make the field miss.
  `test/runs.test.ts` holds every piece with something in the way to
  changing the order it hands the field on in.

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
  dropping out of a funnel on to one below it, and one dropping into a bowl
  on to one going round under the lip
- **stuck:** a marble that settles on it, wedges against it, or circles it
  for ever — a bowl's patience is `BOWL_PATIENCE`, a channel's `PATIENCE`. A
  run that cannot finish has to be noticed and said, not waited on
- **off the run:** off a jump's lip, a marble that comes down wide of the
  channel, short of the landing or beyond everything the lip can reach; it is
  lost, told of, given no place, and the race still ends
- **building:** placed, moved, turned and taken away; placed overlapping
  what is already there, and placed with nothing underneath it; any piece
  after any other, which `test/joins.test.ts` races for every pair, and two
  parts that pass through each other, which `check` refuses. In the
  designer: laid on the end and taken off again, laid after the end, laid
  past a ceiling, a run kept, refused, left unkept, thrown away once kept,
  and a design read back from a save that is not one
- **let go and again:** the run released, stopped part way down, and
  released again from the same seed to the same result, marble for marble
- **save:** saved, reloaded, and loaded from an old save without the field
- **phone:** narrow screen, and a slower GPU: which rung it steps down to
- **another run:** put on part way through a race, and the one before it
  thrown away cleanly; framed to fit the screen, whatever its shape; and put
  back on after a reload
- **the end:** a field lined up in the lane in the order it finished,
  none inside another and none pushed back over the line or a racer pushed
  over it; two crossing the line in one step placed by which crossed first
- **the catalog:** the piece on its own between a start and the end, sound,
  raced home on every seed its test tries, and drawn within budget
- **the players:** a pick before the off, one tried once they are away and
  refused, one let go and its number taken by the next to pick; picks kept
  through a reset and another run; the winner named, or nobody where no
  player had the winning marble or nothing finished

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
