/**
 * What the game costs a player, held to a budget and to what it cost
 * before: how long it takes to boot, what a frame costs to draw at the
 * standard view, and how much is downloaded. The budget is what a good
 * browser game may cost at all; the baseline is what this one cost at the
 * last commit, so a step toward the budget is noticed as much as a step
 * over it.
 *
 *   npm run perf               the figures, held to smoke/perf-baseline.json and the budget
 *   npm run perf:update        the baseline written again, after a change meant to move it
 *
 * The boot and the frame are this machine's, headless on its own GPU, and
 * both wobble from run to run; the tolerances were set by running it several
 * times first, and the frame is the lower quartile of many. The download is
 * the built bundle, gzipped, and does not wobble at all.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { start, watch } from './game';

const BASELINE = 'smoke/perf-baseline.json';
/**
 * What the game may cost at all, on this machine, whatever it cost before.
 * Three quarters of a megabyte of the download is Rapier, which the race is
 * crossing over to a piece at a time: accepted, for what real physics buys,
 * and the budget is what that leaves.
 */
export const BUDGET = { bootMs: 3000, frameMs: 8, bundleKb: 1200 };
/**
 * How far a figure may move from the baseline before it is a change: a share,
 * and a slack for the noisy ones. A slack has to be as wide as the whole of a
 * figure's wobble, not half of it, because `perf:update` writes one run and
 * that run can land anywhere in the spread; a narrower slack holds only if
 * the baseline happened to land near the middle. The frame here, a little
 * under a millisecond of a machine that draws this scene with ease, has run
 * anywhere from 0.3 to 1.3 ms with nothing changed, over some thirty runs
 * across a day, so its slack is that spread: 1 ms, against a budget of 8.
 */
const TOLERANCE = { bootMs: [0.35, 250], frameMs: [0.3, 1], bundleKb: [0.1, 2] } as const;

interface Figures {
  bootMs: number;
  frameMs: number;
  bundleKb: number;
}

/** The built game's download: every script and stylesheet in dist/, gzipped, in kilobytes. */
function bundleKb(): number {
  execFileSync('npx', ['vite', 'build', '--logLevel', 'silent'], { stdio: 'ignore' });
  const dir = 'dist/assets';
  let bytes = 0;
  for (const f of readdirSync(dir)) {
    if (!/\.(js|css)$/.test(f)) continue;
    if (!statSync(join(dir, f)).isFile()) continue;
    bytes += gzipSync(readFileSync(join(dir, f))).length;
  }
  return Math.round(bytes / 102.4) / 10;
}

test('draws every run within budget, whole, with the field racing down it', async ({ page }) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await start(page, { seed: 11, paused: true });
  const content = await page.evaluate(() => window.game!.content());
  for (let i = 0; i < content.runs.length; i++) {
    // put on as a player puts it on, so framed as a player first sees it, then let go and part way down
    const frame = await page.evaluate(async (n) => {
      const g = window.game!;
      g.pick(n);
      g.release();
      g.step(120);
      return g.measureFrame();
    }, i);
    console.log(`perf: ${content.runs[i]}, frame ${Math.round(frame * 100) / 100} ms`);
    expect(frame, `${content.runs[i]} within budget`).toBeLessThanOrEqual(BUDGET.frameMs);
  }
  expect(problems).toEqual([]);
});

test('draws the screen split in four and in eight within budget, with every marble racing', async ({ page }) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await start(page, { seed: 11, paused: true });
  const [whole, four, eight] = await page.evaluate(async () => {
    const g = window.game!;
    g.release();
    g.step(120);
    const whole = await g.measureFrame();
    g.reset();
    for (const m of [0, 1, 2, 3]) g.claim(m);
    g.split(true);
    g.release();
    g.step(120);
    const four = await g.measureFrame();
    g.reset();
    for (let m = 0; m < 8; m++) g.claim(m);
    g.release();
    g.step(120);
    return [whole, four, await g.measureFrame()];
  });
  const ms = (n: number) => Math.round(n * 100) / 100;
  console.log(`perf: split, frame ${ms(four)} ms in four and ${ms(eight)} ms in eight, against ${ms(whole)} ms whole`);
  expect(four, 'the four-way split within budget').toBeLessThanOrEqual(BUDGET.frameMs);
  expect(eight, 'the eight-way split within budget').toBeLessThanOrEqual(BUDGET.frameMs);
  expect(problems).toEqual([]);
});

