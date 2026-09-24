/**
 * What a test of the race as physics sets up and reads: a run of the test's
 * own, a field on it under physics, a race played through, and a field read
 * as it goes over a piece. Shared by the engine's own tests and the pieces',
 * which are two files so that they run on two workers.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from '../src/physics';
import { MARBLES, RACING, RADIUS } from '../src/race';
import { seeded } from '../src/random';
import { type Facing, type Kind, type Placed, type Run, compile, exitOf } from '../src/track';

await RAPIER.init();

const DT = 1 / 60;

/**
 * The kinds physics races: every one that is no more than a channel, has
 * pegs or mounds fixed in it, a part that moves, or a lip it flies off. The funnel is not among them: what "fed by
 * two drops" tests is the fastest any ONE piece hands a field on at, and a
 * ball off two drops straight into a funnel's bowl, at the extreme end of
 * its swirl, now and then misses the outlet's own catch and free-falls
 * clean past it, which no shipped run risks — every one feeds a funnel
 * gently, off a spiral or a run of its own, and 24 seeds of that loses
 * none. The funnel's own tests are in `physics-pieces.test.ts`.
 */
export const CROSSED: Kind[] = [
  'straight',
  'curveLeft',
  'curveRight',
  'ramp',
  'drop',
  'spiralLeft',
  'spiralRight',
  'shallow',
  'shallowWide',
  'shallowBroad',
  'narrow',
  'brake',
  'pegs',
  'bumps',
  'sweeper',
  'gate',
  'wheel',
  'jump',
];

/** Pieces laid end to end from the lattice's origin, each where the one before hands a marble on. */
export function chain(kinds: Kind[]): Run {
  const pieces: Placed[] = [];
  let here = { x: 0, y: 0, z: 0, facing: 0 as Facing };
  for (const kind of kinds) {
    pieces.push({ kind, ...here });
    const out = exitOf({ kind, ...here });
    if (out) here = out;
  }
  return { id: 'made-up', name: 'made up', pieces };
}

/** A field on a run of the test's own, under physics, with a note of what happens. */
export function fieldOn(run: Run, seed = 1) {
  const told: string[] = [];
  const track = compile(run);
  const race = new Physics(
    RAPIER,
    track,
    {
      released: (n) => told.push(`released ${n}`),
      finished: (m, place, s) => told.push(`finished ${m} ${place} ${s.toFixed(2)}`),
      stalled: (m) => told.push(`stalled ${m}`),
      lost: (m) => told.push(`lost ${m}`),
    },
    { random: seeded(seed) },
  );
  return { race, track, told };
}

/** The field let go and the race played to its end, or for `cap` seconds; how many frames it took. */
export function raced(race: Physics, cap = 60) {
  race.release();
  let f = 0;
  for (; f < cap * 60 && !race.over; f++) race.step(DT);
  return f;
}

/** How far a ball's underside stands off the floor of the segment it is on, read from the nearest sample's own frame. */
export function offFloor(race: Physics, i: number): number {
  const seg = race.track.segments[race.segment[i]];
  const k =
    Math.min(seg.arc.length - 1, Math.max(0, Math.round((race.along[i] / seg.length) * (seg.arc.length - 1)))) * 3;
  return (
    seg.ups[k] * (race.x[i] - seg.points[k]) +
    seg.ups[k + 1] * (race.y[i] - seg.points[k + 1]) +
    seg.ups[k + 2] * (race.z[i] - seg.points[k + 2]) -
    RADIUS
  );
}

/** Whether another racing ball is abreast of `i`: on the same segment, within a ball's width along and off to one side. */
function abreast(race: Physics, i: number): boolean {
  for (let j = 0; j < race.count; j++)
    if (
      j !== i &&
      race.state[j] === RACING &&
      race.segment[j] === race.segment[i] &&
      Math.abs(race.along[j] - race.along[i]) < RADIUS * 2 &&
      Math.abs(race.across[j] - race.across[i]) > RADIUS
    )
      return true;
  return false;
}

/** Kendall's tau between two orders of the same marbles: 1 the same order, 0 no relation, -1 the other way round. */
export function tau(a: number[], b: number[]): number {
  let same = 0,
    other = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) {
      const k = Math.sign(a[i] - a[j]) * Math.sign(b[i] - b[j]);
      if (k > 0) same++;
      else if (k < 0) other++;
    }
  return (same - other) / Math.max(1, same + other);
}

