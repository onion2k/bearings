/** The autopilot as a measuring instrument: it sees races through, on more than one seed, and does not get stuck. */
import { describe, expect, it } from 'vitest';
import { Autopilot } from '../src/autopilot';
import { checkInvariants } from '../src/invariants';
import { DT, newGame } from './helpers';

describe('the autopilot', () => {
  for (const seed of [1, 2, 3]) {
    it(`sees three races through inside two minutes from seed ${seed}, breaking no rule`, () => {
      const { game } = newGame(seed);
      const pilot = new Autopilot(game);
      for (let f = 0; f < 120 * 60 && game.progress.save.races < 3; f++) pilot.step(DT);
      expect(game.progress.save.races).toBeGreaterThanOrEqual(3);
      expect(checkInvariants(game)).toEqual([]);
    });
  }

  it('lets them go by itself, rather than sitting at the line', () => {
    const { game } = newGame(1);
    const pilot = new Autopilot(game);
    for (let f = 0; f < 120; f++) pilot.step(DT);
    expect(game.marbles.state[0], 'the field is away').not.toBe(0);
  });
});
