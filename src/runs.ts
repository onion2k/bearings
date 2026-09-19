/**
 * The runs that come with the game. Content, not logic: a run is a list of
 * pieces on the lattice, and nothing here knows how one is worked out or
 * drawn. A run the player designs is this same shape, so the two go down one
 * path and there is never a run the game can build but not save.
 *
 * Every run has something on it that breaks a field up — pegs, a sweeper, a
 * gate, a wheel or a funnel — because a chute alone is single file, and a
 * field let go down one finishes in the order the grid put it in: over three
 * hundred races on the chutes alone, no marble won from the back half of the
 * grid. Each run here was raced sixty times as it was laid out, and held to
 * the finishing order following the grid order by no more than 0.4 and the
 * back half of the grid winning at least one race in five.
 */
import type { Run } from './track';

/**
 * Down a peg board, round two bends and through a gate, and down again to
 * the cup: a long race where the pegs and the gate between them leave the
 * grid order counting for little.
 */
export const FIRST: Run = {
  id: 'first-drop-2',
  name: 'First Drop',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'ramp', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'pegs', x: 2, y: 0, z: -2, facing: 0 },
    { kind: 'curveLeft', x: 4, y: 0, z: -3, facing: 0 },
    { kind: 'ramp', x: 5, y: 1, z: -3, facing: 1 },
    { kind: 'curveLeft', x: 5, y: 2, z: -4, facing: 1 },
    { kind: 'gate', x: 4, y: 3, z: -4, facing: 2 },
    { kind: 'curveRight', x: 3, y: 3, z: -5, facing: 2 },
    { kind: 'ramp', x: 2, y: 4, z: -5, facing: 1 },
    { kind: 'finish', x: 2, y: 5, z: -6, facing: 1 },
  ],
};

/** The short one: a sweeper and a gate straight off the start, and down to the cup. */
export const SHORT: Run = {
  id: 'the-chute-2',
  name: 'The Chute',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'sweeper', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'gate', x: 3, y: 0, z: -2, facing: 0 },
    { kind: 'curveRight', x: 4, y: 0, z: -3, facing: 0 },
    { kind: 'ramp', x: 5, y: -1, z: -3, facing: 3 },
    { kind: 'finish', x: 5, y: -2, z: -4, facing: 3 },
  ],
};

/**
 * Held at a gate, then three turns of a spiral stacked into a tower, and
 * down into a funnel at its foot. The tower files the field on its outer
 * wall in the order the gate let it go, and the funnel mixes it: the order
 * it goes into the bowl tells next to nothing of the order it comes out in.
 * When the bowl slowed a marble within a lap, the field came out nearly the
 * other way round, which is an order too. Its id has moved on each time the
 * funnel changed its races: when the bowl went a level down; when its run in
 * came over the bowl and the field went round nearly twice as long; and when
 * the field came to fall through the hole on to a ramp of the funnel's own,
 * which hands it on a cell further and a level lower than it did.
 */
export const TOWER: Run = {
  id: 'the-tower-5',
  name: 'The Tower',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'ramp', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'gate', x: 2, y: 0, z: -2, facing: 0 },
    { kind: 'spiralLeft', x: 3, y: 0, z: -3, facing: 0 },
    { kind: 'spiralLeft', x: 3, y: 0, z: -5, facing: 0 },
    { kind: 'spiralLeft', x: 3, y: 0, z: -7, facing: 0 },
    { kind: 'funnel', x: 3, y: 0, z: -9, facing: 0 },
    { kind: 'straight', x: 5, y: 1, z: -12, facing: 0 },
    { kind: 'finish', x: 6, y: 1, z: -12, facing: 0 },
  ],
};

/**
 * A sweeper off the start, then two jumps, each of which carries its own
 * felt, lip and landing. The first comes down on to a peg board, which mixes
 * a field still jostling from the sweeper; the second on to a straight, and
 * there is a gate before the cup. A jump that left its landing to the piece
 * after it lost the field off a slow run-in and over the wrong piece, and
 * this one was rebuilt when the jump was made to join anything.
 */
export const LEAP: Run = {
  id: 'the-leap-4',
  name: 'The Leap',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'sweeper', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'jump', x: 3, y: 0, z: -2, facing: 0 },
    { kind: 'pegs', x: 8, y: 0, z: -5, facing: 0 },
    { kind: 'curveLeft', x: 10, y: 0, z: -6, facing: 0 },
    { kind: 'jump', x: 11, y: 1, z: -6, facing: 1 },
    { kind: 'straight', x: 11, y: 6, z: -9, facing: 1 },
    { kind: 'gate', x: 11, y: 7, z: -9, facing: 1 },
    { kind: 'finish', x: 11, y: 8, z: -10, facing: 1 },
  ],
};

