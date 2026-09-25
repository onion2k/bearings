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

  // and the field rolls on past the line into the lane at the end, and comes to rest there, in the cup: in a V a
  // chute wide, where two may sit abreast, and not always in the order it finished; the rules hold that none is
  // inside another
  await play(page, 10 * 60, 'rolling up the lane');
  const queue = await page.evaluate(() =>
    window
      .game!.marbles()
      .filter((m) => m.place > 0)
      .map((m) => ({ segment: m.segment, speed: m.speed })),
  );
  expect(queue.length).toBe(content.marbles);
  for (const m of queue) {
    expect(m.segment, 'all in the lane').toBe(queue[0].segment);
    expect(Math.abs(m.speed), 'at rest').toBeLessThan(0.05);
  }
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
    ['The Tower', 'inBowl'],
    ['The Leap', 'aloft'],
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

test('the screen splits to a view for every picked marble, follows them through a race, on the key and on the board', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 3, paused: true });
  const cellOf = (box: { x: number; y: number; width: number; height: number }, columns: number, rows: number) => {
    const size = page.viewportSize()!;
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    return { x: Math.floor((x / size.width) * columns), y: Math.floor((y / size.height) * rows) };
  };

  // whole to begin with: nothing is followed
  expect((await page.evaluate(() => window.game!.cameras())).on).toBe(false);
  await expect(page.locator('#toSplit')).not.toHaveClass(/on/);
  await expect(page.locator('#toSplit')).toHaveText('Split');

  // S turns the split on, but with nobody picked there is nothing to give a view to
  await page.keyboard.press('s');
  await expect(page.locator('#toSplit')).not.toHaveClass(/on/);
  await expect(page.locator('#toSplit')).toHaveText('Split');
  expect((await page.evaluate(() => window.game!.cameras())).views).toBe(0);

  // picking a second marble turns on a view for each, without pressing S again
  await page.evaluate(() => {
    const g = window.game!;
    g.claim(6);
    g.claim(2);
  });
  await expect(page.locator('#toSplit')).toHaveClass(/on/);
  await expect(page.locator('#toSplit')).toHaveText('Split 2');
  let cameras = await page.evaluate(() => window.game!.cameras());
  expect(cameras.views).toBe(2);
  expect(cameras.marbles.slice(0, 2)).toEqual([6, 2]);

  // a third pick grows the split to three views, in player order
  await page.evaluate(() => window.game!.claim(4));
  await expect(page.locator('#toSplit')).toHaveText('Split 3');
  cameras = await page.evaluate(() => window.game!.cameras());
  expect(cameras.views).toBe(3);
  expect(cameras.marbles.slice(0, 3)).toEqual([6, 2, 4]);

  // each view says who it follows, in its own place on the screen
  const tags = page.locator('#tags .tag');
  await expect(page.locator('#tags')).toBeVisible();
  await expect(tags.nth(0)).toHaveText('P1 · Bone');
  await expect(tags.nth(1)).toHaveText('P2 · Sulphur');
  await expect(tags.nth(2)).toHaveText('P3 · Cobalt');
  for (let s = 0; s < 3; s++) {
    await expect(tags.nth(s)).toBeVisible();
    const cell = cellOf((await tags.nth(s).boundingBox())!, 2, 2);
    expect(cell, `caption ${s} in its view`).toEqual({ x: s & 1, y: s >> 1 });
  }
  await expect(tags.nth(3), 'and no caption for a view there is not').toBeHidden();

  // S turns it off, and S again brings back exactly the three picked, in the same order
  await page.keyboard.press('s');
  await expect(page.locator('#tags')).toBeHidden();
  await page.keyboard.press('s');
  cameras = await page.evaluate(() => window.game!.cameras());
  expect(cameras.views).toBe(3);
  expect(cameras.marbles.slice(0, 3)).toEqual([6, 2, 4]);

  // picking every marble grows the split to all eight, none twice, none but the picked
  await page.evaluate(() => {
    const g = window.game!;
    for (const m of [0, 1, 3, 5, 7]) g.claim(m);
  });
  await expect(page.locator('#toSplit')).toHaveText('Split 8');
  cameras = await page.evaluate(() => window.game!.cameras());
  expect(cameras.views).toBe(8);
  expect([...cameras.marbles].sort(), 'every marble in the field, once').toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  const eight = page.locator('#tags .tag');
  for (let s = 0; s < 8; s++) {
    await expect(eight.nth(s)).toBeVisible();
    const cell = cellOf((await eight.nth(s).boundingBox())!, 4, 2);
    expect(cell, `caption ${s} in its view, four across and two down`).toEqual({ x: s % 4, y: Math.floor(s / 4) });
  }

  // raced through, eight views throughout, with the rules holding at every stage and no camera on a marble
  // that is not there
  for (let stage = 0; stage < 8; stage++) {
    const seen = await page.evaluate(() => {
      const g = window.game!;
      if (g.state().racing === 0 && !g.state().over) g.release();
      g.step(300);
      return [g.cameras(), g.invariants()] as const;
    });
    expect(seen[1], `invariants after stage ${stage}`).toEqual([]);
    expect(seen[0].views, `still eight views at stage ${stage}, a race in cannot change a pick`).toBe(8);
    const live = seen[0].marbles.filter((m) => m >= 0);
    expect(new Set(live).size, `no two cameras on one marble, stage ${stage}`).toBe(live.length);
    for (const target of seen[0].targets) for (const v of target) expect(Number.isFinite(v)).toBe(true);
  }

  // the window changing shape while it is split in eight: upright and wide grids, neither leaving the
  // game broken or a camera off its marble
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
    expect(shown[1], `invariants at ${size.width}x${size.height}`).toEqual([]);
    expect(shown[0].views).toBe(8);
  }

  // the board's button turns it off again, following nobody, though the picks themselves are kept
  await page.locator('#toSplit').click();
  await expect(page.locator('#toSplit')).not.toHaveClass(/on/);
  await expect(page.locator('#toSplit')).toHaveText('Split');
  await expect(page.locator('#tags')).toBeHidden();
  cameras = await page.evaluate(() => window.game!.cameras());
  expect(cameras.on).toBe(false);
  expect(cameras.marbles).toEqual([]);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('a piece raced under physics through the page: every marble home, in order, a splitter and all', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 7, paused: true });
  // First Drop, a peg board and a gate, is one physics races now: raced through the page, every marble home
  await page.evaluate(() => window.game!.release());
  await play(page, 120, 'the off down First Drop under physics');
  expect(await page.evaluate(() => window.game!.settle(60))).toBeGreaterThan(0);
  const dropped = await page.evaluate(() => window.game!.state());
  expect(dropped.over).toBe(true);
  expect(dropped.finished, 'every marble home down First Drop, past its gate, under physics').toBe(8);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  await page.evaluate(() => {
    const g = window.game!;
    g.browse('pieces');
    g.pick(g.content().catalog.indexOf('Left turn'));
  });
  await page.evaluate(() => window.game!.release());
  await play(page, 60, 'the off under physics');
  const away = await page.evaluate(() => window.game!.state());
  expect(away.racing, 'they are away').toBeGreaterThan(0);
  const took = await page.evaluate(() => window.game!.settle(30));
  expect(took).toBeGreaterThan(0);
  const done = await page.evaluate(() => window.game!.state());
  expect(done.over).toBe(true);
  expect(done.finished, 'every marble home').toBe(8);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  // placed in the order they came, and the board says so
  const places = await page.evaluate(() => window.game!.marbles().map((m) => m.place));
  expect([...places].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  await expect(page.locator('#order li').first()).toHaveClass(/won/);
  // a run built of the pieces redesigned for physics races on physics too: a drop under its grid into a brake
  await page.evaluate(() => {
    const g = window.game!;
    g.browse('designs');
    for (const k of ['drop', 'brake', 'finish'] as const) g.lay(k);
  });
  expect(await page.evaluate(() => window.game!.designer().pieces)).toEqual(['start', 'drop', 'brake', 'finish']);
  // kept, since a run still being built is not let go; the test's own save, in a browser of its own
  expect(await page.evaluate(() => window.game!.keep('Drop and brake'))).toEqual([]);
  await page.evaluate(() => window.game!.release());
  await play(page, 60, 'the off down a drop and a brake under physics');
  expect(await page.evaluate(() => window.game!.settle(30))).toBeGreaterThan(0);
  const braked = await page.evaluate(() => window.game!.state());
  expect(braked.over).toBe(true);
  expect(braked.finished, 'every marble home off the drop and through the brake').toBe(8);
  expect(braked.lost + braked.stalled).toBe(0);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  // and a splitter, the field parted into two lanes and brought together again, raced home under physics too
  await page.evaluate(() => {
    const g = window.game!;
    g.browse('pieces');
    g.pick(g.content().catalog.indexOf('Splitter'));
  });
  await page.evaluate(() => window.game!.release());
  await play(page, 60, 'the off through a splitter under physics');
  expect(await page.evaluate(() => window.game!.settle(30))).toBeGreaterThan(0);
  const parted = await page.evaluate(() => window.game!.state());
  expect(parted.over).toBe(true);
  expect(parted.finished, 'every marble home through both lanes').toBe(8);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('the split turned on with fewer than two picked chases the leader as if it were off', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 3, paused: true });
  // one pick is not enough for a split: the screen stays whole and the usual chase camera keeps working
  await page.evaluate(() => {
    const g = window.game!;
    g.claim(0);
    g.split(true);
    g.release();
  });
  expect((await page.evaluate(() => window.game!.cameras())).views, 'one pick is not a split').toBe(0);
  const before = await page.evaluate(() => window.game!.chase());
  await page.evaluate(() => window.game!.step(200));
  const after = await page.evaluate(() => window.game!.chase());
  expect(after, 'the chase camera moved with the leader, not frozen with the split unusably on').not.toEqual(before);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('a run built with a split, a lane at a time, joined, kept, raced, and put back on after a reload', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 5, paused: true });
  const designer = () => page.evaluate(() => window.game!.designer());
  const piece = (name: string) => page.locator('#palette').getByRole('button', { name, exact: true });
  const left = page.locator('#laneLeft'),
    right = page.locator('#laneRight');

  await page.locator('#toDesigns').click();
  await expect(page.locator('#lanes'), 'no lanes to choose with one end open').toBeHidden();
  for (const name of ['Ramp', 'Splitter']) await piece(name).click();
  // two ends open: the lanes shown, the right one chosen, and a second split and the end refused
  await expect(page.locator('#lanes')).toBeVisible();
  await expect(right).toHaveAttribute('aria-pressed', 'true');
  await expect(left).toHaveAttribute('aria-pressed', 'false');
  await expect(piece('Splitter')).toBeDisabled();
  await expect(piece('The end')).toBeDisabled();
  await expect(piece('Joiner'), 'side by side as they part, so the split can close again at once').toBeEnabled();
  expect((await designer()).ends).toHaveLength(2);

  // the right lane a drop and a straight, the left two ramps: side by side, by routes of different length
  await piece('Drop').click();
  await expect(piece('Joiner'), 'the lanes a level apart').toBeDisabled();
  await piece('Straight').click();
  await left.click();
  await expect(left).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['Ramp', 'Ramp']) await piece(name).click();
  expect((await designer()).lane).toBe('left');
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  await expect(piece('Joiner')).toBeEnabled();
  await piece('Joiner').click();
  await expect(page.locator('#lanes'), 'one end again').toBeHidden();
  for (const name of ['Straight', 'The end']) await piece(name).click();
  expect((await designer()).pieces).toEqual([
    'start',
    'ramp',
    'splitter',
    'drop',
    'straight',
    'ramp',
    'ramp',
    'joiner',
    'straight',
    'finish',
  ]);
  await expect(page.locator('#problems')).toHaveText('sound, and ready to keep');

  // undo takes the last piece laid, and the joiner reopens the lanes, the left one chosen, which it went on last from
  for (let n = 0; n < 3; n++) await page.locator('#undo').click();
  await expect(page.locator('#lanes')).toBeVisible();
  await expect(left).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['Joiner', 'Straight', 'The end']) await piece(name).click();

  // kept, raced home, and put back on after a reload
  await page.locator('#designName').fill('Two ways down');
  await page.locator('#keep').click();
  const raced = await page.evaluate(() => {
    const g = window.game!;
    g.release();
    g.settle(60);
    g.save();
    return [g.state(), g.invariants()] as const;
  });
  expect(raced[1]).toEqual([]);
  expect(raced[0].over).toBe(true);
  expect(raced[0].finished).toBe(8);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.game?.ready ?? false), { timeout: 60_000 }).toBe(true);
  const back = await page.evaluate(() => window.game!.state());
  expect(back.runId).toBe(raced[0].runId);
  await expect(page.locator('#title')).toHaveText('Two ways down');
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('a run built on the board a piece at a time, kept, raced, and put back on after a reload', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 5, paused: true });
  const designer = () => page.evaluate(() => window.game!.designer());
  const piece = (name: string) => page.locator('#palette').getByRole('button', { name, exact: true });

  // the designs shelf, with nothing on it yet, is the builder: a start gate, and nothing to keep
  await page.locator('#toDesigns').click();
  expect((await designer()).building).toBe(true);
  await expect(page.locator('#build')).toBeVisible();
  await expect(page.locator('#order')).toBeHidden();
  await expect(page.locator('#keep')).toBeDisabled();
  await expect(page.locator('#undo')).toBeDisabled();
  await expect(page.locator('#problems')).toContainText('no finish');

  // built from the palette, each piece on where the last hands a marble on, the run framed as it grows
  for (const name of ['Ramp', 'Peg board']) await piece(name).click();
  // a grid over the peg board, the last piece laid: the button pressed while it has one, and put over that piece
  const grid = page.locator('#grid');
  await expect(grid).toHaveAttribute('aria-pressed', 'false');
  await grid.click();
  await expect(grid).toHaveAttribute('aria-pressed', 'true');
  expect((await designer()).lids).toEqual([2]);
  for (const name of ['Left turn', 'Ramp', 'The end']) await piece(name).click();
  expect((await designer()).pieces).toEqual(['start', 'ramp', 'pegs', 'curveLeft', 'ramp', 'finish']);
  expect((await designer()).lids, 'the grid stays over the board it was put over').toEqual([2]);
  await expect(page.locator('#problems')).toHaveText('sound, and ready to keep');
  await expect(page.locator('#keep')).toBeEnabled();
  await expect(piece('Ramp'), 'nothing goes on after the end').toBeDisabled();
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);

  // the end taken off again, and put back
  await page.locator('#undo').click();
  await expect(page.locator('#keep')).toBeDisabled();
  await expect(piece('Ramp')).toBeEnabled();
  await piece('The end').click();

  // nothing goes down a run still being built, and a key typed into its name is the name's and not the game's:
  // this one has a space in it, which lets them go, an R, which sets up again, an N, which puts on the next run,
  // and a 1, which picks a marble
  await page.keyboard.press(' ');
  expect((await page.evaluate(() => window.game!.state())).racing).toBe(0);
  await page.locator('#designName').fill('');
  await page.locator('#designName').pressSequentially('Down and round 1');
  const state = await page.evaluate(() => window.game!.state());
  expect(state.racing).toBe(0);
  expect((await page.evaluate(() => window.game!.marbles())).every((m) => m.player === 0)).toBe(true);
  expect((await designer()).building, 'still building, not put on to the next run').toBe(true);
  // and out of the field, N and C, which would put on another run or shelf, do not throw away a run not yet kept
  await page.locator('#designName').blur();
  await page.keyboard.press('n');
  await page.keyboard.press('c');
  expect((await designer()).pieces.length, 'the run built so far, all of it').toBe(6);

  // kept: on the designs shelf, under its name, with its own buttons, and raced like any run
  await page.locator('#keep').click();
  const kept = await designer();
  expect(kept.building).toBe(false);
  expect(kept.designs).toEqual([{ id: 'design-1', name: 'Down and round 1', pieces: 6 }]);
  await expect(page.locator('#title')).toHaveText('Down and round 1');
  await expect(page.locator('#designTools')).toBeVisible();
  await expect(page.locator('#toDesigns')).toHaveClass(/on/);
  const raced = await page.evaluate(() => {
    const g = window.game!;
    g.release();
    g.settle(60);
    g.save();
    return [g.state(), g.invariants()] as const;
  });
  expect(raced[1]).toEqual([]);
  expect(raced[0].over).toBe(true);
  expect(raced[0].runId).toBe('design-1');
  expect(raced[0].best).toBeGreaterThan(0);
  await expect(page.locator('#best')).toContainText('best');

  // a reload puts it back on, best and all
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.game?.ready ?? false), { timeout: 60_000 }).toBe(true);
  const back = await page.evaluate(() => window.game!.state());
  expect(back.shelf).toBe('designs');
  expect(back.runId).toBe('design-1');
  expect(back.best).toBeCloseTo(raced[0].best, 5);
  await expect(page.locator('#title')).toHaveText('Down and round 1');
  // and its grid with it, over the board it was put over
  const reloaded = JSON.parse(await page.evaluate(() => window.game!.save())) as {
    designs: { pieces: { lid?: boolean }[] }[];
  };
  expect(reloaded.designs[0].pieces.flatMap((p, i) => (p.lid ? [i] : []))).toEqual([2]);

  // thrown away: nothing left on the shelf, so the builder again, and the save forgets it and its best
  await page.locator('#forget').click();
  const gone = await designer();
  expect(gone.building).toBe(true);
  expect(gone.designs).toEqual([]);
  const save = JSON.parse(await page.evaluate(() => window.game!.save())) as { bests: object; run: string };
  expect(save.bests).not.toHaveProperty('design-1');
  expect(save.run).toBe('');

  // left unkept, back to the runs
  await page.locator('#leave').click();
  expect((await page.evaluate(() => window.game!.state())).shelf).toBe('runs');
  await expect(page.locator('#build')).toBeHidden();
  await expect(page.locator('#order')).toBeVisible();
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('a run dressed as a works while it is built, made plain and dressed again, kept, raced, and dressed after a reload', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 5, paused: true });
  const decor = () => page.evaluate(() => window.game!.decor());
  const piece = (name: string) => page.locator('#palette').getByRole('button', { name, exact: true });
  const plain = page.locator('#themes [data-theme="plain"]'),
    works = page.locator('#themes [data-theme="industrial"]');

  // the runs that come with the game are dressed, and the catalog's pieces are not
  expect((await decor()).theme).toBe('industrial');
  expect((await decor()).kinds.lamp).toBeGreaterThan(0);
  await page.locator('#toDesigns').click();
  await expect(plain, 'a run begun plain').toHaveAttribute('aria-pressed', 'true');
  for (const name of ['Ramp', 'Straight', 'Sweeper', 'Straight', 'Drop', 'Straight']) await piece(name).click();
  expect(Object.values((await decor()).kinds).every((n) => n === 0)).toBe(true);

  // dressed at a press, made plain again, and dressed once more, the pieces untouched by any of it
  await works.click();
  await expect(works).toHaveAttribute('aria-pressed', 'true');
  await expect(plain).toHaveAttribute('aria-pressed', 'false');
  const dressed = await decor();
  expect(dressed.theme).toBe('industrial');
  expect(dressed.kinds.stripes, 'stripes by the sweeper').toBeGreaterThan(0);
  await plain.click();
  expect(Object.values((await decor()).kinds).every((n) => n === 0)).toBe(true);
  // the sweet factory in place of the works, with the sweet factory's own things and none of the works'
  const sweets = page.locator('#themes [data-theme="sweets"]');
  await sweets.click();
  await expect(sweets).toHaveAttribute('aria-pressed', 'true');
  await expect(works).toHaveAttribute('aria-pressed', 'false');
  const sweet = await decor();
  expect(sweet.theme).toBe('sweets');
  expect(sweet.kinds.candyStripes, 'candy stripes by the sweeper').toBeGreaterThan(0);
  expect(sweet.kinds.stripes).toBe(0);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  await works.click();
  expect(await decor()).toEqual(dressed);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);

  // a piece laid after keeps it dressed; kept, raced home, and put back on dressed after a reload
  await piece('The end').click();
  expect((await decor()).theme).toBe('industrial');
  await page.locator('#designName').fill('The works');
  await page.locator('#keep').click();
  const raced = await page.evaluate(() => {
    const g = window.game!;
    g.release();
    g.settle(60);
    g.save();
    return [g.state(), g.invariants(), g.decor()] as const;
  });
  expect(raced[1]).toEqual([]);
  expect(raced[0].finished).toBe(8);
  expect(raced[2].theme).toBe('industrial');
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.game?.ready ?? false), { timeout: 60_000 }).toBe(true);
  await expect(page.locator('#title')).toHaveText('The works');
  const back = await decor();
  expect(back.theme).toBe('industrial');
  expect(back.kinds).toEqual(raced[2].kinds);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});
