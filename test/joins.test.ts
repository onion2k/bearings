/**
 * Any piece after any other. Every ordered pair of kinds, set between a start
 * and the end, is sound, clear of itself, and raced with every marble home,
 * none lost and none stopped, and no rule broken on the way. It is what lets
 * the designer offer every piece after every other: a pair that failed here
 * is a join a player could build and watch the field drop out of.
 */
import { describe, expect, it } from 'vitest';
import { Marbles, checkMarbles } from '../src/marbles';
import { seeded } from '../src/random';
import { type Facing, type Kind, type Placed, type Run, KINDS, check, checkTrack, compile, exitOf } from '../src/track';

const DT = 1 / 60;
const SEEDS = 3;

/** Pieces laid end to end from the lattice's origin, each where the one before hands a marble on. */
function lay(kinds: Kind[]): Run {
  const pieces: Placed[] = [];
  let here = { x: 0, y: 0, z: 0, facing: 0 as Facing };
  for (const kind of kinds) {
    pieces.push({ kind, ...here });
    const out = exitOf({ kind, ...here });
    if (out) here = out;
  }
  return { id: 'pair', name: kinds.join(', '), pieces };
}

describe('any piece after any other', () => {
  for (const a of KINDS.filter((k) => k !== 'finish'))
    for (const b of KINDS.filter((k) => k !== 'start')) {
      const kinds: Kind[] = ['start', ...(a === 'start' ? [] : [a]), ...(b === 'finish' ? [] : [b]), 'finish'];
      it(`${a} then ${b}`, () => {
        const run = lay(kinds);
        expect(check(run)).toEqual([]);
        const track = compile(run);
        expect(checkTrack(track)).toEqual([]);
        for (let seed = 1; seed <= SEEDS; seed++) {
          const marbles = new Marbles(track, {}, { random: seeded(seed) });
          marbles.release();
          for (let f = 0; f < 90 * 60 && !marbles.over; f++) {
            marbles.step(DT);
            if (f % 5 === 0) expect(checkMarbles(marbles), `seed ${seed} frame ${f}`).toEqual([]);
          }
          expect(marbles.lost, `seed ${seed}: none lost`).toBe(0);
          expect(marbles.stalled, `seed ${seed}: none stopped`).toBe(0);
          expect(marbles.finishers, `seed ${seed}: every marble home`).toBe(marbles.count);
        }
      });
    }
});
