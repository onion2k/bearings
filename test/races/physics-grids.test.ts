/**
 * The boards with something on them under physics, each under a grid at the
 * walls' own height: fed at two drops' speed, the fastest a run feeds one,
 * straight into a drop, whose own grid a ball thrown up by the board landed
 * on, and into a turn, whose wall one went over. Uncovered, bumps into a drop
 * lost 10 in 192 and put balls through the drop's grid hundreds of times.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { MARBLES } from '../../src/race';
import { type Kind } from '../../src/track';
import { chain, fieldOn } from '../physics-helpers';

await RAPIER.init();

const DT = 1 / 60;
const BOARDS: Kind[] = ['pegs', 'bumps', 'sweeper', 'gate'];

describe('a board under its grid, under physics', () => {
  it("is covered the whole way, at the walls' own height", () => {
    for (const kind of BOARDS) {
      const { track } = fieldOn(chain(['start', kind, 'finish']));
      const board = track.segments[1];
      expect(board.lid, kind).toEqual({ from: 0, upto: board.length });
      expect(board.wall, kind).toBe(track.wall);
    }
  });

  for (const kind of BOARDS)
    for (const next of ['drop', 'curveLeft'] as const)
      it(`hands a field off two drops on from the ${kind} into a ${next}, none lost, none through anything`, () => {
        for (let seed = 1; seed <= 24; seed++) {
          const { race, told } = fieldOn(chain(['start', 'drop', 'drop', kind, next, 'finish']), seed);
          race.release();
          for (let f = 0; f < 90 * 60 && !race.over; f++) {
            race.step(DT);
            if (f % 5 === 0) expect(race.check(), `seed ${seed} frame ${f}`).toEqual([]);
          }
          expect(race.finishers, `seed ${seed}: ${told.filter((l) => !l.startsWith('finished')).join(', ')}`).toBe(
            MARBLES,
          );
          race.dispose();
        }
      });
});
