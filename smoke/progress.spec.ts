/**
 * A race played through in a real browser: a field let go, run to the cup,
 * and the board showing who won. Played through the test API with the game
 * paused and stepped a frame at a time, so it is the same every run and
 * waits on no clock — but everything that follows, the solver, the scene,
 * the words on the screen, is the game's own.
 *
 * A feature that a player can reach gets a stage here, and after every
 * stage the game's invariants are checked.
 */
import { expect, test, type Page } from '@playwright/test';
import { start, watch } from './game';

/** Play `frames` frames, and check nothing that must hold has broken. */
async function play(page: Page, frames: number, stage: string) {
  const broken = await page.evaluate((n) => {
    window.game!.step(n);
    return window.game!.invariants();
  }, frames);
  expect(broken, `invariants after ${stage}`).toEqual([]);
}

test('a field let go races to the cup, and the board says who won', async ({ page }, info) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });

  const content = await page.evaluate(() => window.game!.content());
  expect(content.runs.length, 'there is more than one run to pick').toBeGreaterThan(1);
  expect(content.length, 'the run has some length to it').toBeGreaterThan(10);
  expect(content.marbles).toBeGreaterThan(1);

  // ---- on the gate ----
  await play(page, 30, 'waiting on the gate');
  const onTheGate = await page.evaluate(() => window.game!.state());
  expect(onTheGate.waiting).toBe(content.marbles);
  expect(onTheGate.racing).toBe(0);
  expect(onTheGate.over).toBe(false);

  // every marble starts on the first piece, inside the channel
  const lined = await page.evaluate(() => window.game!.marbles());
  for (const m of lined) {
    expect(m.segment, `marble ${m.index} on the gate`).toBe(0);
    expect(m.state).toBe('waiting');
    expect(Math.abs(m.across)).toBeLessThanOrEqual(1);
  }

  // ---- let go ----
  await page.evaluate(() => window.game!.release());
  await play(page, 60, 'the off');
  const away = await page.evaluate(() => window.game!.state());
  expect(away.racing, 'they are away').toBeGreaterThan(0);
  expect(away.leader, 'somebody is in front').toBeGreaterThanOrEqual(0);
  const moving = await page.evaluate(() => window.game!.marbles());
  expect(
    moving.some((m) => m.far > 1),
    'and getting down the run',
  ).toBe(true);

  // ---- run to the end ----
  const took = await page.evaluate(() => window.game!.settle(120));
  expect(took, 'the race took some time').toBeGreaterThan(0);
  const done = await page.evaluate(() => window.game!.state());
  expect(done.over, 'the race is over').toBe(true);
  expect(done.finished + done.stalled).toBe(content.marbles);
  expect(done.races, 'and it was counted').toBe(1);
  expect(done.best).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);

  // what the page was told, and what it shows
  const said = await page.evaluate(() => window.game!.events());
  expect(said.filter((l) => l.startsWith('finished')).length).toBeGreaterThan(0);
  expect(said.some((l) => l.startsWith('over'))).toBe(true);
  const rows = page.locator('#order li');
  await expect(rows).toHaveCount(content.marbles);
  await expect(rows.first()).toHaveClass(/won/);
  await expect(rows.first()).toContainText(/\d+\.\d\ds/);

  // ---- and again ----
  await page.evaluate(() => window.game!.reset());
  await play(page, 30, 'set up again');
  const again = await page.evaluate(() => window.game!.state());
  expect(again.waiting).toBe(content.marbles);
  expect(again.over).toBe(false);
  expect(again.races, 'what was run is kept').toBe(1);

  // what was just won stands as the best on this run, on the board
  await expect(page.locator('#best')).toHaveText(`best ${done.best.toFixed(2)}s`);

  // ---- another run, by the arrows on the board, as a player picks one ----
  await page.locator('#next').click();
  await play(page, 30, 'the next run on');
  const next = await page.evaluate(() => window.game!.state());
  expect(next.run).toBe(1);
  expect(next.runName).toBe(content.runs[1]);
  expect(next.waiting, 'a fresh field on its gate').toBe(content.marbles);
  await expect(page.locator('#title')).toHaveText(content.runs[1]);
  await expect(page.locator('#best'), "no best of its own yet, and not the last run's").toHaveText('no best yet');

  // back past the first, which comes round to the last
  await page.locator('#prev').click();
  await page.locator('#prev').click();
  await play(page, 30, 'round to the last run');
  const last = await page.evaluate(() => window.game!.state());
  expect(last.run).toBe(content.runs.length - 1);
  await expect(page.locator('#title')).toHaveText(content.runs[content.runs.length - 1]);

  // every run can be put on and raced through the page, with nothing broken
  for (let i = 0; i < content.runs.length; i++) {
    await page.evaluate((n) => window.game!.pick(n), i);
    await page.evaluate(() => window.game!.release());
    const raced = await page.evaluate(() => {
      const g = window.game!;
      g.settle(120);
      return [g.state(), g.invariants()] as const;
    });
    expect(raced[1], `invariants after racing ${content.runs[i]}`).toEqual([]);
    expect(raced[0].finished, `every marble home on ${content.runs[i]}`).toBe(content.marbles);
  }

  await info.attach('the board', { body: await page.screenshot(), contentType: 'image/png' });
  expect(problems).toEqual([]);
});
