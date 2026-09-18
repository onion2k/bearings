/**
 * The catalog: every kind of piece there is, each set on its own between a
 * start and the end, named and said what it does, and each raced to the end
 * with every marble home. It is the one place every piece is tried by itself.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG, PIECES } from '../src/catalog';
import { Marbles, checkMarbles } from '../src/marbles';
import { seeded } from '../src/random';
import { KINDS, check, checkTrack, compile } from '../src/track';

const DT = 1 / 60;
const SEEDS = 6;

describe('the catalog of pieces', () => {
  it('has an entry for every kind of piece, and nothing that is not one', () => {
    expect(Object.keys(CATALOG).sort()).toEqual([...KINDS].sort());
    expect(PIECES.length).toBe(KINDS.length);
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
    const kind = KINDS[k];
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
          const marbles = new Marbles(track, {}, { random: seeded(seed) });
          marbles.release();
          for (let f = 0; f < 90 * 60 && !marbles.over; f++) {
            marbles.step(DT);
            if (f % 10 === 0) expect(checkMarbles(marbles), `seed ${seed} frame ${f}`).toEqual([]);
          }
          expect(marbles.over, `seed ${seed}`).toBe(true);
          expect(marbles.finishers, `seed ${seed}: every marble home`).toBe(marbles.count);
        }
      });
    });
  }
});
