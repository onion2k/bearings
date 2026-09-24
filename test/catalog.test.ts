/**
 * The catalog: every kind of piece there is, each set on its own between a
 * start and the end, named and said what it does, and each raced to the end
 * with every marble home. It is the one place every piece is tried by itself.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG, PIECES } from '../src/catalog';
import { Physics } from '../src/physics';
import { seeded } from '../src/random';
import { KINDS, check, checkTrack, compile } from '../src/track';
import { RAPIER } from './helpers';

const DT = 1 / 60;
// each kind is raced alone on 24 seeds in the physics tests; this is the catalog's own layout of it, on a few
const SEEDS = 2;

describe('the catalog of pieces', () => {
  it('has an entry for every kind of piece, and nothing that is not one', () => {
    expect(Object.keys(CATALOG).sort()).toEqual([...KINDS].sort());
    // every kind, and then the grid, which is not a kind but something any piece but three may have
    expect(PIECES.length).toBe(KINDS.length + 1);
    expect(PIECES[KINDS.length].id).toBe('piece-grid');
    expect(PIECES[KINDS.length].pieces.some((p) => p.lid)).toBe(true);
  });

  it('names every piece once, and says what each does', () => {
    expect(new Set(PIECES.map((p) => p.name)).size).toBe(PIECES.length);
    expect(new Set(PIECES.map((p) => p.id)).size).toBe(PIECES.length);
    for (const kind of KINDS) {
      expect(CATALOG[kind].name.length, kind).toBeGreaterThan(2);
      expect(CATALOG[kind].about.length, kind).toBeGreaterThan(20);
    }
  });

  for (const [k, piece] of PIECES.entries()) {
    // the grid is shown over a board, and is held to what the board is
    const kind = KINDS[k] ?? 'shallowBroad';
    describe(piece.name, () => {
      it(`is the ${kind}, set between a start and the end, and sound`, () => {
        expect(piece.pieces.some((p) => p.kind === kind)).toBe(true);
        expect(piece.pieces[0].kind).toBe('start');
        expect(piece.pieces[piece.pieces.length - 1].kind).toBe('finish');
        expect(check(piece)).toEqual([]);
        expect(checkTrack(compile(piece))).toEqual([]);
      });

      it(`is raced to the end on ${SEEDS} seeds with every marble home and no rule broken`, () => {
        const track = compile(piece);
        for (let seed = 1; seed <= SEEDS; seed++) {
          const race = new Physics(RAPIER, track, {}, { random: seeded(seed) });
          race.release();
          for (let f = 0; f < 90 * 60 && !race.over; f++) {
            race.step(DT);
            if (f % 10 === 0) expect(race.check(), `seed ${seed} frame ${f}`).toEqual([]);
          }
          expect(race.over, `seed ${seed}`).toBe(true);
          expect(race.finishers, `seed ${seed}: every marble home`).toBe(race.count);
          race.dispose();
        }
      });
    });
  }
});
