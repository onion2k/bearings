import { describe, expect, it } from 'vitest';
import { Designer, MAX_DESIGNS, PALETTE, kept } from '../src/designer';
import { checkInvariants } from '../src/invariants';
import { Game } from '../src/game';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { type Kind, MAX_PIECES, MAX_SAMPLES, MOVING_MOST, check, compile, exitOf } from '../src/track';
import { newGame, race } from './helpers';

/** A run a player might build: down, across a peg board, round a corner, down again, and home. */
const SOUND: Kind[] = ['ramp', 'pegs', 'curveLeft', 'ramp', 'finish'];

function built(kinds: Kind[]): Designer {
  const d = new Designer('Mine');
  for (const k of kinds) expect(d.place(k), `${k} laid`).toBe(true);
  return d;
}

describe('the designer', () => {
  it('begins with a start gate and nothing else, open where the gate hands a marble on', () => {
    const d = new Designer('Mine');
    expect(d.run.pieces.map((p) => p.kind)).toEqual(['start']);
    expect(d.open).toEqual(exitOf(d.run.pieces[0]));
  });

  it('lays each piece where the one before it hands a marble on, facing the way it is going', () => {
    const d = built(['ramp', 'curveLeft', 'straight']);
    const [start, ramp, turn, straight] = d.run.pieces;
    expect(ramp).toEqual({ kind: 'ramp', ...exitOf(start)! });
    expect(turn).toEqual({ kind: 'curveLeft', ...exitOf(ramp)! });
    // a left turn has done the turning, so the piece after it faces a quarter round
    expect(straight.facing).toBe(1);
    expect(straight).toEqual({ kind: 'straight', ...exitOf(turn)! });
  });

  it('takes the last piece away, one at a time, and never the start', () => {
    const d = built(['ramp', 'pegs']);
    expect(d.undo()).toBe(true);
    expect(d.run.pieces.map((p) => p.kind)).toEqual(['start', 'ramp']);
    expect(d.undo()).toBe(true);
    expect(d.undo(), 'nothing left to take away but the start').toBe(false);
    expect(d.run.pieces.map((p) => p.kind)).toEqual(['start']);
  });

  it('lays nothing after the end, and lays again once the end is taken away', () => {
    const d = built(['ramp', 'finish']);
    expect(d.open).toBeNull();
    expect(d.refuses('ramp')).toMatch(/ended/);
    expect(d.place('ramp')).toBe(false);
    d.undo();
    expect(d.place('ramp')).toBe(true);
  });

  it('offers every kind but the start and the two that branch, the end among them', () => {
    expect(PALETTE).toContain('finish');
    expect(PALETTE).toContain('funnel');
    for (const k of ['start', 'splitter', 'joiner'] as const) {
      expect(PALETTE).not.toContain(k);
      expect(new Designer('Mine').place(k)).toBe(false);
    }
  });

  it(`lays no more than ${MAX_PIECES} pieces`, () => {
    const d = new Designer('Mine');
    while (d.place('straight'));
    expect(d.run.pieces.length).toBe(MAX_PIECES);
    expect(d.refuses('straight')).toMatch(/pieces/);
  });

  it(`lays no more than ${MOVING_MOST} of a moving piece, as many as the scene can draw`, () => {
    const d = new Designer('Mine');
    for (let i = 0; i < MOVING_MOST; i++) expect(d.place('sweeper')).toBe(true);
    expect(d.refuses('sweeper')).toMatch(/sweepers/);
    expect(d.place('gate'), 'another kind of moving piece has its own count').toBe(true);
  });

  it('lays nothing that would take the track past the samples it may have', () => {
    const d = new Designer('Mine');
    // a spiral is the most track a piece is: a tower of them runs out of samples before it runs out of pieces
    while (d.place('spiralLeft'));
    expect(d.run.pieces.length).toBeLessThan(MAX_PIECES);
    expect(d.refuses('spiralLeft')).toMatch(/long/);
    expect(compile(d.run).samples).toBeLessThanOrEqual(MAX_SAMPLES);
  });

  it('says what is wrong with the run until it is sound, and then nothing', () => {
    const d = new Designer('Mine');
    expect(d.problems().join('\n')).toMatch(/no finish/);
    for (const k of SOUND) d.place(k);
    expect(d.problems()).toEqual([]);
    expect(d.sound).toBe(true);
  });

  it('says so when the run comes back round on to itself', () => {
    const d = built(['curveLeft', 'curveLeft', 'curveLeft', 'curveLeft', 'straight']);
    expect(d.problems().join('\n')).toMatch(/same place|through each other/);
    expect(d.sound).toBe(false);
  });
});

