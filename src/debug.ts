/**
 * `window.game`: the game, for tests and for poking at from the console.
 * Everything a test needs to set a scene, play it exactly and read back
 * what happened, so no test waits on a clock or reaches into the game's
 * insides.
 *
 * Time is the test's to keep: `pause` stops the game where it is, and
 * `step` plays it on a frame at a time, exactly, drawing the last. `seed`
 * makes chance repeat. Anything that changes the game goes through here,
 * and `state`, `marbles`, `content`, `events` and `invariants` read it back.
 *
 * The types are shared with the smoke tests, so a test that calls something
 * that is not here does not compile.
 */
import type { Game, Shelf } from './game';
import { checkInvariants } from './invariants';
import { FINISHED, LOST, RACING, RADIUS, type Race, STALLED, WAITING } from './race';
import { seeded } from './random';
import { PIECES } from './catalog';
import { type Lane, PALETTE } from './designer';
import { type Kind, type Theme, at, spot } from './track';
import { DECOR_KINDS, type DecorKind, LIGHTS, bulbOf } from './decor';
import { RUNS } from './runs';

declare global {
  interface Window {
    game?: GameApi;
  }
}

export interface GameState {
  /** Game time, in seconds. */
  t: number;
  frame: number;
  paused: boolean;
  /** How many races have been run, and the best winning time on the run that is on; 0 before it has one. */
  races: number;
  best: number;
  /** Which run is on, what it is called, and the id the save knows it by. */
  run: number;
  runName: string;
  runId: string;
  /** Which shelf is on the board: the runs, the catalog of pieces, or the player's own designs. */
  shelf: Shelf;
  /** How the race that is on stands. */
  waiting: number;
  racing: number;
  finished: number;
  stalled: number;
  lost: number;
  /** Racing more than a ball's width clear of the floor under it: off a lip, or falling through a funnel's throat. */
  aloft: number;
  /** Racing on a funnel's bowl. */
  inBowl: number;
  over: boolean;
  /** Who is leading, or who won; -1 with nothing to say. */
  leader: number;
  /** The player whose marble won: 0 where no player had it, -1 before the race is over. */
  champion: number;
}

/** A marble, as a test sees it. */
export interface Marble {
  /** Which marble it is. */
  index: number;
  x: number;
  y: number;
  z: number;
  /** Which piece of the run it is on, how far along it, and how far across the channel. */
  segment: number;
  along: number;
  across: number;
  speed: number;
  /** How far along the whole run it has got. */
  far: number;
  state: 'waiting' | 'racing' | 'finished' | 'stalled' | 'lost';
  /** How high its middle is over the floor under it, along the floor's own up: a ball's radius where it rolls. */
  up: number;
  /** Whether it is on a funnel's bowl, where the floor is the bowl's and not the line it is ordered by. */
  bowl: boolean;
  place: number;
  took: number;
  /** Which player has it, from 1; 0 where it is nobody's. */
  player: number;
}

/** What the run is, for setting a scene without importing the game's source. */
export interface Content {
  runs: string[];
  /** Every piece in the catalog, by name, in the order its shelf shows them. */
  catalog: string[];
  /** How long the run that is on is, and how many pieces it has. */
  length: number;
  pieces: number;
  marbles: number;
  /** Each funnel's bowl on the run that is on: its segment, and the middle of its rim, for a picture to look at. */
  bowls: { segment: number; x: number; y: number; z: number }[];
}

/** What the run on is dressed with, as a test sees it. */
export interface Dressing {
  /** The run's theme: plain where it names none. */
  theme: Theme | 'plain';
  /** How many of each kind stand by it, every kind named, none or not. */
  kinds: Record<DecorKind, number>;
  /** Where each lamp's light hangs, a works' or a sweet factory's, for a picture to look at. */
  lamps: [number, number, number][];
  /** Where each chimney's top is, for a picture to look at. */
  chimneys: [number, number, number][];
}

