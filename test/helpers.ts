/** What the tests share: a new game in memory, from a seed, with a note of every event it tells. */
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, type GameEvents, type GameOptions } from '../src/game';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

// Rapier, which every race is raced on, loaded once for every test that imports this
await RAPIER.init();

export { RAPIER };

export const DT = 1 / 60;

export function newGame(seed = 1, json: string | null = null, options: Omit<GameOptions, 'random'> = {}) {
  const store = memoryStore(json);
  const told: string[] = [];
  const events: GameEvents = new Proxy(
    {},
    {
      get:
        (_, name: string) =>
        (...args: unknown[]) =>
          told.push(`${name} ${args.filter((a) => typeof a === 'number').join(' ')}`.trim()),
    },
  );
  const game = new Game(RAPIER, new Progress(store), events, { ...options, random: seeded(seed) });
  return { game, store, told };
}

/** Play `frames` frames. */
export function settle(game: Game, frames = 120) {
  for (let f = 0; f < frames; f++) game.step(DT);
}

/** Let them go and play until the race is done with, or `cap` seconds have gone by. */
export function race(game: Game, cap = 120) {
  game.release();
  for (let f = 0; f < cap * 60 && !game.over; f++) game.step(DT);
  return game.over;
}
