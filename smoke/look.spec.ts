/**
 * What the game looks like, held to pictures taken before. Every other check
 * is on what the game does; nothing until now noticed a palette gone muddy,
 * a light lost, or a marble drawn beside the chute instead of in it.
 *
 * Each scene is set through the test API with chance seeded from before the
 * game is built, the game paused, the camera parked by hand, and a fixed
 * number of frames stepped, so the same machine draws the same pixels every
 * run. The pictures are in `smoke/screens/`. They are this machine's GPU:
 * another one will draw them a little differently, so the tolerance is
 * loose and the pictures are not worth arguing with from elsewhere.
 *
 *   npm run look               the scenes against the pictures
 *   npm run look:update        the pictures written again, after a change meant to alter them
 *
 * A failure leaves the picture, what was drawn and the difference in
 * `test-results/`. Look at all three before deciding which is right.
 */
import { expect, test, type Page } from '@playwright/test';
import { start, watch } from './game';

/** How far the pictures may differ before it is a change and not the GPU: a fiftieth of the pixels, each well off. */
const TOLERANCE = { maxDiffPixelRatio: 0.002, threshold: 0.02 };

/** The corner that counts the milliseconds a frame takes is different every run, and says nothing about the look. */
async function hideStats(page: Page) {
  await page.locator('#stats').evaluate((el: HTMLElement) => (el.hidden = true));
}

test.describe('what it looks like', () => {
  test('the run, with the field on the gate', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    // First Drop framed the way the page frames a run when it is put on
    await page.evaluate(() => {
      const g = window.game!;
      g.pick(0);
      g.step(60);
    });
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('run.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the field among the pegs, part way down', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const onBoard = await page.evaluate(() => {
      const g = window.game!;
      g.pick(0);
      g.release();
      g.follow(false);
      g.step(150);
      // First Drop's peg board, from above its downhill end
      g.look(18, 0, -10, { azimuth: 0.9, polar: 0.8, radius: 22 });
      g.step(1);
      return g.marbles().filter((m) => m.segment === 2).length;
    });
    expect(onBoard, 'the picture is of the field on the board, or it is not this picture').toBe(8);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('pegs.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the tower, as a player first sees it', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    // put on the way a player puts a run on, so framed the way the page frames it and not by hand
    await page.evaluate(() => {
      const g = window.game!;
      g.pick(2);
      g.step(1);
    });
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('tower.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the field going round the funnel at the foot of the tower', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const swirling = await page.evaluate(() => {
      const g = window.game!;
      g.pick(2);
      g.release();
      g.follow(false);
      g.step(560);
      g.look(18, 6, -37, { azimuth: 0.9, polar: 0.7, radius: 24 });
      g.step(1);
      return g.state().swirling;
    });
    expect(swirling, 'the picture is of marbles in the bowl, or it is not this picture').toBe(8);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('funnel.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the chute, with the field in the pen and the gate across it', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      g.pick(1);
      g.release();
      g.follow(false);
      g.step(160);
      // the sweeper's board and the gate's pen below it
      g.look(17, 0, -8.5, { azimuth: 0.9, polar: 0.8, radius: 22 });
      g.step(1);
    });
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('pen.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the field gathered behind the wheel on switchback', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const atWheel = await page.evaluate(() => {
      const g = window.game!;
      g.pick(4);
      g.release();
      g.follow(false);
      g.step(639);
      // looking down its pen, so the wheel is seen right across it from wall to wall, with the field at it
      g.look(13.25, -28.05, -25.5, { azimuth: -Math.PI / 2, polar: 0.75, radius: 14 });
      g.step(1);
      return g.marbles().filter((m) => m.segment === 8).length;
    });
    expect(atWheel, 'the picture is of marbles at the wheel, or it is not this picture').toBe(4);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('wheel.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the leap, with five marbles in the air over the first gap', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const flying = await page.evaluate(() => {
      const g = window.game!;
      g.pick(3);
      g.release();
      g.follow(false);
      g.step(289);
      // side on to the first jump, from its lip to the board it lands on
      g.look(35.4, 0, -15.2, { azimuth: -1.2, polar: 1.1, radius: 22 });
      g.step(1);
      return g.state().flying;
    });
    expect(flying, 'the picture is of marbles in the air, or it is not this picture').toBe(5);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('leap.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the board, with three players picked before the off, and who won after it', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      // on this seed Amethyst, marble 5, wins, and the second player has it
      g.claim(4);
      g.claim(5);
      g.claim(1);
      g.step(1);
    });
    await expect(page.locator('#board')).toHaveScreenshot('board.png', TOLERANCE);
    const champion = await page.evaluate(() => {
      const g = window.game!;
      g.release();
      g.settle(120);
      return g.state().champion;
    });
    expect(champion, 'the picture is of a race some player won, or it is not this picture').toBeGreaterThan(0);
    await expect(page.locator('#board')).toHaveScreenshot('won.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the field lined up in the lane at the end of first drop, in the order it finished', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const home = await page.evaluate(() => {
      const g = window.game!;
      g.release();
      g.follow(false);
      g.settle(60);
      // and long enough after for the last home to roll up to the back of the queue
      g.step(600);
      g.look(12, 36, -24, { azimuth: 0.4, polar: 0.9, radius: 14 });
      g.step(1);
      return g.state().finished;
    });
    expect(home, 'the picture is of the whole field home, or it is not this picture').toBe(8);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('lane.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  for (const [name, piece, frames] of [
    ['narrow', 'Narrow', 100],
    ['bumps', 'Bumps', 100],
    ['broad', 'Shallow and broad', 90],
  ] as const) {
    test(`the catalog's ${piece.toLowerCase()}, with the field on it`, async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      const on = await page.evaluate(
        ([piece, frames]) => {
          const g = window.game!;
          g.browse('pieces');
          g.pick(g.content().catalog.indexOf(piece));
          g.release();
          g.follow(false);
          g.step(frames);
          // the piece is laid out from the lattice's first cell, two cells long and a level down
          g.look(12, 0, -6, { azimuth: -1.2, polar: 0.7, radius: 18 });
          g.step(1);
          return g.state().runName;
        },
        [piece, frames] as const,
      );
      expect(on).toBe(piece);
      await hideStats(page);
      await expect(page.locator('#view')).toHaveScreenshot(`${name}.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });
  }

  test('the catalog on the board, a piece framed and said what it does', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.locator('#toPieces').click();
    await page.evaluate(() => {
      const g = window.game!;
      g.pick(g.content().catalog.indexOf('Bumps'));
      g.step(2);
    });
    await hideStats(page);
    await expect(page).toHaveScreenshot('catalog.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true });
    test('the board and the run, at the width of a phone', async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await page.evaluate(() => {
        const g = window.game!;
        g.claim(2);
        g.claim(5);
        g.step(1);
      });
      await expect(page).toHaveScreenshot('phone.png', TOLERANCE);
      expect(problems).toEqual([]);
    });
  });
});
