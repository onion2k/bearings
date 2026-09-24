/**
 * A wheel fed straight off two drops, the fastest any one piece hands a
 * field on at: how often the field it lets go abreast comes to rest in its
 * neck. A file of its own so that its 48 races run beside the rest.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { MARBLES } from '../src/race';
import { chain, fieldOn } from './physics-helpers';

await RAPIER.init();

const DT = 1 / 60;

describe('a wheel fed as fast as a piece can feed it', () => {
  it('a wheel fed straight off two drops now and then lets a field it held come to rest in its neck, and no more', () => {
    // the fastest any one piece hands a field on at, far past how any shipped run feeds a wheel: the field it
    // lets go abreast arched three wide in the pen's neck on one seed in 48. Held to a number rather than to
    // nothing, so that more than that is still seen
    let stopped = 0;
    for (let seed = 1; seed <= 48; seed++) {
      const { race } = fieldOn(chain(['start', 'drop', 'drop', 'wheel', 'finish']), seed);
      race.release();
      for (let f = 0; f < 60 * 60 && !race.over; f++) race.step(DT);
      expect(race.lost, `seed ${seed}`).toBe(0);
      stopped += race.stalled;
    }
    expect(stopped, `${stopped} of ${48 * MARBLES} stopped`).toBeLessThanOrEqual(MARBLES);
  }, 60000);
});
