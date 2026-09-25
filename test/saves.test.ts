/**
 * Saves from every shape the game has ever written, kept in `test/saves`, all
 * still loading and playing. A player's save outlives the code that wrote it.
 *
 * A save whose shape is new needs a file here. The last test sees to that: it
 * fails when the game writes a field no file in the corpus has.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { RAPIER } from './helpers';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { RUNS } from '../src/runs';

const DIR = new URL('saves/', import.meta.url);
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();
const read = (file: string) => readFileSync(new URL(file, DIR), 'utf8');

/** What each save was worth when it was written, and what loading it must keep. */
const KEPT: Record<string, Record<string, unknown>> = {
  // written when a save held what had been banked, before the game was a race at all
  '01-first.json': { races: 0, run: '', bests: {} },
  // written when there was one best for the whole game: nobody can say which run it was set on, so it goes
  '02-race.json': { races: 12, run: '', bests: {} },
  '03-runs.json': { races: 30, run: 'the-tower', bests: { 'first-drop': 5.02, 'the-tower': 5.61 } },
  // written once a player could build runs of their own: one kept, put on last, with a best on it
  '04-designs.json': { races: 41, run: 'design-1', bests: { 'first-drop': 5.02, 'design-1': 4.4 } },
  // written once a design could ask for a grid over a piece: two kept, the one put on last with grids over two
  '05-lids.json': { races: 57, run: 'design-2', bests: { 'first-drop-2': 5.02, 'design-1': 4.4, 'design-2': 6.1 } },
  // written once a design could split into two lanes and join them again: two kept, the lanes of the one put on last
  // of different lengths
  '06-lanes.json': { races: 64, run: 'design-2', bests: { 'first-drop-3': 2.74, 'design-1': 3.1, 'design-2': 3.4 } },
  // written when a design could be dressed: one dressed as a works, one left plain, and a best on each run
  '07-themes.json': { races: 12, run: 'design-1', bests: { 'first-drop-3': 2.74, 'design-1': 3.2 } },
  // written when a design could be dressed as a sweet factory as well as a works: one of each, the sweet one on
  '08-sweets.json': { races: 20, run: 'design-2', bests: { 'first-drop-3': 2.74, 'design-1': 3.2, 'design-2': 3.3 } },
};

describe('saves from every shape the game has written', () => {
  it('has a file for every shape, oldest first', () => {
    expect(files).toEqual(Object.keys(KEPT).sort());
  });

  for (const file of files) {
    describe(file, () => {
      it('loads with what it was worth kept', () => {
        const save = new Progress(memoryStore(read(file))).save;
        for (const [key, was] of Object.entries(KEPT[file])) expect(save[key as keyof typeof save]).toEqual(was);
        expect(Number.isFinite(save.races) && save.races >= 0).toBe(true);
      });

      it('plays on from where it left off, and breaks no rule', () => {
        const game = new Game(RAPIER, new Progress(memoryStore(read(file))), {}, { random: seeded(7) });
        game.release();
        for (let f = 0; f < 300; f++) game.step(1 / 60);
        expect(checkInvariants(game)).toEqual([]);
      });

      it('comes back as it went, written again in the shape of today, less any best for a run that is gone', () => {
        const store = memoryStore(read(file));
        const before = new Progress(store).save;
        expect(store.json, 'loading alone must not write').toBe(read(file));
        const game = new Game(RAPIER, new Progress(store));
        game.persist();
        const after = new Progress(memoryStore(store.json)).save;
        const known = (id: string) => RUNS.some((r) => r.id === id) || before.designs.some((r) => r.id === id);
        const kept = Object.fromEntries(Object.entries(before.bests).filter(([id]) => known(id)));
        expect(after).toEqual({ ...before, bests: kept, run: known(before.run) ? before.run : '' });
      });
    });
  }

  it('brings back a grid a design asked for, over the pieces it was asked for over', () => {
    const save = new Progress(memoryStore(read('05-lids.json'))).save;
    expect(save.designs[1].pieces.flatMap((p, i) => (p.lid ? [i] : []))).toEqual([1, 2]);
    expect(save.designs[0].pieces.some((p) => p.lid)).toBe(false);
  });

  it('brings back a design that splits and joins again, its lanes of different lengths, and races it home', () => {
    const game = new Game(RAPIER, new Progress(memoryStore(read('06-lanes.json'))), {}, { random: seeded(7) });
    expect(game.current.id).toBe('design-2');
    expect(game.current.pieces.map((p) => p.kind)).toContain('splitter');
    expect(game.current.pieces.map((p) => p.kind)).toContain('joiner');
    game.release();
    for (let f = 0; f < 60 * 60 && !game.over; f++) game.step(1 / 60);
    expect(game.marbles.finishers).toBe(game.marbles.count);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('brings back one design dressed as a works and one plain, and puts the dressed one on dressed', () => {
    const game = new Game(RAPIER, new Progress(memoryStore(read('07-themes.json'))), {}, { random: seeded(7) });
    const [dressed, plain] = game.progress.save.designs;
    expect(dressed.theme).toBe('industrial');
    expect('theme' in plain).toBe(false);
    expect(game.current.id).toBe('design-1');
    expect(game.decor.length).toBeGreaterThan(0);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('brings back a design dressed as a sweet factory beside one dressed as a works, and puts it on dressed so', () => {
    const game = new Game(RAPIER, new Progress(memoryStore(read('08-sweets.json'))), {}, { random: seeded(7) });
    expect(game.progress.save.designs.map((d) => d.theme)).toEqual(['industrial', 'sweets']);
    expect(game.current.id).toBe('design-2');
    expect(game.decor.map((d) => d.kind)).toContain('lollipop');
    expect(checkInvariants(game)).toEqual([]);
  });

  it('takes defaults for what an old save lacks, and shrugs at what it cannot read', () => {
    const none = { races: 0, run: '', bests: {}, designs: [] };
    expect(new Progress(memoryStore('{"races": 3}')).save).toEqual({ ...none, races: 3 });
    expect(new Progress(memoryStore('not json')).save).toEqual(none);
    expect(new Progress(memoryStore('{"races": "lots"}')).save).toEqual(none);
    // the shape before this game was a race at all: nothing it held means anything now, and it opens anyway
    expect(new Progress(memoryStore('{"bank": 7, "banked": 7}')).save).toEqual(none);
  });

  it('has the shape the game writes now: a new field means a new file here', () => {
    const game = new Game(RAPIER, new Progress(memoryStore()));
    game.persist();
    const now = Object.keys(JSON.parse(JSON.stringify(game.progress.save)) as object).sort();
    const newest = Object.keys(JSON.parse(read(files[files.length - 1])) as object).sort();
    expect(newest, 'add a save in the new shape to test/saves').toEqual(now);
  });
});
