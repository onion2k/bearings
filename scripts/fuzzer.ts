/**
 * The game played by a monkey: the real game, without the picture, made to
 * do at random everything a player can make happen — letting them go, setting
 * up again, putting another run on, saving and loading — and checked after
 * every few frames for anything that must always hold and does not
 * (`invariants.ts`), and for anything thrown.
 *
 * Only what a player could do. A monkey that did what no player can would
 * find bugs no player will. A new thing a player can do gets an action here.
 *
 * From a seed, so a failure can be played again exactly: `npm run fuzz --
 * --seed N` does, and prints what was done before it went wrong.
 */
import { Game, type GameEvents } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

const DT = 1 / 60;
/** How many frames between checks, when nothing has just been done. */
const CHECK_EVERY = 10;
/** How many of the last things done a failure reports. */
const LOG_TAIL = 25;

export interface FuzzFailure {
  seed: number;
  frame: number;
  problems: string[];
  /** The last things done before it, oldest first. */
  log: string[];
}

export interface FuzzResult {
  seed: number;
  frames: number;
  failure: FuzzFailure | null;
  /** How often each thing was done, and each event happened: to see that the monkey got about. */
  done: Record<string, number>;
  happened: Record<string, number>;
}

/** Play `frames` frames of the game at random from `seed`. */
export function fuzz(seed: number, frames: number): FuzzResult {
  // the monkey's own chance, apart from the game's, so what it decides does not shift what the game does
  const random = seeded(seed * 7 + 1);
  const happened: Record<string, number> = {};
  const done: Record<string, number> = {};
  const count = (into: Record<string, number>, key: string) => (into[key] = (into[key] ?? 0) + 1);
  const events: GameEvents = new Proxy(
    {},
    {
      get: (_, name: string) => () => count(happened, name),
    },
  );
  const log: string[] = [];
  let frame = 0;
  const fail = (problems: string[]): FuzzResult => ({
    seed,
    frames: frame,
    failure: { seed, frame, problems, log: log.slice(-LOG_TAIL) },
    done,
    happened,
  });

  try {
    let store = memoryStore();
    let game = new Game(new Progress(store), events, { random: seeded(seed) });
    let busy = 0;
    const between = (a: number, b: number) => a + random() * (b - a);
    const did = (what: string) => {
      count(done, what);
      log.push(`frame ${frame}: ${what}`);
    };
    /** Everything a player can make happen, each as often as it is weighted. */
    const actions: [number, () => void][] = [
      [
        6,
        () => {
          // the gate: what a player does most, and a no-op once they are already away
          game.release();
          busy = Math.floor(between(30, 400));
          did('release');
        },
      ],
      [
        2,
        () => {
          // let go and watched to the end, which is what most players do: the only way a monkey that is forever
          // setting up again gets as far as the last pieces of a long run, a wheel or a funnel near the cup
          game.release();
          busy = Math.floor(between(1500, 2400));
          did('watch');
        },
      ],
      [
        3,
        () => {
          // set up again, whether or not the race that is on has finished
          game.reset();
          busy = Math.floor(between(10, 60));
          did('reset');
        },
      ],
      [
        1,
        () => {
          // the other shelf on the board: the catalog of pieces, or back to the runs, then something off it
          game.browse(game.shelf === 'runs' ? 'pieces' : 'runs');
          game.pick(Math.floor(random() * game.list.length));
          busy = Math.floor(between(10, 60));
          did('browse');
        },
      ],
      [
        2,
        () => {
          // another run put on, which throws away the race that was on
          game.pick(Math.floor(random() * game.list.length));
          busy = Math.floor(between(10, 60));
          did('pick');
        },
      ],
      [
        2,
        () => {
          // a marble picked or let go by a player, which only counts before the off; tried whenever, as a player
          // at the screen might, and a pick while they are away has to change nothing
          const marble = Math.floor(random() * game.marbles.count);
          const had = game.players[marble];
          const now = game.claim(marble);
          if (game.away && now !== had) throw new Error(`marble ${marble} changed hands during a race`);
          busy = Math.floor(between(5, 40));
          did('claim');
        },
      ],
      [
        2,
        () => {
          // the screen split in four or whole again, at any time: a way of looking, so nothing it does may show
          // in the race, and the invariants have every camera on a marble that is there, none twice
          game.setSplit(!game.split);
          busy = Math.floor(between(5, 40));
          did('split');
        },
      ],
      [
        1,
        () => {
          // saved, and loaded again into a new game as a reload would: what was run must be kept
          const races = game.progress.races;
          game.persist();
          store = memoryStore(store.json);
          game = new Game(new Progress(store), events, { random: seeded(seed + frame) });
          if (game.progress.races !== races)
            throw new Error(`${races} races had been run, and loaded as ${game.progress.races}`);
          did('reload');
        },
      ],
    ];
    const total = actions.reduce((n, [w]) => n + w, 0);
    const act = () => {
      let pick = random() * total;
      for (const [w, go] of actions) {
        if ((pick -= w) < 0) return go();
      }
    };

    for (frame = 1; frame <= frames; frame++) {
      if (busy > 0) busy--;
      else act();
      game.step(DT);
      if (frame % CHECK_EVERY === 0) {
        const problems = checkInvariants(game);
        if (problems.length) return fail(problems);
      }
    }
    return { seed, frames, failure: null, done, happened };
  } catch (err) {
    return fail([`threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`]);
  }
}
