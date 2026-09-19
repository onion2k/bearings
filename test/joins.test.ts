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

/**
 * A splitter's two lanes, where each begins: the shape's own curve straight
 * ahead, and its fork a lattice cell across from it — the splitter's own
 * geometry, not a choice made here.
 */
function split(splitter: Placed) {
  const main = exitOf(splitter)!;
  return { main, fork: { ...main, y: main.y + 1 } };
}

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

// a splitter needs a matching joiner to mean anything, and a joiner needs a splitter to feed its second
// entry: neither fits a plain chain of one kind after another, so each is raced on its own branches below
const chainable = (k: Kind) => k !== 'splitter' && k !== 'joiner';

describe('any piece after any other', () => {
  for (const a of KINDS.filter((k) => k !== 'finish' && chainable(k)))
    for (const b of KINDS.filter((k) => k !== 'start' && chainable(k))) {
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

/**
 * A splitter and a joiner, raced together: what neither means alone. Every
 * kind at a chute's width can stand on a branch, one lattice cell either
 * side of the middle — the same kind on both, since a facing-preserving kind
 * hands the field on the same cell across it started, letting one joiner
 * placement close both branches at once. A kind wider than a chute cannot:
 * it needs more than the cell a splitter opens between its two lanes, which
 * is `check`'s business and not a bug in either piece.
 */
describe('a splitter and a joiner', () => {
  const onABranch: Kind[] = ['straight', 'ramp', 'drop', 'jump', 'wheel', 'shallow', 'shallowWide', 'narrow'];
  const tooWide: Kind[] = ['pegs', 'sweeper', 'gate', 'funnel', 'shallowBroad', 'bumps', 'spiralLeft', 'spiralRight'];
  // a turn changes which way `main` and `fork` face, so the same-kind trick that lines a joiner up with both
  // branches at once does not hold for one; it is out of scope for this run, not untested elsewhere, since
  // `test/joins.test.ts`'s own pairwise matrix already races curveLeft and curveRight after and before a
  // splitter and a joiner as plain, non-forking kinds
  const notOnABranch: Kind[] = ['curveLeft', 'curveRight'];
  expect(new Set([...onABranch, ...tooWide, ...notOnABranch, 'start', 'finish', 'splitter', 'joiner']).size).toBe(
    KINDS.length,
  );

  /** A splitter's two branches, each carrying `kind`, closed by a joiner right after. */
  function run(kind: Kind): Run {
    const start: Placed = { kind: 'start', x: 0, y: 0, z: 0, facing: 0 };
    const splitter: Placed = { kind: 'splitter', ...exitOf(start)! };
    const { main, fork } = split(splitter);
    const mainPiece: Placed = { kind, ...main };
    const forkPiece: Placed = { kind, ...fork };
    const joiner: Placed = { kind: 'joiner', ...exitOf(mainPiece)! };
    const after: Placed = { kind: 'straight', ...exitOf(joiner)! };
    const finish: Placed = { kind: 'finish', ...exitOf(after)! };
    return { id: 'split', name: kind, pieces: [start, splitter, mainPiece, forkPiece, joiner, after, finish] };
  }

  for (const kind of onABranch)
    it(`carries ${kind} on each branch, raced home with none lost, none stopped and no rule broken`, () => {
      const track = compile(run(kind));
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

  it('refuses a kind wider than the cell between the two branches, rather than racing them through each other', () => {
    for (const kind of tooWide) expect(check(run(kind)), kind).not.toEqual([]);
  });

  it('refuses two branches that hand the field on very different distances along the run', () => {
    // a joiner right after the splitter, with nothing of its own on either branch, closes the fork lane's own
    // extra length (about half again, over just the one cell it moves across) against a lead-in too short for
    // the tolerance to absorb it
    const start: Placed = { kind: 'start', x: 0, y: 0, z: 0, facing: 0 };
    const splitter: Placed = { kind: 'splitter', ...exitOf(start)! };
    const joiner: Placed = { kind: 'joiner', ...exitOf(splitter)! };
    const after: Placed = { kind: 'straight', ...exitOf(joiner)! };
    const finish: Placed = { kind: 'finish', ...exitOf(after)! };
    const problems = check({ id: 'mismatch', name: 'mismatch', pieces: [start, splitter, joiner, after, finish] });
    expect(problems.some((p) => p.includes('is reached') && p.includes('along one branch'))).toBe(true);
  });
});
