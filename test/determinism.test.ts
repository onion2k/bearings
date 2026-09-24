/**
 * The same seed gives the same game, twice over. Everything that holds the
 * game to a figure rests on that; where it fails, those figures wander for
 * reasons nobody can see.
 */
import type { Physics } from '../src/physics';
import { describe, expect, it } from 'vitest';
import { hashGame, playTwice } from '../scripts/determinism';
import { DT, newGame } from './helpers';

describe('the same seed gives the same game', () => {
  it('plays out the same, twice from a seed, all the way down to the last ball', () => {
    const run = playTwice({ seed: 3, frames: 1200, every: 100 });
    expect(run.diverged, run.note).toBe(null);
    expect(run.checkpoints.length).toBe(12);
  });

  it('hashes what a game is, so anything moved shows', () => {
    const one = newGame(5).game;
    const two = newGame(5).game;
    one.release();
    two.release();
    for (let f = 0; f < 60; f++) {
      one.step(DT);
      two.step(DT);
    }
    const hash = hashGame(one);
    expect(hashGame(two)).toBe(hash);
    // a marble a thousandth further on, a shade across the channel, a race counted: all different games
    one.marbles.along[0] += 0.001;
    expect(hashGame(one)).not.toBe(hash);
    one.marbles.along[0] -= 0.001;
    expect(hashGame(one)).toBe(hash);
    one.marbles.across[0] += 1e-6;
    expect(hashGame(one)).not.toBe(hash);
    one.marbles.across[0] -= 1e-6;
    one.progress.ran('first-drop', 3);
    expect(hashGame(one)).not.toBe(hash);
  });

  it('says where two runs first parted, when they do', () => {
    let frame = 0;
    const run = playTwice({
      seed: 4,
      frames: 400,
      every: 100,
      // a second run that nudges a ball part way through: the check must catch it, and say when
      meddle: (game, pass) => {
        if (pass === 1 && ++frame === 250) (game.marbles as Physics).meddle(0, { lift: 0.01 });
      },
    });
    expect(run.diverged).toBe(300);
    expect(run.note).toMatch(/parted by frame 300/);
  });
});
