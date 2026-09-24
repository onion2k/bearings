/**
 * How long a frame of the race takes, held to what it took before.
 *
 *   npm run bench              measure, and fail if any scenario has moved by more than the tolerance, either way
 *   npm run bench -- --update  write what it takes now as the new baseline
 *
 * Two scenarios: eight marbles racing the first run, which is what an
 * ordinary busy frame is; and eight racing the Stress Test, which is the
 * dearest. A game adds a scenario for each way its frames get costly.
 *
 * A time on one machine is not a time on another, or on the same one with
 * something else running. So each scenario is held to the baseline as a
 * multiple of a fixed piece of arithmetic, timed just before and just after
 * each run, which goes faster and slower with the machine much as the game
 * does: a baseline written on one machine means something on another, and
 * on this one as it warms. Each scenario is run several times, fresh, in a
 * worker of its own, and the run that counts is the one that took least
 * against its reference, since noise only ever makes a run slower. Each is
 * run for long enough that its time is well clear of the timer's grain: a
 * frame of the race costs about a third of a millisecond. The milliseconds
 * are reported too.
 *
 * It holds both ways, as every baseline here does: a race gone faster is
 * written into the baseline, so that giving the speed back later is seen.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { readFileSync, writeFileSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { Autopilot } from '../src/autopilot';
import { Game } from '../src/game';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { STRESS } from '../src/runs';
import { TOLERANCE, bestRatio, judge } from './benching';

// Rapier, which every race is raced on, loaded once before anything is played
await RAPIER.init();

const BASELINE = 'scripts/bench-baseline.json';
/** How many times each scenario is run: four let a slow moment through often enough to wobble the figure by a tenth. */
const RUNS = 8;
const DT = 1 / 60;

interface Result {
  /** Milliseconds a frame, the fastest run. */
  ms: number;
  /** That against the reference arithmetic. */
  relative: number;
  /** Milliseconds the reference took, the fastest time. */
  ref: number;
  /** How many marbles were still racing at the end, to show the scenario did what it says. */
  awake: number;
  live: number;
}

interface Scenario {
  name: string;
  frames: number;
  /** The game as the timing starts, and what one timed frame of it is. */
  setup: () => { game: Game; frame: () => void };
}

/** A game from a seed, with its field on the gate. */
function settled(seed: number): Game {
  const game = new Game(RAPIER, new Progress(memoryStore()), {}, { random: seeded(seed) });
  for (let f = 0; f < 180; f++) game.step(DT);
  return game;
}

const SCENARIOS: Scenario[] = [
  {
    name: 'eight marbles racing',
    // about three races back to back, set up again between them as a player would: one race was too short a time
    // to measure steadily, and the figure wobbled by a sixth
    frames: 3000,
    setup: () => {
      const game = settled(1);
      game.release();
      // a little way in, so the first race is timed with the field spread out on it and not queued on the gate
      for (let f = 0; f < 60; f++) game.step(DT);
      const pilot = new Autopilot(game);
      return { game, frame: () => pilot.step(DT) };
    },
  },
  {
    name: 'eight marbles racing the Stress Test',
    // the dearest frame there is: the longest run, its hundred pieces the most for a ball to be near, and every
    // kind of moving part at once. A field waiting on the gate was the other scenario, until physics held a waiting
    // field as bodies fixed in place, which cost too little for any timer to see
    frames: 1500,
    setup: () => {
      const game = settled(1);
      game.pick(game.list.findIndex((r) => r.id === STRESS.id));
      game.release();
      for (let f = 0; f < 60; f++) game.step(DT);
      const pilot = new Autopilot(game);
      return { game, frame: () => pilot.step(DT) };
    },
  },
];

/**
 * The reference: typed-array arithmetic of the physics' own kind, a pass of
 * springs over a grid of points, the same work every time.
 */
function reference(): number {
  const n = 200_000;
  const x = new Float32Array(n),
    v = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.sin(i * 0.37) * 3;
  const t = performance.now();
  for (let pass = 0; pass < 40; pass++) {
    for (let i = 1; i < n - 1; i++) {
      const f = x[i - 1] + x[i + 1] - 2 * x[i];
      v[i] = v[i] * 0.99 + f * 0.1;
    }
    for (let i = 0; i < n; i++) x[i] += Math.sqrt(v[i] * v[i] + 1e-6) * Math.sign(v[i]) * 0.01;
  }
  return performance.now() - t;
}

function measure(s: Scenario): Result {
  let awake = 0,
    live = 0;
  // the reference warmed up first, so its first times are not the compiler's
  for (let k = 0; k < 3; k++) reference();
  const best = bestRatio(RUNS, reference, () => {
    const { game, frame } = s.setup();
    const t = performance.now();
    for (let f = 0; f < s.frames; f++) frame();
    const ms = (performance.now() - t) / s.frames;
    const { marbles } = game;
    awake = 0;
    for (let i = 0; i < marbles.count; i++) if (marbles.state[i] === 1) awake++;
    live = marbles.count;
    return ms;
  });
  return { ms: best.ms, relative: best.ratio, ref: best.ref, awake, live };
}

if (!isMainThread) {
  const { index } = workerData as { index: number };
  parentPort!.postMessage(measure(SCENARIOS[index]));
} else {
  await main();
}

async function main() {
  const update = process.argv.includes('--update');
  const results: Result[] = [];
  // one at a time, so no scenario is timed while another runs beside it
  for (let index = 0; index < SCENARIOS.length; index++) {
    results.push(
      await new Promise<Result>((resolve, reject) => {
        const worker = new Worker(new URL(`file://${process.argv[1]}`), { workerData: { index } });
        worker.once('message', resolve);
        worker.once('error', reject);
      }),
    );
  }

  if (update) {
    const out = Object.fromEntries(
      SCENARIOS.map((s, k) => [
        s.name,
        { relative: results[k].relative, ms: round(results[k].ms), ref: round(results[k].ref) },
      ]),
    );
    writeFileSync(BASELINE, `${JSON.stringify(out, null, 2)}\n`);
    SCENARIOS.forEach((s, k) => console.log(`${s.name}: ${line(results[k])}`));
    console.log('baseline written');
    return;
  }

  let baseline: Partial<Record<string, { relative: number; ms: number }>>;
  try {
    baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as typeof baseline;
  } catch {
    console.error('no baseline: run npm run bench -- --update first');
    process.exitCode = 1;
    return;
  }
  let moved = 0;
  SCENARIOS.forEach((s, k) => {
    const now = results[k],
      was = baseline[s.name];
    if (!was) {
      console.log(`${s.name}: ${line(now)}, not in the baseline`);
      moved++;
      return;
    }
    const change = now.relative / was.relative - 1;
    const verdict = judge(was.relative, now.relative);
    if (verdict !== 'within tolerance') moved++;
    console.log(
      `${s.name}: ${line(now)}, ${change >= 0 ? '+' : ''}${(change * 100).toFixed(0)}% on the baseline (${verdict === 'within tolerance' ? verdict : verdict.toUpperCase()})`,
    );
  });
  if (moved) {
    console.error(
      `\n${moved} scenario${moved === 1 ? '' : 's'} moved from the baseline by more than ${TOLERANCE * 100}%: if that was meant, npm run bench -- --update, and say why`,
    );
    process.exitCode = 1;
  }
}

function line(r: Result): string {
  return `${r.ms.toFixed(4)} ms a frame (${r.relative.toPrecision(3)} of the reference), ${r.awake} of ${r.live} racing`;
}

function round(n: number): number {
  return Math.round(n * 100000) / 100000;
}
