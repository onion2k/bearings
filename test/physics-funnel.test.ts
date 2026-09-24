/**
 * The funnel under physics, fed the ways a run feeds one: every ball down
 * through its hole and its throat and on to what comes after it. A file of
 * its own, since each of these races a field over 24 seeds and a funnel's
 * bowl is a slow thing for a field to go round.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { FINISHED, MARBLES } from '../src/race';
import { breathe, chain, fieldOn, raced } from './physics-helpers';

await RAPIER.init();

describe('the funnel under physics', () => {
  // each races a field over 24 seeds round a bowl, which is the slowest of any piece to race
  const LONG = 60000;

  it(
    'the funnel takes every ball down through its hole and its throat, on to what comes after it, fed the way a run feeds it',
    async () => {
      // three stacked spirals, as The Tower feeds its own funnel: a real run's own pace, not the extreme end of
      // two drops straight into the bowl, which now and then throws a ball past the outlet's own catch (below)
      for (let seed = 1; seed <= 24; seed++) {
        await breathe();
        const { race } = fieldOn(
          chain(['start', 'ramp', 'spiralLeft', 'spiralLeft', 'spiralLeft', 'funnel', 'straight', 'finish']),
          seed,
        );
        raced(race, 90);
        expect(race.finishers, `seed ${seed}`).toBe(MARBLES);
        expect(race.lost + race.stalled, `seed ${seed}`).toBe(0);
        for (let i = 0; i < MARBLES; i++) expect(race.state[i]).toBe(FINISHED);
        expect(race.check(), `seed ${seed}`).toEqual([]);
      }
    },
    LONG,
  );

  it(
    'takes a field off two drops straight into its bowl, the fastest a run feeds one, and hands every ball on to a straight',
    async () => {
      // a ball that came off the run in's lip at speed and struck the bowl near its rim once went straight
      // through it, the bowl's floor being wound facing down, and was taken for one thrown wide of the way out
      for (let seed = 1; seed <= 24; seed++) {
        await breathe();
        const { race, told } = fieldOn(chain(['start', 'drop', 'drop', 'funnel', 'straight', 'finish']), seed);
        raced(race, 90);
        expect(race.finishers, `seed ${seed}: ${told.filter((l) => !l.startsWith('finished')).join(', ')}`).toBe(
          MARBLES,
        );
        expect(race.check(), `seed ${seed}`).toEqual([]);
      }
    },
    LONG,
  );

  it(
    'hands a field let go from the gate on to a straight after it, none falling through the bowl',
    async () => {
      for (let seed = 1; seed <= 24; seed++) {
        await breathe();
        const { race, told } = fieldOn(chain(['start', 'funnel', 'straight', 'straight', 'finish']), seed);
        raced(race, 90);
        expect(race.finishers, `seed ${seed}: ${told.filter((l) => !l.startsWith('finished')).join(', ')}`).toBe(
          MARBLES,
        );
        expect(race.check(), `seed ${seed}`).toEqual([]);
      }
    },
    LONG,
  );

  it(
    'hands on a field fed off a turn with none knocked out through the back of its way out',
    async () => {
      // a ball come to rest against the head of the way out, struck from above by the next out of the throat, was
      // once knocked out through the back of it, a slab then, on seed 5: it is a block now
      for (let seed = 1; seed <= 24; seed++) {
        await breathe();
        const { race, told } = fieldOn(chain(['start', 'curveLeft', 'funnel', 'finish']), seed);
        raced(race, 90);
        expect(race.finishers, `seed ${seed}: ${told.filter((l) => !l.startsWith('finished')).join(', ')}`).toBe(
          MARBLES,
        );
      }
    },
    LONG,
  );
});
