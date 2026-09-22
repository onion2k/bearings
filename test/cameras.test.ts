/** The cameras: which picked marbles are shown, one to a camera, and where each looks from. */
import { describe, expect, it } from 'vitest';
import { Cameras, MAX_SLOTS, SPLIT_VIEW } from '../src/cameras';
import { newGame } from './helpers';

/** A game with these marbles picked, in the order given (so player 1 is picks[0], and so on). */
function played(picks: number[], seed = 1) {
  const { game } = newGame(seed);
  for (const m of picks) game.claim(m);
  const cameras = new Cameras(picks.length);
  const follow = () => cameras.assign(game.players);
  return { game, cameras, follow };
}

describe('the cameras', () => {
  it('follow the picked marbles, one each, in player order', () => {
    const { cameras, follow } = played([5, 2, 7]);
    follow();
    expect([...cameras.marble].slice(0, 3)).toEqual([5, 2, 7]);
  });

  it('follow nothing past how many are picked', () => {
    const { cameras, follow } = played([5, 2, 7]);
    follow();
    expect([...cameras.marble].slice(3)).toEqual(Array(MAX_SLOTS - 3).fill(-1));
  });

  it('reorder to match player order, not the order marbles were claimed in', () => {
    const { game, cameras, follow } = played([]);
    game.claim(1); // player 1
    game.claim(3); // player 2
    game.claim(1); // let go, freeing player 1
    game.claim(5); // takes the free player 1, though it was claimed last
    cameras.count = 2;
    follow();
    expect([...cameras.marble].slice(0, 2), '5 is player 1 now, so its camera is first').toEqual([5, 3]);
  });

  it('keep a marble on its own camera once the race is away, however it ends up', () => {
    const { game, cameras, follow } = played([0, 1]);
    follow();
    const was = [...cameras.marble];
    game.release();
    for (let f = 0; f < 600; f++) game.step(1 / 60);
    game.marbles.state[0] = 5; // lost, or however it ended up: still its camera's own marble
    follow();
    expect([...cameras.marble].slice(0, 2)).toEqual(was.slice(0, 2));
  });

  it('let go of every camera on reset, to be given a marble again', () => {
    const { cameras, follow } = played([3]);
    follow();
    cameras.reset();
    expect([...cameras.marble]).toEqual(Array(MAX_SLOTS).fill(-1));
  });

  it('put each camera on its marble the first time, and ease to it after', () => {
    const { game, cameras, follow } = played([0, 1]);
    follow();
    const home = [0, 0, 0];
    cameras.ease(game.marbles, home, 0.06);
    const m = cameras.marble[0];
    expect(cameras.target[0]).toBeCloseTo(game.marbles.x[m], 6);
    expect(cameras.target[1]).toBeCloseTo(game.marbles.y[m], 6);
    game.marbles.x[m] += 10;
    const was = cameras.target[0];
    cameras.ease(game.marbles, home, 0.5);
    expect(cameras.target[0]).toBeCloseTo(was + 5, 6);
  });

  it('cut straight to a newly picked marble rather than easing from the last one on that camera', () => {
    const { game, cameras, follow } = played([0]);
    follow();
    cameras.ease(game.marbles, [0, 0, 0], 0.06);
    const first = cameras.target[0];
    game.claim(0);
    game.claim(4);
    cameras.count = 1;
    follow();
    cameras.ease(game.marbles, [0, 0, 0], 0.06);
    expect(cameras.target[0]).toBeCloseTo(game.marbles.x[4], 6);
    expect(cameras.target[0]).not.toBeCloseTo(first, 3);
  });

  it('look from where the view puts them, the same distance round every marble', () => {
    const { game, cameras, follow } = played([0, 1, 2]);
    follow();
    cameras.ease(game.marbles, [0, 0, 0], 0.06);
    const out = [0, 0, 0];
    for (let s = 0; s < 3; s++) {
      cameras.eye(s, out);
      const dx = out[0] - cameras.target[s * 3],
        dy = out[1] - cameras.target[s * 3 + 1],
        dz = out[2] - cameras.target[s * 3 + 2];
      expect(Math.hypot(dx, dy, dz)).toBeCloseTo(SPLIT_VIEW.radius, 6);
      expect(dz).toBeCloseTo(SPLIT_VIEW.radius * Math.cos(SPLIT_VIEW.polar), 6);
    }
  });
});
