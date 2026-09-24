/**
 * Every kind physics races, fed by two drops, the fastest any one piece
 * hands a field on at: every marble home on 6 seeds, none lost or stopped,
 * no rule broken. This is the first half of `CROSSED`; the kinds are split across two
 * files so that they run on two workers.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { MARBLES } from '../src/marbles';
import { CROSSED, chain, fieldOn, raced } from './physics-helpers';

await RAPIER.init();

describe('the pieces under physics, fed by two drops', () => {
  for (const kind of CROSSED.slice(0, Math.ceil(CROSSED.length / 2)))
    it(`races every marble home over a ${kind} fed by two drops, the fastest one piece hands a field on at, on 6 seeds`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const { race, told } = fieldOn(chain(['start', 'drop', 'drop', kind, 'finish']), seed);
        raced(race);
        expect(race.finishers, `seed ${seed}: every marble home`).toBe(MARBLES);
        expect(
          race.lost + race.stalled,
          `seed ${seed}: ${told.filter((l) => !l.startsWith('finished')).join(', ')}`,
        ).toBe(0);
        expect(race.check(), `seed ${seed}`).toEqual([]);
      }
    });
});
