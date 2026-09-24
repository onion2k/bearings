/**
 * A splitter's and a joiner's lanes as physics meets them: a lane's wall is
 * left open where it would stand inside the other lane, so the two share one
 * floor where they part and meet, and each lane falls at its own rate so that
 * both arrive at the joiner at one height. Without the second, the lane moved
 * a cell across, half again as long, arrived 0.28 lower than the straight one,
 * and the field stopped against the step.
 */
import { describe, expect, it } from 'vitest';
import { RUNS } from '../src/runs';
import { compile } from '../src/track';
import { branched } from './physics-helpers';

describe('the lanes of a branch, compiled for physics', () => {
  const run = branched('straight');
  const track = compile(run);
  const kindOf = (s: number) => run.pieces[track.segments[s].piece].kind;

  it('leaves a lane open only on its inner side, where the lanes overlap, and nowhere else', () => {
    const lanes = track.segments
      .map((seg, s) => ({ seg, s }))
      .filter(({ s }) => kindOf(s) === 'splitter' || kindOf(s) === 'joiner');
    expect(lanes.length).toBe(4);
    for (const { seg, s } of lanes) {
      expect(seg.open, `segment ${s}, a ${kindOf(s)}`).not.toBeNull();
      const bits = new Set([...seg.open!].filter((b) => b !== 0));
      // one side only, never both, and not the whole way along
      expect(bits.size, `segment ${s}`).toBe(1);
      expect(
        [...seg.open!].some((b) => b === 0),
        `segment ${s}`,
      ).toBe(true);
    }
    // the two lanes of a piece open on opposite sides, toward each other
    for (const kind of ['splitter', 'joiner']) {
      const sides = lanes.filter(({ s }) => kindOf(s) === kind).map(({ seg }) => seg.open!.find((b) => b !== 0));
      expect(new Set(sides), kind).toEqual(new Set([1, 2]));
    }
    // a splitter's lanes are open where they begin and a joiner's where they end
    for (const { seg, s } of lanes) {
      const n = seg.open!.length;
      if (kindOf(s) === 'splitter') expect(seg.open![1], `segment ${s}`).not.toBe(0);
      else expect(seg.open![n - 2], `segment ${s}`).not.toBe(0);
    }
    for (const [s, seg] of track.segments.entries())
      if (kindOf(s) !== 'splitter' && kindOf(s) !== 'joiner') expect(seg.open, `segment ${s}`).toBeNull();
  });

  it('brings both lanes to the joiner at one height, on every run with a branch', () => {
    let joins = 0;
    for (const r of [run, ...RUNS]) {
      const t = compile(r);
      const onto = new Map<number, number[]>();
      t.segments.forEach((seg, s) => {
        if (seg.branch !== 0 && seg.next >= 0 && t.segments[seg.next].branch === 0)
          onto.set(seg.next, [...(onto.get(seg.next) ?? []), s]);
      });
      for (const [next, ends] of onto) {
        if (ends.length !== 2) continue;
        joins++;
        const z = t.segments[next].points[2];
        for (const s of ends) {
          const seg = t.segments[s];
          const last = seg.points[seg.points.length - 1];
          expect(Math.abs(last - z), `${r.name}: segment ${s} into ${next}`).toBeLessThan(1e-3);
        }
      }
    }
    // this layout's, The Fork's, The Crossing's and the Stress Test's
    expect(joins).toBeGreaterThanOrEqual(4);
  });

  it('still leans each lane down the whole way, never up', () => {
    for (const seg of track.segments.filter((s) => s.branch !== 0 && !s.flies)) {
      const n = seg.points.length / 3;
      expect(seg.points[(n - 1) * 3 + 2]).toBeLessThan(seg.points[2]);
    }
  });
});
