/**
 * Every run that comes with the game, held to what a run has to be before it
 * is raced at all: named once, sound, and worked out the same way every time.
 * Raced 60 times each and held to being a race, not a procession, with every
 * marble home and nothing in its way passed unchanged, is
 * `physics-judged.ts`, in the full check.
 */
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RUNS } from '../src/runs';
import { check, checkTrack, compile } from '../src/track';

describe('the runs that come with the game', () => {
  it('are several, each with a name and an id of its own', () => {
    expect(RUNS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(RUNS.map((r) => r.id)).size, 'ids are not shared').toBe(RUNS.length);
    expect(new Set(RUNS.map((r) => r.name)).size, 'names are not shared').toBe(RUNS.length);
    for (const run of RUNS)
      expect(run.id, `${run.name}'s id is plain lower-case words and numbers`).toMatch(/^[a-z]+(-[a-z0-9]+)*$/);
  });

  it('are each judged, a file to a run, so that none is left out of the full check', () => {
    const files = readdirSync('test').filter((f) => /^physics-judged-\d+\.test\.ts$/.test(f));
    expect(files.length, 'a new run needs a physics-judged-N.test.ts of its own').toBe(RUNS.length);
  });

  for (const run of RUNS) {
    describe(run.name, () => {
      it('is sound, and works out to a sound track', () => {
        expect(check(run)).toEqual([]);
        expect(checkTrack(compile(run))).toEqual([]);
      });

      it('works out the same way twice, to the last bit', () => {
        const one = compile(run),
          two = compile(run);
        for (let i = 0; i < one.segments.length; i++) {
          expect([...one.segments[i].points]).toEqual([...two.segments[i].points]);
          expect([...one.segments[i].tangents]).toEqual([...two.segments[i].tangents]);
          expect(one.segments[i].gap).toBe(two.segments[i].gap);
        }
      });
    });
  }
});
