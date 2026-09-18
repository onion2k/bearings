# Bearing

A marble run game. Eight marbles wait on the gate at the top of a run; you
let them go, and the run decides it. Once they are rolling nobody touches
them — gravity and the shape of the run are the whole of it — so what a
player brings is the choice of run and, to come, the marble they back and
the runs they build themselves.

Built on [artshape-render](https://github.com/onion2k/artshape-render):
TypeScript, Vite and WebGPU, in the browser, on the machine's own GPU. The
marbles ride a track solver of the game's own rather than a general physics
engine, because a marble in a chute only ever needs to know how far along it
is and how far across.

## Playing it

**Space** lets the field go, **R** puts it back on the gate, **N** puts the
next run on. Drag to go round the run, and the wheel to go nearer. The board
keeps the order as it stands, and the times once they are home.

## Where it is

The race runs, on two runs: First Drop, six levels down with three turns,
and The Chute, over in a few seconds. Still to come, a feature at a time
through `/feature`: more runs and a way to choose them, backing a marble,
building a run of your own, and patterns on the marbles. `CLAUDE.md` says
how the code is made and what is open.

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
and the save, two bench scenarios, two saved shapes in `test/saves/`, two
pictures, and one play-through with a stage for everything a player reaches.

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
