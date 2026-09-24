/**
 * What a race is to everything that is not the engine racing it: the game
 * that steps it, the scene that draws it, the cameras that follow it, the
 * test API that reads it and the rules that hold it. Physics, in
 * `physics.ts`, stands behind it; nothing else needs to know that, so the
 * engine can change without the rest of the game changing with it. And the
 * facts every part of the game shares about a race: how many marbles, how
 * big one is, how hard the world pulls, and what a marble can be doing.
 */
import type { Random } from './random';
import type { Obstacle, Track } from './track';

/** How many marbles race. */
export const MARBLES = 8;
/** How big a marble is. */
export const RADIUS = 0.45;
/** How hard the world pulls down. */
export const GRAVITY = 30;
/** How much speed the air costs, a share of the speed squared: what gives a falling ball its top speed. */
export const DRAG = 0.02;
/** How far apart they sit on the start, waiting. */
export const SPACING = 1.1;
/** What a marble is doing. */
export const WAITING = 0,
  RACING = 1,
  FINISHED = 2,
  STALLED = 3,
  LOST = 4;
/**
 * How slowly a marble may be going, and for how long, before the run is
 * called on it. A run that cannot be finished has to be noticed and said,
 * because the alternative is a race nobody is ever told is over. It is
 * longer than any gate holds a marble or a pile takes to drain through a
 * neck, so a marble waiting its turn is not taken for one stuck.
 */
export const CRAWL = 0.05;
export const PATIENCE = 6;

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
  /**
   * Where a moving part really is, where the engine keeps it as a body of its
   * own rather than working it out from the clock: how far across a sweeper
   * or a gate stands, or how far round from straight down a wheel's first
   * paddle has turned. Nothing where the clock is all there is.
   */
  where?(ob: Obstacle): number | undefined;
  /** Whatever the engine holds outside the garbage collector's reach let go of, when another race takes its place. */
  dispose?(): void;
}