/** The builder, as a test sees it. */
export interface Designing {
  building: boolean;
  /** The run being built, by kind, the start first; empty while nothing is. */
  pieces: Kind[];
  /** Which of those pieces have a grid over them, by their place in the run. */
  lids: number[];
  /** What it is dressed as. */
  theme: Theme | 'plain';
  /** Where it can go on: one end, a split's two, the right lane's first, or none once it has ended. */
  ends: { x: number; y: number; z: number; facing: number }[];
  /** Which lane the next piece goes on while a split is open; null while there is one end or none. */
  lane: Lane | null;
  /** What is wrong with it, in the player's terms; empty once it could be kept. */
  problems: string[];
  /** The kinds it can be built with. */
  palette: Kind[];
  designs: { id: string; name: string; pieces: number }[];
}

export interface GameApi {
  readonly version: 1;
  /** Booted, and the frame loop running. */
  readonly ready: boolean;
  /** How long the boot took, from the page's start to ready, in milliseconds; 0 until it has. */
  readonly bootMs: number;

  pause(): void;
  resume(): void;
  /** Play `frames` frames of 1/60 s exactly, and draw the last. */
  step(frames?: number): void;
  /** Chance from a seed from now on. */
  seed(n: number): void;

  state(): GameState;
  marbles(): Marble[];
  content(): Content;
  /** What has happened since this was last asked, a line each: "finished 3 1 5.21". */
  events(): string[];
  /** The rules that must always hold, broken; empty when all is well. */
  invariants(): string[];

  /** Put a run on, by its number on the shelf that is on the board. */
  pick(run: number): void;
  /** Another shelf on the board, where it was left; the designs shelf with none on it is the builder. */
  browse(shelf: Shelf): void;
  /** A run begun from a start gate, to build a piece at a time, and put on as it grows. */
  build(): void;
  /** A piece of `kind` on the end of the run being built; whether it went on. */
  lay(kind: Kind): boolean;
  /** The last piece of the run being built taken off; whether there was one. */
  undo(): boolean;
  /** A grid over the last piece of the run being built, or taken off it; whether either happened. */
  lid(): boolean;
  /** The next piece on `lane` of the split being built; whether there was one. */
  lane(lane: Lane): boolean;
  /** The run being built dressed as `theme`, or made plain; whether anything was being built. */
  dress(theme: Theme | 'plain'): boolean;
  /** What the run on is dressed with. */
  decor(): Dressing;
  /** The run being built kept and put on; what is wrong with it instead, and nothing kept, where anything is. */
  keep(name?: string): string[];
  /** The run being built thrown away, and the run it was begun from put back on. */
  leave(): void;
  /** A kept design thrown away, by its number on the designs shelf. */
  forget(index: number): void;
  /** The builder as it stands: whether a run is being built, its pieces, what is wrong with it, and the designs kept. */
  designer(): Designing;
  /** Let them go: where each starts is drawn now. */
  release(): void;
  /** The field back on the start gate. */
  reset(): void;
  /** A marble picked for the next player without one, or let go if it is had already; who has it now, 0 for nobody. */
  claim(marble: number): number;
  /** A marble put where a test wants it, still: how far along which piece, and how far across. */
  place(marble: number, segment: number, along: number, across?: number): void;
  /** Play until the race is over or `seconds` of game time have gone by; how long it took. */
  settle(seconds?: number): number;
  /** The save written now, and what it is. */
  save(): string;

  /**
   * The camera looking at a point, from `azimuth` round and `polar` down,
   * `radius` away, at once, and following nothing after. A run descends, so
   * where to look has a height to it as well.
   */
  look(x: number, y: number, z: number, view?: { azimuth?: number; polar?: number; radius?: number }): void;
  /** What drawing a frame of the scene as it stands costs, in milliseconds. */
  measureFrame(): Promise<number>;
  /** Whether the camera follows the leader, which a test wants off so a picture is the same every run. */
  follow(on: boolean): void;
  /** The screen split, one view to every picked marble, or whole again; whether it is split now. */
  split(on?: boolean): boolean;
  /** The cameras in use, one to every picked marble: whether the screen is split, which marble each follows, and where each looks. */
  cameras(): { on: boolean; views: number; marbles: number[]; targets: number[][] };
  /** Where the ordinary, unsplit camera is looking: a test's way of telling a chase still moving from one frozen. */
  chase(): [number, number, number];
  /** The colour of the sky the page draws the run against, which the run's theme sets. */
  sky(): [number, number, number];
  /** Where a point of the world is on the page, in CSS pixels from its top left, seen through the camera as it stands. */
  project(x: number, y: number, z: number): [number, number];
}

