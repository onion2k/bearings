/**
 * What a race is to everything that is not the engine racing it: the game
 * that steps it, the scene that draws it, the cameras that follow it, the
 * test API that reads it and the rules that hold it. Two engines stand
 * behind this — the game's own track solver in `marbles.ts`, and physics in
 * `physics.ts` — and nothing outside them may tell which, so that a run can
 * cross from one to the other a piece at a time with the rest of the game
 * none the wiser.
 */
import type { Random } from './random';
import type { Track } from './track';

/** What happens in a race, for whoever shows it. Every one may be left out. */
export interface RaceEvents {
  /** They were let go. */
  released?(count: number): void;
  /** A marble reached the cup: which one, in which place, and how long it took. */
  finished?(marble: number, place: number, seconds: number): void;
  /** A marble came to rest short of the cup, and is not going to get there. */
  stalled?(marble: number, seconds: number): void;
  /** A marble off a jump came down nowhere it could land: off the run altogether. */
  lost?(marble: number, seconds: number): void;
}

export interface RaceOptions {
  count?: number;
  /** Chance, for the small differences between one marble and another. */
  random?: Random;
}

/** Which way a marble is turned, for drawing it: the axis it rolls about, and how far round it has come. */
export interface Roll {
  ax: number;
  ay: number;
  az: number;
  angle: number;
}

export interface Race {
  readonly track: Track;
  readonly count: number;
  /** Race time, in seconds since the off. */
  t: number;
  /** Where each marble is in the world. */
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  /** Which piece of the run each is on, how far along it and how far across the channel, and how fast it is going. */
  readonly segment: Int32Array;
  readonly along: Float32Array;
  readonly across: Float32Array;
  readonly speed: Float32Array;
  /** What each is doing, of `WAITING` and the rest, and its place and time once home. */
  readonly state: Uint8Array;
  readonly place: Int32Array;
  readonly took: Float32Array;
  /** Which slot on the grid each drew, and where each moving piece is in its turn. */
  readonly grid: Int32Array;
  readonly phase: Float32Array;
  finishers: number;
  stalled: number;
  lost: number;
  readonly over: boolean;

  /** The race drawn again: the grid, and where each moving piece begins its turn. */
  draw(random: Random): void;
  /** Everything back on the start, waiting. */
  reset(): void;
  /** Let them go. */
  release(): void;
  /** One fixed step. */
  step(dt: number): void;
  /**
   * A marble put where a test wants it, still, before the off: how far along
   * which piece and how far across. Refused once they are away, since
   * nothing may put a marble anywhere once a race has begun.
   */
  put(marble: number, segment: number, along: number, across: number): boolean;

  /** How far along the whole run a marble has got. */
  far(i: number): number;
  /** Who is furthest on of those still going, or -1 for nobody. */
  leader(): number;
  /** Those still going, the furthest on first. */
  running(): number[];
  /** Which way a marble is turned this frame, into `out`. */
  roll(i: number, out: Roll): Roll;
  /** What must always hold of the race as it stands, a line each. */
  check(): string[];
  /** Whatever the engine holds outside the garbage collector's reach let go of, when another race takes its place. */
  dispose?(): void;
}
