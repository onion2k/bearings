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

const DIR = new URL('saves/', import.meta.url);
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();
const read = (file: string) => readFileSync(new URL(file, DIR), 'utf8');

/** What each save was worth when it was written, and what loading it must keep. */
const KEPT: Record<string, Record<string, unknown>> = {
  // written when a save held what had been banked, before the game was a race at all
  '01-first.json': { races: 0, best: 0 },
  '02-race.json': { races: 12, best: 5.21 },
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

      it('comes back as it went, written again in the shape of today', () => {
        const store = memoryStore(read(file));
        const before = new Progress(store).save;
        expect(store.json, 'loading alone must not write').toBe(read(file));
        const game = new Game(new Progress(store));
        game.persist();
        const after = new Progress(memoryStore(store.json)).save;
        expect(after).toEqual(before);
      });
    });
  }

  it('takes defaults for what an old save lacks, and shrugs at what it cannot read', () => {
    expect(new Progress(memoryStore('{"races": 3}')).save).toEqual({ races: 3, best: 0 });
    expect(new Progress(memoryStore('not json')).save).toEqual({ races: 0, best: 0 });
    expect(new Progress(memoryStore('{"races": "lots"}')).save).toEqual({ races: 0, best: 0 });
    // the shape before this game was a race at all: nothing it held means anything now, and it opens anyway
    expect(new Progress(memoryStore('{"bank": 7, "banked": 7}')).save).toEqual({ races: 0, best: 0 });
  });

  it('has the shape the game writes now: a new field means a new file here', () => {
    const game = new Game(new Progress(memoryStore()));
    game.persist();
    const now = Object.keys(JSON.parse(JSON.stringify(game.progress.save)) as object).sort();
    const newest = Object.keys(JSON.parse(read(files[files.length - 1])) as object).sort();
    expect(newest, 'add a save in the new shape to test/saves').toEqual(now);
  });
});
