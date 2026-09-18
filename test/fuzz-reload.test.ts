/**
 * The fuzzer's reload, tried against a save that forgets what it was told.
 * A correct save never loses a race, so nothing else ever makes this check
 * fire; without this, the check could be gone and every gate stay green.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/progress', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/progress')>();
  /** A save that loads with every race forgotten. */
  class Forgetful extends real.Progress {
    constructor(...args: ConstructorParameters<typeof real.Progress>) {
      super(...args);
      this.save.races = 0;
    }
  }
  return { ...real, Progress: Forgetful };
});

const { fuzz } = await import('../scripts/fuzzer');

describe('the fuzzer, against a save that forgets', () => {
  it('says so, on the first reload after a race has been run', () => {
    const failures = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => fuzz(seed, 4000).failure).filter((f) => f !== null);
    expect(failures.length, 'some seed reloads after a race').toBeGreaterThan(0);
    for (const f of failures) expect(f.problems.join('\n')).toMatch(/races had been run, and loaded as 0/);
  });
});
