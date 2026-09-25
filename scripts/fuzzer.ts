/**
 * The game played by a monkey: the real game, without the picture, made to
 * do at random everything a player can make happen — letting them go, setting
 * up again, putting another run on, building one, saving and loading — and checked after
 * every few frames for anything that must always hold and does not
 * (`invariants.ts`), and for anything thrown.
 *
 * Only what a player could do. A monkey that did what no player can would
 * find bugs no player will. A new thing a player can do gets an action here.
 *
 * From a seed, so a failure can be played again exactly: `npm run fuzz --
 * --seed N` does, and prints what was done before it went wrong.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { PALETTE } from '../src/designer';
import { Game, type GameEvents, type Shelf } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

// Rapier, which every race is raced on, loaded once before anything is played
await RAPIER.init();

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
    let game = new Game(RAPIER, new Progress(store), events, { random: seeded(seed) });
    let busy = 0;
    const between = (a: number, b: number) => a + random() * (b - a);
    const did = (what: string) => {
      count(done, what);
      log.push(`frame ${frame}: ${what}`);
    };
    const design = () => {
      // a run built: begun, pieces put on and taken off, and now and then kept, thrown away unkept, or a kept
      // one thrown away. Pieces chosen at random run into themselves more often than not, which is the
      // builder's to say and not to crash on; the end is put on more often than its share, so that a run is
      // sound often enough to be kept, and then raced by whatever the monkey does next
      if (!game.building) {
        const { designs } = game.progress.save;
        if (designs.length > 0 && random() < 0.25) {
          game.forget(Math.floor(random() * designs.length));
          did('forget');
        } else {
          game.build();
          did('build');
        }
      } else {
        const r = random();
        const split = (game.designer?.lane ?? null) !== null;
        if (split && r < 0.4) {
          // the other lane of a split chosen, or, as often, the same pieces laid on both and the two joined: laid
          // at random, two lanes all but never end side by side, and a split design would never be kept
          if (random() < 0.5) {
            game.lane(game.designer!.lane === 'left' ? 'right' : 'left');
            did('lane');
          } else {
            const kinds = Array.from(
              { length: Math.floor(between(1, 4)) },
              () => PALETTE[Math.floor(random() * PALETTE.length)],
            );
            for (const side of ['right', 'left'] as const) {
              game.lane(side);
              for (const kind of kinds) game.lay(kind);
            }
            game.lay('joiner');
            did('lanes');
          }
        } else if (!split && r < 0.08) {
          // a split begun, which a piece laid at random rarely is
          game.lay('splitter');
          did('splitter');
        } else if (r < 0.6) {
          for (let n = Math.floor(between(1, 7)); n > 0; n--)
            game.lay(random() < 0.12 ? 'finish' : PALETTE[Math.floor(random() * PALETTE.length)]);
          did('lay');
        } else if (r < 0.65) {
          // a grid over the last piece, or taken off it, as the builder's own button does
          game.lid();
          did('lid');
        } else if (r < 0.69) {
          // the run dressed as a works, or made plain again, at any point in building it
          game.dress(game.designer?.run.theme ? 'plain' : 'industrial');
          did('dress');
        } else if (r < 0.8) {
          game.undo();
          did('undo');
        } else if (r < 0.95) {
          const refused = game.keep(random() < 0.5 ? '' : 'A run');
          did(refused.length ? 'keep refused' : 'keep');
        } else {
          game.leave();
          did('leave');
        }
      }
      busy = Math.floor(between(5, 40));
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
          // another shelf on the board, then something off it: the catalog of pieces, the runs, or the player's
          // own designs, which is the builder where there are none yet
          const shelves: Shelf[] = ['runs', 'pieces', 'designs'];
          game.browse(shelves[Math.floor(random() * shelves.length)]);
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
          // the screen split, one view to every picked marble, or whole again, at any time: a way of looking,
          // so nothing it does may show in the race, and the invariants have every camera on a marble that is
          // there, none twice, and no more views than are picked
          game.setSplit(!game.split);
          busy = Math.floor(between(5, 40));
          did('split');
        },
      ],
      [3, design],
      [
        1,
        () => {
          // saved, and loaded again into a new game as a reload would: what was run must be kept, and what was built
          const races = game.progress.races;
          const designs = JSON.stringify(game.progress.save.designs);
          game.persist();
          store = memoryStore(store.json);
          game = new Game(RAPIER, new Progress(store), events, { random: seeded(seed + frame) });
          if (game.progress.races !== races)
            throw new Error(`${races} races had been run, and loaded as ${game.progress.races}`);
          if (JSON.stringify(game.progress.save.designs) !== designs)
            throw new Error(
              `the designs kept were ${designs}, and loaded as ${JSON.stringify(game.progress.save.designs)}`,
            );
          did('reload');
        },
      ],
    ];
    const total = actions.reduce((n, [w]) => n + w, 0);
    const act = () => {
      // a player at the builder mostly builds, and a monkey that wandered off after every piece never got a run
      // far enough to keep one
      if (game.building && random() < 0.75) return design();
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
