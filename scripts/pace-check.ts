/**
 * The pace gate: every run's pace, held to what it was.
 *
 *   npm run pace                       the figures, run by run
 *   npm run pace:check                 held to scripts/pace-baseline.json
 *   npm run pace:check -- --update     the baseline written again, after a change meant to move it
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { RUNS } from '../src/runs';
import { CHECK, type PaceRun, median, moved, paceRun, round } from './pace';

const BASELINE = 'scripts/pace-baseline.json';

/** One seed of one run: what a worker is handed, and what it hands back. */
interface Job {
  run: number;
  seed: number;
}

/**
 * Every run's seeds played on as many threads as the machine has cores to spare, the dearest first: each game is
 * its own seed and its own world, so the figures are the same whatever order they come back in, and the check
 * takes as long as its slowest game rather than all of them end to end, which on physics was five minutes.
 */
async function playAll(): Promise<Map<string, PaceRun>> {
  const jobs: Job[] = RUNS.flatMap((_, run) => CHECK.seeds.map((seed) => ({ run, seed })));
  jobs.sort((a, b) => RUNS[b.run].pieces.length - RUNS[a.run].pieces.length);
  const out = new Map<string, PaceRun>();
  const threads = Math.max(1, Math.min(jobs.length, availableParallelism() - 1));
  let next = 0;
  await Promise.all(
    Array.from({ length: threads }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        const worker = new Worker(new URL(import.meta.url), { workerData: job });
        const played = await new Promise<PaceRun>((done, fail) => {
          worker.once('message', done);
          worker.once('error', fail);
        });
        await worker.terminate();
        out.set(`${job.run} ${job.seed}`, played);
      }
    }),
  );
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const started = performance.now();
  const played = await playAll();
  const figures: Record<string, number> = {};
  let stuck = 0;
  for (const [index, run] of RUNS.entries()) {
    const runs = CHECK.seeds.map((seed) => played.get(`${index} ${seed}`)!);
    figures[run.id] = round(median(runs.map((r) => r.minutes)));
    const each = runs.map((r) => (r.finished ? String(r.minutes) : 'stuck')).join(' ');
    console.log(`${run.name}: ${figures[run.id]} min for ${CHECK.races} races (seeds: ${each})`);
    for (const r of runs.filter((r) => !r.finished)) {
      console.error(`  seed ${r.seed} did not run ${CHECK.races} races on ${run.name} in ${CHECK.capMinutes} min`);
      stuck++;
    }
  }
  console.log(`(${((performance.now() - started) / 1000).toFixed(1)} s)`);
  if (stuck) process.exitCode = 1;
  if (!args.includes('--check')) return;

  if (args.includes('--update')) {
    if (stuck) {
      console.error('not written: fix these first');
      return;
    }
    writeFileSync(BASELINE, `${JSON.stringify(figures, null, 2)}\n`);
    console.log('pace baseline written');
    return;
  }
  let baseline: Partial<Record<string, number>>;
  try {
    baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as typeof baseline;
  } catch {
    console.error('no baseline: run npm run pace:check -- --update first');
    process.exitCode = 1;
    return;
  }
  let out = 0;
  for (const run of RUNS) {
    const was = baseline[run.id],
      now = figures[run.id];
    if (was === undefined) {
      console.log(`pace, ${run.name}: ${now} min, not in the baseline`);
      out++;
      continue;
    }
    const gone = moved(was, now);
    console.log(`pace, ${run.name}: ${was} -> ${now} min (${gone ? 'MOVED' : 'within tolerance'})`);
    if (gone) out++;
  }
  if (out) {
    console.error(
      `\nthe pacing moved beyond tolerance: if that was meant, npm run pace:check -- --update, and say why`,
    );
    process.exitCode = 1;
  }
}

if (isMainThread) await main();
else {
  const job = workerData as Job;
  parentPort!.postMessage(paceRun(job.seed, CHECK.races, CHECK.capMinutes, job.run));
}
