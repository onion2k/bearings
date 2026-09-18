/**
 * The runs that come with the game. Content, not logic: a run is a list of
 * pieces on the lattice, and nothing here knows how one is worked out or
 * drawn. A run the player designs is this same shape, so the two go down one
 * path and there is never a run the game can build but not save.
 */
import type { Run } from './track';

/**
 * The first run: down the straight, left at the bottom, back across and down
 * again to the cup. Six levels, two turns left and one right, which is
 * enough to meet every kind of piece there is.
 */
export const FIRST: Run = {
  id: 'first-drop',
  name: 'First Drop',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'ramp', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'ramp', x: 2, y: 0, z: -2, facing: 0 },
    { kind: 'curveLeft', x: 3, y: 0, z: -3, facing: 0 },
    { kind: 'ramp', x: 4, y: 1, z: -3, facing: 1 },
    { kind: 'curveLeft', x: 4, y: 2, z: -4, facing: 1 },
    { kind: 'ramp', x: 3, y: 3, z: -4, facing: 2 },
    { kind: 'curveRight', x: 2, y: 3, z: -5, facing: 2 },
    { kind: 'ramp', x: 1, y: 4, z: -5, facing: 1 },
    { kind: 'finish', x: 1, y: 5, z: -6, facing: 1 },
  ],
};

/**
 * The short one: straight down the hill with a single turn in it, for a race
 * that is over in a handful of seconds.
 */
export const SHORT: Run = {
  id: 'the-chute',
  name: 'The Chute',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'ramp', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'curveRight', x: 2, y: 0, z: -2, facing: 0 },
    { kind: 'ramp', x: 3, y: -1, z: -2, facing: 3 },
    { kind: 'finish', x: 3, y: -2, z: -3, facing: 3 },
  ],
};

/**
 * Three turns of a spiral stacked into a tower. Round a spiral the whole
 * field is thrown against its outer wall and held there, single file, so
 * whoever leads into the tower all but always leads out of it: the run for
 * backing the front of the grid.
 */
export const TOWER: Run = {
  id: 'the-tower',
  name: 'The Tower',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'ramp', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'spiralLeft', x: 2, y: 0, z: -2, facing: 0 },
    { kind: 'spiralLeft', x: 2, y: 0, z: -4, facing: 0 },
    { kind: 'spiralLeft', x: 2, y: 0, z: -6, facing: 0 },
    { kind: 'straight', x: 2, y: 0, z: -8, facing: 0 },
    { kind: 'finish', x: 3, y: 0, z: -8, facing: 0 },
  ],
};

/**
 * Two jumps, each off a drop so that even the slowest marble has the speed
 * to clear the gap, and each onto two straights so that the fastest comes
 * down on track and not beyond it. Raced on forty seeds, no marble has missed
 * a landing; a slower approach loses the back of the field in the first gap.
 */
export const LEAP: Run = {
  id: 'the-leap',
  name: 'The Leap',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'drop', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'jump', x: 2, y: 0, z: -3, facing: 0 },
    { kind: 'straight', x: 4, y: 0, z: -4, facing: 0 },
    { kind: 'straight', x: 5, y: 0, z: -4, facing: 0 },
    { kind: 'curveLeft', x: 6, y: 0, z: -4, facing: 0 },
    { kind: 'drop', x: 7, y: 1, z: -4, facing: 1 },
    { kind: 'jump', x: 7, y: 2, z: -6, facing: 1 },
    { kind: 'straight', x: 7, y: 4, z: -7, facing: 1 },
    { kind: 'straight', x: 7, y: 5, z: -7, facing: 1 },
    { kind: 'ramp', x: 7, y: 6, z: -7, facing: 1 },
    { kind: 'finish', x: 7, y: 7, z: -8, facing: 1 },
  ],
};

/**
 * The long one: down the hill in drops and ramps, turning back on itself
 * again and again, with a spiral two thirds of the way down. Long enough for
 * form to tell over the grid, so it is the most open of them.
 */
export const SWITCHBACK: Run = {
  id: 'switchback',
  name: 'Switchback',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'ramp', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'drop', x: 2, y: 0, z: -2, facing: 0 },
    { kind: 'curveRight', x: 3, y: 0, z: -4, facing: 0 },
    { kind: 'ramp', x: 4, y: -1, z: -4, facing: 3 },
    { kind: 'curveRight', x: 4, y: -2, z: -5, facing: 3 },
    { kind: 'drop', x: 3, y: -3, z: -5, facing: 2 },
    { kind: 'curveLeft', x: 2, y: -3, z: -7, facing: 2 },
    { kind: 'ramp', x: 1, y: -4, z: -7, facing: 3 },
    { kind: 'curveLeft', x: 1, y: -5, z: -8, facing: 3 },
    { kind: 'drop', x: 2, y: -6, z: -8, facing: 0 },
    { kind: 'curveRight', x: 3, y: -6, z: -10, facing: 0 },
    { kind: 'ramp', x: 4, y: -7, z: -10, facing: 3 },
    { kind: 'spiralRight', x: 4, y: -8, z: -11, facing: 3 },
    { kind: 'curveRight', x: 4, y: -8, z: -13, facing: 3 },
    { kind: 'drop', x: 3, y: -9, z: -13, facing: 2 },
    { kind: 'curveLeft', x: 2, y: -9, z: -15, facing: 2 },
    { kind: 'ramp', x: 1, y: -10, z: -15, facing: 3 },
    { kind: 'straight', x: 1, y: -11, z: -16, facing: 3 },
    { kind: 'finish', x: 1, y: -12, z: -16, facing: 3 },
  ],
};

/**
 * Every run that comes with the game, in the order they are offered. The
 * first is the one a new player starts on. A run's id is what a save keeps,
 * so it never changes once a run has shipped; its place in this list may.
 */
export const RUNS: readonly Run[] = [FIRST, SHORT, TOWER, LEAP, SWITCHBACK];
