/** The race bench's arithmetic: how it times a scenario against the reference, and how it judges a move. */
import { describe, expect, it } from 'vitest';
import { TOLERANCE, bestRatio, judge } from '../scripts/benching';

describe('the race bench', () => {
  it('holds a figure both ways, faster as much as slower', () => {
    expect(judge(1, 1)).toBe('within tolerance');
    expect(judge(1, 1 + TOLERANCE * 0.9)).toBe('within tolerance');
    expect(judge(1, 1 - TOLERANCE * 0.9)).toBe('within tolerance');
    expect(judge(1, 1 + TOLERANCE * 1.1)).toBe('slower');
    expect(judge(1, 1 - TOLERANCE * 1.1)).toBe('faster');
    // five times slower is slower, however small the figure: there is no allowance in milliseconds to hide in
    expect(judge(0.0005, 0.0025)).toBe('slower');
  });

  it('judges each run against the reference timed beside it', () => {
    // the machine slows down just after the first reference is timed, and stays slow: every run takes twice as
    // long, and so does every reference after the first. Each run against its own references is a tenth; held to
    // the first reference, as a reference timed once at the start was, every run would read a fifth
    const r = bestRatio(3, fake([10, 20, 20, 20, 20, 20]), fake([2, 2, 2]));
    expect(r.ratio).toBeCloseTo(0.1, 9);
  });

  it('keeps the lowest ratio, so a run held up by something else does not count', () => {
    const r = bestRatio(3, fake([10, 10, 10, 10, 10, 10]), fake([1.5, 1, 3]));
    expect(r.ratio).toBeCloseTo(0.1, 9);
    expect(r.ms).toBeCloseTo(1, 9);
  });

  it('takes the lower of the two references beside a run, so one held up cannot make a run look fast', () => {
    // one of the references either side of the run was held up, to three times its time, before it or after it:
    // against that one, the run would look a third as long as it was
    for (const refs of [
      [10, 30],
      [30, 10],
    ]) {
      const r = bestRatio(1, fake(refs), fake([1]));
      expect(r.ratio, refs.join(', ')).toBeCloseTo(0.1, 9);
      expect(r.ref, refs.join(', ')).toBe(10);
    }
  });
});

/** Something timed that takes each of `times` in turn. */
function fake(times: number[]): () => number {
  let k = 0;
  return () => times[k++];
}
