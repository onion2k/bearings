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
 * into a funnel at its foot. The tower files the field on its outer wall in
 * the order the gate let it go, and the funnel keeps the fastest going round
 * longest, so the back of the field is as likely to come out first as the
 * front.
 */
export const TOWER: Run = {
  id: 'the-tower-2',
  name: 'The Tower',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'ramp', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'gate', x: 2, y: 0, z: -2, facing: 0 },
    { kind: 'spiralLeft', x: 3, y: 0, z: -3, facing: 0 },
    { kind: 'spiralLeft', x: 3, y: 0, z: -5, facing: 0 },
    { kind: 'spiralLeft', x: 3, y: 0, z: -7, facing: 0 },
    { kind: 'funnel', x: 3, y: 0, z: -9, facing: 0 },
    { kind: 'straight', x: 3, y: 1, z: -10, facing: 0 },
    { kind: 'finish', x: 4, y: 1, z: -10, facing: 0 },
  ],
};

/**
 * A sweeper off the start, then two jumps. The first is off a ramp and comes
 * down on a peg board: marbles still jostling from the sweeper leave its lip
 * with some way across, and a chute to land on was missed three times in
 * five hundred races, where a board is wide enough to catch them. Off a drop
 * the field flew clean over the board's pegs and came down past them, and
 * the board mixed nothing; off a ramp it comes down among them, and off
 * anything slower it falls short of the board. The second is off a drop, on
 * to three straights for the fastest, and there is a gate before the cup.
 */
export const LEAP: Run = {
  id: 'the-leap-3',
  name: 'The Leap',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'sweeper', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'ramp', x: 3, y: 0, z: -2, facing: 0 },
    { kind: 'jump', x: 4, y: 0, z: -3, facing: 0 },
    { kind: 'pegs', x: 6, y: 0, z: -4, facing: 0 },
    { kind: 'curveLeft', x: 8, y: 0, z: -5, facing: 0 },
    { kind: 'drop', x: 9, y: 1, z: -5, facing: 1 },
    { kind: 'jump', x: 9, y: 2, z: -7, facing: 1 },
    { kind: 'straight', x: 9, y: 4, z: -8, facing: 1 },
    { kind: 'straight', x: 9, y: 5, z: -8, facing: 1 },
    { kind: 'straight', x: 9, y: 6, z: -8, facing: 1 },
    { kind: 'gate', x: 9, y: 7, z: -8, facing: 1 },
    { kind: 'finish', x: 9, y: 8, z: -9, facing: 1 },
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
 * Every run that comes with the game, in the order they are offered. The
 * first is the one a new player starts on. A run's id is what a save keeps
 * its best under, so it never changes once a run has shipped; a run whose
 * layout changes is a new run with a new id, since a best set on the old
 * layout means nothing on the new one. Each was rebuilt once when the pegs
 * and the moving parts came in, and The Leap again when its first jump was
 * made to come down among its pegs; each carries the id of its latest layout.
 */
export const RUNS: readonly Run[] = [FIRST, SHORT, TOWER, LEAP, SWITCHBACK];
