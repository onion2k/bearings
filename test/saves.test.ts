/**
 * Saves from every shape the game has ever written, kept in `test/saves`, all
 * still loading and playing. A player's save outlives the code that wrote it.
 *
 * A save whose shape is new needs a file here. The last test sees to that: it
 * fails when the game writes a field no file in the corpus has.
 */
import { readFileSync, readdirSync } from 'node:fs';
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
        const game = new Game(new Progress(memoryStore(read(file))), {}, { random: seeded(7) });
        game.release();
        for (let f = 0; f < 300; f++) game.step(1 / 60);
        expect(checkInvariants(game)).toEqual([]);
      });

      it('comes back as it went, written again in the shape of today, less any best for a run that is gone', () => {
        const store = memoryStore(read(file));
        const before = new Progress(store).save;
        expect(store.json, 'loading alone must not write').toBe(read(file));
        const game = new Game(new Progress(store));
        game.persist();
        const after = new Progress(memoryStore(store.json)).save;
        const known = (id: string) => RUNS.some((r) => r.id === id) || before.designs.some((r) => r.id === id);
        const kept = Object.fromEntries(Object.entries(before.bests).filter(([id]) => known(id)));
        expect(after).toEqual({ ...before, bests: kept, run: known(before.run) ? before.run : '' });
      });
    });
  }

  it('takes defaults for what an old save lacks, and shrugs at what it cannot read', () => {
    const none = { races: 0, run: '', bests: {}, designs: [] };
    expect(new Progress(memoryStore('{"races": 3}')).save).toEqual({ ...none, races: 3 });
    expect(new Progress(memoryStore('not json')).save).toEqual(none);
    expect(new Progress(memoryStore('{"races": "lots"}')).save).toEqual(none);
    // the shape before this game was a race at all: nothing it held means anything now, and it opens anyway
    expect(new Progress(memoryStore('{"bank": 7, "banked": 7}')).save).toEqual(none);
  });

  it('has the shape the game writes now: a new field means a new file here', () => {
    const game = new Game(new Progress(memoryStore()));
    game.persist();
    const now = Object.keys(JSON.parse(JSON.stringify(game.progress.save)) as object).sort();
    const newest = Object.keys(JSON.parse(read(files[files.length - 1])) as object).sort();
    expect(newest, 'add a save in the new shape to test/saves').toEqual(now);
  });
});