/**
 * A field raced over `kinds` on `seeds` seeds, with how far the order it
 * left segment `off` in follows the order it reached segment `on` in: what a
 * piece with something in the way does to a field's order, the same measure
 * `test/runs.test.ts` holds every such piece in a shipped run to.
 */
export function mixed(kinds: Kind[], on: number, off: number, seeds: number) {
  let follows = 0,
    judged = 0,
    home = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const { race } = fieldOn(chain(kinds), seed);
    const onAt = new Float64Array(MARBLES).fill(-1),
      offAt = new Float64Array(MARBLES).fill(-1);
    race.release();
    for (let f = 0; f < 45 * 60 && !race.over; f++) {
      race.step(DT);
      for (let i = 0; i < MARBLES; i++) {
        const s = race.segment[i];
        if (onAt[i] < 0 && s >= on) onAt[i] = race.t;
        if (offAt[i] < 0 && s >= off) offAt[i] = race.t;
      }
    }
    const all = [...Array(MARBLES).keys()];
    if (all.every((i) => onAt[i] >= 0 && offAt[i] >= 0)) {
      follows += tau(
        all.map((i) => onAt[i]),
        all.map((i) => offAt[i]),
      );
      judged++;
    }
    home += race.finishers;
  }
  return { kept: follows / Math.max(1, judged), home, of: seeds * MARBLES };
}

/**
 * A field raced over `kinds` on `seeds` seeds, with the mean speed it goes on
 * to segment `on` at and leaves it at, and what share leave it abreast of
 * another: what a piece does to a field, read on the piece after it.
 */
export function through(kinds: Kind[], on: number, seeds: number) {
  let inAt = 0,
    outAt = 0,
    n = 0,
    pairs = 0,
    home = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const { race } = fieldOn(chain(kinds), seed);
    const seen = new Int8Array(MARBLES);
    race.release();
    for (let f = 0; f < 45 * 60 && !race.over; f++) {
      race.step(DT);
      for (let i = 0; i < MARBLES; i++) {
        if (race.state[i] !== RACING) continue;
        if (seen[i] === 0 && race.segment[i] === on) {
          seen[i] = 1;
          inAt += race.speed[i];
        }
        if (seen[i] === 1 && race.segment[i] === on + 1) {
          seen[i] = 2;
          outAt += race.speed[i];
          n++;
          if (abreast(race, i)) pairs++;
        }
      }
    }
    home += race.finishers;
  }
  return { in: inAt / n, out: outAt / n, pairs: pairs / n, home, of: seeds * MARBLES };
}

/**
 * A splitter's two lanes, each carrying `kind`, closed by a joiner right
 * after: the fork lane begins a lattice cell across from the main one, and a
 * kind that keeps its facing hands the same offset on from either, so the
 * joiner lines up with both at once. The layout `joins.test.ts` races under
 * the solver.
 */
export function branched(kind: Kind): Run {
  const start: Placed = { kind: 'start', x: 0, y: 0, z: 0, facing: 0 };
  const splitter: Placed = { kind: 'splitter', ...exitOf(start)! };
  const main = exitOf(splitter)!;
  const mainPiece: Placed = { kind, ...main };
  const forkPiece: Placed = { kind, ...main, y: main.y + 1 };
  const joiner: Placed = { kind: 'joiner', ...exitOf(mainPiece)! };
  const after: Placed = { kind: 'straight', ...exitOf(joiner)! };
  const finish: Placed = { kind: 'finish', ...exitOf(after)! };
  return { id: 'split', name: kind, pieces: [start, splitter, mainPiece, forkPiece, joiner, after, finish] };
}

/** The kinds a branch can carry: a chute wide, and not turning. */
export const ON_A_BRANCH: Kind[] = [
  'straight',
  'ramp',
  'drop',
  'jump',
  'wheel',
  'shallow',
  'shallowWide',
  'narrow',
  'brake',
];

/**
 * A moment for the test's worker to answer Vitest between one race and the
 * next: a test that races for most of a minute without one kept Vitest's own
 * calls to the worker waiting past their timeout, which it reports as an
 * error of the run even with every test passing.
 */
export const breathe = (): Promise<void> => new Promise((done) => setImmediate(done));
