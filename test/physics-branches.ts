/**
 * A splitter and a joiner under physics, with every kind a branch can carry
 * on both lanes: raced on 24 seeds with every marble home, none lost, none
 * stopped and no rule broken through the race. The kinds are dealt across
 * `physics-branches-N.test.ts` so that they race on two workers at once.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { MARBLES } from '../src/race';
import { Physics } from '../src/physics';
import { seeded } from '../src/random';
import { check, compile } from '../src/track';
import { ON_A_BRANCH, branched, breathe } from './physics-helpers';

const DT = 1 / 60;

export function racesBranches(half: number): void {
  describe(`a splitter and a joiner under physics, ${half + 1} of 2`, () => {
    for (const kind of ON_A_BRANCH.filter((_, k) => k % 2 === half))
      it(`carries ${kind} on each branch, raced home on 24 seeds with none lost, none stopped and no rule broken`, async () => {
        await RAPIER.init();
        await breathe();
        const run = branched(kind);
        expect(check(run)).toEqual([]);
        const track = compile(run);
        for (let seed = 1; seed <= 24; seed++) {
          const race = new Physics(RAPIER, track, {}, { random: seeded(seed) });
          race.release();
          for (let f = 0; f < 90 * 60 && !race.over; f++) {
            race.step(DT);
            if (f % 5 === 0) expect(race.check(), `seed ${seed} frame ${f}`).toEqual([]);
          }
          expect(race.finishers, `seed ${seed}: every marble home`).toBe(MARBLES);
          expect(race.lost + race.stalled, `seed ${seed}: none lost, none stopped`).toBe(0);
          race.dispose();
        }
      });
  });
}
