/**
 * The splitter and the joiner in the designer: a splitter opens two ends, a
 * lane each, and the player chooses which the next piece goes on; a joiner
 * closes the two once they end side by side, whatever way each took to get
 * there and however long. Everything else is the designer as it was: a piece
 * on the end, the undo the last piece laid.
 */
import { describe, expect, it } from 'vitest';
import { Designer, PALETTE } from '../src/designer';
import { checkInvariants } from '../src/invariants';
import { type Kind, check, compile, exitOf } from '../src/track';
import { newGame, race } from './helpers';

/** A designer with `kinds` laid, each where the designer lays it. */
function built(kinds: Kind[]): Designer {
  const d = new Designer('Mine');
  for (const k of kinds) expect(d.place(k), `${k} laid`).toBe(true);
  return d;
}

/** Lanes that end side by side by routes of different length: a drop and a straight, and two ramps. */
function lanes(): Designer {
  const d = built(['ramp', 'splitter', 'drop', 'straight']);
  expect(d.choose('left')).toBe(true);
  for (const k of ['ramp', 'ramp'] as const) expect(d.place(k), `${k} on the left`).toBe(true);
  return d;
}

describe('the designer, with a splitter and a joiner', () => {
  it('offers the splitter and the joiner', () => {
    expect(PALETTE).toContain('splitter');
    expect(PALETTE).toContain('joiner');
  });

  it('opens two ends at a splitter, the right lane chosen, and lays the next piece on the chosen one', () => {
    const d = built(['ramp', 'splitter']);
    const splitter = d.run.pieces[2];
    const right = exitOf(splitter)!;
    expect(d.ends).toHaveLength(2);
    expect(d.lane).toBe('right');
    expect(d.open).toEqual(right);
    // the left lane is a cell across from the right, to the left of the way the field is going
    const left = d.ends.find((e) => e.y !== right.y || e.x !== right.x)!;
    expect(left).toEqual({ ...right, y: right.y + 1 });
    d.place('straight');
    expect(d.run.pieces[3]).toEqual({ kind: 'straight', ...right });
    expect(d.choose('left')).toBe(true);
    expect(d.lane).toBe('left');
    expect(d.open).toEqual(left);
    d.place('straight');
    expect(d.run.pieces[4]).toEqual({ kind: 'straight', ...left });
  });

  it('has no lanes to choose with one end open', () => {
    const d = built(['ramp']);
    expect(d.ends).toHaveLength(1);
    expect(d.lane).toBeNull();
    expect(d.choose('left')).toBe(false);
    expect(d.choose('right')).toBe(false);
  });

  it('takes the last piece laid away, whichever lane it is on, and chooses that lane', () => {
    const d = built(['ramp', 'splitter', 'straight']);
    d.choose('left');
    d.place('ramp');
    d.choose('right');
    expect(d.undo()).toBe(true);
    expect(d.run.pieces.map((p) => p.kind)).toEqual(['start', 'ramp', 'splitter', 'straight']);
    expect(d.lane, 'the left lane, which the ramp was taken off').toBe('left');
    expect(d.undo()).toBe(true);
    expect(d.lane).toBe('right');
    expect(d.undo(), 'the splitter').toBe(true);
    expect(d.ends).toHaveLength(1);
    expect(d.lane).toBeNull();
  });

  it('joins the lanes once they end side by side, however long each is, and builds on from one end', () => {
    const d = lanes();
    expect(d.refuses('joiner')).toBe('');
    // laid while the left lane is chosen, it still goes on the right-hand end, which is where it has to go
    expect(d.place('joiner')).toBe(true);
    const joiner = d.run.pieces[d.run.pieces.length - 1];
    expect(joiner).toEqual({ kind: 'joiner', ...exitOf(d.run.pieces[4])! });
    expect(d.ends).toEqual([exitOf(joiner)]);
    expect(d.lane).toBeNull();
    d.place('straight');
    d.place('finish');
    expect(d.problems()).toEqual([]);
    const track = compile(d.run);
    const long = (branch: number) =>
      track.segments.filter((s) => s.branch === branch).reduce((sum, s) => sum + s.length, 0);
    expect(Math.abs(long(1) - long(2)), 'lanes of different lengths').toBeGreaterThan(3);
  });

  it('takes a joiner away and opens both lanes again', () => {
    const d = lanes();
    d.place('joiner');
    expect(d.undo()).toBe(true);
    expect(d.ends).toHaveLength(2);
    expect(d.lane).toBe('left');
  });

  it('refuses a joiner until the lanes end side by side, and says how they differ', () => {
    expect(built(['ramp']).refuses('joiner')).toMatch(/no lanes to join/);
    const d = built(['ramp', 'splitter', 'drop', 'straight']);
    expect(d.refuses('joiner'), 'the left lane still at the top').toMatch(/level/);
    d.choose('left');
    d.place('drop');
    expect(d.refuses('joiner'), 'level, and a cell across, but the right lane a cell further on').toMatch(/along/);
    d.place('straight');
    expect(d.refuses('joiner'), 'side by side').toBe('');
    d.place('straight');
    expect(d.refuses('joiner'), 'the left lane now a cell further on').toMatch(/along/);
    d.undo();
    d.choose('right');
    d.place('curveLeft');
    expect(d.refuses('joiner')).toMatch(/way/);
  });

  it('refuses a second splitter, and the end, while two lanes are open', () => {
    const d = built(['ramp', 'splitter']);
    expect(d.refuses('splitter')).toMatch(/one split/);
    expect(d.refuses('finish')).toMatch(/join the lanes/);
    expect(d.place('finish')).toBe(false);
  });

  it('says a piece on one lane standing in the other is wrong with the run', () => {
    // a spiral turning right on the left lane swings round into the right lane's cell, over its drop
    const d = built(['ramp', 'splitter', 'drop']);
    d.choose('left');
    d.place('spiralRight');
    d.place('straight');
    d.place('joiner');
    d.place('finish');
    expect(d.problems().join('\n')).toMatch(/run through each other/);
  });

  it('no longer asks the two lanes to be about the same length', () => {
    const d = built(['ramp', 'splitter', 'drop', 'straight', 'straight']);
    d.choose('left');
    for (const k of ['spiralLeft', 'straight', 'straight', 'straight'] as const) d.place(k);
    d.place('joiner');
    d.place('finish');
    expect(check(d.run)).toEqual([]);
  });
});

describe('the game, building lanes', () => {
  it('chooses a lane, keeps a design with a split, and races it home with no rule broken', () => {
    const { game } = newGame(3);
    game.browse('designs');
    for (const k of ['ramp', 'splitter', 'drop', 'straight'] as const) expect(game.lay(k), k).toBe(true);
    expect(game.lane('left')).toBe(true);
    expect(game.designer!.lane).toBe('left');
    for (const k of ['ramp', 'ramp', 'joiner', 'straight', 'finish'] as const) expect(game.lay(k), k).toBe(true);
    expect(checkInvariants(game)).toEqual([]);
    expect(game.keep('Two ways down')).toEqual([]);
    expect(game.current.pieces.some((p) => p.kind === 'splitter')).toBe(true);
    expect(race(game)).toBe(true);
    expect(game.marbles.finishers).toBe(game.marbles.count);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('chooses no lane when nothing is being built, or only one end is open', () => {
    const { game } = newGame(3);
    expect(game.lane('left')).toBe(false);
    game.browse('designs');
    game.lay('ramp');
    expect(game.lane('left')).toBe(false);
  });
});
