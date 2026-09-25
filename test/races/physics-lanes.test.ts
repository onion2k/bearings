/**
 * A split's two lanes need not be the same length: a ball arrives at the
 * joiner when it arrives, and each lane leans at its own rate so that both
 * reach it at one height. Lanes of different lengths, built as a player
 * builds them in the designer, raced on 24 seeds with every marble home and
 * no rule broken through the race.
 */
import { describe, expect, it } from 'vitest';
import { Designer } from '../../src/designer';
import { Physics } from '../../src/physics';
import { MARBLES } from '../../src/race';
import { seeded } from '../../src/random';
import { type Kind, compile } from '../../src/track';
import { RAPIER } from '../helpers';
import { breathe } from '../physics-helpers';

const DT = 1 / 60;

/** A run with `right` laid on the right lane of a split and `left` on its left, joined and ended. */
function lanes(right: Kind[], left: Kind[]): Designer {
  const d = new Designer('Lanes');
  for (const k of ['ramp', 'splitter', ...right] as Kind[]) expect(d.place(k), k).toBe(true);
  d.choose('left');
  for (const k of left) expect(d.place(k), k).toBe(true);
  for (const k of ['joiner', 'straight', 'finish'] as Kind[]) expect(d.place(k), k).toBe(true);
  expect(d.problems()).toEqual([]);
  return d;
}

describe('a split whose lanes are not the same length, under physics', () => {
  for (const [right, left] of [
    [
      ['drop', 'straight'],
      ['ramp', 'ramp'],
    ],
    [['shallow'], ['straight', 'ramp']],
    [
      ['drop', 'straight', 'straight'],
      ['spiralLeft', 'straight', 'straight', 'straight'],
    ],
  ] as Kind[][][])
    it(`races ${right.join(' and ')} against ${left.join(' and ')} home on 24 seeds, no rule broken`, async () => {
      const track = compile(lanes(right, left).run);
      const long = (branch: number) =>
        track.segments.filter((s) => s.branch === branch).reduce((sum, s) => sum + s.length, 0);
      expect(Math.abs(long(1) - long(2)), 'lanes of different lengths').toBeGreaterThan(3);
      for (let seed = 1; seed <= 24; seed++) {
        await breathe();
        const race = new Physics(RAPIER, track, {}, { random: seeded(seed) });
        race.release();
        for (let f = 0; f < 90 * 60 && !race.over; f++) {
          race.step(DT);
          if (f % 5 === 0) expect(race.check(), `seed ${seed} frame ${f}`).toEqual([]);
        }
        expect(race.finishers, `seed ${seed}: every marble home`).toBe(MARBLES);
        race.dispose();
      }
    });
});