/** What the page gives the API that is not the game's: time, the camera and the renderer. */
export interface DebugHost {
  game: Game;
  ready(): boolean;
  bootMs(): number;
  paused(): boolean;
  setPaused(paused: boolean): void;
  /** Play one frame of `dt`, without drawing. */
  simulate(dt: number): void;
  draw(dt: number): void;
  frame(): number;
  /** The run changed underneath the page, so whatever draws it has to be built again. */
  rebuild(): void;
  look(x: number, y: number, z: number, view: { azimuth?: number; polar?: number; radius?: number }): void;
  setFollow(on: boolean): void;
  /** The screen laid out again for the game's `split`, which has just changed. */
  resplit(): void;
  measureFrame(): Promise<number>;
  /** Where the ordinary, unsplit camera is looking. */
  chase(): [number, number, number];
  /** The colour of the sky the page draws the run against, which the run's theme sets. */
  sky(): [number, number, number];
  /** Where a point of the world is on the page, in CSS pixels from its top left, seen through the camera as it stands. */
  project(x: number, y: number, z: number): [number, number];
  events: string[];
}

const NAMES = ['waiting', 'racing', 'finished', 'stalled', 'lost'] as const;

/** How high marble `i` is over the floor under it, along the floor's up; a spot to read into, so reading makes nothing. */
const under = spot();
function upOf(marbles: Race, i: number): number {
  const s = at(marbles.track, marbles.segment[i], marbles.along[i], under);
  return s.ux * (marbles.x[i] - s.x) + s.uy * (marbles.y[i] - s.y) + s.uz * (marbles.z[i] - s.z);
}

