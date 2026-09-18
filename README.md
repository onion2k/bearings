# Bearing

A marble run game for up to eight players. Eight marbles wait on the gate at
the top of a run; each player picks one, you let them go, and whoever picked
the winner wins. It is a roll of a die and not a bet: the marbles are all
the same, and where each starts is drawn as the gate opens, after the picks,
so every pick is one chance in eight on every run. Once they are rolling
nobody touches them, and the pegs, gates and paddles on the way decide it.
To come: the runs you build yourselves.

Built on [artshape-render](https://github.com/onion2k/artshape-render):
TypeScript, Vite and WebGPU, in the browser, on the machine's own GPU. The
marbles ride a track solver of the game's own rather than a general physics
engine, because a marble in a chute only ever needs to know how far along it
is and how far across.

## Playing it

Tap a marble on the board, or press its number, **1** to **8**, to pick it
for the next player without one: the first to pick is P1, the next P2. Pick
it again to let it go. **Space** lets the field go, and the board says who
won; **R** puts it back on the gate, and everyone keeps their marble for the
next race until they change it. **C**, or the tabs over the run's name,
turns the board to the catalog of pieces and back. The arrows
either side of the run's name on the board choose another run, as does
**N**, and under the name is your best on it. Drag to go round the run, and
the wheel to go nearer. The board keeps the order as it stands, and the
times once they are home.

## Where it is

Five runs, each its own kind of race, and on every one something that
breaks a field up, since a chute alone is single file and finishes in the
order the grid set: **peg boards** that knock a marble off its line;
**sweepers** that swing across a board; **gates** that hold a pen and slide
open from one wall, then the other; a **paddle wheel** right across its pen
that holds back every marble that comes under it; and a **funnel**, where
the field circles a bowl until each marble is slow enough to drop through
the hole. The runs:
**First Drop**, a peg board and a gate between long drops; **The Chute**, a
sweeper and a gate and over in five seconds; **The Tower**, a gate, three
turns of a spiral and a funnel at its foot; **The Leap**, two jumps, the
first on to a peg board; and **Switchback**, twenty pieces of drops, turns,
pegs and a wheel. Where a marble starts on the grid tells little of where it
finishes. Every run ends in a lane one marble wide, where the field rolls up
and waits in the order it came home.

The catalog shows every kind of piece on its own, named and said what it
does, and each can be raced by itself. Besides those on the runs, there are
shallow straights at a chute's width and opening to two and three times it,
a narrow section that squeezes the field to single file, and a bumpy board
whose mounds turn a marble aside as it rolls over one. Any piece can follow
any other: a jump carries its own felt, lip and landing, and a funnel its
own run down to its bowl, so every pair joins, and every pair is raced. The game remembers which run you last played and your best on
each. Still to come, a feature at a time through `/feature`: building a run
of your own, and patterns on the marbles. `CLAUDE.md` says how the code is
made and what is open.

## What is here

Five decisions made in the first commit, because each is cheap on day one
and dear to retrofit:

- **The game runs without the page.** `src/game.ts` knows nothing of the
  renderer or the DOM, so it is stepped headless in Vitest and in every
  script. `src/main.ts` presents it.
- **Chance comes from one seeded source.** `Game` is handed a `random` and
  never touches `Math.random`. The same seed gives the same game, which is
  what the fuzzer's replays, the determinism check and every baseline rest
  on. A marble run is worth nothing if the same run can go two ways.
- **Time is stepped.** A fixed step, and `pause()` and `step(n)` on the
  test API, so no test waits on a clock.
- **A test API on `window.game`**, typed, that the smoke tests compile
  against. Everything a test needs to set a scene and read it back.
- **A file of always-true rules**, `src/invariants.ts`, checked by the
  fuzzer after everything it does.

And every gate at n=1, the three properties among them:

    npm run check:quick    formatting, types, lint, unit tests (the pre-commit hook)
    npm run fuzz           a monkey plays it, and the rules are checked
    npm run determinism    the same seed played twice, hashed
    npm run leaks          a long game, watching what must stay bounded
    npm run pace:check     how it plays, held to a baseline both ways
    npm run bench          what the physics costs a frame, held to a baseline
    npm run perf           boot time, a frame's cost and the download, held to a budget and a baseline
    npm run smoke          the real thing in headless Chromium on the GPU
    npm run look           what it looks like, held to its pictures
    npm run check          all of it

They came at the size of one thing each and have grown with the race: four
things the fuzzer does, as a player can — let them go, set up again, put
another run on, reload — the rules for the track, the marbles, the places
and the save, two bench scenarios, a pace figure for every run, three saved shapes in
`test/saves/`, five pictures, and one play-through with a stage for
everything a player reaches.

The line every change goes down is in `CLAUDE.md`: a spec agreed, tests
seen failing, the change built, every gate run, the result looked at, a
report with evidence, then a commit. A red gate stops the line until it is
fixed, and no baseline is moved to make it green.

## What comes with it

Four skills in `.claude/skills`, so the practice travels with the repo:
`/feature` to build one, spec and tests first; `/bug` to fix one,
reproduction first; `/gate-moved` for when a baseline moves; `/commit` for
the house style. `.claude/settings.json` lets the repo's own checks run
without asking.

## Running it

    npm install
    npm run dev      the game at http://localhost:5198
    npm run check    every gate, about twenty seconds

The smoke tests take port 5199 for a server of their own, so `npm run dev`
can stay up while they run.

## Layout

    src/game.ts        the game without the picture: a run, a field, a race
    src/marbles.ts     the race itself: marbles riding the track
    src/track.ts       a run of pieces worked out into the track they ride
    src/main.ts        the page: events into words, the frame drawn
    src/scene.ts       the channel swept along the track, and the marbles placed
    src/debug.ts       window.game, the test API
    src/invariants.ts  what must always hold
    src/autopilot.ts   the game played by itself, for the gates
    src/runs.ts        content: the runs that come with the game
    src/field.ts       content: the eight marbles, their names and looks
    src/progress.ts    the save, and where it is kept
    scripts/           the gates, each with its baseline beside it
    test/              unit tests, and a corpus of every save shape
    smoke/             Playwright: boots, races, plays through, looks right

Taken from the [artshape game template](https://github.com/onion2k/artshape-game-template)
in September 2026.
