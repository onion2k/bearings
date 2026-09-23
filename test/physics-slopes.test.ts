/**
 * The pieces that fall and turn, alone under physics. A kind crosses over once it races alone under physics as well as it does
 * under the solver, on the runs test's own measures: every marble home on 24
 * seeds, none lost, none stopped, no rule broken. What each does fed by two
 * drops, and what it is for, is `physics-pieces.test.ts`.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { MARBLES } from '../src/marbles';
import { type Kind } from '../src/track';
import { chain, fieldOn, raced } from './physics-helpers';

await RAPIER.init();

const KINDS: Kind[] = ['straight', 'curveLeft', 'curveRight', 'ramp', 'drop', 'spiralLeft', 'spiralRight'];

describe('the pieces that fall and turn, under physics', () => {
  for (const kind of KINDS)
    it(`races every marble home over a ${kind} on its own, on 24 seeds, none lost and none stopped`, () => {
      for (let seed = 1; seed <= 24; seed++) {
        const { race, told } = fieldOn(chain(['start', kind, 'finish']), seed);
        raced(race);
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