describe('a design kept', () => {
  const run = built(SOUND).run;

  it('is given the first id there is, and one past the highest after that', () => {
    expect(kept([], 'Mine', run.pieces).id).toBe('design-1');
    const a = kept([], 'A', run.pieces);
    const c = { ...kept([], 'C', run.pieces), id: 'design-7' };
    expect(kept([a, c], 'D', run.pieces).id).toBe('design-8');
  });

  it('is named what the player called it, tidied, or given a name where they gave none', () => {
    expect(kept([], '  My   run  ', run.pieces).name).toBe('My run');
    expect(kept([], '', run.pieces).name).toBe('My run 1');
    expect(kept([], 'x'.repeat(200), run.pieces).name.length).toBeLessThanOrEqual(32);
  });

  it('keeps a copy of the pieces, so building on does not change what was kept', () => {
    const d = built(SOUND);
    const design = kept([], 'Mine', d.run.pieces);
    d.undo();
    d.place('drop');
    expect(design.pieces.map((p) => p.kind)).toEqual(['start', ...SOUND]);
    expect(check(design)).toEqual([]);
  });
});

describe('the game, building a run', () => {
  it('puts the run being built on as it grows, and lets nothing go while it is being built', () => {
    const { game } = newGame(1);
    game.build();
    expect(game.building).toBe(true);
    expect(game.shelf).toBe('designs');
    const was = game.track.segments.length;
    expect(game.lay('ramp')).toBe(true);
    expect(game.track.segments.length).toBe(was + 1);
    game.release();
    expect(game.away).toBe(false);
    for (let f = 0; f < 60; f++) game.step(1 / 60);
    expect(checkInvariants(game)).toEqual([]);
    expect(game.undo()).toBe(true);
    expect(game.track.segments.length).toBe(was);
  });

  it('keeps a sound run, puts it on, and races it like any other, its best kept', () => {
    const { game } = newGame(1);
    game.build();
    for (const k of SOUND) game.lay(k);
    expect(game.keep('Mine')).toEqual([]);
    expect(game.building).toBe(false);
    expect(game.shelf).toBe('designs');
    expect(game.current.name).toBe('Mine');
    const { id } = game.current;
    expect(game.progress.save.designs.map((d) => d.id)).toEqual([id]);
    expect(game.progress.save.run, 'put back on next time, as any run picked is').toBe(id);
    expect(race(game)).toBe(true);
    expect(game.progress.races).toBe(1);
    expect(game.progress.best(id)).toBeGreaterThan(0);
    expect(game.best()).toBe(game.progress.best(id));
    expect(checkInvariants(game)).toEqual([]);
  });

  it('refuses to keep a run with something wrong with it, says what, and builds on', () => {
    const { game } = newGame(1);
    game.build();
    game.lay('ramp');
    expect(game.keep('Mine').join('\n')).toMatch(/no finish/);
    expect(game.building).toBe(true);
    expect(game.progress.save.designs).toEqual([]);
  });

  it(`keeps no more than ${MAX_DESIGNS} designs, and says so`, () => {
    const { game } = newGame(1);
    for (let i = 0; i < MAX_DESIGNS; i++) {
      game.build();
      for (const k of SOUND) game.lay(k);
      expect(game.keep('')).toEqual([]);
    }
    game.build();
    for (const k of SOUND) game.lay(k);
    expect(game.keep('One more').join('\n')).toMatch(/20/);
    expect(game.progress.save.designs.length).toBe(MAX_DESIGNS);
    expect(game.building).toBe(true);
  });

  it('forgets a design, and its best with it, and puts on the next or goes back to building', () => {
    const { game } = newGame(1);
    for (const name of ['A', 'B']) {
      game.build();
      for (const k of SOUND) game.lay(k);
      game.keep(name);
    }
    race(game);
    const b = game.current.id;
    expect(game.progress.best(b)).toBeGreaterThan(0);
    game.forget(game.run);
    expect(game.progress.save.designs.map((d) => d.name)).toEqual(['A']);
    expect(game.progress.best(b)).toBe(0);
    expect(game.progress.save.run, 'a design gone is not put back on').toBe('');
    expect(game.current.name).toBe('A');
    expect(checkInvariants(game)).toEqual([]);
    game.forget(0);
    expect(game.progress.save.designs).toEqual([]);
    expect(game.building, 'with nothing left on the shelf, the builder').toBe(true);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('leaves building for the shelf it came from, and the run it was on, throwing the unsaved run away', () => {
    const { game } = newGame(1);
    game.pick(2);
    game.build();
    game.lay('ramp');
    game.leave();
    expect(game.building).toBe(false);
    expect(game.shelf).toBe('runs');
    expect(game.run).toBe(2);
    expect(game.progress.save.designs).toEqual([]);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('opens the builder when the designs shelf is browsed with nothing on it, and the shelf when there is', () => {
    const { game } = newGame(1);
    game.browse('designs');
    expect(game.building).toBe(true);
    for (const k of SOUND) game.lay(k);
    game.keep('Mine');
    game.browse('runs');
    game.browse('designs');
    expect(game.building).toBe(false);
    expect(game.current.name).toBe('Mine');
  });

  it('leaves the build for whatever run is put on, or another shelf', () => {
    const { game } = newGame(1);
    game.build();
    game.pick(0);
    expect(game.building, 'nothing kept, and nothing to put on: back to building').toBe(true);
    game.browse('pieces');
    expect(game.building).toBe(false);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('comes back after a reload, put back on if it was the run on', () => {
    const { game, store } = newGame(1);
    game.build();
    for (const k of SOUND) game.lay(k);
    game.keep('Mine');
    race(game);
    const { id } = game.current;
    const again = new Game(new Progress(memoryStore(store.json)), {}, { random: seeded(2) });
    expect(again.shelf).toBe('designs');
    expect(again.current.id).toBe(id);
    expect(again.progress.best(id), 'a best on a design is not dropped as a run the game has not got').toBeGreaterThan(
      0,
    );
    expect(checkInvariants(again)).toEqual([]);
  });

  it('drops from a save a design that is not sound, not a design, or one too many', () => {
    const sound = kept([], 'Fine', built(SOUND).run.pieces);
    const broken = { ...kept([sound], 'Broken', built(['ramp']).run.pieces) };
    const strange = { id: 'design-9', name: 'Strange', pieces: [{ kind: 'trampoline', x: 0, y: 0, z: 0, facing: 0 }] };
    const many = Array.from({ length: MAX_DESIGNS + 5 }, (_, i) => ({ ...sound, id: `design-${i + 20}` }));
    const json = JSON.stringify({ races: 1, run: '', bests: {}, designs: [sound, broken, strange, 7, sound, ...many] });
    const { designs } = new Progress(memoryStore(json)).save;
    expect(designs[0]).toEqual(sound);
    expect(designs.map((d) => d.id)).not.toContain(broken.id);
    expect(designs.map((d) => d.id)).not.toContain('design-9');
    expect(new Set(designs.map((d) => d.id)).size, 'no id twice').toBe(designs.length);
    expect(designs.length).toBe(MAX_DESIGNS);
  });
});
