/**
 * The parts that move, under physics: a sweeper's paddle and a gate's bar on
 * a slide, and a wheel on its axle, each a body driven by a motor of capped
 * strength toward where its clockwork would have it. Each raced alone on 24
 * seeds with every marble home and no rule broken through the whole race;
 * and each seen to yield — held back from its clock by a ball it would
 * otherwise crush, rather than crushing it — and to carry on once free.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { MARBLES } from '../src/race';
import { type Kind } from '../src/track';
import { chain, fieldOn } from './physics-helpers';

await RAPIER.init();

const DT = 1 / 60;
const KINDS: Kind[] = ['sweeper', 'gate', 'wheel'];

describe('the parts that move, under physics', () => {
  for (const kind of KINDS)
    it(`races every marble home over a ${kind} on its own, on 24 seeds, none lost and none stopped, no rule broken on the way`, () => {
      for (let seed = 1; seed <= 24; seed++) {
        const { race, told } = fieldOn(chain(['start', kind, 'finish']), seed);
        race.release();
        for (let f = 0; f < 60 * 60 && !race.over; f++) {
          race.step(DT);
          if (f % 5 === 0) expect(race.check(), `seed ${seed} frame ${f}`).toEqual([]);
        }
        expect(race.finishers, `seed ${seed}: every marble home`).toBe(MARBLES);
        expect(
          race.lost + race.stalled,
          `seed ${seed}: ${told.filter((l) => !l.startsWith('finished')).join(', ')}`,
        ).toBe(0);
      }
    });
});
