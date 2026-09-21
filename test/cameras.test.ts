/** Four cameras, each on a marble: who is followed, when a camera changes hands, and where each looks from. */
import { describe, expect, it } from 'vitest';
import { Cameras, SLOTS, SPLIT_VIEW } from '../src/cameras';
import { FINISHED, LOST, RACING, STALLED } from '../src/marbles';
import { DT, newGame } from './helpers';

/** A game let go with four players holding these marbles, in player order. */
function played(picks: number[], seed = 1) {
  const { game } = newGame(seed);
  for (const m of picks) game.claim(m);
  const cameras = new Cameras();
  const follow = () => cameras.assign(game.marbles, game.players, game.standing());
  return { game, cameras, follow };
}

const followed = (c: Cameras) => [...c.marble].filter((m) => m >= 0);

describe('the four cameras', () => {
  it('follow the picked marbles first, in player order, then fill up from the standing order', () => {
    const { game, cameras, follow } = played([5, 2]);
    follow();
    expect([...cameras.marble].slice(0, 2)).toEqual([5, 2]);
    const rest = game.standing().filter((m) => m !== 5 && m !== 2);
    expect([...cameras.marble].slice(2)).toEqual(rest.slice(0, SLOTS - 2));
  });

  it('never follow a marble twice, and follow nobody where there is nobody left', () => {
    const { cameras, follow } = played([0, 1, 2, 3, 4]);
    follow();
    expect(new Set(followed(cameras)).size).toBe(SLOTS);
    expect(followed(cameras)).toEqual([0, 1, 2, 3]);
  });

  it('keep a marble while it races, whatever the standing does', () => {
    const { game, cameras, follow } = played([]);
    follow();
    const first = [...cameras.marble];
    game.release();
    for (let f = 0; f < 600; f++) {
      game.step(DT);
      follow();
    }
    const still = first.filter((m) => game.marbles.state[m] === RACING || game.marbles.state[m] === FINISHED);
    for (const m of still) if (game.marbles.state[m] === RACING) expect(cameras.marble).toContain(m);
  });

  it('hand over to the leading marble nobody follows once theirs is home, lost or stopped', () => {
    for (const done of [FINISHED, LOST, STALLED]) {
      const { game, cameras, follow } = played([0, 1, 2, 3]);
      game.release();
      for (let f = 0; f < 60; f++) game.step(DT);
      follow();
      game.marbles.state[1] = done;
      follow();
      const took = cameras.marble[1];
      expect(game.marbles.state[took], `after state ${done}`).toBe(RACING);
      expect(took).not.toBe(1);
      expect(new Set(followed(cameras)).size).toBe(SLOTS);
    }
  });

  it('hold on a marble that is home when there is nobody left to hand over to', () => {
    const { game, cameras, follow } = played([0, 1, 2, 3, 4, 5, 6, 7]);
    game.release();
    for (let f = 0; f < 60; f++) game.step(DT);
    follow();
    for (let i = 0; i < 8; i++) game.marbles.state[i] = FINISHED;
    const before = [...cameras.marble];
    follow();
    expect([...cameras.marble]).toEqual(before);
  });

  it('follow nobody in a slot the field is too small to fill', () => {
    const { game, cameras } = played([]);
    // three marbles racing and the rest done with
    for (let i = 3; i < 8; i++) game.marbles.state[i] = LOST;
    cameras.assign(game.marbles, game.players, game.standing());
    expect(followed(cameras).length).toBeLessThanOrEqual(SLOTS);
    expect(new Set(followed(cameras)).size).toBe(followed(cameras).length);
  });

  it('start over when reset', () => {
    const { cameras, follow } = played([3]);
    follow();
    cameras.reset();
    expect([...cameras.marble]).toEqual([-1, -1, -1, -1]);
  });

  it('put each camera on its marble the first time, and ease to it after', () => {
    const { game, cameras, follow } = played([0, 1, 2, 3]);
    follow();
    const home = [0, 0, 0];
    cameras.ease(game.marbles, home, 0.06);
    const m = cameras.marble[0];
    expect(cameras.target[0]).toBeCloseTo(game.marbles.x[m], 6);
    expect(cameras.target[1]).toBeCloseTo(game.marbles.y[m], 6);
    // the marble moves, and the target goes part of the way: the share `chase` says
    game.marbles.x[m] += 10;
    const was = cameras.target[0];
    cameras.ease(game.marbles, home, 0.5);
    expect(cameras.target[0]).toBeCloseTo(was + 5, 6);
  });

  it('look from where the view puts them, the same distance round every marble', () => {
    const { game, cameras, follow } = played([0, 1, 2, 3]);
    follow();
    cameras.ease(game.marbles, [0, 0, 0], 0.06);
    const out = [0, 0, 0];
    for (let s = 0; s < SLOTS; s++) {
      cameras.eye(s, out);
      const dx = out[0] - cameras.target[s * 3],
        dy = out[1] - cameras.target[s * 3 + 1],
        dz = out[2] - cameras.target[s * 3 + 2];
      expect(Math.hypot(dx, dy, dz)).toBeCloseTo(SPLIT_VIEW.radius, 6);
      expect(dz).toBeCloseTo(SPLIT_VIEW.radius * Math.cos(SPLIT_VIEW.polar), 6);
    }
  });
});