/**
 * The long one: down the hill in drops and ramps, turning back on itself
 * again and again, over two peg boards, under a wheel, and round a spiral.
 */
export const SWITCHBACK: Run = {
  id: 'switchback-2',
  name: 'Switchback',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'ramp', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'pegs', x: 2, y: 0, z: -2, facing: 0 },
    { kind: 'curveRight', x: 4, y: 0, z: -3, facing: 0 },
    { kind: 'ramp', x: 5, y: -1, z: -3, facing: 3 },
    { kind: 'curveRight', x: 5, y: -2, z: -4, facing: 3 },
    { kind: 'drop', x: 4, y: -3, z: -4, facing: 2 },
    { kind: 'curveLeft', x: 3, y: -3, z: -6, facing: 2 },
    { kind: 'wheel', x: 2, y: -4, z: -6, facing: 3 },
    { kind: 'curveLeft', x: 2, y: -5, z: -7, facing: 3 },
    { kind: 'drop', x: 3, y: -6, z: -7, facing: 0 },
    { kind: 'curveRight', x: 4, y: -6, z: -9, facing: 0 },
    { kind: 'ramp', x: 5, y: -7, z: -9, facing: 3 },
    { kind: 'spiralRight', x: 5, y: -8, z: -10, facing: 3 },
    { kind: 'curveRight', x: 5, y: -8, z: -12, facing: 3 },
    { kind: 'pegs', x: 4, y: -9, z: -12, facing: 2 },
    { kind: 'curveLeft', x: 2, y: -9, z: -13, facing: 2 },
    { kind: 'ramp', x: 1, y: -10, z: -13, facing: 3 },
    { kind: 'straight', x: 1, y: -11, z: -14, facing: 3 },
    { kind: 'finish', x: 1, y: -12, z: -14, facing: 3 },
  ],
};

/**
 * The short one that shows off the fork: a sweeper straight off the start,
 * then a splitter parts the field by which side of the middle it is on, one
 * lane either side of a cell, closed by a joiner right after, and a gate
 * before the cup. A field the sweeper has already scattered goes down the
 * two lanes in about the mix it arrived in, so the two never decide the
 * race alone; the gate after the joiner does its own further mixing on the
 * whole field back together.
 */
export const FORK: Run = {
  id: 'the-fork-1',
  name: 'The Fork',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'sweeper', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'splitter', x: 3, y: 0, z: -2, facing: 0 },
    { kind: 'straight', x: 4, y: 0, z: -2, facing: 0 },
    { kind: 'straight', x: 4, y: 1, z: -2, facing: 0 },
    { kind: 'joiner', x: 5, y: 0, z: -2, facing: 0 },
    { kind: 'gate', x: 6, y: 0, z: -2, facing: 0 },
    { kind: 'finish', x: 7, y: 0, z: -3, facing: 0 },
  ],
};

/**
 * Pegs off the start, then a bend into a splitter parted across the bend's
 * own width: two ramps down a level side by side, a lane apart, closed by a
 * joiner right after. Bending in and out of the fork, rather than straight
 * on, is what a designer's own layout would do more often than not, and is
 * what the splitter's `fork` and the joiner's `joins` have to turn with the
 * piece, not only carry it straight ahead. Another bend and a gate follow,
 * back on the whole field.
 */
export const CROSSING: Run = {
  id: 'the-crossing-1',
  name: 'The Crossing',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'ramp', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'pegs', x: 2, y: 0, z: -2, facing: 0 },
    { kind: 'curveLeft', x: 4, y: 0, z: -3, facing: 0 },
    { kind: 'splitter', x: 5, y: 1, z: -3, facing: 1 },
    { kind: 'ramp', x: 5, y: 2, z: -3, facing: 1 },
    { kind: 'ramp', x: 4, y: 2, z: -3, facing: 1 },
    { kind: 'joiner', x: 5, y: 3, z: -4, facing: 1 },
    { kind: 'curveRight', x: 5, y: 4, z: -4, facing: 1 },
    { kind: 'gate', x: 6, y: 5, z: -4, facing: 0 },
    { kind: 'finish', x: 7, y: 5, z: -5, facing: 0 },
  ],
};

/**
 * Every run that comes with the game, in the order they are offered. The
 * first is the one a new player starts on. A run's id is what a save keeps
 * its best under, so it never changes once a run has shipped; a run whose
 * layout changes is a new run with a new id, since a best set on the old
 * layout means nothing on the new one. Each was rebuilt once when the pegs
 * and the moving parts came in; The Leap twice more, when its first jump was
 * made to come down among its pegs and when its jumps took their landings
 * with them, and The Tower when its funnel went down a level. Each carries
 * the id of its latest layout.
 */
export const RUNS: readonly Run[] = [FIRST, SHORT, TOWER, LEAP, SWITCHBACK, FORK, CROSSING];
