# Bearing: working on it

A marble run game: up to eight players each pick one of eight marbles, the
field is let go down a run, and whoever picked the winner wins.
TypeScript, Vite, and WebGPU through
[artshape-render](https://github.com/onion2k/artshape-render). The README
says what the game is; this file says how it is made. The house rules in
`~/.claude/CLAUDE.md` apply too.

The marbles are balls in Rapier (`@dimforge/rapier3d-compat`), in
`src/physics.ts`: nothing acts on one after the gate opens but gravity, the
air and what it touches, and what a rule might have done the pieces do by
their shape. The race rode a track solver of the game's own until it crossed
over to Rapier in six parts (`~/.claude/plans/rapier-in-six.md`), all
landed; the spike that decided it is on branch `spike/rapier`, and the solver
is in the history before it went. The template came with artshape-physics,
whose floor is flat tiers, one height a tile, and a marble run is nothing but
slopes.

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
| Download, scripts and styles gzipped                | 1200 kB                        | `perf`       |
| A frame drawn, lower quartile, on every run         | 8 ms                           | `perf`       |
| The race, a frame, against the reference arithmetic | baseline ± 15%                 | `bench`      |
| Pace, each run's minutes to see ten races through   | baseline ± 20%, run by run     | `pace:check` |
| Anything kept: marbles, track, save, heap           | ceilings in `scripts/leaks.ts` | `leaks`      |

A budget is what the game may cost at all; a baseline is what it cost at
the last commit, held both ways, so a step toward a budget is noticed as
much as a step over it. The perf tolerances are the measured wobble of a
headless boot and a GPU frame, and say so in the file. The download was 400
until the race crossed over to Rapier, a megabyte of WASM in a chunk of its
own, fetched at the start of every boot while the GPU starts: accepted for
what real physics buys, and the budget is what that leaves. A frame of the
race costs about 0.35 ms, the Stress Test's 0.41.

## Commands

    npm run dev            the game at http://localhost:5198
    npm run check:quick    formatting, types, lint, unit tests but test/races/ (the pre-commit hook; ~25 s)
    npm run test:runs      test/races/: every kind raced over 24 seeds, every pair of kinds, and every run judged over 60 races (~4 min)
    npm run check          all of it: check:quick, test:runs, fuzz, determinism, leaks, pace, bench, smoke with perf and look (~6.5 min)
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
- `src/physics.ts` is the race itself: every marble a ball in a Rapier
  world, the track met as a mesh built from the very samples the scene draws,
  and each moving part a body driven toward its clock by a motor of limited
  strength. Where each ball is on the track (`segment`, `along`, `across`)
  is read back from its position every step, for the cameras, the board and
  the rules. `src/track.ts` works a run of pieces out into that track — the
  lattice, the kinds of piece, the segments with their frames, how wide each
  is at every sample, what stands on it and where its clock has it (`pose`),
  and what may be wrong with a run. Neither takes anything from the
  renderer, so the same run is drawn, raced and measured from one working
  out.
- `src/main.ts` is the page. It turns events into words on the board, puts
  a run on from the arrows either side of its name, frames each run to fit
  the screen whatever its shape, and draws the frame. There is no game logic
  here. `src/scene.ts` sweeps the channel along the track's own samples, as
  wide as the track says at each; turns each funnel's bowl from the height
  the marbles roll on; stands the pegs; and places the marbles and, every
  frame, the sweepers, gates and wheels where the race says they are
  (`Race.where`), so what is drawn is what a marble hits.
- `src/race.ts` is what a race is to everything that is not the engine
  racing it, and the facts every part shares: how many marbles, how big one
  is, gravity, the air, and what a marble can be doing. `Game` is handed
  Rapier, loaded, as its first argument, by whoever wires it up: the page at
  its boot, and Node in a test or a script.
- `src/cameras.ts` is the split screen's cameras, one to every picked
  marble, without the screen.
- `src/decor.ts` is what a run is dressed with when it names a theme — lamps,
  pipes, cogs, chimneys and the rest of a works — worked out from the run's
  own track, where each thing stands and nothing about how it is drawn.
- `src/designer.ts` is a run the player builds, a piece at a time, and the
  designs they keep: what may go on the end, what is refused outright, and
  what a design read back from a save has to be before it is put on.
- `src/debug.ts` is `window.game`, the test API. `src/invariants.ts` lists
  the rules that must always hold. `src/autopilot.ts` plays the game by
  itself, for the gates.
- Content is `src/runs.ts`, the runs that come with the game;
  `src/catalog.ts`, every kind of piece named, said what it does and set
  between a start and the end, for the board's second shelf; and
  `src/field.ts`, what the eight marbles are called and look like: a colour,
  a shine, and a pattern in a second colour. A run's
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

- **On the run: a marble.** A ball in `physics.ts`, a body in the world
  with its reading on the track kept in typed arrays; stepped by `game.ts`,
  drawn by `scene.ts` with its look from `field.ts`, its rules in
  `Physics.check` and `invariants.ts`, read by `marbles()` in `debug.ts`,
  hashed in `scripts/determinism.ts`, counted in `scripts/leaks.ts`, and
  pictured in `smoke/look.spec.ts`. One kind of thing, eight places, and a
  new thing on the run goes to all of them. Each marble's look is a colour,
  a shine and a pattern (`Look.pattern`): a swirl, bands, marbling or
  speckle in a second colour, each kind on two marbles, drawn by
  artshape-render from where on the ball a fragment is, so it turns as the
  ball rolls. `Scene.patterns` hands them to the renderer sized to the
  marble (`1 / RADIUS`); only the marbles' group carries patterns, and every
  other group draws through a build of the shader with no pattern code in
  it. Held by `test/field.test.ts`, the renderer's own `patterns.gpu.test.ts`,
  and `field.png`, all eight close up.
- **A kind of piece:** `src/track.ts`. A kind is one line in `SHAPES` — where
  it hands a marble on, the curve it follows, and what a real ball asks of
  it — and every path over the kinds gets it for nothing, because they are
  a `Record<Kind, Shape>` and not a switch anyone can forget to add to. A
  piece may be two parts (`then`), each its own segment, so that it joins
  whatever is either side of it: a jump is its run-up, which `flies` off a
  lip, and its own landing board beyond the air; a funnel is a run in that
  `flies` off a lip over its bowl, then the bowl, whose rim's wall stands as
  high as the lip, so that whatever comes off it at whatever speed comes
  down inside, and then a ramp of its own under the hole, which a marble
  falls through the bowl's `throat` on to and is carried off down, a cell
  beyond the hole and a level below. A board is the same plus `width`; pegs
  and moving parts are `obstacles`, each with a `Motion` that `pose` turns
  into where its clock has it at a moment, from a phase the race draws from
  its seed; a funnel is `bowl`; lumps in a floor are `mounds`; a V for a
  floor is `trough`; a ceiling is `lid`; walls higher than a chute's are
  `wall`. No channel is narrower than a chute, and every one is a chute's
  width wherever one piece meets another. A new kind needs an entry in
  `CATALOG` too, which the compiler insists on; the catalog's test then
  races it by itself, and `test/races/physics-pairs.ts` races it after and before
  every other kind there is, fed from the gate and off two drops. `check`
  refuses a run whose parts pass through each other. Copy that shape for
  anything the game has several of.
- **A branch in the track: the splitter and the joiner.** The one place
  `compile` is a graph and not a line: a splitter's own segment carries
  `fork` — `a` and `b`, its two lanes — in place of the one `next` every
  other segment has, and the segments either side of it carry `branch`, a
  lane tag that keeps the rules from reading two balls on separate lanes as
  touching just because their `far` — cumulative length along the run —
  happens to overlap while the lanes run in parallel. A joiner's second
  entry is matched to the splitter's own fork lane by position, the same way
  every other piece's entry is. The lanes need not be the same length: a
  ball arrives when it arrives, and each lane leans at its own rate
  (`branchLean`) so that both reach the joiner at one height: at the one
  rate, the longer arrived 0.28 lower, and The Fork's field stopped against
  the step. Lanes of 34 and 56 units raced home 192 in 192, and
  `test/races/physics-lanes.test.ts` holds three such layouts. A piece is
  reached a second time only through a joiner's own second entry; a lane that
  runs into anything the other lane has walked already is left a dead end and
  said to come back round on itself, since wiring it on left a gap and two
  ideas of how far along the run the piece was. Where the two lanes overlap, a wall of one that would stand
  inside the other is left open (`Segment.open`, `openWalls`), met and drawn
  so; where their floors overlap, lying a hair apart at the two lanes' own
  leans, only the first lane's is drawn, the second lane's floor cut in
  `LANE_STRIPS` strips across and those lying in the first left out
  (`inLane`), since the one poking through the other showed as a wedge
  (`test/scene-lanes.test.ts`), and they part at the crotch where their inner walls meet, as a real Y
  does. Both are shown together on the catalog's shelf (`CATALOG`'s `laid`,
  an `Entry` field that lays a shelf piece out by hand instead of chaining
  `among`, since neither piece means anything alone). A kind at a chute's
  width that keeps its facing can stand on a branch — proven by placing the
  same kind on both, `test/races/physics-branches.ts` — but a kind wider than the
  cell a splitter opens between its lanes cannot, which `check` refuses
  rather than racing them through each other. A lane may turn, climb down
  and wind as it likes, so long as it ends beside the other, going the same
  way, where the joiner's two entries are.
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
  draw a view, the dressing and its lamps with it: about 1.7 ms at eight
  views on First Drop, against 0.6 whole, in the perf spec.
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
  **Lanes:** a splitter opens two ends (`ends`: the right lane's, from
  `exitOf`, and the left's, `leftOf` it), and the player chooses which the
  next piece goes on (`choose`, `Game.lane`, `lane()` in the test API, the
  board's Left lane and Right lane, shown only while a split is open). One
  split at a time, and the end only once the lanes are joined, so there
  are never more than two ends to choose between. A joiner is offered once
  one lane ends a cell to the left of the other, level and going the same
  way, and goes on the right-hand one whichever lane is chosen; until then
  `apart` says how they differ, in the player's terms. The undo is a stack
  of what was open and chosen before each piece (`before`), so taking a
  piece off chooses the lane it came off. A gold cone stands over the end
  the next piece goes on (`Scene.mark`, `marker`, the renderer's group 4),
  only while building: it is a few hundred pixels, under what the look gate
  forgives, so `test/scene-marker.test.ts` holds where it stands. Held by
  `test/designer.test.ts` and `test/designer-lanes.test.ts`, the invariants
  (no design id twice, none over the cap, nothing let go down a run being
  built, never more than two ends, the next piece on one of them, a lane
  chosen only with two), the fuzzer's `design` action, which stays at the
  builder three times in four while it is there, since one that wandered
  off after every piece never kept a run, and its `splitter`, `lane` and
  `lanes` — the last the same pieces laid on both lanes and joined, since
  laid at random two lanes all but never end side by side —
  `'designs kept'` and `'pieces being built'` in `scripts/leaks.ts`,
  `test/saves/04-designs.json` and `06-lanes.json`, two stages in
  `smoke/progress.spec.ts`, the `designer`, `design`, `designer-phone`,
  `designer-lanes` and `designer-lanes-phone` pictures, and the frame of a
  design being built and raced in the perf spec. On a phone the palette is
  one row that scrolls sideways, so the builder stands no taller than the
  board over a race. Every click checks the whole run again and compiles it
  once a kind to know what to refuse: about 10 ms at a hundred pieces, on a
  click and never a frame. A row of themes, Plain and Industrial, dresses
  the run being built (`Designer.dress`, `Game.dress`); see the dressing.
- **The dressing:** a run that names a theme (`Run.theme`: `'industrial'`,
  a works, or `'sweets'`, a sweet factory; plain written as nothing at all)
  is dressed by `dress` in `src/decor.ts`, from its own track and nothing
  else. A `Site` holds what every theme places by — the room checks, the
  supports, the ground, the box, the spreading along the run — as rules
  that take the kind and its shape: `stripes`, `lamps`, `alongWall`,
  `onWall`, `againstWall`, `legs` and `stand`. A theme is one function
  calling them, chosen by `DRESSERS: Record<Theme, …>`, and its kinds are
  `THEME_KINDS[theme]`, every kind in one theme only; the scene draws each
  kind from a `Record<DecorKind, …>` too, so the compiler refuses a theme
  or a kind with nothing to place or draw it by. A sweet factory's kinds
  take the place of a works' and are placed by the same rule, so their room
  is the room already tested: lollipop lamps (the lamps, lit pink, `LIGHTS`),
  candy stripes (the stripes), gumdrops (every other piece, where pipes go
  on every fourth), whisks (the cogs), candy-cane posts (the girders: one smooth tube each, which may be
  stretched along its length since its normals point straight out from its
  axis, striped by the renderer's swirl scaled by its length so the stripes
  climb as fast whatever its height; built as geometry they read as a
  checkerboard and cost nearly a million triangles on a tall run), giant
  lollipops swirled by the renderer's pattern (the chimneys), pots of fudge
  steaming pink (the chimneys' smoke, lower: `SMOKES`, `POT_STEAM`),
  cupcakes (the tanks), and candy-cane arches over the channel (`arches`,
  every third piece where the lamps are not, a chain of tubes whose stripes
  carry on round it: each tube's seed turns the swirl by as far along the
  chain as it begins). A theme has a world too (`WORLDS`): a sweet factory's
  pale blue sky, a daylight environment for what it reflects, and toon
  shading (`shading: 'toon'`, artshape-render 0.18's `look.shading` and
  `post.tone = 'clamp'`): lit in three flat bands at every candy's own
  colour and shown straight, where the physically based light took a
  quarter of each colour, added the sky's light grey over it and ran it
  through a filmic curve that pulled it all to mauve; and no vignette; `main.ts` applies it at every rebuild,
  and `sky()` in the test API reads it. The works and plain keep the dark.
  A world also colours the track (`World.track`, `TrackColours`: `STEEL`
  for the works and plain, `CANDY` for a sweet factory, a lilac floor
  deeper than a pastel since toon light at full colour washes a pale one to
  white, cream walls and trim, white grids and pink pegs); the channel is
  swept twice, its floor edges and the rest apart (`FLOOR_OF_PROFILE`,
  `FLOOR_OF_TROUGH`), which draws the steel track exactly as before. Each
  light has its own strength (`LIGHTS`): a lollipop's is a fifth of a works
  lamp's and hangs well under its sweet, which a works lamp's strength blew
  out white. By a sweet factory's run: arches every other piece where no
  lamp is, placed before the gumdrops so those give way to their posts,
  gumdrops on every piece a chute wide, and small lollipops stood beside the
  walls every third piece (`standingLollipop`). A sweet factory's backdrop (`backdrop`, `SCENERY`, `FLAT`) is a pink
  ground and a river under everything, frosted mountains in pastel bands,
  rounded at the top as a scoop of ice cream is (`revolved`, `hillOf`), with
  sprinkles on their frosting and the donuts' icing, castle towers with
  swirled roofs and a rounded rim, chocolate kisses for trees, clouds, and donuts, pretzels and cakes
  strewn just past the run in proportion to its reach, all from a chance
  seeded by the run's own shape. It is held by `sceneryClear` and a rule:
  nothing nearer the run's middle than its reach and 6, and no top over a
  line rising 0.6 from the run's lowest point past its reach, under the
  0.73 the framing camera looks down at, so none of it can stand between
  the camera and the run however far back it is. The Tower and The Leap are sweet factories, the other six works. A works:
  lamps on poles with an arm over the channel, copper pipes along a wall,
  meshing cogs on one, pistons pumping beside one, hazard stripes low on the
  walls where the field is let go, something moves and the race is won,
  girders under the pieces, and brick chimneys and painted tanks standing
  on a ground two units under the run's lowest point. There is no floor: a
  girder's leg stands on the wall or grid of whatever is below it, reaches
  the ground where nothing is, and is left out where it would come down
  into an open channel or a bowl. Every thing is tried against every channel
  before it stands (`inTheWay`), what is fixed to a wall keeping outside the
  wall's own skin and what stands on its own keeping 0.7 off any, 3 back
  from any bowl, since a chimney beside one stood between the camera and the
  field, and inside the run's box (`boxOf`, moved to `track.ts` so the
  dresser need not reach into the scene), so framing and the sun's shadow
  are as they were; a chimney has room for its smoke all the way up
  (`smokeAt`). Where a thing will not fit it is left out, so a run that
  folds tight is dressed less and never dressed through itself. `MOST` caps
  each kind — twelve lamps, which are lights, and the renderer has sixteen,
  one of them the light over the whole run. Nothing is met by a marble: the
  race is compiled and raced from the pieces alone, and a test races a
  design dressed and plain to the same result, marble for marble. The
  shipped runs name the theme and keep their ids; the catalog's pieces are
  plain. `Game.decor` is the run on's dressing, worked out whenever a run is
  put on. `Scene.decor` draws what stands still merged into a few meshes a
  colour, `animate` places the cogs, the pistons' rods and the puffs of
  smoke where the game's clock has them (`game.t`, so a paused game stands
  still and a picture is the same every run), and `main.ts` hangs a warm
  light under each lamp's shade. Smoke is the renderer's sprites
  (`setSprites`, from artshape-render 0.17): soft translucent puffs placed
  by `puffOf` from the clock each frame, thickening as they leave the
  chimney and thinning as they rise and swell, and not its particles, which
  move only when a frame is drawn, so a test that steps and draws once
  would never see them move. Given up with the particles on the ladder's
  rung. A puff is tried for room as a ball `SMOKE_THICK` of its size across
  (`smoke.png`). Girders were
  a million triangles on the Stress Test in fine bays and are coarse on
  purpose. Held by `test/decor.test.ts` — above all that no point over any
  drawn surface, standing or moving, is where a marble can be, sampled
  across every triangle and judged by the sample each channel is squarest
  to, since high on a tall wall round a tight bend a sample's frame reaches
  past its neighbour's; the stripes are a band low on the wall for the same
  fold — and `test/decor-designs.test.ts`, the invariants (nothing on a plain
  run, no more of a kind than `MOST`, every thing by a segment of the run on
  and within reach of it), the fuzzer's `dress`, `'things dressed'` in
  `scripts/leaks.ts`, `test/saves/07-themes.json`, a stage in
  `smoke/progress.spec.ts`, and the `works`, `works-lamp` and
  `designer-works` pictures, besides every picture of a shipped run. About
  6 kB of download, 8 ms of boot, and 0.1 ms a view of the split screen.
- **The race:** `Physics` in `src/physics.ts`, a `Race`, with nothing
  acting on a ball after the gate opens but gravity, the air and what it
  touches: the air's drag, `DRAG`, is a share of the speed squared on every
  ball alike, and gives a top speed of `TERMINAL`, falling straight down; no
  felt, no nudge, no clamp, and `put` is refused once they are away. The
  track is met as a mesh built from the very samples the scene draws: the
  lean taken into the geometry (`LEAN`, `leanTrack`, a twentieth, so a queue
  on a level piece always drains), walls `WALL` high, and each triangle
  wound to face the side a ball meets it from, since with Rapier's
  `FIX_INTERNAL_EDGES` a ball passes through a triangle's back: the bowl's
  floor was once wound facing down, and a ball that struck it went straight
  through, which read for a whole part of the plan as a fast ball thrown wide
  of the funnel's way out (`test/meshes.test.ts`). A block stood on the
  track is turned by a frame of along, up by along, and up — a rotation; as
  along, along by up, and up, a mirror, its quaternion was not of unit
  length and Rapier met a block that was not the one placed, and a queue
  pressed through the lane's end (a test holds every collider to a unit
  quaternion). A ball is held fixed on the gate until the off, since the
  gate's own slope would set it going; the gate holds the field in a
  zigzag, each row's second a half space behind its first, since level rows
  down a mirror-symmetric run arrive as mirror-symmetric pairs. Balls grip
  the track at 0.3 and each other at next to nothing (`SLIP`, 0.02, with
  Rapier's `Max` rule): a crowd pressed into a neck stands as an arch on the
  friction between its balls, the way a hopper jams, and at 0.3 gates and
  wheels fed fast stopped a field; with none at all, no queue in the lane
  ever came to rest. Where a ball is on the track (`segment`, `along`,
  `across`, for the cameras, the board and the rules) is read back each step
  from the nearest sample of its own segment or its neighbours, how high it
  is over its floor measured along the floor's own up; a ball whose position
  runs past the end of its segment is on the next one, and goes back a
  segment only if it is behind the join by that segment's own measure too,
  since at a join that turns downward there is a sliver past the end of one
  and short of the start of the other. `check` rules on a ball faster than
  the air allows, one read off its piece or outside its channel, one into
  the floor or through a grid, two inside each other, and the tallies. The
  world is one of Rapier's own memory, let go of by `dispose` when another
  run is put on, and `'physics worlds'` in `scripts/leaks.ts` holds it to
  one. A lost ball is held fixed where it fell out: left to fall it fell
  for ever, faster than the air allows. How far into its floor a ball may
  read as sitting before `check` calls it through, `FLOOR_GIVE`, is 0.15,
  where a cone's point or a mound's crest meets an angled strike: measured
  up to 0.128 over 48 seeds each, with nothing else wrong. Rapier is
  deterministic on this machine, to the bit, held by `npm run determinism`
  and a test; across machines it is not verified. Each kind is raced alone
  on 24 seeds (`test/races/physics-slopes.test.ts`, `-boards`, `-obstacles`,
  `-moving`, `-funnel`, the rules checked every five frames), again fed by
  two drops, the fastest any one piece hands a field on at
  (`test/races/physics-fed-first.test.ts` and `-second`), held to what each is for
  in `test/physics-pieces.test.ts`, and every pair of kinds raced both ways
  (`test/races/physics-pairs.ts`); the racing is in `test/races/`, run by
  `npm run test:runs` in the full check and not by the hook; `test/physics-helpers.ts`
  sets a field on a run of a test's own, and `mixed()` there is how far a
  field's order after a piece follows its order before it. The tests are
  split across many files so that they race on the machine's cores, a long
  one yields to Vitest between races (`breathe`), and Vitest's own timeout
  is thirty seconds (`vitest.config.ts`).
- **What a funnel is:** its bowl (`bowlMesh`, the very mesh `scene.ts`
  turns for drawing) is a trimesh collider of its own, not part of the
  channel mesh; a peg is a cone collider stood on the floor; and mounds are
  met as the very shape they are drawn as, the floor's own mesh sampled
  across as often as it is along (`channelMesh`'s `cols`). Falling through a
  funnel's hole and down its throat is a drop no `Segment` represents: a
  ball can read as nowhere near any segment's own line while it falls, so
  `inThroat` gives it up to a second of grace from the last time it was
  genuinely on the bowl or the segment its hole hands on to, four times what
  landing ever took; a ball still reading wrong once that runs out is off
  the run for real.
- **Parts that move:** each sweeper's paddle and gate's bar is a body on a
  prismatic joint across its piece, and each wheel a body on a revolute
  joint at its axle, its four paddles one body, each joined to a fixed
  anchor, built in `Physics.build` and parked where its clockwork has it at
  the off (`park`). A slide's motor is set every substep toward where `pose`
  has it, its force capped (`SLIDE_FORCE`); a wheel's motor turns at its
  pace, pushing in proportion to how far behind it is (`WHEEL_GRIP`). So a
  ball caught between a part and a wall holds the part back rather than
  being crushed, and the part catches up once the ball is out:
  `test/races/physics-yield.test.ts` and `-yield-wheel` hold each to that. A part
  meets balls and nothing else (Rapier's collision groups, `TRACK`, `BALL`
  and `PART`), since a gate slides aside into its wall and a sweeper's ends
  swing through theirs. `Race.where` is where a part really is, and the
  scene draws it there. A wheel's paddles are polished: one coming down on
  a ball closes a wedge on it against the floor only a quarter-turn from
  flat, which a ball squirts out of only if the paddle grips it less than
  about 0.27. The gate's bar stands halfway down its piece (`GATE_AT`) and
  its pen closes from the bar on, since a crowd let go from a standstill
  into a neck over the ramp's flattening end arched as a hopper does; the
  wheel's pen closes from 0.7 (`WHEEL_CLOSE`) for the same arch, and its
  walls stand 2.4 (`WHEEL_WALL`), since it can have no grid and a fast field
  meeting a paddle was thrown over walls of 1.2.
- **What a real ball asks of a shape:** every crest launches a ball at
  speed: a ball stays on a crest of radius `r` only below `sqrt(GRAVITY r)`,
  5 for the drop, 7 for the ramp and 10 for a shallow, and a drop alone
  hands a field on at 13, two drops at 22. So the drop, the ramp and the
  first half of a jump's run-up are under a **grid** (`Part.lid`,
  `Segment.lid`): a ceiling from wall top to wall top in the mesh, a rule in
  `check` that no ball is through it, and bars along and rungs across in
  `scene.ts`. So is every board with something on it — pegs, bumps, the
  sweeper and the gate — at the walls' own height: what stands on a board
  throws a fast ball up as well as aside, as much as 2.6 over the floor, and
  walled higher it arrived at the next piece above that piece's walls; under
  a grid, nothing leaves higher than a chute's walls, and bouncing between
  board and grid shuffles a field. The **spirals** are walled 1.8
  (`SPIRAL_WALL`): off a drop a ball rides the outer wall 1.3 high; banking
  the floor made it worse, since a wall square to a banked floor leans
  outward. The **narrow** is a groove, a V a chute wide (`trough`), closing
  in over its first stretch and flat again over its last: a neck barely a
  ball wide arches as a hopper does, and a groove that met the next piece as
  a V handed a ball on 0.8 up its side. The **brake** is a board's fall with
  the channel snaking from wall to wall (`brakeCurve`, `BRAKE_SWING` 0.6
  every `BRAKE_WAVE` 8), the honest way to take speed off, since a ball has
  no rolling resistance: a field at 18.5 leaves it at 11.9. A **peg** is a
  cone, `PEG_CONE` wide at its foot, `PEG_SPACING` (2.4) apart in four
  staggered rows: a ball came to rest against a post, and a gap narrower
  than two balls wedged two abreast. The **jump** is a run-up, a lip and a
  landing, with no felt: a ball reaches the lip at 13 to 19 whatever it came
  in at and clears the cell of air every time. The pictures are
  `physics-ramp.png`, `physics-drop-brake.png`, `physics-pegs-bumps.png`,
  `physics-grid.png` and `physics-fork.png`.
- **A grid a run asks for:** `Placed.lid`, a piece placed with a grid over
  it from end to end (`compile`'s `covered`, a bowl excepted), met as a
  ceiling at the walls' height. Any piece but a jump, a funnel or a wheel
  (`LIDLESS`, `lidRefused`, said by `check` in the player's terms): a jump's
  field flies over its walls, a funnel's drops into its bowl from over them,
  and a wheel's paddles turn up through where a grid would be. The
  designer's Grid button, beside Undo, puts one over the last piece laid or
  takes it off (`Designer.lid`, `refusesLid`, `Game.lid`, `lid()` in the
  test API, which reads them back as `designer().lids`). Written only where
  it is asked for, so every older save loads as it was; `readDesigns` takes
  `true` and nothing else, and `test/saves/05-lids.json` is the shape. On
  the catalog's shelf after the kinds (`piece-grid`, not a kind). Held by
  `test/lid.test.ts`, the fuzzer's `lid`, a stage in `smoke/progress.spec.ts`,
  and `physics-grid.png`.
- **The end of the run:** `finish` is the line and a cup behind it, a V a
  chute wide under a grid, eased down a level and up half of one again to
  level at its end (`cup`, its bottom where both halves curve alike), with a
  solid block at its end (`LANE_STOP`). Which segment the run ends at is
  `finishOf`, the race's and the scene's alike: the one handing on to nothing
  that does not fork, and not the last in the list, which on a run with a
  split is a lane's, and drew the line and the stop across it where it
  joined the other (`test/scene-finish.test.ts`). Nothing of a finish is
  drawn where a run does not end in one (`Track.finished`), so a run being
  built shows no line or stop at its open end. A marble is placed as it crosses, by
  which crossed first in the step, and comes to rest in the cup, not always
  in the order it finished, since two may sit abreast in a V. Under a grid
  because balls that barely grip each other pass a knock down a queue at
  rest as a Newton's cradle does, and fed off three drops 23 in 192 at the
  front were sent up the rise and out.
- **A shelf of runs:** `Game.shelf` and `browse`. The runs are raced,
  counted and kept; the pieces from the catalog are put on the same way
  but nothing raced on them is counted or saved.
- **The players:** `Game.players`, a player number for each marble, picked
  by `claim` before the off and read by `champion` after it; kept from race
  to race and never saved. Ruled on in `invariants.ts`, read by `marbles()`
  and `state()` in `debug.ts`, done by the fuzzer's `claim`, shown on the
  board by `main.ts`, and pictured in `board.png` and `won.png`.
- **A run:** a list of placements with an id, in `src/runs.ts`. Every run is
  held by `test/runs.test.ts` — sound, and worked out the same way twice —
  and judged in the full check over 60 races (`test/races/physics-judged.ts`, a
  file a run): every marble home in every one, none lost, none stopped, no
  rule broken; a race, not a procession, the grid telling little of who
  wins (Kendall's tau of grid against finish within ±0.4) and the back half
  of the grid winning between a fifth and four fifths; and nothing in its
  way — pegs, mounds, moving parts or a funnel — that the field goes by
  unchanged (kept at most 0.85). Paced on its own
  by `pace:check`. A new run is a new entry and a judged file, and then the
  gates hold it. A run rebuilt enough to change its races gets a new id, so
  a best set on the old one is not held against the new; the game drops
  bests for ids it no longer has, which is why every run took a new id when
  the race became physics. The Stress Test's hundred pieces (every kind,
  `MAX_PIECES`'s own ceiling) are folded into a box with turns — a
  lawnmower's own rows, stepping a level further down each turn — so that
  it frames like any other run. And a piece with something in the way only
  reorders a field that meets it bunched and spread across it: a field
  strung out over seconds passes a board one ball at a time, and one in
  single file along a bend's outside wall strikes the cones alike, identical
  balls in one line coming off in the same order. Switchback's second peg
  board kept the order it was handed at 0.93 for the second reason and is a
  sweeper now; the Stress Test's late peg and bumps boards kept it at 0.93 to
  1.00 for the first and are plain wide shallows, its bumps and pegs moved to
  the head of the run, where the field is still bunched off the gate.
- **Tools:** the fuzzer (`scripts/fuzzer.ts`), the pace gate
  (`scripts/pace.ts`, its games played on worker threads by
  `pace-check.ts`) and the race bench (`scripts/bench.ts`, its arithmetic in
  `scripts/benching.ts`). Each has unit tests of its own working parts, and
  the fuzzer's reload is tried against a save that forgets, in
  `test/fuzz-reload.test.ts`, since a correct save never makes it fire. The
  bench was blind to a race five times slower until it was made to fail one
  on purpose, and on physics it was made to fail twice the substeps; a gate
  is trusted once it has been seen to fail what it is for.
- **Test helpers:** `newGame(seed)` and `race(game)` in `test/helpers.ts`,
  which load Rapier once and hand it in; `memoryStore` in `src/progress.ts`
  for a save that is not the player's; `fieldOn`, `chain`, `branched` and
  `mixed` in `test/physics-helpers.ts`; and `Physics.meddle`, the one lever
  a test has on a ball once it is away: lift it, set its speed, or put it
  where another is.

## What comes next

Eight runs race, up to eight players pick a marble each, and a player can
build and keep runs of their own, and the race is physics, every gate
green. Open: **determinism across machines** is not verified — Rapier is the
same to the bit on this machine, and has not been run on a second.

After that, each through `/feature`: more themes, each a `Theme`, its
kinds in `THEME_KINDS`, a dresser in `DRESSERS` and a drawing a kind in the
scene. A designer that places
a piece anywhere on the lattice was weighed and turned down: building on the
end is simple, and lanes were all it lacked. And what holds of the race as
it stands:

- **The marbles are all the same, and are treated so.** No marble has form
  or any other property of its own: every ball is the same size, the same
  weight and the same grip. Where each starts is drawn at the off, after the
  picks, so a pick is one in eight whatever the run favours.
- **The chance is in the draw and the contact.** The grid is drawn from the
  race's seed, and so is where each moving part is in its turn; after that,
  it is balls meeting cones, mounds, paddles, bars, grids and each other.
  There is no rule scattering a strike; a board under a grid shuffles a
  field by bouncing it between the two.
- **Nothing is quite level.** Every piece leans down by a twentieth
  (`LEAN`), taken into the geometry, so a queue on a level piece drains.
- **Nothing in the way may be missed.** A ball keeps its line through a pen,
  within a chute's width of the middle, and a bend puts a whole field on its
  outside; a thing in the way that does not reach across that stream, both
  sides, is one a layout can make the field miss.

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
  fastest a marble gets anywhere on the run, which is two drops in front of
  it; never passed through, however fast it arrives; every triangle facing
  the side a ball meets it from, and every block turned by a rotation
- **a join:** where it meets the piece above and the piece below, both ways
  round, fed from the gate and off two drops; a seam a marble catches on, a
  gap it drops through, a crest it leaves the floor at, and a ball arriving
  above the next piece's grid or walls
- **many marbles:** a train of them nose to tail, a clump of three pressed
  together, and one pinned on a wall by another; a pile held at a gate; all
  eight at once (`MARBLES`), and what it costs a frame at that many
- **in the way of it:** a peg hit dead on, and a marble rolled square on to
  one's crown; a moving part met at every point of its turn (the phase is
  the seed's), and one that would crush a marble against a wall; a marble
  dropping out of a funnel on to one below it, and one dropping into a bowl
  on to one going round under the lip
- **stuck:** a marble that settles on it, wedges against it, arches with
  others across a neck, or circles it for ever — a ball crawling for
  `PATIENCE` is called stopped. A run that cannot finish has to be noticed
  and said, not waited on
- **off the run:** off a jump's lip, a marble that comes down wide of the
  channel, short of the landing or beyond everything the lip can reach; it is
  lost, told of, given no place, and the race still ends
- **building:** placed, moved, turned and taken away; placed overlapping
  what is already there, and placed with nothing underneath it; any piece
  after any other, which `test/races/physics-pairs.ts` races for every pair, and two
  parts that pass through each other, which `check` refuses. In the
  designer: laid on the end and taken off again, laid after the end, laid
  past a ceiling, a run kept, refused, left unkept, thrown away once kept,
  and a design read back from a save that is not one; laid on either lane of
  a split, the lanes joined at different lengths, a joiner laid before they
  end side by side, one lane run into the other, and the joiner taken off
  again
- **let go and again:** the run released, stopped part way down, and
  released again from the same seed to the same result, marble for marble
- **save:** saved, reloaded, and loaded from an old save without the field
- **phone:** narrow screen, and a slower GPU: which rung it steps down to
- **another run:** put on part way through a race, and the one before it
  thrown away cleanly; framed to fit the screen, whatever its shape; and put
  back on after a reload
- **the end:** a field come to rest in the cup, none inside another, none
  sent out of it by a knock down the queue, and none pushed back over the
  line or a racer pushed over it; two crossing the line in one step placed
  by which crossed first
- **the catalog:** the piece on its own between a start and the end, sound,
  raced home on every seed its test tries, and drawn within budget
- **the dressing:** nothing drawn where a marble can be, standing or
  moving, on the piece and on any piece passing over or under it; a new
  kind of piece dressed in a run and in the catalog's own test; a run
  dressed, made plain and dressed again, kept, and read back from a save
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
