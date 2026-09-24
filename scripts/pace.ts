/**
 * How each run paces, played by the autopilot: how many game minutes it takes
 * to see ten races through on it, over a few seeds, held to a baseline both
 * ways and run by run. Quicker is as much a change as slower: a run that got
 * faster has changed as surely as one that got slower, and on a different
 * run from the one anybody was working on is exactly where it goes unseen.
 *
 * `pace-check.ts` runs it: `npm run pace` for the figures, `npm run
 * pace:check` to hold them, `-- --update` to write the baseline again.
 *
 * Each figure is a median over the seeds, so one odd race does not move it,
 * and the tolerance is a fifth: wide enough for the wobble between seeds,
 * which was measured before it was chosen, and tight enough to catch a run
 * made twice as fast.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { Autopilot } from '../src/autopilot';
import { Game } from '../src/game';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

// Rapier, which every race is raced on, loaded once before anything is played
await RAPIER.init();

const DT = 1 / 60;
/**
 * The seeds and races each figure is taken over, and how long a seed may take before it is called stuck. The
 * cap is twice the slowest seed seen: Switchback's ten races took up to 6.1 minutes over seeds 1 to 16 once
 * its pegs, wheel and pens were in, and a cap under that calls a slow seed stuck when it is not. The Stress
 * Test's hundred pieces moved the slowest seen to its own ten races taking up to 20.79 minutes, folded into
 * a box of turns rather than run straight out — a turn costs a field more time than a straight the same
 * length, so the fold that let it fit on a screen also made it slower. Raced as physics, it takes up to
 * 24.47 minutes for its ten.
 */
export const CHECK = { seeds: [1, 2, 3, 4], races: 10, capMinutes: 50 };
/** How far the figure may move from the baseline, as a share of it, before the check fails. */
export const TOLERANCE = 0.2;

export interface PaceRun {
  seed: number;
  /** Game minutes to see the races through, or the cap if it never did. */
  minutes: number;
  finished: boolean;
}

/** One game from a seed, on the run given, played until the races are run or the time is up. */
export function paceRun(seed: number, races = CHECK.races, capMinutes = CHECK.capMinutes, run = 0): PaceRun {
  const game = new Game(RAPIER, new Progress(memoryStore()), {}, { random: seeded(seed) });
  // the first run is on already; putting it on again would draw its field twice, and change every seed's race
  if (run !== game.run) game.pick(run);
  const pilot = new Autopilot(game);
  const frames = capMinutes * 3600;
  for (let f = 0; f < frames; f++) {
    pilot.step(DT);
    if (game.progress.save.races >= races) return { seed, minutes: round(game.t / 60), finished: true };
  }
  return { seed, minutes: capMinutes, finished: false };
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

/** Whether a figure has moved from its baseline beyond the tolerance, either way. */
export function moved(was: number, now: number, tolerance = TOLERANCE): boolean {
  return Math.abs(now - was) > Math.abs(was) * tolerance;
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}