export function createApi(host: DebugHost): GameApi {
  const { game } = host;
  return {
    version: 1,
    get ready() {
      return host.ready();
    },
    get bootMs() {
      return host.bootMs();
    },
    pause: () => host.setPaused(true),
    resume: () => host.setPaused(false),
    step(frames = 1) {
      for (let f = 0; f < frames; f++) host.simulate(1 / 60);
      host.draw(1 / 60);
    },
    seed(n) {
      game.random = seeded(n);
    },

    state() {
      const { marbles } = game;
      let waiting = 0,
        racing = 0,
        aloft = 0,
        inBowl = 0;
      for (let i = 0; i < marbles.count; i++) {
        if (marbles.state[i] === WAITING) waiting++;
        else if (marbles.state[i] === RACING) {
          racing++;
          const seg = marbles.track.segments[marbles.segment[i]];
          if (seg.funnel) inBowl++;
          else if (upOf(marbles, i) > RADIUS * 3) aloft++;
        }
      }
      const standing = game.standing();
      return {
        t: game.t,
        frame: host.frame(),
        paused: host.paused(),
        races: game.progress.save.races,
        best: game.best(),
        run: game.run,
        runName: game.track.name,
        runId: game.current.id,
        shelf: game.shelf,
        waiting,
        racing,
        finished: marbles.finishers,
        stalled: marbles.stalled,
        lost: marbles.lost,
        aloft,
        inBowl,
        over: game.over,
        leader: standing.length > 0 ? standing[0] : -1,
        champion: game.champion(),
      };
    },
    marbles() {
      const { marbles } = game;
      const out: Marble[] = [];
      for (let i = 0; i < marbles.count; i++)
        out.push({
          index: i,
          x: marbles.x[i],
          y: marbles.y[i],
          z: marbles.z[i],
          segment: marbles.segment[i],
          along: marbles.along[i],
          across: marbles.across[i],
          speed: marbles.speed[i],
          far: marbles.far(i),
          state: NAMES[marbles.state[i]] ?? 'waiting',
          up: upOf(marbles, i),
          bowl: marbles.track.segments[marbles.segment[i]].funnel !== null,
          place: marbles.place[i],
          took: marbles.took[i],
          player: game.players[i] ?? 0,
        });
      return out;
    },
    content: () => ({
      runs: RUNS.map((r) => r.name),
      catalog: PIECES.map((p) => p.name),
      length: game.track.length,
      pieces: game.current.pieces.length,
      marbles: game.marbles.count,
      bowls: game.track.segments.flatMap((seg, segment) =>
        seg.funnel ? [{ segment, x: seg.funnel.x, y: seg.funnel.y, z: seg.funnel.z }] : [],
      ),
    }),
    events() {
      return host.events.splice(0);
    },
    invariants: () => checkInvariants(game),

    pick(run) {
      game.pick(run);
      host.rebuild();
    },
    browse(shelf) {
      game.browse(shelf);
      host.rebuild();
    },
    build() {
      game.build();
      host.rebuild();
    },
    lay(kind) {
      const went = game.lay(kind);
      host.rebuild();
      return went;
    },
    undo() {
      const went = game.undo();
      host.rebuild();
      return went;
    },
    lid() {
      const went = game.lid();
      host.rebuild();
      return went;
    },
    lane(lane) {
      const went = game.lane(lane);
      host.rebuild();
      return went;
    },
    dress(theme) {
      const went = game.dress(theme);
      host.rebuild();
      return went;
    },
    decor() {
      const on = game.designer?.run ?? game.current;
      const kinds = Object.fromEntries(DECOR_KINDS.map((k) => [k, game.decor.filter((d) => d.kind === k).length]));
      return {
        theme: on.theme ?? 'plain',
        kinds: kinds as Record<DecorKind, number>,
        lamps: game.decor.filter((d) => LIGHTS[d.kind]).map((d) => bulbOf(game.track, d, [0, 0, 0])),
        chimneys: game.decor
          .filter((d) => d.kind === 'chimney')
          .map((d): [number, number, number] => [d.x, d.y, d.z + d.height]),
      };
    },
    keep(name = '') {
      const refused = game.keep(name);
      host.rebuild();
      return refused;
    },
    leave() {
      game.leave();
      host.rebuild();
    },
    forget(index) {
      game.forget(index);
      host.rebuild();
    },
    designer() {
      const { designer } = game;
      return {
        building: designer !== null,
        pieces: designer ? designer.run.pieces.map((p) => p.kind) : [],
        lids: designer ? designer.run.pieces.flatMap((p, i) => (p.lid ? [i] : [])) : [],
        theme: designer ? (designer.run.theme ?? 'plain') : 'plain',
        ends: designer ? designer.ends.map((e) => ({ ...e })) : [],
        lane: designer ? designer.lane : null,
        problems: designer ? designer.problems() : [],
        palette: [...PALETTE],
        designs: game.progress.save.designs.map((d) => ({ id: d.id, name: d.name, pieces: d.pieces.length })),
      };
    },
    release: () => game.release(),
    reset: () => game.reset(),
    claim: (marble) => game.claim(marble),
    place(marble, segment, along, across = 0) {
      game.marbles.put(marble, segment, along, across);
    },
    settle(seconds = 60) {
      const frames = Math.ceil(seconds * 60);
      const was = game.t;
      for (let f = 0; f < frames && !game.over; f++) host.simulate(1 / 60);
      host.draw(1 / 60);
      return game.t - was;
    },
    save() {
      game.persist();
      return JSON.stringify(game.progress.save);
    },

    look: (x, y, z, view = {}) => host.look(x, y, z, view),
    measureFrame: () => host.measureFrame(),
    follow: (on) => host.setFollow(on),
    split(on) {
      if (on !== undefined && on !== game.split) {
        game.setSplit(on);
        host.resplit();
      }
      return game.split;
    },
    cameras() {
      const { cameras, views } = game;
      return {
        on: views > 0,
        views,
        marbles: [...cameras.marble.slice(0, views)],
        targets: Array.from({ length: views }, (_, s) => [...cameras.target.slice(s * 3, s * 3 + 3)]),
      };
    },
    sky() {
      return host.sky();
    },
    project(x, y, z) {
      return host.project(x, y, z);
    },
    chase() {
      return host.chase();
    },
  };
}

export { FINISHED, LOST, RACING, STALLED, WAITING };
