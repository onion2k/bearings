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

  // ---- the players pick, by a tap on a row and by the number keys ----
  // before the off the board lists the field in its own order, so row n is marble n - 1
  const rows = page.locator('#order li');
  await expect(page.locator('#verdict')).toContainText('pick it');
  await rows.nth(0).click();
  await page.keyboard.press('3');
  await rows.nth(5).click();
  await rows.nth(0).click();
  await page.keyboard.press('8');
  const picked = await page.evaluate(() => window.game!.marbles().map((m) => m.player));
  // the first let go again, so the next to pick takes the number it left
  expect(picked).toEqual([0, 0, 2, 0, 0, 3, 0, 1]);
  await expect(rows.nth(2).locator('i')).toHaveText('P2');
  await expect(rows.nth(7).locator('i')).toHaveText('P1');
  await expect(page.locator('#verdict'), 'nothing to say once they have picked').toBeEmpty();
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);

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
  await expect(rows).toHaveCount(content.marbles);
  await expect(rows.first()).toHaveClass(/won/);
  await expect(rows.first()).toContainText(/\d+\.\d\ds/);
  // and who won: the player whose marble came first, or the marble alone where nobody had it
  const champion = done.champion;
  expect(champion, 'the race is over, so somebody or nobody won it').toBeGreaterThanOrEqual(0);
  await expect(page.locator('#verdict')).toHaveText(
    champion > 0 ? new RegExp(`^P${champion} wins, with `) : /nobody had it/,
  );

  // ---- and again ----
  await page.evaluate(() => window.game!.reset());
  await play(page, 30, 'set up again');
  const again = await page.evaluate(() => window.game!.state());
  expect(again.waiting).toBe(content.marbles);
  expect(again.over).toBe(false);
  expect(again.races, 'what was run is kept').toBe(1);
  expect(
    await page.evaluate(() => window.game!.marbles().map((m) => m.player)),
    'and so is who has which marble',
  ).toEqual([0, 0, 2, 0, 0, 3, 0, 1]);

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

  // ---- the pieces that break a field up, watched at work ----
  // the rules checked every few frames on the way down, and not only once the race is over: the tower's funnel
  // takes the field round its bowl and out through the hole, the leap throws it into the air, and the chute's
  // sweeper and gate stand in its way
  for (const [name, what] of [
    ['The Tower', 'swirling'],
    ['The Leap', 'flying'],
    ['The Chute', 'racing'],
  ] as const) {
    const i = content.runs.indexOf(name);
    expect(i, `${name} is a run`).toBeGreaterThanOrEqual(0);
    const seen = await page.evaluate(
      ([i, what]) => {
        const g = window.game!;
        g.pick(i);
        g.release();
        let most = 0;
        for (let f = 0; f < 120 * 60 && !g.state().over; f += 5) {
          g.step(5);
          most = Math.max(most, g.state()[what]);
          const broken = g.invariants();
          if (broken.length) return { most, broken, frame: f, state: g.state() };
        }
        return { most, broken: [] as string[], frame: -1, state: g.state() };
      },
      [i, what] as const,
    );
    expect(seen.broken, `invariants on ${name}, frame ${seen.frame}`).toEqual([]);
    expect(seen.most, `${name}: several ${what} at once`).toBeGreaterThan(2);
    expect(seen.state.finished, `${name}: every marble home`).toBe(content.marbles);
  }

  await info.attach('the board', { body: await page.screenshot(), contentType: 'image/png' });
  expect(problems).toEqual([]);
});
