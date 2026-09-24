/**
 * Every run that comes with the game and physics can race yet, raced under
 * physics on 24 seeds: every marble home, none lost and none stopped, no
 * rule broken through the race. Whether a run is a race and not a
 * procession under physics — the grid telling little of who wins — is held
 * of the solver's runs by `runs.test.ts` and is still to be tuned for
 * physics, so it is not asked here. This file races the second, fourth and so on of them; the
 * runs are split across two files so that they race on two workers.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { MARBLES } from '../src/marbles';
import { PHYSICAL, Physics } from '../src/physics';
import { seeded } from '../src/random';
import { compile } from '../src/track';
import { PHYSICS_RUNS } from './physics-helpers';

await RAPIER.init();

const DT = 1 / 60;

describe('the runs physics can race', () => {
  it('are at least the four the moving parts bring', () => {
    expect(PHYSICS_RUNS.map((r) => r.name)).toEqual(
      expect.arrayContaining(['First Drop', 'The Chute', 'The Tower', 'Switchback']),
    );
  });

  for (const run of PHYSICS_RUNS.filter((_, i) => i % 2 === 1))
    it(`races ${run.name} under physics on 24 seeds with every marble home and no rule broken`, () => {
      const track = compile(run, PHYSICAL);
      for (let seed = 1; seed <= 24; seed++) {
        const race = new Physics(RAPIER, track, {}, { random: seeded(seed) });
        race.release();
        for (let f = 0; f < 180 * 60 && !race.over; f++) {
          race.step(DT);
          if (f % 10 === 0) expect(race.check(), `seed ${seed} frame ${f}`).toEqual([]);
        }
        expect(race.finishers, `seed ${seed}: every marble home`).toBe(MARBLES);
        expect(race.lost + race.stalled, `seed ${seed}: none lost, none stopped`).toBe(0);
        race.dispose();
      }
    }, 60000);
});
