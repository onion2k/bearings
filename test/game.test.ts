import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../src/invariants';
import { FINISHED, WAITING } from '../src/marbles';
import { PIECES } from '../src/catalog';
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
    expect(game.best()).toBeGreaterThan(0);
    expect(store.json, 'and it is written out').toBe(JSON.stringify(game.progress.save));
    // playing on does not count it twice
    settle(game, 300);
    expect(game.progress.save.races).toBe(1);
  });

  it('keeps the best time on the run that is on, and only betters it', () => {
    const { game } = newGame(4);
    race(game);
    const first = game.best();
    expect(first).toBeGreaterThan(0);
    game.reset();
    race(game);
    expect(game.progress.save.races).toBe(2);
    expect(game.best()).toBeLessThanOrEqual(first);
  });

  it('keeps a best for each run, and never lets one stand for another', () => {
    const { game } = newGame(11);
    game.pick(1);
    race(game);
    const chute = game.best();
    game.pick(0);
    expect(game.best(), 'nothing yet on a run not raced').toBe(0);
    race(game);
    expect(game.best(), "the long run's own time, not the short one's").toBeGreaterThan(chute);
    game.pick(1);
    expect(game.best()).toBe(chute);
  });

  it('puts the run last put on back on when it is loaded again', () => {
    const { game, store } = newGame(12);
    game.pick(2);
    const again = newGame(12, store.json).game;
    expect(again.run).toBe(2);
    expect(again.track.name).toBe(RUNS[2].name);
  });

  it('starts on the first run from a save that names none, or one there is not', () => {
    expect(newGame(13, JSON.stringify({ races: 4 })).game.run).toBe(0);
    const gone = newGame(13, JSON.stringify({ races: 4, run: 'a-run-long-gone', bests: {} })).game;
    expect(gone.run).toBe(0);
    expect(gone.progress.save.run, 'and does not keep a name for a run it cannot put on').toBe('');
    expect(checkInvariants(gone)).toEqual([]);
  });

  it('writes the save when a run is picked, and not for being loaded', () => {
    const { game, store } = newGame(14, JSON.stringify({ races: 1, run: 'the-chute', bests: {} }));
    expect(store.json, 'loading alone writes nothing').toBe(JSON.stringify({ races: 1, run: 'the-chute', bests: {} }));
    game.pick(3);
    expect((JSON.parse(store.json!) as { run: string }).run).toBe(RUNS[3].id);
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

  it('lists the whole field before the off in its own order, since where each starts is not drawn until the off', () => {
    const { game } = newGame(10);
    expect(game.standing()).toEqual([...Array(game.marbles.count).keys()]);
    race(game);
    game.reset();
    expect(game.standing(), 'and again after a race').toEqual([...Array(game.marbles.count).keys()]);
  });

  it('draws the grid at the off, so the gate a player sees before it tells nothing of where a marble starts', () => {
    let kept = 0,
      seen = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { game } = newGame(seed);
      const before = [...game.marbles.grid];
      game.release();
      for (let i = 0; i < game.marbles.count; i++, seen++) if (game.marbles.grid[i] === before[i]) kept++;
      expect(checkInvariants(game)).toEqual([]);
    }
    // one in eight would keep its slot by chance alone: 40 of 320
    expect(kept / seen, 'no more often than chance keeps a marble where it stood').toBeLessThan(0.25);
  });

  it('draws the same grid at the off from the same seed', () => {
    const one = newGame(12).game,
      two = newGame(12).game;
    one.release();
    two.release();
    expect([...one.marbles.grid]).toEqual([...two.marbles.grid]);
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

  describe('the players', () => {
    it('gives a marble to the first player without one, and frees it when it is picked again', () => {
      const { game, told } = newGame(1);
      expect(game.claim(3)).toBe(1);
      expect(game.claim(5)).toBe(2);
      expect(game.claim(0)).toBe(3);
      expect([...game.players]).toEqual([3, 0, 0, 1, 0, 2, 0, 0]);
      expect(game.claim(5), 'picked again, it is let go').toBe(0);
      expect(game.claim(6), 'and the next to pick takes the lowest number free').toBe(2);
      expect(told.filter((l) => l.startsWith('claimed')).length).toBe(5);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('seats as many players as there are marbles, and no more', () => {
      const { game } = newGame(1);
      for (let i = 0; i < game.marbles.count; i++) expect(game.claim(i)).toBe(i + 1);
      expect(new Set(game.players).size).toBe(game.marbles.count);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('holds the claims fast once they are away, and frees them again for the next race', () => {
      const { game } = newGame(2);
      game.claim(1);
      game.release();
      expect(game.claim(4), 'nothing is picked once they are away').toBe(0);
      expect(game.claim(1), 'nor let go').toBe(1);
      for (let f = 0; f < 120 * 60 && !game.over; f++) game.step(DT);
      game.reset();
      expect(game.claim(4)).toBe(2);
    });

    it('keeps who has which marble through a race, a reset and another run', () => {
      const { game } = newGame(3);
      game.claim(2);
      game.claim(7);
      race(game);
      game.reset();
      expect([...game.players]).toEqual([0, 0, 1, 0, 0, 0, 0, 2]);
      game.pick(1);
      expect([...game.players]).toEqual([0, 0, 1, 0, 0, 0, 0, 2]);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('names the player whose marble won, and nobody where no player had it', () => {
      let named = 0,
        nobody = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const { game } = newGame(seed);
        expect(game.champion(), 'nobody has won before the race is run').toBe(-1);
        game.claim(0);
        game.claim(1);
        game.claim(2);
        race(game);
        const won = [...Array(game.marbles.count).keys()].find((i) => game.marbles.place[i] === 1)!;
        expect(game.champion(), `seed ${seed}`).toBe(game.players[won]);
        if (game.champion() > 0) named++;
        else nobody++;
      }
      expect(named, 'three players of eight win some of the time').toBeGreaterThan(0);
      expect(nobody, 'and some of the time nobody had the winner').toBeGreaterThan(0);
    });
  });

  describe('the shelf of pieces', () => {
    it('puts the pieces on in place of the runs, one after another, and goes back to the run it was on', () => {
      const { game } = newGame(4);
      game.pick(2);
      game.browse('pieces');
      expect(game.shelf).toBe('pieces');
      expect(game.track.name).toBe(PIECES[0].name);
      game.pick(game.run + 1);
      expect(game.track.name).toBe(PIECES[1].name);
      game.pick(-1);
      expect(game.track.name, 'round from the first to the last').toBe(PIECES[PIECES.length - 1].name);
      expect(game.progress.save.run, 'a piece is somewhere to look, not a run to come back to').toBe(RUNS[2].id);
      expect(checkInvariants(game)).toEqual([]);
      game.browse('runs');
      expect(game.track.name).toBe(RUNS[2].name);
      game.browse('pieces');
      expect(game.track.name, 'and back to the piece it was on').toBe(PIECES[PIECES.length - 1].name);
    });

    it('counts no race run on a piece, and keeps no best for one', () => {
      const { game } = newGame(5);
      game.browse('pieces');
      expect(race(game)).toBe(true);
      expect(game.progress.save.races).toBe(0);
      expect(Object.keys(game.progress.save.bests)).toEqual([]);
      expect(game.best()).toBe(0);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('keeps who has which marble when the shelf changes', () => {
      const { game } = newGame(6);
      game.claim(3);
      game.browse('pieces');
      expect(game.players[3]).toBe(1);
      game.browse('runs');
      expect(game.players[3]).toBe(1);
    });
  });
});

describe('the split screen', () => {
  it('is off until asked, and follows nobody', () => {
    const { game } = newGame(3);
    expect(game.split).toBe(false);
    game.release();
    settle(game, 60);
    expect([...game.cameras.marble]).toEqual([-1, -1, -1, -1]);
  });

  it('puts four cameras on four marbles as soon as it is turned on, and keeps them there as they race', () => {
    const { game } = newGame(3);
    game.claim(6);
    game.claim(1);
    game.setSplit(true);
    expect([...game.cameras.marble].slice(0, 2)).toEqual([6, 1]);
    expect(new Set(game.cameras.marble).size).toBe(4);
    game.release();
    settle(game, 300);
    expect(new Set([...game.cameras.marble].filter((m) => m >= 0)).size).toBe(4);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('hands a camera on to the next marble as the race goes on, without being asked', () => {
    const { game } = newGame(3);
    game.setSplit(true);
    game.release();
    settle(game, 60);
    const was = game.cameras.marble[0];
    game.marbles.state[was] = FINISHED;
    game.step(DT);
    expect(game.cameras.marble[0]).not.toBe(was);
    expect(game.marbles.state[game.cameras.marble[0]]).not.toBe(FINISHED);
  });

  it('lets go of them when it is turned off', () => {
    const { game } = newGame(3);
    game.setSplit(true);
    game.setSplit(false);
    expect([...game.cameras.marble]).toEqual([-1, -1, -1, -1]);
  });

  it('starts the cameras again for another run and for a field set up again, and is still on', () => {
    const { game } = newGame(3);
    game.claim(2);
    game.setSplit(true);
    game.release();
    settle(game, 120);
    // a camera left on a marble the new field does not want it on, so a restart has to be seen to happen
    game.cameras.marble[0] = 7;
    game.reset();
    expect(game.split).toBe(true);
    expect(game.cameras.marble[0]).toBe(2);
    game.cameras.marble[0] = 7;
    game.pick(1);
    expect(game.split).toBe(true);
    expect(game.cameras.marble[0]).toBe(2);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('changes nothing about the race: the same seed goes the same way with it on or off', () => {
    const run = (split: boolean) => {
      const { game } = newGame(9);
      if (split) game.setSplit(true);
      race(game);
      return [...game.marbles.x, ...game.marbles.y, ...game.marbles.z, ...game.marbles.took].join(',');
    };
    expect(run(true)).toBe(run(false));
  });
});
