/** The monkey itself: it gets about, and a clean seed is clean. `npm run fuzz` is the long form. */
import { describe, expect, it } from 'vitest';
import { fuzz } from '../scripts/fuzzer';

describe('the fuzzer', () => {
  it('plays three seeds through without breaking a rule, and between them does everything a player can', () => {
    // a watched race takes most of a seed's frames, so one seed alone may not get round to everything
    const done: Record<string, number> = {};
    let finished = 0;
    for (const seed of [1, 2, 3]) {
      const r = fuzz(seed, 4000);
      expect(r.failure, JSON.stringify(r.failure)).toBe(null);
      finished += (r.happened as Partial<Record<string, number>>).finished ?? 0;
      for (const [action, n] of Object.entries(r.done)) done[action] = (done[action] ?? 0) + n;
    }
    expect(finished, 'the monkey gets marbles home').toBeGreaterThan(0);
    for (const action of ['release', 'watch', 'reset', 'pick', 'claim', 'browse', 'reload'])
      expect(done[action] ?? 0, action).toBeGreaterThan(0);
  });

  it('plays seed 24 through clean, where two marbles once ended up inside each other', () => {
    const r = fuzz(24, 4000);
    expect(r.failure, JSON.stringify(r.failure)).toBe(null);
  });

  it('plays the same way twice from a seed', () => {
    expect(fuzz(2, 600)).toEqual(fuzz(2, 600));
  });
});
