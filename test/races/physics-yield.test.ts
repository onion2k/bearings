/**
 * The parts that move, under physics, seen to yield: a sweeper's paddle and a gate's bar on
 * a slide, and a wheel on its axle, each a body driven by a motor of capped
 * strength toward where its clockwork would have it. Each raced alone on 24
 * seeds with every marble home and no rule broken through the whole race.
 * Each seen to yield to a ball it would otherwise crush, and to carry on
 * once free, is `physics-yield.test.ts`.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import type { Physics } from '../../src/physics';
import { type Kind, type Obstacle, pose, pose0 } from '../../src/track';
import { chain, fieldOn } from '../physics-helpers';

await RAPIER.init();

const DT = 1 / 60;
const KINDS: Kind[] = ['sweeper', 'gate'];

const posed = pose0();

/** How far a part is from where its clockwork has it: across for a slide, round for a wheel, the short way. */
function behind(race: Physics, ob: Obstacle): number {
  const really = race.where(ob)!;
  const phase = race.phase[ob.slot];
  if (ob.motion.kind === 'paddle') {
    const f = (((race.t / ob.motion.period + phase) % 1) + 1) % 1;
    const d = really - (Math.PI * 2 * f - Math.PI);
    return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
  }
  return Math.abs(really - pose(ob, race.t, phase, posed).across);
}

describe('the parts that move, under physics, yielding', () => {
  for (const kind of KINDS)
    it(`a ${kind} is held back by the field rather than crushing it, and carries on at its own pace once the field has gone`, () => {
      let most = 0;
      for (let seed = 1; seed <= 24; seed++) {
        const { race, track } = fieldOn(chain(['start', kind, 'finish']), seed);
        const ob = track.segments[1].obstacles[0];
        race.release();
        for (let f = 0; f < 60 * 60 && !race.over; f++) {
          race.step(DT);
          most = Math.max(most, behind(race, ob));
        }
        // the field home and out of its way, a part that moves to a clock is back on it, and a wheel turning at
        // its own pace, though a wheel's motor keeps a pace and not a time, so it may stay behind by where it was
        // held
        for (let f = 0; f < 60 * 3; f++) race.step(DT);
        if (kind === 'wheel') {
          const before = race.where(ob)!;
          race.step(DT);
          const moved = Math.atan2(Math.sin(race.where(ob)! - before), Math.cos(race.where(ob)! - before));
          const m = ob.motion as { period: number };
          expect(moved / DT, `seed ${seed}: the wheel turning at its pace again`).toBeCloseTo(
            (Math.PI * 2) / m.period,
            1,
          );
        } else {
          // a gate's clock slides it at 18 a second from a standstill, which no motor of capped force follows
          // exactly, so it is read once its clock has stood still half a second, shut or open
          let still = 0;
          for (let f = 0; f < 60 * 10 && still < 0.5; f++) {
            race.step(DT);
            still = pose(ob, race.t, race.phase[ob.slot], posed).vc === 0 ? still + DT : 0;
          }
          expect(behind(race, ob), `seed ${seed}: back on its clock`).toBeLessThan(0.2);
        }
        expect(race.check(), `seed ${seed}`).toEqual([]);
      }
      // held back somewhere in the 24 races by more than a ball's own width: it yielded, and did not crush
      expect(most, 'a ball held it back from its clock, somewhere').toBeGreaterThan(0.9);
    });
});
