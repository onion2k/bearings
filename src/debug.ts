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
import type { Game } from './game';
import { checkInvariants } from './invariants';
import { FINISHED, FLYING, LOST, RACING, STALLED, WAITING } from './marbles';
import { seeded } from './random';
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
  /** How the race that is on stands. */
  waiting: number;
  racing: number;
  finished: number;
  stalled: number;
  flying: number;
  lost: number;
  over: boolean;
  /** Who is leading, or who won; -1 with nothing to say. */
  leader: number;
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
  state: 'waiting' | 'racing' | 'finished' | 'stalled' | 'flying' | 'lost';
  place: number;
  took: number;
}

/** What the run is, for setting a scene without importing the game's source. */
export interface Content {
  runs: string[];
  /** How long the run that is on is, and how many pieces it has. */
  length: number;
  pieces: number;
  marbles: number;
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

  /** Put a run on, by its number. */
  pick(run: number): void;
  /** Let them go. */
  release(): void;
  /** The field back on the start gate, drawn again. */
  reset(): void;
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
  measureFrame(): Promise<number>;
  events: string[];
}

const NAMES = ['waiting', 'racing', 'finished', 'stalled', 'flying', 'lost'] as const;

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
        flying = 0;
      for (let i = 0; i < marbles.count; i++) {
        if (marbles.state[i] === WAITING) waiting++;
        else if (marbles.state[i] === RACING) racing++;
        else if (marbles.state[i] === FLYING) flying++;
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
        runId: RUNS[game.run].id,
        waiting,
        racing,
        finished: marbles.finishers,
        stalled: marbles.stalled,
        flying,
        lost: marbles.lost,
        over: game.over,
        leader: standing.length > 0 ? standing[0] : -1,
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
          place: marbles.place[i],
          took: marbles.took[i],
        });
      return out;
    },
    content: () => ({
      runs: RUNS.map((r) => r.name),
      length: game.track.length,
      pieces: game.track.segments.length,
      marbles: game.marbles.count,
    }),
    events() {
      return host.events.splice(0);
    },
    invariants: () => checkInvariants(game),

    pick(run) {
      game.pick(run);
      host.rebuild();
    },
    release: () => game.release(),
    reset: () => game.reset(),
    place(marble, segment, along, across = 0) {
      const { marbles } = game;
      if (marble < 0 || marble >= marbles.count) return;
      marbles.segment[marble] = Math.min(Math.max(segment, 0), game.track.segments.length - 1);
      marbles.along[marble] = along;
      marbles.across[marble] = across;
      marbles.speed[marble] = 0;
      marbles.drift[marble] = 0;
      if (marbles.state[marble] === WAITING) marbles.state[marble] = RACING;
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
  };
}

export { FINISHED, FLYING, LOST, RACING, STALLED, WAITING };
