/**
 * Any piece after any other, raced under physics: every kind that can be
 * chained, then every kind that can follow it, fed from the gate and again
 * off two drops, the fastest any piece hands a field on at. Every marble
 * home, none lost, none stopped, and no rule broken through the race. What
 * `joins.test.ts` asks of the solver, asked of physics, where a piece fed
 * fast is where it most often failed: a ramp's crest, a wheel's paddles, a
 * groove that ended in a V. The pairs are dealt across
 * `physics-pairs-N.test.ts` so that they race on several workers at once,
 * and raced in the full check rather than the hook, being most of a minute.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { MARBLES } from '../src/race';
import { Physics } from '../src/physics';
import { seeded } from '../src/random';
import { breathe } from './physics-helpers';
import { type Facing, type Kind, type Placed, type Run, KINDS, check, compile, exitOf } from '../src/track';

const DT = 1 / 60;
const SEEDS = 3;
export const PAIR_SHARDS = 8;

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

// a splitter needs a joiner to mean anything, and a joiner a splitter: each is raced on its own branches, in
// `physics-branches.ts`
const chainable = (k: Kind) => k !== 'splitter' && k !== 'joiner';

/** Every pair, fed from the gate and off two drops, in a fixed order. */
export function pairs(): { name: string; kinds: Kind[] }[] {
  const out: { name: string; kinds: Kind[] }[] = [];
  for (const a of KINDS.filter((k) => k !== 'finish' && chainable(k)))
    for (const b of KINDS.filter((k) => k !== 'start' && chainable(k))) {
      const pair = [...(a === 'start' ? [] : [a]), ...(b === 'finish' ? [] : [b])];
      out.push({ name: `${a} then ${b}`, kinds: ['start', ...pair, 'finish'] });
      if (a !== 'start')
        out.push({ name: `${a} then ${b}, off two drops`, kinds: ['start', 'drop', 'drop', ...pair, 'finish'] });
    }
  return out;
}

export function racesPairs(shard: number): void {
  describe(`any piece after any other under physics, ${shard + 1} of ${PAIR_SHARDS}`, () => {
    if (shard === 0)
      it('deals every pair out once, fed both ways', () => {
        const all = pairs();
        expect(new Set(all.map((p) => p.name)).size).toBe(all.length);
        // 400 pairs of the kinds that chain fed from the gate, and the 380 of them that do not begin at the start
        // fed off two drops as well
        expect(all.length).toBe(780);
      });
    for (const { name, kinds } of pairs().filter((_, k) => k % PAIR_SHARDS === shard))
      it(name, async () => {
        await RAPIER.init();
        await breathe();
        const run = lay(kinds);
        expect(check(run)).toEqual([]);
        const track = compile(run);
        for (let seed = 1; seed <= SEEDS; seed++) {
          const race = new Physics(RAPIER, track, {}, { random: seeded(seed) });
          race.release();
          for (let f = 0; f < 90 * 60 && !race.over; f++) {
            race.step(DT);
            if (f % 5 === 0) expect(race.check(), `seed ${seed} frame ${f}`).toEqual([]);
          }
          expect(race.lost, `seed ${seed}: none lost`).toBe(0);
          expect(race.stalled, `seed ${seed}: none stopped`).toBe(0);
          expect(race.finishers, `seed ${seed}: every marble home`).toBe(MARBLES);
          race.dispose();
        }
      });
  });
}
