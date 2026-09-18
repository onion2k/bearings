/**
 * The game itself, without the picture or the page: a run chosen, a field of
 * marbles on its start gate, and a race, a step at a time.
 *
 * What happens is told to `events`, for whoever shows it: the browser turns
 * it into words on the screen; the fuzzer and the tests leave it out, or
 * keep a note of it. Nothing here waits on anything there, so the same game
 * runs in the page and in Node, and what the tests try is what is played.
 *
 * Up to eight players each pick a marble before the off, and whoever picked
 * the winner wins. The marbles are all the same, and where each starts is
 * drawn as the gate opens, after the picks, so every pick is one chance in
 * eight whatever the run favours; the pegs, gates and paddles along the way
 * decide the rest. Nothing a player does reaches a marble once it is let go.
 * That is the game, and it is also what makes a race exactly repeatable from
 * its seed, which every replay and every baseline rests on.
 */
import { LOST, MARBLES, Marbles, STALLED, WAITING } from './marbles';
import { Progress } from './progress';
import type { Random } from './random';
import { PIECES } from './catalog';
import { RUNS } from './runs';
import { type Run, type Track, compile } from './track';

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
  /** A marble picked by a player, or let go by one: 0 where it is nobody's now. */
  claimed?(marble: number, player: number): void;
}

/** Which of the two lists is on the board: the runs, which are raced and kept, or the catalog of pieces, which is only looked at. */
export type Shelf = 'runs' | 'pieces';

export interface GameOptions {
  /** Chance; Math.random unless told otherwise, and the tests always tell. */
  random?: Random;
}

export class Game {
  /** Game time, in seconds. */
  t = 0;
  /** Where chance comes from: replaced by the test API's `seed`. */
  random: Random;
  /** Which shelf is on the board, and which of its runs is on. */
  shelf: Shelf = 'runs';
  run = 0;
  /** Where each shelf was left, to go back to it there. */
  private readonly left: Record<Shelf, number> = { runs: 0, pieces: 0 };
  track!: Track;
  marbles!: Marbles;
  /** Whether the race that is on has been counted into the save yet. */
  private counted = true;
  /**
   * Which player has each marble, from 1, and 0 for nobody's. Kept from one
   * race to the next and from one run to another, as a colour is in a board
   * game, until a player lets theirs go; never saved, since a table of
   * players is only ever the people round the screen.
   */
  readonly players = new Int8Array(MARBLES);

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

  /** The runs on the shelf that is on the board. */
  get list(): readonly Run[] {
    return this.shelf === 'runs' ? RUNS : PIECES;
  }

  /** The run that is on, whichever shelf it is from. */
  get current(): Run {
    return this.list[this.run];
  }

  /**
   * Put a run on from the shelf that is on the board. A run is remembered,
   * and the save written so the next visit starts on it; a piece from the
   * catalog is somewhere to look, and is not.
   */
  pick(run: number) {
    this.putOn(run);
    if (this.shelf !== 'runs') return;
    this.progress.chose(this.current.id);
    this.persist();
  }

  /** The other shelf on the board, put on where it was left: the first of it, the first time. */
  browse(shelf: Shelf) {
    if (shelf === this.shelf) return;
    this.left[this.shelf] = this.run;
    this.shelf = shelf;
    this.putOn(this.left[shelf]);
  }

  /** A run worked out, and a field drawn for its start gate. */
  private putOn(run: number) {
    const { list } = this;
    this.run = ((run % list.length) + list.length) % list.length;
    this.track = compile(list[this.run]);
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

  /** The field back on the start gate, to wait for the next off. */
  reset() {
    this.marbles.reset();
    this.counted = false;
  }

  /**
   * Let them go. Where each starts is drawn now, as the gate opens, and not
   * before: the players have picked by then, and a slot a run favours —
   * and some favour one slot in two races of five — is no use to anyone.
   */
  release() {
    if (this.away) return;
    this.marbles.draw(() => this.random());
    this.marbles.reset();
    this.marbles.release();
  }

  /** Whether they have been let go, in the race that is on. */
  get away(): boolean {
    for (let i = 0; i < this.marbles.count; i++) if (this.marbles.state[i] !== WAITING) return true;
    return false;
  }

  /**
   * A marble picked: given to the first player without one, or let go again
   * if a player has it already. Only before the off. Which player has it now,
   * or 0 for nobody.
   */
  claim(marble: number): number {
    if (!Number.isInteger(marble) || marble < 0 || marble >= this.players.length) return 0;
    if (this.away) return this.players[marble];
    if (this.players[marble] > 0) this.players[marble] = 0;
    else {
      let player = 1;
      while (this.players.includes(player)) player++;
      this.players[marble] = player;
    }
    this.events.claimed?.(marble, this.players[marble]);
    return this.players[marble];
  }

  /** The player whose marble won the race that is over; 0 where no player had it, or nothing finished; -1 before it is over. */
  champion(): number {
    if (!this.over) return -1;
    const won = this.standing().find((i) => this.marbles.place[i] === 1);
    return won === undefined ? 0 : this.players[won];
  }

  /** The best winning time on the run that is on, or 0 before it has one. */
  best(): number {
    return this.shelf === 'runs' ? this.progress.best(this.current.id) : 0;
  }

  /** Whether the race that is on has been run. */
  get over(): boolean {
    return this.marbles.over;
  }

  /**
   * Who is winning, or who won: every marble in the order it stands. Those
   * home first in the order they came, then those still going with the one
   * furthest on in front, then those still on the gate in their own order —
   * where each starts is not drawn until the off, so a board of them in the
   * order they stand would tell of a draw that means nothing — and last
   * anything that stopped short. A board is worth having before the off as
   * well as after it.
   */
  standing(): number[] {
    const { marbles } = this;
    const all = [...Array(marbles.count).keys()];
    const home = all.filter((i) => marbles.place[i] > 0).sort((a, b) => marbles.place[a] - marbles.place[b]);
    const waiting = all.filter((i) => marbles.state[i] === WAITING);
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
      // a race on a piece from the catalog is only a look at it, and is neither counted nor kept
      if (this.shelf === 'runs') {
        this.progress.ran(this.current.id, seconds);
        this.persist();
      }
      this.events.over?.(won, seconds);
    }
  }

  /** The save written now. */
  persist() {
    this.progress.persist();
  }
}
