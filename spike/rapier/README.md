# The race in Rapier: a spike

Whether a marble run can be a physics simulation — Rapier 3D, a real engine,
in place of the game's own track solver — and what it would take. `spike.ts`
races the game's runs in Rapier and in the solver on the same seeds, judged on
the runs test's own measures. Nothing in `src/` knows this is here.

    npm run spike:rapier                  every run, 24 seeds each
    npm run spike:rapier -- the-leap-4    one run
    SEEDS=12 FELT_TO=1.8 MU=0.3 npm run spike:rapier

## What was built

The channel as a triangle mesh from the track's own samples — floor, walls
and lips — with the solver's twentieth of lean baked into the geometry. Pegs
as capsules. A funnel's bowl, rim wall and throat as a surface of revolution.
A sweeper and a wheel as dynamic bodies on motored joints, pulled toward
where the game's own `pose` would have them, so a jammed wheel slows rather
than crushing a ball; a gate that lifts rather than slides. Balls with the
solver's own quadratic drag on the track and none in the air, a jump's felt
that sets their spin as well as their pace, and a nudge for a ball sat still
against a peg for half a second. Four substeps a frame.

## What was found, 24 seeds a run

| Run          | Home of 192 | Lost | Winner's time, Rapier vs solver | A frame |
| ------------ | ----------- | ---- | ------------------------------- | ------- |
| Switchback   | 192         | 0    | 29.8 s vs 22.3                  | 0.21 ms |
| The Crossing | 186         | 5    | 10.4 vs 10.0                    | 0.19    |
| The Tower    | 181         | 11   | 22.6 vs 18.5                    | 0.18    |
| The Chute    | 180         | 12   | 6.4 vs 4.9                      | 0.19    |
| First Drop   | 178         | 12   | 15.0 vs 10.4                    | 0.19    |
| The Leap     | 161         | 27   | 15.2 vs 12.5                    | 0.16    |
| The Fork     | 125         | 67   | 4.5 vs 5.2                      | 0.17    |
| Stress Test  | 25          | 163  | —                               | 0.18    |

The solver gets every marble home on every run at 0.007 ms a frame. How much
the grid decides the finish comes out about the same in both.

- **Cost is no object:** 0.16–0.21 ms a frame against a budget of 8, and the
  same result twice on the same machine. Cross-machine determinism is not
  verified.
- **The download is:** the WASM is 749 kB gzipped and its glue 26, or
  1,053 kB with the WASM inlined, against a budget of 400 for the whole game,
  which downloads 59 today.
- **Without drag** a ball on the baked-in lean ran away to 140 a second and
  flew off the first bend. With the solver's quadratic drag it peaks where
  marbles do.
- **Kinematic moving parts were every throw:** a bar or paddle of infinite
  mass pinning a ball against a wall, the very crush the solver has a rule
  for. Motored dynamic parts fixed Switchback outright.
- **The jump's shape assumes the solver.** Its run-up is a hump, a dip and
  then the lip; at 15 a real ball leaves the hump, lands in the dip and
  loses a quarter of its speed, and falls short. Extending the felt over the
  dip, standing in for a better run-up, took The Leap from 22 home to 161.
  Any piece with a convex crest — a drop most of all — wants reshaping.
- **Pegs on a gentle board** hold a ball square behind them; the solver
  breaks that tie by the grid, and the spike nudges the ball.
- **Branches** want a merged mesh: the walls left off the shared stretch
  serves The Crossing and loses balls on the short, fast Fork.
- **The Stress Test** still throws balls on its bends at 126 a second, a pop
  not yet found.

## What it would mean

A rebuild of the race, not a swap: `marbles.ts` and everything on it, the
jump and the drop reshaped, merged meshes for branches, every run retuned for
the pace real friction gives it, and a download of about 800 kB gzipped. In
return, real banking, tumbling and bouncing, moving parts that push back
when jammed, and pieces that cannot exist today.
