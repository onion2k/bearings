/**
 * The race bench's arithmetic, apart from the timing itself so that it can
 * be tested without timing anything: how a scenario is timed against the
 * reference, and how a figure is judged against the baseline.
 */

/**
 * How far a scenario may move from its baseline, either way, before the
 * bench fails: a share of it. Timed as it is now, the race's figure wobbles
 * by five parts in a hundred from one run of the bench to the next, and the
 * gate's, whose frames cost next to nothing, by eight; both measured over a
 * dozen runs, each in a process of its own. A race made three tenths slower
 * reads at least a quarter slower. Fifteen in a hundred is twice the wobble,
 * and well short of that. It used to be twenty in a hundred and a twentieth
 * of a millisecond as well, which a race costing a hundredth of one could
 * not reach until it was more than six times slower.
 */
export const TOLERANCE = 0.15;

export type Verdict = 'slower' | 'faster' | 'within tolerance';

/** Whether a figure has moved from its baseline by more than the tolerance, and which way. */
export function judge(was: number, now: number, tolerance = TOLERANCE): Verdict {
  const change = now / was - 1;
  if (change > tolerance) return 'slower';
  if (change < -tolerance) return 'faster';
  return 'within tolerance';
}

export interface Best {
  /** A run's time against the reference timed beside it: the lowest there was. */
  ratio: number;
  /** That run's time, and the reference it was held to. */
  ms: number;
  ref: number;
}

/**
 * A scenario run `runs` times, each held to the reference timed just before
 * it and just after: the lower of the two, since one held up by something
 * else would make the run look fast. The machine goes faster and slower as
 * it warms and as other work comes and goes, and a reference timed once, at
 * the start, was held against runs timed in another moment altogether; so
 * each run is held to its own. The lowest ratio counts: anything else going
 * on only ever makes a run slower, never faster.
 */
export function bestRatio(runs: number, reference: () => number, run: () => number): Best {
  const best: Best = { ratio: Infinity, ms: 0, ref: 0 };
  for (let k = 0; k < runs; k++) {
    const before = reference();
    const ms = run();
    const ref = Math.min(before, reference());
    if (ms / ref < best.ratio) {
      best.ratio = ms / ref;
      best.ms = ms;
      best.ref = ref;
    }
  }
  return best;
}
