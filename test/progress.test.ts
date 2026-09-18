/** The save's own arithmetic: a race counted once, and a best time that only ever gets better. */
import { describe, expect, it } from 'vitest';
import { Progress, memoryStore } from '../src/progress';

describe('the save', () => {
  it('counts every race run, and keeps only the best time', () => {
    const p = new Progress(memoryStore());
    p.ran(6);
    expect(p.save).toEqual({ races: 1, best: 6 });
    p.ran(7);
    expect(p.save, 'a slower race is counted, and leaves the best alone').toEqual({ races: 2, best: 6 });
    p.ran(5);
    expect(p.save).toEqual({ races: 3, best: 5 });
    p.ran(0);
    expect(p.save, 'a race nobody finished still counts, and sets no time').toEqual({ races: 4, best: 5 });
  });

  it('forgets everything when started over, in memory and in the store', () => {
    const store = memoryStore();
    const p = new Progress(store);
    p.ran(4);
    p.persist();
    p.reset();
    expect(p.save).toEqual({ races: 0, best: 0 });
    expect(store.json).toBe(null);
  });
});
