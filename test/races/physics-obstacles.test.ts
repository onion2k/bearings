/**
 * The things in the way that stand still, alone under physics: pegs, mounds
 * and a funnel's bowl. A kind crosses over once it races alone under
 * physics as well as it does under the solver, on the runs test's own
 * measures: every marble home on 24 seeds, none lost, none stopped, no rule
 * broken through the whole race and not just at its end, since a peg's
 * point or a mound's crest is where a ball is most likely to read wrong for
 * a moment. What each does fed by two drops, and how it mixes a field, is
 * `physics-pieces.test.ts`.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { MARBLES } from '../../src/race';
import { type Kind } from '../../src/track';
import { chain, fieldOn } from '../physics-helpers';

await RAPIER.init();

const DT = 1 / 60;
const KINDS: Kind[] = ['pegs', 'bumps', 'funnel'];

describe('the things in the way that stand still, under physics', () => {
  for (const kind of KINDS)
    it(`races every marble home over a ${kind} on its own, on 24 seeds, none lost and none stopped, no rule broken on the way`, () => {
      for (let seed = 1; seed <= 24; seed++) {
        const { race, told } = fieldOn(chain(['start', kind, 'finish']), seed);
        race.release();
        for (let f = 0; f < 60 * 60 && !race.over; f++) {
          race.step(DT);
          if (f % 5 === 0) expect(race.check(), `seed ${seed} frame ${f}`).toEqual([]);
        }
        expect(race.over, `seed ${seed}: the race ended`).toBe(true);
        expect(race.finishers, `seed ${seed}: every marble home`).toBe(MARBLES);
        expect(
          race.lost + race.stalled,
          `seed ${seed}: ${told.filter((l) => !l.startsWith('finished')).join(', ')}`,
        ).toBe(0);
        expect(race.check(), `seed ${seed}`).toEqual([]);
      }
    });
});
