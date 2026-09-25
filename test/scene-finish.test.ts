/**
 * Where the scene draws the end of a run: the finish line across the start
 * of the last piece and the stop behind its cup. On a run with a split, the
 * last segment in the track's list is a lane's and not the finish, and the
 * line and the stop were drawn across that lane, where the race meets
 * neither. They are held here to the segment the race itself ends at.
 */
import { describe, expect, it } from 'vitest';
import { PIECES } from '../src/catalog';
import { Designer } from '../src/designer';
import { RUNS } from '../src/runs';
import { Scene } from '../src/scene';
import { at, compile, finishOf } from '../src/track';

describe('the end of the run, drawn', () => {
  const runs = [PIECES.find((r) => r.name === 'Splitter')!, RUNS.find((r) => r.name === 'The Fork')!, RUNS[0]];

  it('ends a run with a split at its finish, not at the lane listed last', () => {
    const fork = compile(runs[0]);
    expect(finishOf(fork), 'the finish is not the last segment listed').not.toBe(fork.segments.length - 1);
  });

  for (const run of runs)
    it(`draws the finish line and the stop on ${run.name} where the race ends`, () => {
      const track = compile(run);
      const end = finishOf(track);
      expect(track.segments[end].next).toBeLessThan(0);
      const groups = new Scene().static(track);
      // the finish line is the one gold bar, placed at the start of the finish segment
      const line = groups.find((g) => g.albedo?.[0] === 0.95 && g.albedo[1] === 0.72)!;
      const start = at(track, end, 0.06);
      expect(
        Math.hypot(line.matrices[12] - start.x, line.matrices[13] - start.y, line.matrices[14] - start.z),
      ).toBeLessThan(0.05);
      // the stop stands just beyond the end of the finish segment
      const tail = at(track, end, track.segments[end].length);
      expect(line.count, 'the line drawn').toBe(1);
      const stops = groups.filter((g) => g.count === 1 && g.matrices.length === 16 && g !== line);
      const near = stops.some(
        (g) => Math.hypot(g.matrices[12] - tail.x, g.matrices[13] - tail.y, g.matrices[14] - tail.z) < 1,
      );
      expect(near, 'a stop at the finish lane end').toBe(true);
    });

  it('draws no finish line and no stop at the open end of a run still being built', () => {
    const d = new Designer('Mine');
    for (const k of ['ramp', 'straight', 'drop'] as const) d.place(k);
    const open = compile(d.run);
    expect(open.finished).toBe(false);
    const drawn = new Scene().static(open);
    const line = drawn.find((g) => g.albedo?.[0] === 0.95 && g.albedo[1] === 0.72)!;
    expect(line.count, 'no line').toBe(0);
    const tail = at(open, finishOf(open), open.segments[finishOf(open)].length);
    const stops = drawn.filter((g) => g.matrices.length === 16 && (g.count ?? 1) > 0 && g !== line);
    expect(
      stops.some((g) => Math.hypot(g.matrices[12] - tail.x, g.matrices[13] - tail.y, g.matrices[14] - tail.z) < 1),
      'no stop at the open end',
    ).toBe(false);
    d.place('finish');
    expect(compile(d.run).finished).toBe(true);
  });
});
