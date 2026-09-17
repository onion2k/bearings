# Bearing

A marble run game. You build the run — ramps, funnels, chutes, whatever the
run has — and then you let a marble go and watch. Once it is rolling you do
not touch it: gravity and the shape you built are the whole of the game, and
a run that works is one you got right before you let go.

Built on [artshape-render](https://github.com/onion2k/artshape-render) and
[artshape-physics](https://github.com/onion2k/artshape-physics): TypeScript,
Vite and WebGPU, in the browser, on the machine's own GPU.

## Where it is

The game itself has not been built yet. What runs today is the template's
stub — a sled on a walled floor, a dozen balls and a hole in the middle —
kept because it exercises every gate below at the size of one thing. It
gives way one feature at a time through `/feature`, and the first thing to
go is the content in `src/arena.ts`. `CLAUDE.md` says how.

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
    npm run look           what it looks like, held to a picture
    npm run check          all of it

One fuzzer action, one invariant, one watched size, one bench scenario, one
pace figure, one saved shape in `test/saves/`, one picture, one stage in the
play-through, and one perf figure each for boot, frame and download. Each is
a model for the next.

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

    src/game.ts        the game without the picture
    src/main.ts        the page: events into words, the frame drawn
    src/debug.ts       window.game, the test API
    src/invariants.ts  what must always hold
    src/autopilot.ts   the game played by itself, for the gates
    src/arena.ts       content: the floor, the hole, the balls
    src/progress.ts    the save, and where it is kept
    src/physics.ts     the game's side of artshape-physics
    src/scene.ts       the arena as it is drawn
    src/sled.ts        the player's machine
    scripts/           the gates, each with its baseline beside it
    test/              unit tests, and a corpus of every save shape
    smoke/             Playwright: boots, drives, plays through, looks right

Taken from the [artshape game template](https://github.com/onion2k/artshape-game-template)
in September 2026.
