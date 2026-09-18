/**
 * The pace gate: every run's pace, held to what it was.
 *
 *   npm run pace                       the figures, run by run
 *   npm run pace:check                 held to scripts/pace-baseline.json
 *   npm run pace:check -- --update     the baseline written again, after a change meant to move it
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { RUNS } from '../src/runs';
import { CHECK, median, moved, paceRun, round } from './pace';

const BASELINE = 'scripts/pace-baseline.json';

function main() {
  const args = process.argv.slice(2);
  const started = performance.now();
  const figures: Record<string, number> = {};
  let stuck = 0;
  for (const [index, run] of RUNS.entries()) {
    const runs = CHECK.seeds.map((seed) => paceRun(seed, CHECK.races, CHECK.capMinutes, index));
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

main();
