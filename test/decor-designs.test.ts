/**
 * A theme chosen in the builder: a run the player builds begins plain, is
 * dressed as a works or made plain again with a press, keeps its theme
 * through every piece laid and taken off, and is kept and read back with it.
 * The game dresses whatever run is on, for the page to draw; the race is the
 * same, marble for marble, whether it is dressed or not.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { THEME_KINDS } from '../src/decor';
import { Designer, readDesigns } from '../src/designer';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { FIRST } from '../src/runs';
import { newGame, race } from './helpers';

await RAPIER.init();

const pieces = FIRST.pieces;

describe('a theme in the builder', () => {
  it('begins plain, and is dressed and made plain again', () => {
    const d = new Designer('Mine');
    expect(d.run.theme).toBeUndefined();
    expect(d.dress('industrial')).toBe(true);
    expect(d.run.theme).toBe('industrial');
    expect(d.dress('plain')).toBe(true);
    expect('theme' in d.run, 'plain is written as nothing at all').toBe(false);
  });

  it('keeps its theme through pieces laid and taken off', () => {
    const d = new Designer('Mine');
    d.dress('industrial');
    d.place('ramp');
    d.place('drop');
    d.undo();
    expect(d.run.theme).toBe('industrial');
  });
});

describe('a theme in the game', () => {
  it('dresses the run being built as soon as it is chosen, and keeps a design with it', () => {
    const { game } = newGame(3);
    game.browse('designs');
    for (const k of ['ramp', 'straight', 'drop', 'straight'] as const) game.lay(k);
    expect(game.decor).toEqual([]);
    expect(game.dress('industrial')).toBe(true);
    expect(game.decor.length).toBeGreaterThan(0);
    game.lay('finish');
    expect(game.decor.length, 'still dressed after another piece').toBeGreaterThan(0);
    expect(game.keep('The works')).toEqual([]);
    const kept = game.progress.save.designs[game.progress.save.designs.length - 1];
    expect(kept.theme).toBe('industrial');
    expect(game.current.id).toBe(kept.id);
    expect(game.decor.length, 'the kept design put on dressed').toBeGreaterThan(0);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('dresses the run being built as a sweet factory, and keeps it so', () => {
    const { game } = newGame(3);
    game.browse('designs');
    for (const k of ['ramp', 'straight', 'drop', 'straight', 'sweeper', 'straight'] as const) game.lay(k);
    expect(game.dress('sweets')).toBe(true);
    const kinds = new Set(game.decor.map((d) => d.kind));
    for (const k of kinds) expect(THEME_KINDS.sweets, `a ${k}`).toContain(k);
    expect(kinds.has('candyStripes'), 'candy stripes by the sweeper').toBe(true);
    expect(game.dress('industrial')).toBe(true);
    expect(game.decor.map((d) => d.kind)).not.toContain('candyStripes');
    game.dress('sweets');
    game.lay('finish');
    expect(game.keep('Sugar rush')).toEqual([]);
    expect(game.progress.save.designs[game.progress.save.designs.length - 1].theme).toBe('sweets');
    expect(checkInvariants(game)).toEqual([]);
  });

  it('chooses no theme when nothing is being built', () => {
    const { game } = newGame(3);
    expect(game.dress('plain')).toBe(false);
    expect(game.current.theme).toBe('industrial');
  });

  it('dresses the runs that come with the game, and leaves the catalog of pieces plain', () => {
    const { game } = newGame(3);
    expect(game.decor.length).toBeGreaterThan(0);
    game.browse('pieces');
    expect(game.decor).toEqual([]);
  });

  it('races the same, marble for marble, dressed or plain', () => {
    const took = (theme: boolean) => {
      const save = JSON.stringify({
        races: 0,
        run: 'design-1',
        bests: {},
        designs: [{ id: 'design-1', name: 'Same', pieces, ...(theme ? { theme: 'industrial' } : {}) }],
      });
      const game = new Game(RAPIER, new Progress(memoryStore(save)), {}, { random: seeded(11) });
      expect(game.current.id).toBe('design-1');
      expect(game.decor.length > 0).toBe(theme);
      expect(race(game)).toBe(true);
      return Array.from(game.marbles.took);
    };
    expect(took(true)).toEqual(took(false));
  });
});

describe('a theme in a save', () => {
  it('is read back, and a design with none is plain', () => {
    const designs = readDesigns([
      { id: 'design-1', name: 'Dressed', theme: 'industrial', pieces },
      { id: 'design-2', name: 'Bare', pieces },
    ]);
    expect(designs.map((d) => d.theme)).toEqual(['industrial', undefined]);
    expect('theme' in designs[1]).toBe(false);
  });

  it('reads a sweet factory back', () => {
    expect(readDesigns([{ id: 'design-1', name: 'Sweet', theme: 'sweets', pieces }]).map((d) => d.theme)).toEqual([
      'sweets',
    ]);
  });

  it('turns away a design whose theme is not one the game has', () => {
    expect(readDesigns([{ id: 'design-1', name: 'Odd', theme: 'disco', pieces }])).toEqual([]);
    expect(readDesigns([{ id: 'design-1', name: 'Odd', theme: 3, pieces }])).toEqual([]);
  });
});
