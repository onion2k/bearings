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

  // and the field rolls on past the line into the lane at the end, and waits there in the order it finished
  await play(page, 10 * 60, 'rolling up the lane');
  const queue = await page.evaluate(() =>
    window
      .game!.marbles()
      .filter((m) => m.place > 0)
      .sort((a, b) => a.place - b.place)
      .map((m) => ({ segment: m.segment, along: m.along, speed: m.speed })),
  );
  expect(queue.length).toBe(content.marbles);
  for (let k = 1; k < queue.length; k++) {
    expect(queue[k].segment, 'all in the lane').toBe(queue[0].segment);
    expect(queue[k - 1].along - queue[k].along, `place ${k + 1} a marble behind place ${k}`).toBeCloseTo(0.9, 1);
    expect(Math.abs(queue[k].speed), 'at rest').toBeLessThan(0.05);
  }

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
      // the Stress Test's hundred pieces, folded into a box of turns, took up to 127 s to race through
      g.settle(180);
      return [g.state(), g.invariants()] as const;
    });
    expect(raced[1], `invariants after racing ${content.runs[i]}`).toEqual([]);
    expect(raced[0].finished, `every marble home on ${content.runs[i]}`).toBe(content.marbles);
  }

  // ---- the catalog of pieces, by its tab, and back ----
  const onRun = await page.evaluate(() => window.game!.state().runName);
  await page.locator('#toPieces').click();
  await play(page, 30, 'the catalog on');
  const shelf = await page.evaluate(() => window.game!.state());
  expect(shelf.shelf).toBe('pieces');
  expect(content.catalog.length, 'a piece for every kind').toBeGreaterThan(15);
  await expect(page.locator('#title')).toHaveText(content.catalog[0]);
  await expect(page.locator('#best'), 'a piece says what it does').not.toHaveText(/best|no best/);
  await page.locator('#next').click();
  await expect(page.locator('#title')).toHaveText(content.catalog[1]);
  // every piece raced by itself through the page, with every marble home and nothing broken, and none of it kept
  const racesBefore = shelf.races;
  for (let i = 0; i < content.catalog.length; i++) {
    const raced = await page.evaluate((n) => {
      const g = window.game!;
      g.pick(n);
      g.release();
      g.settle(90);
      return [g.state(), g.invariants()] as const;
    }, i);
    expect(raced[1], `invariants after racing ${content.catalog[i]}`).toEqual([]);
    expect(raced[0].finished, `every marble home on ${content.catalog[i]}`).toBe(content.marbles);
    expect(raced[0].races, 'a race on a piece is not counted').toBe(racesBefore);
  }
  await page.keyboard.press('c');
  await play(page, 30, 'back to the runs');
  const back = await page.evaluate(() => window.game!.state());
  expect(back.shelf).toBe('runs');
  expect(back.runName, 'on the run it was left on').toBe(onRun);

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

test('the screen split in four follows four marbles through a race, on the key and on the board', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 3, paused: true });

  // whole to begin with: nothing is followed
  expect((await page.evaluate(() => window.game!.cameras())).on).toBe(false);
  await expect(page.locator('#toSplit')).not.toHaveClass(/on/);

  // S splits it, and the board's button says so
  await page.keyboard.press('s');
  await expect(page.locator('#toSplit')).toHaveClass(/on/);
  let cameras = await page.evaluate(() => window.game!.cameras());
  expect(cameras.on).toBe(true);
  expect(new Set(cameras.marbles).size, 'four marbles, none twice').toBe(4);

  // the picked marbles are the ones followed, first
  await page.evaluate(() => {
    const g = window.game!;
    g.claim(6);
    g.claim(2);
  });
  await page.keyboard.press('s');
  await page.keyboard.press('s');
  cameras = await page.evaluate(() => window.game!.cameras());
  expect(cameras.marbles.slice(0, 2)).toEqual([6, 2]);

  // raced through, with the rules holding at every stage and no camera on a marble that is not there
  for (let stage = 0; stage < 6; stage++) {
    const seen = await page.evaluate(() => {
      const g = window.game!;
      if (g.state().racing === 0 && !g.state().over) g.release();
      g.step(300);
      return [g.cameras(), g.invariants()] as const;
    });
    expect(seen[1], `invariants after stage ${stage} split`).toEqual([]);
    const live = seen[0].marbles.filter((m) => m >= 0);
    expect(new Set(live).size, `no two cameras on one marble, stage ${stage}`).toBe(live.length);
    for (const target of seen[0].targets) for (const v of target) expect(Number.isFinite(v)).toBe(true);
  }

  // the window changing shape while it is split: upright is one quarter over the next, wide is two and two, and
  // neither leaves the game broken or a camera off its marble
  for (const size of [
    { width: 700, height: 900 },
    { width: 1001, height: 601 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    const shown = await page.evaluate(() => {
      const g = window.game!;
      g.step(5);
      return [g.cameras(), g.invariants()] as const;
    });
    expect(shown[1], `invariants at ${size.width}x${size.height} split`).toEqual([]);
    expect(shown[0].on).toBe(true);
  }

  // the board's button puts it whole again, and it follows nobody
  await page.locator('#toSplit').click();
  await expect(page.locator('#toSplit')).not.toHaveClass(/on/);
  cameras = await page.evaluate(() => window.game!.cameras());
  expect(cameras.on).toBe(false);
  expect(cameras.marbles).toEqual([-1, -1, -1, -1]);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});
