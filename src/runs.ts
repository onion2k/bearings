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
  id: 'first-drop-3',
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
  id: 'the-chute-3',
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
  id: 'the-tower-6',
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
  id: 'the-leap-5',
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
 * again and again, over a peg board, under a wheel, round a spiral and
 * across a sweeper. The sweeper was a second peg board, which the field
 * reached in single file along the outside of the bend before it, and
 * identical balls in one line strike cones alike: it kept their order at
 * 0.93. A paddle swinging across the stream at its own moment keeps 0.72.
 */
export const SWITCHBACK: Run = {
  id: 'switchback-4',
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
    { kind: 'sweeper', x: 4, y: -9, z: -12, facing: 2 },
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
  id: 'the-fork-2',
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
  id: 'the-crossing-2',
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
 * The stress test: a hundred pieces, `MAX_PIECES`'s own ceiling, and every
 * kind of piece the catalog has but the sweeper. Folded into a box with
 * turns rather than run straight out — laid out end to end the first time,
 * it needed a camera three hundred units further back than any other run
 * and stood a sliver in the corner of the screen for it — so what carries
 * the length is depth, one level further down each turn, not width.
 *
 * Every piece with something in the way sits early, while the field is
 * still off the gate and bunched: a board met by a field strung out over
 * seconds is passed one ball at a time, and keeps the order it was handed.
 * The peg and bumps boards once scattered through the long middle kept it
 * at 0.93 to 1.00, and are plain wide shallows now. The two early boards,
 * the bumps and the pegs, were the sweeper and the pegs, and there is room
 * for only two while the field is bunched: the sweeper is on three other
 * runs, and bumps on no other. Nothing with something in the way stands
 * after the fork either: a splitter and a joiner hand two equal lanes back
 * on in lock step, and the first thing to meet that field read as though it
 * did nothing, whatever it was.
 */
export const STRESS: Run = {
  id: 'stress-test-3',
  name: 'Stress Test',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'bumps', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'curveRight', x: 3, y: 0, z: -2, facing: 0 },
    { kind: 'pegs', x: 4, y: -1, z: -2, facing: 3 },
    { kind: 'curveLeft', x: 4, y: -3, z: -3, facing: 3 },
    { kind: 'gate', x: 5, y: -4, z: -3, facing: 0 },
    { kind: 'curveLeft', x: 6, y: -4, z: -4, facing: 0 },
    { kind: 'wheel', x: 7, y: -3, z: -4, facing: 1 },
    { kind: 'curveRight', x: 7, y: -2, z: -5, facing: 1 },
    { kind: 'funnel', x: 8, y: -1, z: -5, facing: 0 },
    { kind: 'curveRight', x: 10, y: 0, z: -8, facing: 0 },
    { kind: 'spiralLeft', x: 11, y: -1, z: -8, facing: 3 },
    { kind: 'curveLeft', x: 11, y: -1, z: -10, facing: 3 },
    { kind: 'spiralRight', x: 12, y: -2, z: -10, facing: 0 },
    { kind: 'curveRight', x: 12, y: -2, z: -12, facing: 0 },
    { kind: 'jump', x: 13, y: -3, z: -12, facing: 3 },
    { kind: 'curveRight', x: 13, y: -8, z: -15, facing: 3 },
    { kind: 'shallow', x: 12, y: -9, z: -15, facing: 2 },
    { kind: 'curveLeft', x: 10, y: -9, z: -16, facing: 2 },
    { kind: 'shallowWide', x: 9, y: -10, z: -16, facing: 3 },
    { kind: 'curveLeft', x: 9, y: -12, z: -17, facing: 3 },
    { kind: 'shallowBroad', x: 10, y: -13, z: -17, facing: 0 },
    { kind: 'curveRight', x: 12, y: -13, z: -18, facing: 0 },
    { kind: 'narrow', x: 13, y: -14, z: -18, facing: 3 },
    { kind: 'curveRight', x: 13, y: -16, z: -19, facing: 3 },
    { kind: 'drop', x: 12, y: -17, z: -19, facing: 2 },
    { kind: 'shallowWide', x: 11, y: -17, z: -21, facing: 2 },
    { kind: 'drop', x: 9, y: -17, z: -22, facing: 2 },
    { kind: 'curveRight', x: 8, y: -17, z: -24, facing: 2 },
    { kind: 'curveRight', x: 7, y: -16, z: -24, facing: 1 },
    { kind: 'ramp', x: 8, y: -15, z: -24, facing: 0 },
    { kind: 'shallowWide', x: 9, y: -15, z: -25, facing: 0 },
    { kind: 'ramp', x: 11, y: -15, z: -26, facing: 0 },
    { kind: 'curveLeft', x: 12, y: -15, z: -27, facing: 0 },
    { kind: 'curveLeft', x: 13, y: -14, z: -27, facing: 1 },
    { kind: 'drop', x: 12, y: -13, z: -27, facing: 2 },
    { kind: 'shallowWide', x: 11, y: -13, z: -29, facing: 2 },
    { kind: 'drop', x: 9, y: -13, z: -30, facing: 2 },
    { kind: 'curveRight', x: 8, y: -13, z: -32, facing: 2 },
    { kind: 'curveRight', x: 7, y: -12, z: -32, facing: 1 },
    { kind: 'ramp', x: 8, y: -11, z: -32, facing: 0 },
    { kind: 'shallowWide', x: 9, y: -11, z: -33, facing: 0 },
    { kind: 'ramp', x: 11, y: -11, z: -34, facing: 0 },
    { kind: 'curveLeft', x: 12, y: -11, z: -35, facing: 0 },
    { kind: 'curveLeft', x: 13, y: -10, z: -35, facing: 1 },
    { kind: 'drop', x: 12, y: -9, z: -35, facing: 2 },
    { kind: 'shallowWide', x: 11, y: -9, z: -37, facing: 2 },
    { kind: 'drop', x: 9, y: -9, z: -38, facing: 2 },
    { kind: 'curveRight', x: 8, y: -9, z: -40, facing: 2 },
    { kind: 'curveRight', x: 7, y: -8, z: -40, facing: 1 },
    { kind: 'ramp', x: 8, y: -7, z: -40, facing: 0 },
    { kind: 'shallowWide', x: 9, y: -7, z: -41, facing: 0 },
    { kind: 'ramp', x: 11, y: -7, z: -42, facing: 0 },
    { kind: 'curveLeft', x: 12, y: -7, z: -43, facing: 0 },
    { kind: 'curveLeft', x: 13, y: -6, z: -43, facing: 1 },
    { kind: 'drop', x: 12, y: -5, z: -43, facing: 2 },
    { kind: 'shallowWide', x: 11, y: -5, z: -45, facing: 2 },
    { kind: 'drop', x: 9, y: -5, z: -46, facing: 2 },
    { kind: 'curveRight', x: 8, y: -5, z: -48, facing: 2 },
    { kind: 'curveRight', x: 7, y: -4, z: -48, facing: 1 },
    { kind: 'ramp', x: 8, y: -3, z: -48, facing: 0 },
    { kind: 'shallowWide', x: 9, y: -3, z: -49, facing: 0 },
    { kind: 'ramp', x: 11, y: -3, z: -50, facing: 0 },
    { kind: 'curveLeft', x: 12, y: -3, z: -51, facing: 0 },
    { kind: 'curveLeft', x: 13, y: -2, z: -51, facing: 1 },
    { kind: 'drop', x: 12, y: -1, z: -51, facing: 2 },
    { kind: 'shallowWide', x: 11, y: -1, z: -53, facing: 2 },
    { kind: 'drop', x: 9, y: -1, z: -54, facing: 2 },
    { kind: 'curveRight', x: 8, y: -1, z: -56, facing: 2 },
    { kind: 'curveRight', x: 7, y: 0, z: -56, facing: 1 },
    { kind: 'ramp', x: 8, y: 1, z: -56, facing: 0 },
    { kind: 'shallowWide', x: 9, y: 1, z: -57, facing: 0 },
    { kind: 'ramp', x: 11, y: 1, z: -58, facing: 0 },
    { kind: 'curveLeft', x: 12, y: 1, z: -59, facing: 0 },
    { kind: 'curveLeft', x: 13, y: 2, z: -59, facing: 1 },
    { kind: 'drop', x: 12, y: 3, z: -59, facing: 2 },
    { kind: 'shallowWide', x: 11, y: 3, z: -61, facing: 2 },
    { kind: 'drop', x: 9, y: 3, z: -62, facing: 2 },
    { kind: 'splitter', x: 8, y: 3, z: -64, facing: 2 },
    { kind: 'straight', x: 7, y: 3, z: -64, facing: 2 },
    { kind: 'straight', x: 7, y: 2, z: -64, facing: 2 },
    { kind: 'joiner', x: 6, y: 3, z: -64, facing: 2 },
    { kind: 'straight', x: 5, y: 3, z: -64, facing: 2 },
    { kind: 'ramp', x: 4, y: 3, z: -64, facing: 2 },
    { kind: 'straight', x: 3, y: 3, z: -65, facing: 2 },
    { kind: 'curveRight', x: 2, y: 3, z: -65, facing: 2 },
    { kind: 'curveRight', x: 1, y: 4, z: -65, facing: 1 },
    { kind: 'straight', x: 2, y: 5, z: -65, facing: 0 },
    { kind: 'ramp', x: 3, y: 5, z: -65, facing: 0 },
    { kind: 'straight', x: 4, y: 5, z: -66, facing: 0 },
    { kind: 'curveLeft', x: 5, y: 5, z: -66, facing: 0 },
    { kind: 'curveLeft', x: 6, y: 6, z: -66, facing: 1 },
    { kind: 'straight', x: 5, y: 7, z: -66, facing: 2 },
    { kind: 'ramp', x: 4, y: 7, z: -66, facing: 2 },
    { kind: 'straight', x: 3, y: 7, z: -67, facing: 2 },
    { kind: 'curveRight', x: 2, y: 7, z: -67, facing: 2 },
    { kind: 'curveRight', x: 1, y: 8, z: -67, facing: 1 },
    { kind: 'straight', x: 2, y: 9, z: -67, facing: 0 },
    { kind: 'ramp', x: 3, y: 9, z: -67, facing: 0 },
    { kind: 'finish', x: 4, y: 9, z: -68, facing: 0 },
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
export const RUNS: readonly Run[] = [FIRST, SHORT, TOWER, LEAP, SWITCHBACK, FORK, CROSSING, STRESS];
