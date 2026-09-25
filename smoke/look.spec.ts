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
    const inBowl = await page.evaluate(() => {
      const g = window.game!;
      g.pick(2);
      g.release();
      g.follow(false);
      // played on until most of the field is going round the bowl, however long that takes
      for (let f = 0; f < 60 * 60 && g.state().inBowl < 6; f += 5) g.step(5);
      const [bowl] = g.content().bowls;
      g.look(bowl.x, bowl.y, bowl.z - 2, { azimuth: 0.9, polar: 0.7, radius: 24 });
      g.step(1);
      return g.state().inBowl;
    });
    expect(inBowl, 'the picture is of marbles in the bowl, or it is not this picture').toBeGreaterThanOrEqual(6);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('funnel.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test("the field dropping off the funnel's lip into its bowl, and going round under it", async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const state = await page.evaluate(() => {
      const g = window.game!;
      g.pick(2);
      g.release();
      g.follow(false);
      // played on until one is in the air off the lip and another already going round
      for (let f = 0; f < 60 * 60 && !(g.state().aloft > 0 && g.state().inBowl > 0); f++) g.step(1);
      // from beside the run in, where it comes over the rim to its lip: when it ended on the rim, a marble left it
      // off the side and was next seen inside the rim
      const [bowl] = g.content().bowls;
      g.look(bowl.x, bowl.y - 1.5, bowl.z - 0.5, { azimuth: -0.4, polar: 1.05, radius: 20 });
      g.step(1);
      return g.state();
    });
    expect(state.aloft, 'a marble in the air off the lip, or it is not this picture').toBeGreaterThan(0);
    expect(state.inBowl, 'and some already going round').toBeGreaterThan(0);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('drop.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test("a marble falling through the funnel's hole on to the ramp under it", async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const falling = await page.evaluate(() => {
      const g = window.game!;
      g.pick(2);
      g.release();
      g.follow(false);
      const [bowl] = g.content().bowls;
      // a marble on the way out from under the bowl and well clear of its floor: falling through the throat
      const inThroat = () =>
        g.marbles().filter((m) => m.state === 'racing' && m.segment === bowl.segment + 1 && m.up > 1.5).length;
      for (let f = 0; f < 60 * 60 && inThroat() === 0; f++) g.step(1);
      // from beside the throat under the bowl, over the way out that carries each marble off: a marble was once
      // taken from the hole and set down on the piece below, and never seen between
      g.look(bowl.x + 1, bowl.y, bowl.z - 4, { azimuth: -1.2, polar: 1.2, radius: 12 });
      g.step(1);
      return inThroat();
    });
    expect(falling, 'a marble in the throat, or it is not this picture').toBeGreaterThan(0);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('hole.png', TOLERANCE);
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
      // played on until most of the field is gathered at the wheel, however long physics takes to bring it
      const at = () => g.marbles().filter((m) => m.segment === 8).length;
      for (let f = 0; f < 60 * 30 && at() < 5; f++) g.step(1);
      // from the side, where the paddles are edge on: down the pen they stand right across it from wall to wall,
      // and a field gathered behind one is under the one before it and hidden
      g.look(13.25, -28.05, -26.5, { azimuth: 0, polar: 0.9, radius: 16 });
      g.step(1);
      return at();
    });
    expect(atWheel, 'the picture is of marbles at the wheel, or it is not this picture').toBeGreaterThanOrEqual(5);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('wheel.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the leap, with marbles in the air off its first jump', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const aloft = await page.evaluate(() => {
      const g = window.game!;
      g.pick(3);
      g.release();
      g.follow(false);
      // played on until most of the field is in the air off the first lip
      let most = 0;
      for (let f = 0; f < 60 * 30 && most < 3; f++) {
        g.step(1);
        most = g.state().aloft;
      }
      // side on to the first jump, from its lip to its own landing
      g.look(33, 0, -16, { azimuth: -1.2, polar: 1.1, radius: 22 });
      g.step(1);
      return g.state().aloft;
    });
    expect(aloft, 'the picture is of marbles in the air, or it is not this picture').toBeGreaterThanOrEqual(3);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('leap.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the board, with three players picked before the off, and who won after it', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      // on this seed marble 2 wins, and the first player has it
      g.claim(2);
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

  test('the field come to rest in the cup at the end of first drop, under its grid', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const home = await page.evaluate(() => {
      const g = window.game!;
      g.release();
      g.follow(false);
      g.settle(60);
      // and long enough after for the last home to come to rest with the rest
      g.step(600);
      // looking at the field where it came to rest
      const ms = g.marbles();
      const mid = (k: 'x' | 'y' | 'z') => ms.reduce((sum, m) => sum + m[k], 0) / ms.length;
      g.look(mid('x'), mid('y'), mid('z'), { azimuth: 0.4, polar: 0.9, radius: 12 });
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

  test("the catalog's splitter, parting the field and closing it again", async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const on = await page.evaluate(() => {
      const g = window.game!;
      g.browse('pieces');
      g.pick(g.content().catalog.indexOf('Splitter'));
      g.release();
      g.follow(false);
      g.step(150);
      // the splitter's own shelf piece is a whole loop, start to finish, not the two cells the others are
      g.look(17, 0, -2, { azimuth: -0.9, polar: 0.8, radius: 16 });
      g.step(1);
      return g.state().runName;
    });
    expect(on).toBe('Splitter');
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('splitter.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the screen split, a view to every picked marble, three of them picked', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const on = await page.evaluate(() => {
      const g = window.game!;
      g.claim(1);
      g.claim(4);
      g.claim(6);
      g.split(true);
      g.release();
      g.step(240);
      return g.cameras();
    });
    expect(on.views, 'a view to each of the three picked, and no more').toBe(3);
    expect(on.marbles.slice(0, 3), 'the picked marbles, in player order').toEqual([1, 4, 6]);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('split.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the screen split, a view to every picked marble, five of them picked', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const on = await page.evaluate(() => {
      const g = window.game!;
      for (const m of [1, 4, 6, 0, 5]) g.claim(m);
      g.split(true);
      g.release();
      g.step(240);
      return g.cameras();
    });
    expect(on.views).toBe(5);
    expect(on.marbles.slice(0, 5)).toEqual([1, 4, 6, 0, 5]);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('split-five.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the screen split, a view to every marble, all eight of them picked', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const on = await page.evaluate(() => {
      const g = window.game!;
      for (let m = 0; m < 8; m++) g.claim(m);
      g.split(true);
      g.release();
      g.step(240);
      return g.cameras();
    });
    expect(on.views).toBe(8);
    expect([...on.marbles].sort(), 'every marble followed once').toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('split-eight.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the ramp raced under physics: the field in a lane that is a trough, sloping to its stop', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const home = await page.evaluate(() => {
      const g = window.game!;
      g.browse('pieces');
      g.pick(g.content().catalog.indexOf('Ramp'));
      g.release();
      g.follow(false);
      g.settle(20);
      // the lane at the end from the side, where the trough's V and its slope show, with the field lined up in it
      g.look(15, 0, -7, { azimuth: 0.4, polar: 1.0, radius: 16 });
      g.step(1);
      return [g.state().finished] as const;
    });
    expect(home[0], 'the picture is of the field home').toBe(8);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('physics-ramp.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('a drop under its grid and the brake after it, raced under physics: the field thrown from wall to wall', async ({
    page,
  }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const on = await page.evaluate(() => {
      const g = window.game!;
      // built rather than picked, since no shelf has a drop feeding a brake: the run being built is the run on
      g.browse('designs');
      for (const k of ['drop', 'brake', 'finish'] as const) g.lay(k);
      // kept, since a run still being built is not let go
      if (g.keep('Drop and brake').length) throw new Error('the design was refused');
      g.release();
      g.follow(false);
      g.step(100);
      // the drop and the brake from the side, the grid over the one and the field in the other
      g.look(14, 0, -12, { azimuth: -1.2, polar: 0.75, radius: 26 });
      g.step(1);
      return [g.state().runName, g.state().racing + g.state().finished] as const;
    });
    expect(on[0]).toBe('Drop and brake');
    expect(on[1], 'and of the field away').toBe(8);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('physics-drop-brake.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('pegs and bumps raced under physics: the pegs cones, and both boards under a grid that throws a fast field back down', async ({
    page,
  }) => {
    const problems = watch(page);
    await start(page, { seed: 5, paused: true });
    const on = await page.evaluate(() => {
      const g = window.game!;
      g.browse('designs');
      for (const k of ['drop', 'drop', 'pegs', 'bumps', 'finish'] as const) g.lay(k);
      if (g.keep('Pegs and bumps').length) throw new Error('the design was refused');
      g.release();
      g.follow(false);
      g.step(140);
      // the pegs and the bumps from above, where a cone's point, a mound's rise and the grids over both show
      g.look(24, 0, -8, { azimuth: -1.5, polar: 0.55, radius: 22 });
      g.step(1);
      return [g.state().runName, g.state().racing + g.state().finished] as const;
    });
    expect(on[0]).toBe('Pegs and bumps');
    expect(on[1], 'and of the field away').toBe(8);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('physics-pegs-bumps.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test("the catalog's grid over a board, raced under physics: the field kept in under it", async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const on = await page.evaluate(() => {
      const g = window.game!;
      g.browse('pieces');
      g.pick(g.content().catalog.indexOf('A grid over it'));
      g.release();
      g.follow(false);
      g.step(90);
      // the board from above and to one side, where the grid's bars and rungs stand over the field
      g.look(12, 0, -6, { azimuth: -1.2, polar: 0.7, radius: 18 });
      g.step(1);
      return [g.state().runName] as const;
    });
    expect(on[0]).toBe('A grid over it');
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('physics-grid.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test("the fork raced under physics: its lanes' walls open where they part, and no divider standing there", async ({
    page,
  }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const on = await page.evaluate(() => {
      const g = window.game!;
      g.pick(5);
      g.release();
      g.follow(false);
      // played on until most of the field has parted into the two lanes, however long physics takes
      const parted = () => g.marbles().filter((m) => m.segment === 2 || m.segment === 3).length;
      for (let f = 0; f < 60 * 20 && parted() < 4; f += 5) g.step(5);
      // from above the point where the lanes part, looking down them
      g.look(21, 3, -9.2, { azimuth: -2.4, polar: 0.75, radius: 15 });
      g.step(1);
      return [g.state().runName, parted()] as const;
    });
    expect(on[0]).toBe('The Fork');
    expect(on[1], 'and of marbles in the lanes').toBeGreaterThanOrEqual(4);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('physics-fork.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

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

  test('the builder, a run part built, with what is still wrong with it', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      g.browse('designs');
      for (const k of ['ramp', 'pegs', 'curveLeft', 'drop', 'sweeper'] as const) g.lay(k);
      g.step(2);
    });
    await expect(page.locator('#problems')).toContainText('no finish');
    await hideStats(page);
    await expect(page).toHaveScreenshot('designer.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the builder with a split, the left lane chosen and marked, the right lane longer', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      g.browse('designs');
      for (const k of ['ramp', 'splitter', 'drop', 'straight'] as const) g.lay(k);
      g.lane('left');
      g.lay('ramp');
      g.step(2);
    });
    await expect(page.locator('#laneLeft')).toHaveAttribute('aria-pressed', 'true');
    await hideStats(page);
    await expect(page).toHaveScreenshot('designer-lanes.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('switchback dressed as a works: lamps, pipes, cogs, chimneys, girders, tanks, pistons and stripes', async ({
    page,
  }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const kinds = await page.evaluate(() => {
      const g = window.game!;
      g.pick(4);
      g.step(60);
      return g.decor().kinds;
    });
    for (const kind of ['lamp', 'pipes', 'cog', 'chimney', 'girder', 'tank', 'piston', 'stripes'] as const)
      expect(kinds[kind], `switchback has a ${kind}`).toBeGreaterThan(0);
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('works.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the field on the gate, close to: every marble told apart by its pattern', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      g.pick(0);
      g.follow(false);
      const ms = g.marbles();
      const [x, y, z] = [0, 1, 2].map((k) => ms.reduce((s, m) => s + [m.x, m.y, m.z][k], 0) / ms.length);
      g.look(x, y, z, { azimuth: 2.4, polar: 0.3, radius: 6 });
      g.step(2);
    });
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('field.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test("a chimney's smoke, close to: translucent, thinning as it rises", async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      g.pick(0);
      g.follow(false);
      const c = g.decor().chimneys[0];
      g.look(c[0] + 2, c[1] + 1, c[2] + 5, { azimuth: 2.2, polar: 1.25, radius: 22 });
      g.step(120);
    });
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('smoke.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('a lamp over the channel, lighting it, close to', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      g.pick(4);
      g.follow(false);
      const [x, y, z] = g.decor().lamps[1];
      g.look(x, y, z - 3, { azimuth: 2.2, polar: 1.05, radius: 11 });
      g.step(90);
    });
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('works-lamp.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the builder, a run dressed as a works as it is built', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      g.browse('designs');
      for (const k of ['ramp', 'straight', 'sweeper', 'curveLeft', 'drop', 'straight', 'straight'] as const) g.lay(k);
      g.dress('industrial');
      g.step(2);
    });
    await expect(page.locator('#themes [data-theme="industrial"]')).toHaveAttribute('aria-pressed', 'true');
    await hideStats(page);
    await expect(page).toHaveScreenshot('designer-works.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the tower dressed as a sweet factory: candy canes, lollipops, gumdrops, whisks and giant lollipops', async ({
    page,
  }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    const theme = await page.evaluate(() => {
      const g = window.game!;
      g.pick(2);
      g.step(60);
      return g.decor().theme;
    });
    expect(theme).toBe('sweets');
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('sweets.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test("a lollipop lamp over the leap's first piece, and a whisk turning on its wall, close to", async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      g.pick(3);
      g.follow(false);
      g.look(12, 0, -5, { azimuth: 2.6, polar: 1.0, radius: 11 });
      g.step(90);
    });
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('sweets-close.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('a giant lollipop and a fudge pot steaming at the foot of the leap', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      g.pick(3);
      g.follow(false);
      g.look(64, 1.5, -44, { azimuth: 2.2, polar: 1.25, radius: 26 });
      g.step(120);
    });
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('sweets-ground.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the builder, a run dressed as a sweet factory as it is built', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      g.browse('designs');
      for (const k of ['ramp', 'straight', 'sweeper', 'curveLeft', 'drop', 'straight', 'straight'] as const) g.lay(k);
      g.dress('sweets');
      g.step(2);
    });
    await expect(page.locator('#themes [data-theme="sweets"]')).toHaveAttribute('aria-pressed', 'true');
    await hideStats(page);
    await expect(page).toHaveScreenshot('designer-sweets.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('a design kept, on its shelf, the field part way down it', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      g.browse('designs');
      for (const k of ['ramp', 'pegs', 'curveLeft', 'drop', 'sweeper', 'curveRight', 'ramp', 'finish'] as const)
        g.lay(k);
      g.keep('Round the sweeper');
      g.release();
      g.step(150);
    });
    await expect(page.locator('#title')).toHaveText('Round the sweeper');
    await hideStats(page);
    await expect(page).toHaveScreenshot('design.png', TOLERANCE);
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

    test('the screen split, one view over the next, at the width of a phone', async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await page.evaluate(() => {
        const g = window.game!;
        g.claim(2);
        g.claim(5);
        g.split(true);
        g.release();
        g.step(240);
      });
      await hideStats(page);
      await expect(page).toHaveScreenshot('split-phone.png', TOLERANCE);
      expect(problems).toEqual([]);
    });

    test('the screen split six ways, two across and three down, at the width of a phone', async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await page.evaluate(() => {
        const g = window.game!;
        for (const m of [2, 5, 0, 1, 3, 6]) g.claim(m);
        g.split(true);
        g.release();
        g.step(240);
      });
      await hideStats(page);
      await expect(page).toHaveScreenshot('split-six-phone.png', TOLERANCE);
      expect(problems).toEqual([]);
    });

    test('the builder, at the width of a phone', async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await page.evaluate(() => {
        const g = window.game!;
        g.browse('designs');
        for (const k of ['ramp', 'pegs', 'curveLeft', 'drop'] as const) g.lay(k);
        g.step(2);
      });
      await hideStats(page);
      await expect(page).toHaveScreenshot('designer-phone.png', TOLERANCE);
      expect(problems).toEqual([]);
    });

    test('the builder with a split, at the width of a phone', async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await page.evaluate(() => {
        const g = window.game!;
        g.browse('designs');
        for (const k of ['ramp', 'splitter', 'drop', 'straight'] as const) g.lay(k);
        g.lane('left');
        g.lay('ramp');
        g.step(2);
      });
      await hideStats(page);
      await expect(page).toHaveScreenshot('designer-lanes-phone.png', TOLERANCE);
      expect(problems).toEqual([]);
    });
  });
});
