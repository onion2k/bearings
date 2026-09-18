import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../src/invariants';
import { FINISHED, WAITING } from '../src/marbles';
import { RUNS } from '../src/runs';
import { DT, newGame, race, settle } from './helpers';

describe('the game', () => {
  it('starts with a run on and a field waiting on its gate', () => {
    const { game } = newGame();
    expect(game.track.name).toBe(RUNS[0].name);
    expect(game.marbles.count).toBeGreaterThan(1);
    for (let i = 0; i < game.marbles.count; i++) expect(game.marbles.state[i]).toBe(WAITING);
    settle(game);
    expect(game.over, 'nothing happens until they are let go').toBe(false);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('runs a race to the end and tells of every marble home', () => {
    const { game, told } = newGame(2);
    expect(race(game)).toBe(true);
    expect(told.filter((t) => t.startsWith('finished')).length).toBe(game.marbles.count);
    expect(told.some((t) => t.startsWith('over'))).toBe(true);
    for (let i = 0; i < game.marbles.count; i++) expect(game.marbles.state[i]).toBe(FINISHED);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('counts a race into the save once it is done with, and not before', () => {
    const { game, store } = newGame(3);
    settle(game, 60);
    expect(game.progress.save.races).toBe(0);
    expect(store.json).toBe(null);
    race(game);
    expect(game.progress.save.races).toBe(1);
    expect(game.progress.save.best).toBeGreaterThan(0);
    expect(store.json, 'and it is written out').toBe(JSON.stringify(game.progress.save));
    // playing on does not count it twice
    settle(game, 300);
    expect(game.progress.save.races).toBe(1);
  });

  it('keeps the best time it has seen, and only betters it', () => {
    const { game } = newGame(4);
    race(game);
    const first = game.progress.save.best;
    game.reset();
    race(game);
    expect(game.progress.save.races).toBe(2);
    expect(game.progress.save.best).toBeLessThanOrEqual(first);
  });

  it('sets up again with the field back on the gate', () => {
    const { game } = newGame(5);
    race(game);
    game.reset();
    expect(game.over).toBe(false);
    for (let i = 0; i < game.marbles.count; i++) expect(game.marbles.state[i]).toBe(WAITING);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('puts another run on, and keeps what has been run', () => {
    const { game, told } = newGame(6);
    race(game);
    game.pick(1);
    expect(game.track.name).toBe(RUNS[1].name);
    expect(game.progress.save.races, 'a run changed is not a race lost').toBe(1);
    expect(told.some((t) => t.startsWith('picked'))).toBe(true);
    expect(checkInvariants(game)).toEqual([]);
    expect(race(game)).toBe(true);
    expect(game.progress.save.races).toBe(2);
  });

  it('wraps round when asked for a run past the last', () => {
    const { game } = newGame(7);
    game.pick(RUNS.length);
    expect(game.run).toBe(0);
    game.pick(-1);
    expect(game.run).toBe(RUNS.length - 1);
  });

  it('lists the whole field on the gate before the off, in the order they will leave it', () => {
    const { game } = newGame(10);
    const standing = game.standing();
    expect(standing.length).toBe(game.marbles.count);
    expect(standing.map((i) => game.marbles.grid[i])).toEqual([...Array(game.marbles.count).keys()]);
  });

  it('gives the standing with the finishers first, in the order they came', () => {
    const { game } = newGame(8);
    race(game);
    const standing = game.standing();
    expect(standing.length).toBe(game.marbles.count);
    expect(standing.map((i) => game.marbles.place[i])).toEqual([...Array(game.marbles.count).keys()].map((k) => k + 1));
  });

  it('plays on exactly where it left off, a frame at a time', () => {
    const { game } = newGame(9);
    game.release();
    for (let f = 0; f < 90; f++) game.step(DT);
    const was = game.marbles.far(0);
    game.step(DT);
    expect(game.marbles.far(0)).not.toBe(was);
    expect(checkInvariants(game)).toEqual([]);
  });
});
