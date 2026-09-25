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
 *
 * Besides the runs that ship there are the runs a player builds: while one is
 * being built it is the run on, remade as each piece goes on or comes off, and
 * nothing is let go down it; kept, it goes on the designs shelf and is raced,
 * timed and put back on after a reload like any run that ships.
 */
import { Cameras, MAX_SLOTS } from './cameras';
import { Designer, type Lane, MAX_DESIGNS, kept } from './designer';
import { Physics, type Rapier } from './physics';
import { LOST, MARBLES, type Race, STALLED, WAITING } from './race';
import { Progress } from './progress';
import type { Random } from './random';
import { PIECES } from './catalog';
import { RUNS } from './runs';
import { type Kind, type Run, type Track, compile } from './track';

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

/**
 * Which list is on the board: the runs that ship, the catalog of pieces, which
 * is only looked at, or the runs the player has built, which are raced and
 * kept like the runs that ship.
 */
export type Shelf = 'runs' | 'pieces' | 'designs';

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
  private readonly left: Record<Shelf, number> = { runs: 0, pieces: 0, designs: 0 };
  /** The run being built, and which shelf and run to go back to if it is left unkept; null while nothing is. */
  designer: Designer | null = null;
  private cameFrom: { shelf: Shelf; run: number } = { shelf: 'runs', run: 0 };
  track!: Track;
  marbles!: Race;
  /** Whether the race that is on has been counted into the save yet. */
  private counted = true;
  /**
   * Which player has each marble, from 1, and 0 for nobody's. Kept from one
   * race to the next and from one run to another, as a colour is in a board
   * game, until a player lets theirs go; never saved, since a table of
   * players is only ever the people round the screen.
   */
  readonly players = new Int8Array(MARBLES);
  /**
   * Whether the screen is split, one view to every picked marble, and who
   * they follow. Off below two picks, whatever this says: a split of one is
   * no split, and no split is the whole screen. A way of looking and
   * nothing the race feels: it is not saved, and it changes no marble.
   */
  split = false;
  readonly cameras = new Cameras();

  /** How many views the split has, from how many marbles are picked; 0 with the screen whole. */
  get views(): number {
    if (!this.split) return 0;
    let picked = 0;
    for (let m = 0; m < this.players.length; m++) if (this.players[m] > 0) picked++;
    return picked >= 2 ? Math.min(picked, MAX_SLOTS) : 0;
  }

  /**
   * `rapier` is Rapier, loaded and ready, which races every run: handed in
   * rather than imported, since it is loaded by whoever wires the game up,
   * the page at its boot and Node in a test or a script.
   */
  constructor(
    private readonly rapier: Rapier,
    readonly progress: Progress,
    private readonly events: GameEvents = {},
    options: GameOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    // the run last put on, if the save names one there is, among the runs that ship or the player's own; loading
    // alone writes nothing, so a name the game cannot put on is only forgotten in memory until the next write
    const { save } = progress;
    const shipped = RUNS.findIndex((r) => r.id === save.run);
    const built = save.designs.findIndex((r) => r.id === save.run);
    if (shipped < 0 && built < 0) save.run = '';
    // a best kept for a run the game no longer has — one since rebuilt under a new id, or a design since
    // thrown away — is dropped, so a save does not gather records for runs that are gone
    for (const id of Object.keys(save.bests))
      if (!RUNS.some((r) => r.id === id) && !save.designs.some((r) => r.id === id))
        Reflect.deleteProperty(save.bests, id);
    if (built >= 0) this.shelf = 'designs';
    this.putOn(Math.max(shipped, built, 0));
  }

  /** The runs on the shelf that is on the board. */
  get list(): readonly Run[] {
    return this.shelf === 'runs' ? RUNS : this.shelf === 'pieces' ? PIECES : this.progress.save.designs;
  }

  /** The run that is on, whichever shelf it is from, or the one being built. */
  get current(): Run {
    return this.designer ? this.designer.run : this.list[this.run];
  }

  /** Whether a run is being built, rather than one put on from a shelf. */
  get building(): boolean {
    return this.designer !== null;
  }

  /** Whether races on the run that is on are counted, timed and kept: those on a catalog piece are not. */
  private get scored(): boolean {
    return this.shelf !== 'pieces' && !this.designer;
  }

  /**
   * Put a run on from the shelf that is on the board. A run is remembered,
   * and the save written so the next visit starts on it; a piece from the
   * catalog is somewhere to look, and is not.
   */
  pick(run: number) {
    // a run put on leaves the one being built, unkept; with no designs to put on there is only building
    this.designer = null;
    if (this.list.length === 0) return this.build();
    this.putOn(run);
    if (!this.scored) return;
    this.progress.chose(this.current.id);
    this.persist();
  }

  /** Another shelf on the board, put on where it was left: the first of it, the first time; the builder, for designs with none. */
  browse(shelf: Shelf) {
    if (shelf === this.shelf && !this.designer) return;
    if (!this.designer) this.left[this.shelf] = this.run;
    this.designer = null;
    this.shelf = shelf;
    if (this.list.length === 0) return this.build();
    this.putOn(this.left[shelf]);
  }

  /** A run begun from its start gate, to build on a piece at a time, on the designs shelf. */
  build() {
    if (!this.designer) this.cameFrom = { shelf: this.shelf, run: this.run };
    const { designs } = this.progress.save;
    this.shelf = 'designs';
    this.designer = new Designer(kept(designs, '', []).name);
    this.mount(this.designer.run);
  }

  /** A piece of `kind` on the end of the run being built; whether it went on. */
  lay(kind: Kind): boolean {
    if (!this.designer?.place(kind)) return false;
    this.mount(this.designer.run);
    return true;
  }

  /** A grid over the last piece of the run being built, or taken off it; whether either happened. */
  /** The next piece on `lane` of the split being built; whether there was one. Nothing is remade: no piece moved. */
  lane(lane: Lane): boolean {
    return this.designer?.choose(lane) ?? false;
  }

  lid(): boolean {
    if (!this.designer?.lid()) return false;
    this.mount(this.designer.run);
    return true;
  }

  /** The last piece of the run being built taken off again; whether there was one. */
  undo(): boolean {
    if (!this.designer?.undo()) return false;
    this.mount(this.designer.run);
    return true;
  }

  /**
   * The run being built kept, named `name`, and put on: what is wrong with it
   * instead, where anything is, and it is not kept. Nothing is ever kept that
   * would not race, and never more designs than a save keeps.
   */
  keep(name: string): string[] {
    const { designer } = this;
    if (!designer) return ['nothing is being built'];
    const { designs } = this.progress.save;
    if (designs.length >= MAX_DESIGNS)
      return [`${MAX_DESIGNS} designs are kept already: throw one away to keep another`];
    const problems = designer.problems();
    if (problems.length) return problems;
    designs.push(kept(designs, name, designer.run.pieces));
    this.designer = null;
    this.shelf = 'designs';
    this.pick(designs.length - 1);
    return [];
  }

  /** The run being built thrown away, and the shelf and run it was begun from put back on. */
  leave() {
    if (!this.designer) return;
    this.designer = null;
    this.shelf = this.cameFrom.shelf;
    if (this.list.length === 0) this.shelf = 'runs';
    this.putOn(this.cameFrom.run);
  }

  /**
   * A design thrown away, its best time with it, so an id is never taken for
   * a design it once was. Where the designs shelf is on, the design after it
   * goes on, or the builder once there are none.
   */
  forget(index: number) {
    const { save } = this.progress;
    if (!Number.isInteger(index) || index < 0 || index >= save.designs.length) return;
    const gone = save.designs[index];
    save.designs.splice(index, 1);
    Reflect.deleteProperty(save.bests, gone.id);
    if (save.run === gone.id) save.run = '';
    this.persist();
    if (this.shelf !== 'designs' || this.designer) return;
    if (save.designs.length === 0) return this.build();
    this.putOn(Math.min(index, save.designs.length - 1));
  }

  /** A run worked out from a shelf, and a field drawn for its start gate. */
  private putOn(run: number) {
    const { list } = this;
    this.run = ((run % list.length) + list.length) % list.length;
    this.mount(list[this.run]);
  }

  /**
   * `run` worked out, and a field drawn for its start gate: compiled the way
   * physics wants it, leaning and walled, and drawn that way too, so what is
   * seen is what is raced.
   */
  private mount(run: Run) {
    const events = {
      released: (n: number) => this.events.released?.(n),
      finished: (m: number, place: number, s: number) => this.events.finished?.(m, place, s),
      stalled: (m: number, s: number) => this.events.stalled?.(m, s),
      lost: (m: number, s: number) => this.events.lost?.(m, s),
    };
    const random = () => this.random();
    // the race before this one let go of: a physics world is memory of Rapier's own
    (this.marbles as Race | undefined)?.dispose?.();
    this.track = compile(run);
    this.marbles = new Physics(this.rapier, this.track, events, { random });
    this.counted = false;
    this.follow();
    this.events.picked?.(this.run, this.track.name);
  }

  /** The field back on the start gate, to wait for the next off. */
  reset() {
    this.marbles.reset();
    this.counted = false;
    this.follow();
  }

  /** The screen split, one view to every picked marble, or whole again. */
  setSplit(on: boolean) {
    this.split = on;
    this.follow();
  }

  /** The cameras given their marbles afresh, where the screen is split, and let go of them where it is not. */
  private follow() {
    this.cameras.reset();
    this.cameras.count = this.views;
    if (this.views > 0) this.cameras.assign(this.players);
  }

  /**
   * Let them go. Where each starts is drawn now, as the gate opens, and not
   * before: the players have picked by then, and a slot a run favours —
   * and some favour one slot in two races of five — is no use to anyone.
   */
  release() {
    // a run still being built has nowhere yet to finish, and its pieces may be about to change under the field
    if (this.away || this.designer) return;
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
    this.follow();
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
    return this.scored ? this.progress.best(this.current.id) : 0;
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
      if (this.scored) {
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
