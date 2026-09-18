/** The pace gate's arithmetic: what it holds, and how it decides a figure has moved. */
import { describe, expect, it } from 'vitest';
import { median, moved, paceRun } from '../scripts/pace';
import { RUNS } from '../src/runs';

describe('the pace gate', () => {
  it('takes the median, so one odd run does not move the figure', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 100])).toBe(2.5);
  });

  it('holds a figure both ways, quicker as much as slower', () => {
    expect(moved(10, 11)).toBe(false);
    expect(moved(10, 13)).toBe(true);
    expect(moved(10, 7)).toBe(true);
  });

  it('paces whichever run it is given, and every one of them finishes', () => {
    for (const [index, run] of RUNS.entries()) {
      const one = paceRun(1, 2, 3, index);
      expect(one.finished, run.name).toBe(true);
      expect(one.minutes, run.name).toBeGreaterThan(0);
    }
    // a longer run takes longer to see two races through than a short one
    const short = RUNS.findIndex((r) => r.id === 'the-chute'),
      long = RUNS.findIndex((r) => r.id === 'switchback');
    expect(paceRun(1, 2, 3, long).minutes).toBeGreaterThan(paceRun(1, 2, 3, short).minutes);
  });

  it('gives up at the cap, and says so', () => {
    const run = paceRun(1, 1_000_000, 0.05);
    expect(run.finished).toBe(false);
    expect(run.minutes).toBe(0.05);
  });
});
