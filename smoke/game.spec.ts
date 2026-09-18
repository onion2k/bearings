/**
 * The game as a player gets it: served by Vite, run in Chromium on the real
 * GPU, with a fresh save each test. What the unit tests cannot reach — the
 * renderer, the keyboard, the frame loop, the page — checked for the things
 * that would make it plainly broken: an error, a black screen, a gate that
 * will not open, a save that does not come back.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { start, watch } from './game';

/** How many frames the page draws in a second. */
function framesInASecond(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let n = 0;
        const began = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - began < 1000) requestAnimationFrame(tick);
          else resolve(n);
        };
        requestAnimationFrame(tick);
      }),
  );
}

/** How much a screenshot has in it: the spread of its brightness, and the share of it that is not near black. */
function content(png: Buffer) {
  const img = PNG.sync.read(png);
  let sum = 0,
    sq = 0,
    lit = 0;
  const n = img.width * img.height;
  for (let i = 0; i < img.data.length; i += 4) {
    const y = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
    sum += y;
    sq += y * y;
    if (y > 40) lit++;
  }
  const mean = sum / n;
  return { spread: Math.sqrt(sq / n - mean * mean), lit: lit / n };
}

test('boots with no errors and draws the run', async ({ page }, info) => {
  const problems = watch(page);
  await start(page);
  expect(await framesInASecond(page)).toBeGreaterThan(20);
  const state = await page.evaluate(() => window.game!.state());
  expect(state.waiting, 'a field on the gate').toBeGreaterThan(0);
  expect(state.runName, 'a run is on').not.toBe('');
  const shot = await page.screenshot();
  await info.attach('run', { body: shot, contentType: 'image/png' });
  const c = content(shot);
  expect(c.lit, 'share of the screen lit').toBeGreaterThan(0.2);
  expect(c.spread, 'variety in the picture').toBeGreaterThan(20);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('lets them go with the keyboard, and sets up again', async ({ page }) => {
  await start(page, { seed: 3 });
  await page.evaluate(() => window.game!.pause());
  expect((await page.evaluate(() => window.game!.state())).racing).toBe(0);

  // space is the gate: a real key on the real page, not the test API
  await page.keyboard.press(' ');
  await page.evaluate(() => window.game!.step(30));
  const off = await page.evaluate(() => window.game!.state());
  expect(off.racing, 'the field is away').toBeGreaterThan(0);
  expect(off.waiting).toBe(0);

  // and R puts them back on the gate
  await page.keyboard.press('r');
  await page.evaluate(() => window.game!.step(1));
  const again = await page.evaluate(() => window.game!.state());
  expect(again.waiting, 'back on the gate').toBeGreaterThan(0);
  expect(again.racing).toBe(0);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
});

test('keeps what has been run, and which run, across a reload', async ({ page }) => {
  const problems = watch(page);
  await start(page);
  // a run other than the first, so coming back on it is something the save did
  await page.locator('#next').click();
  const before = await page.evaluate(() => {
    const g = window.game!;
    g.pause();
    g.release();
    // played out to the end, so a race is counted and written
    g.settle(120);
    g.save();
    return g.state();
  });
  expect(before.races, 'a race was run').toBeGreaterThan(0);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.game?.ready ?? false), { timeout: 60_000 }).toBe(true);
  const after = await page.evaluate(() => window.game!.state());
  expect(after.races).toBe(before.races);
  expect(after.run, 'back on the run that was on').toBe(before.run);
  expect(after.run).toBe(1);
  expect(after.best, 'with its best').toBeCloseTo(before.best, 5);
  expect(problems).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true });

  test('boots, and nothing is wider than the screen', async ({ page }, info) => {
    const problems = watch(page);
    await start(page);
    await expect(page.locator('#board')).toBeVisible();
    await info.attach('phone', { body: await page.screenshot(), contentType: 'image/png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(400);
    expect(problems).toEqual([]);
  });
});
