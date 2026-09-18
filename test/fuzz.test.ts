/** The monkey itself: it gets about, and a clean seed is clean. `npm run fuzz` is the long form. */
import { describe, expect, it } from 'vitest';
import { fuzz } from '../scripts/fuzzer';

describe('the fuzzer', () => {
  it('plays a seed through without breaking a rule, and does everything a player can', () => {
    const r = fuzz(1, 4000);
    expect(r.failure, JSON.stringify(r.failure)).toBe(null);
    expect(r.happened.finished, 'the monkey gets marbles home').toBeGreaterThan(0);
    for (const action of ['release', 'watch', 'reset', 'pick', 'reload'])
      expect(r.done[action], action).toBeGreaterThan(0);
  });

  it('plays seed 24 through clean, where two marbles once ended up inside each other', () => {
    const r = fuzz(24, 4000);
    expect(r.failure, JSON.stringify(r.failure)).toBe(null);
  });

  it('plays the same way twice from a seed', () => {
    expect(fuzz(2, 600)).toEqual(fuzz(2, 600));
  });
});