test('draws a run being built, and a design raced, within budget', async ({ page }) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await start(page, { seed: 11, paused: true });
  const [building, raced] = await page.evaluate(async () => {
    const g = window.game!;
    g.build();
    // every kind that moves, as many of each as a run may have, among boards and turns: the most a design can ask of a frame
    const kinds = ['ramp', 'sweeper', 'curveLeft', 'gate', 'pegs', 'wheel', 'curveRight', 'bumps', 'drop'] as const;
    for (let i = 0; i < 27; i++) g.lay(kinds[i % kinds.length]);
    g.lay('finish');
    g.step(2);
    const building = await g.measureFrame();
    const refused = g.keep('Busy');
    if (refused.length) throw new Error(refused.join('; '));
    g.release();
    g.step(120);
    return [building, await g.measureFrame()];
  });
  const ms = (n: number) => Math.round(n * 100) / 100;
  console.log(`perf: a design, frame ${ms(building)} ms being built and ${ms(raced)} ms raced`);
  expect(building, 'a run being built within budget').toBeLessThanOrEqual(BUDGET.frameMs);
  expect(raced, 'a design raced within budget').toBeLessThanOrEqual(BUDGET.frameMs);
  expect(problems).toEqual([]);
});

test('draws a piece raced under physics within budget', async ({ page }) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await start(page, { seed: 11, paused: true, physics: true });
  const [engine, frame] = await page.evaluate(async () => {
    const g = window.game!;
    g.browse('pieces');
    g.pick(g.content().catalog.indexOf('Ramp'));
    g.release();
    g.step(60);
    return [g.engine(), await g.measureFrame()] as const;
  });
  expect(engine).toBe('physics');
  console.log(`perf: physics, frame ${Math.round(frame * 100) / 100} ms with the field racing`);
  expect(frame, 'a race under physics within budget').toBeLessThanOrEqual(BUDGET.frameMs);
  expect(problems).toEqual([]);
});

test('boots, draws and downloads within budget, and as it did before', async ({ page }, info) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  const bundle = bundleKb();
  await start(page, { seed: 11, paused: true });
  const boot = await page.evaluate(() => window.game!.bootMs);
  // the standard view: the field away and spread down the run, seen from the look picture's camera
  const frame = await page.evaluate(async () => {
    const g = window.game!;
    g.release();
    g.step(120);
    g.look(15, 17, -11, { azimuth: 0.9, polar: 0.95, radius: 56 });
    g.step(1);
    return g.measureFrame();
  });
  const now: Figures = { bootMs: Math.round(boot), frameMs: Math.round(frame * 100) / 100, bundleKb: bundle };
  info.annotations.push({ type: 'perf', description: JSON.stringify(now) });
  console.log(`perf: boot ${now.bootMs} ms, frame ${now.frameMs} ms, download ${now.bundleKb} kB`);

  if (process.env.PERF_UPDATE) {
    writeFileSync(BASELINE, `${JSON.stringify(now, null, 2)}\n`);
    console.log('perf baseline written');
  } else {
    let baseline: Partial<Figures> = {};
    try {
      baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Partial<Figures>;
    } catch {
      throw new Error('no baseline: run npm run perf:update first');
    }
    const moved: string[] = [];
    for (const key of ['bootMs', 'frameMs', 'bundleKb'] as const) {
      const was = baseline[key];
      if (was === undefined) {
        moved.push(`${key} ${now[key]} (not in the baseline)`);
        continue;
      }
      const [share, slack] = TOLERANCE[key];
      const out = Math.abs(now[key] - was) > Math.max(Math.abs(was) * share, slack);
      console.log(`  ${key}: ${was} -> ${now[key]} (${out ? 'MOVED' : 'within tolerance'})`);
      if (out) moved.push(`${key} ${was} -> ${now[key]}`);
    }
    expect(moved, 'moved from the baseline: if that was meant, npm run perf:update, and say why').toEqual([]);
  }
  expect(now.bootMs, 'boot within budget').toBeLessThanOrEqual(BUDGET.bootMs);
  expect(now.frameMs, 'frame within budget').toBeLessThanOrEqual(BUDGET.frameMs);
  expect(now.bundleKb, 'download within budget').toBeLessThanOrEqual(BUDGET.bundleKb);
  expect(problems).toEqual([]);
});
