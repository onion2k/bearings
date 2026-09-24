/**
 * A long game played through, watching the things that must not keep
 * growing: the bodies on the floor and the slots they sit in, the save, and
 * the heap.
 *
 * A map that is added to and never emptied does not throw, break a rule, or
 * move any gate's figure. It shows up an hour into a game as a machine that
 * has slowed to a crawl, on somebody else's computer. Nothing else here would
 * ever see it: the fuzzer plays 4,000 frames and the pace gate stops at a few
 * minutes.
 *
 * Every size is held two ways: under a ceiling that says what it could ever
 * reasonably be, and, where marked `steady`, not still climbing by the end —
 * the last third of the run against the middle third, so a size that fills
 * up early and settles is left alone, and one that creeps all the way
 * through is not. A new list, map or cache in the game gets a line in
 * `WATCH` and a reading in `sizes`.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { Autopilot } from '../src/autopilot';
import { Game } from '../src/game';
import { MAX_SLOTS } from '../src/cameras';
import { MAX_DESIGNS } from '../src/designer';
import { Physics } from '../src/physics';
import { MARBLES } from '../src/race';
import { RUNS } from '../src/runs';
import { MAX_PIECES, MAX_SAMPLES, MAX_SEGMENTS } from '../src/track';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

// Rapier, which every race is raced on, loaded once before anything is played
await RAPIER.init();

const DT = 1 / 60;

/**
 * What is watched, and how. Every size has a ceiling: what it could ever
 * reasonably be, not a guess at what the game does now, so tuning does not
 * move it and a leak cannot hide under it.
 */
export const WATCH: Partial<Record<string, { ceiling: number; steady?: boolean }>> = {
  marbles: { ceiling: MARBLES },
  // a camera to a marble at most, and never more however long the screen is split
  'cameras followed': { ceiling: MAX_SLOTS },
  // one world of Rapier's, for the run that is on, and never one left behind by a run that was put away
  'physics worlds': { ceiling: 1 },
  segments: { ceiling: MAX_SEGMENTS },
  samples: { ceiling: MAX_SAMPLES },
  // the save is four fields and has to stay four, however long it is played
  'save fields': { ceiling: 4 },
  // a best for each run there is, the player's own among them, and never one for a run there is not
  'bests kept': { ceiling: RUNS.length + MAX_DESIGNS },
  // the designs a player keeps, which they throw away themselves to keep more
  'designs kept': { ceiling: MAX_DESIGNS },
  // the run being built is its own undo, so it can never hold more than a run may
  'pieces being built': { ceiling: MAX_PIECES },
  // what the save was before designs, and every design as long as a run may be, at the most a piece can take to write
  'save bytes': { ceiling: 2_000 + MAX_DESIGNS * (100 + MAX_PIECES * 64) },
  // the catch-all for what is leaking and has no name here; noisy, so it is given a lot of room
  'heap MB': { ceiling: 300, steady: true },
};

/** Every size worth watching, read off a game as it stands. */
export function sizes(game: Game): Record<string, number> {
  const { marbles, track, progress } = game;
  return {
    marbles: marbles.count,
    'cameras followed': game.cameras.marble.filter((m) => m >= 0).length,
    'physics worlds': Physics.alive,
    segments: track.segments.length,
    samples: track.samples,
    'save fields': Object.keys(progress.save).length,
    'bests kept': Object.keys(progress.save.bests).length,
    'designs kept': progress.save.designs.length,
    'pieces being built': game.designer?.run.pieces.length ?? 0,
    'save bytes': JSON.stringify(progress.save).length,
    'heap MB': Math.round(process.memoryUsage().heapUsed / 1e5) / 10,
  };
}

/**
 * Whether a size is still climbing at the end: the last third of the run
 * against the middle third. `share` and `slack` are what it may drift by
 * without counting, as a share and as a number, so a small size wobbling by
 * one or two is not a leak.
 */
export function grew(series: number[], share = 0.15, slack = 3): boolean {
  if (series.length < 6) return false;
  const third = Math.floor(series.length / 3);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const middle = mean(series.slice(third, third * 2));
  const last = mean(series.slice(-third));
  return last > middle * (1 + share) + slack;
}

/** What is wrong with a run's sizes: over a ceiling, or still growing at the end. */
export function trouble(samples: Record<string, number[]>): string[] {
  const out: string[] = [];
  for (const [key, series] of Object.entries(samples)) {
    const watch = WATCH[key];
    const most = Math.max(...series);
    if (watch && most > watch.ceiling) out.push(`${key} went to ${most}, over its ceiling of ${watch.ceiling}`);
    else if (watch?.steady && grew(series, key === 'heap MB' ? 0.5 : 0.15, key === 'heap MB' ? 20 : 3)) {
      const third = Math.floor(series.length / 3);
      const at = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
      out.push(
        `${key} grew all the way through: ${at(series.slice(0, third))} at the start, ${at(series.slice(third, third * 2))} in the middle, ${at(series.slice(-third))} by the end`,
      );
    }
  }
  return out;
}

export interface LeakOptions {
  seed: number;
  /** Game minutes to play. */
  minutes: number;
}

export interface LeakRun {
  seed: number;
  minutes: number;
  /** Every size, sampled once a game minute. */
  samples: Record<string, number[]>;
  problems: string[];
  /** Real seconds it took. */
  seconds: number;
}

/** Play a long game, sampling the sizes once a game minute, and say what would not stay bounded. */
export function leakRun({ seed, minutes }: LeakOptions): LeakRun {
  const started = performance.now();
  const samples: Record<string, number[]> = {};
  try {
    const game = new Game(RAPIER, new Progress(memoryStore()), {}, { random: seeded(seed) });
    const pilot = new Autopilot(game);
    for (let minute = 0; minute < minutes; minute++) {
      for (let f = 0; f < 3600; f++) pilot.step(DT);
      for (const [key, n] of Object.entries(sizes(game))) (samples[key] ??= []).push(n);
    }
    return { seed, minutes, samples, problems: trouble(samples), seconds: (performance.now() - started) / 1000 };
  } catch (err) {
    return {
      seed,
      minutes,
      samples,
      problems: [`seed ${seed}: threw ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`],
      seconds: (performance.now() - started) / 1000,
    };
  }
}
