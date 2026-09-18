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
  name: 'The Chute',
  pieces: [
    { kind: 'start', x: 0, y: 0, z: 0, facing: 0 },
    { kind: 'ramp', x: 1, y: 0, z: -1, facing: 0 },
    { kind: 'curveRight', x: 2, y: 0, z: -2, facing: 0 },
    { kind: 'ramp', x: 3, y: -1, z: -2, facing: 3 },
    { kind: 'finish', x: 3, y: -2, z: -3, facing: 3 },
  ],
};

/** Every run that comes with the game, in the order they are offered. */
export const RUNS: readonly Run[] = [FIRST, SHORT];
