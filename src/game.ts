/**
 * The game itself, without the picture or the page: a run chosen, a field of
 * marbles on its start gate, and a race, a step at a time.
 *
 * What happens is told to `events`, for whoever shows it: the browser turns
 * it into words on the screen; the fuzzer and the tests leave it out, or
 * keep a note of it. Nothing here waits on anything there, so the same game
 * runs in the page and in Node, and what the tests try is what is played.
 *
 * Nothing the player does reaches a marble once it is let go. That is the
 * game — the run decides it — and it is also what makes a race exactly
 * repeatable from its seed, which every replay and every baseline rests on.
 */
import { LOST, Marbles, STALLED, WAITING } from './marbles';
import { Progress } from './progress';
import type { Random } from './random';
import { RUNS } from './runs';
import { type Track, compile } from './track';

/** What happens, for whoever shows it. Every one may be left out. */
export interface GameEvents {
  /** A run was put on: which one it is, and what it is called. */
  picked?(run: number, name: string): void;
  /** They were let go. */
  released?(count: number): void;
  /** A marble reached the cup: which one, in which place, and how long it took. */
  finished?(marble: number, place: number, seconds: number): void;
  /** A marble came to rest short of the cup. */
  stalled?(marble: number, seconds: number): void;
  /** A marble went off a jump and came down nowhere: off the run altogether. */
  lost?(marble: number, seconds: number): void;
  /** The race is done with: who won, and in what time. -1 where nothing finished at all. */
  over?(winner: number, seconds: number): void;
}

export interface GameOptions {
  /** Chance; Math.random unless told otherwise, and the tests always tell. */
  random?: Random;
}

export class Game {
  /** Game time, in seconds. */
  t = 0;
  /** Where chance comes from: replaced by the test API's `seed`. */
  random: Random;
  /** Which of the runs is on. */
  run = 0;
  track!: Track;
  marbles!: Marbles;
  /** Whether the race that is on has been counted into the save yet. */
  private counted = true;

  constructor(
    readonly progress: Progress,
    private readonly events: GameEvents = {},
    options: GameOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    // the run last put on, if the save names one there is; loading alone writes nothing, so a name the
    // game cannot put on is only forgotten in memory until the next thing that is written
    const saved = RUNS.findIndex((r) => r.id === progress.save.run);
    if (saved < 0) progress.save.run = '';
    // a best kept for a run the game no longer has — one since rebuilt under a new id — is dropped, so a
    // save does not gather records for runs that are gone, rebuild after rebuild
    for (const id of Object.keys(progress.save.bests))
      if (!RUNS.some((r) => r.id === id)) Reflect.deleteProperty(progress.save.bests, id);
    this.putOn(Math.max(saved, 0));
  }

  /** Put a run on, and remember it was: the save is written, so the next visit starts on it. */
  pick(run: number) {
    this.putOn(run);
    this.progress.chose(RUNS[this.run].id);
    this.persist();
  }

  /** A run worked out, and a field drawn for its start gate. */
  private putOn(run: number) {
    this.run = ((run % RUNS.length) + RUNS.length) % RUNS.length;
    this.track = compile(RUNS[this.run]);
    this.marbles = new Marbles(
      this.track,
      {
        released: (n) => this.events.released?.(n),
        finished: (m, place, s) => this.events.finished?.(m, place, s),
        stalled: (m, s) => this.events.stalled?.(m, s),
        lost: (m, s) => this.events.lost?.(m, s),
      },
      { random: () => this.random() },
    );
    this.counted = false;
    this.events.picked?.(this.run, this.track.name);
  }

  /** The field back on the start gate, with a fresh draw for the grid. */
  reset() {
    this.marbles.draw(() => this.random());
    this.marbles.reset();
    this.counted = false;
  }

  /** Let them go. */
  release() {
    this.marbles.release();
  }

  /** The best winning time on the run that is on, or 0 before it has one. */
  best(): number {
    return this.progress.best(RUNS[this.run].id);
  }

  /** Whether the race that is on has been run. */
  get over(): boolean {
    return this.marbles.over;
  }

  /**
   * Who is winning, or who won: every marble in the order it stands. Those
   * home first in the order they came, then those still going with the one
   * furthest on in front, then those still on the gate in the order they
   * will leave it, and last anything that stopped short. A board is worth
   * having before the off as well as after it.
   */
  standing(): number[] {
    const { marbles } = this;
    const all = [...Array(marbles.count).keys()];
    const home = all.filter((i) => marbles.place[i] > 0).sort((a, b) => marbles.place[a] - marbles.place[b]);
    const waiting = all.filter((i) => marbles.state[i] === WAITING).sort((a, b) => marbles.grid[a] - marbles.grid[b]);
    const stopped = all.filter((i) => marbles.state[i] === STALLED || marbles.state[i] === LOST);
    return [...home, ...marbles.running(), ...waiting, ...stopped];
  }

  /** One frame of `dt` seconds. */
  step(dt: number) {
    this.t += dt;
    this.marbles.step(dt);
    // a race counts once, when it is done with, however it ended
    if (!this.counted && this.marbles.over) {
      this.counted = true;
      const won = this.standing().find((i) => this.marbles.place[i] === 1) ?? -1;
      const seconds = won >= 0 ? this.marbles.took[won] : 0;
      this.progress.ran(RUNS[this.run].id, seconds);
      this.persist();
      this.events.over?.(won, seconds);
    }
  }

  /** The save written now. */
  persist() {
    this.progress.persist();
  }
}
