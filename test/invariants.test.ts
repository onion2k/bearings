import { describe, expect, it } from 'vitest';
import { MAX_DESIGNS } from '../src/designer';
import { checkInvariants } from '../src/invariants';
import { FINISHED, RACING } from '../src/marbles';
import { newGame, race, settle } from './helpers';

describe('what must always hold', () => {
  it('holds of a new game, and of one that has raced', () => {
    const { game } = newGame();
    settle(game);
    expect(checkInvariants(game)).toEqual([]);
    race(game);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('reports a marble off its piece, one outside the channel, and one that is not a number', () => {
    const { game } = newGame();
    game.release();
    settle(game, 30);
    const was = game.marbles.along[0];
    game.marbles.along[0] = -99;
    expect(checkInvariants(game).join('\n')).toMatch(/along a segment/);
    game.marbles.along[0] = was;
    game.marbles.across[0] = 99;
    expect(checkInvariants(game).join('\n')).toMatch(/across a channel/);
    game.marbles.across[0] = 0;
    game.marbles.speed[0] = NaN;
    expect(checkInvariants(game).join('\n')).toMatch(/not a number/);
  });

  it('reports a tally that does not match what the marbles are doing', () => {
    const { game } = newGame();
    race(game);
    game.marbles.finishers -= 1;
    expect(checkInvariants(game).join('\n')).toMatch(/in the cup, and/);
  });

  it('reports a place given twice, and one given to a marble still going', () => {
    const { game } = newGame();
    race(game);
    const second = [...Array(game.marbles.count).keys()].find((i) => game.marbles.place[i] === 2)!;
    game.marbles.place[second] = 1;
    expect(checkInvariants(game).join('\n')).toMatch(/both came 1/);
    game.marbles.place[second] = 2;
    game.marbles.state[second] = RACING;
    game.marbles.finishers -= 1;
    expect(checkInvariants(game).join('\n')).toMatch(/without finishing/);
    game.marbles.state[second] = FINISHED;
    game.marbles.finishers += 1;
    expect(checkInvariants(game)).toEqual([]);
  });

  it('reports a save that has gone backwards', () => {
    const { game } = newGame();
    game.progress.save.races = -1;
    expect(checkInvariants(game).join('\n')).toMatch(/races have been run/);
    game.progress.save.races = 0;
    game.progress.save.bests['first-drop'] = -1;
    expect(checkInvariants(game).join('\n')).toMatch(/the best time on first-drop is/);
  });

  it('reports a run on that is not one of the runs, or not the one the save says', () => {
    const { game } = newGame();
    game.pick(2);
    expect(checkInvariants(game)).toEqual([]);
    game.progress.save.run = 'the-chute';
    expect(checkInvariants(game).join('\n')).toMatch(/the save says the-chute is on/);
    game.progress.save.run = '';
    game.run = 99;
    expect(checkInvariants(game).join('\n')).toMatch(/run 99 is on/);
  });

  it('reports a marble with a player that is not one, and a player with two marbles', () => {
    const { game } = newGame(1);
    game.players[0] = 9;
    expect(checkInvariants(game).join('\n')).toMatch(/player 9/);
    game.players[0] = 1;
    game.players[3] = 1;
    expect(checkInvariants(game).join('\n')).toMatch(/player 1 has marbles 0 and 3/);
  });

  it('reports a design on that is not one, two designs with one id, and more designs than are kept', () => {
    const { game } = newGame(1);
    game.build();
    for (const k of ['ramp', 'finish'] as const) game.lay(k);
    expect(game.keep('Mine')).toEqual([]);
    expect(checkInvariants(game)).toEqual([]);
    game.run = 3;
    expect(checkInvariants(game).join('\n')).toMatch(/of 1 designs/);
    game.run = 0;
    const { designs } = game.progress.save;
    designs.push({ ...designs[0] });
    expect(checkInvariants(game).join('\n')).toMatch(/two designs are design-1/);
    designs.length = 1;
    for (let i = 0; i < MAX_DESIGNS; i++) designs.push({ ...designs[0], id: `design-${i + 2}` });
    expect(checkInvariants(game).join('\n')).toMatch(/designs are kept/);
  });

  it('reports a field let go on a run that is still being built', () => {
    const { game } = newGame(1);
    game.build();
    game.lay('ramp');
    expect(checkInvariants(game)).toEqual([]);
    game.marbles.release();
    expect(checkInvariants(game).join('\n')).toMatch(/being built/);
  });

  it('reports a piece on that is not one of the pieces', () => {
    const { game } = newGame(1);
    game.browse('pieces');
    expect(checkInvariants(game)).toEqual([]);
    game.run = 999;
    expect(checkInvariants(game).join('\n')).toMatch(/of \d+ pieces/);
  });
});

describe('the cameras', () => {
  it('follow real marbles, none twice', () => {
    const { game } = newGame();
    game.claim(0);
    game.claim(1);
    game.setSplit(true);
    expect(checkInvariants(game)).toEqual([]);
    game.cameras.marble[1] = game.cameras.marble[0];
    expect(checkInvariants(game).join('\n')).toMatch(/camera/);
    game.cameras.marble[1] = 99;
    expect(checkInvariants(game).join('\n')).toMatch(/camera/);
  });

  it('follow nothing while the split is off', () => {
    const { game } = newGame();
    game.cameras.marble[0] = 2;
    expect(checkInvariants(game).join('\n')).toMatch(/camera/);
  });

  it('follow no more marbles than the split has views', () => {
    const { game } = newGame();
    game.claim(0);
    game.claim(1);
    game.setSplit(true);
    game.cameras.marble[5] = 5;
    expect(checkInvariants(game).join('\n')).toMatch(/camera/);
  });
});
