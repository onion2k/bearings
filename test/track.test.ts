import { describe, expect, it } from 'vitest';
import { FIRST } from '../src/runs';
import {
  MAX_SAMPLES,
  type Facing,
  type Placed,
  type Run,
  at,
  check,
  checkTrack,
  compile,
  exitOf,
  spot,
} from '../src/track';

/** A run of pieces laid end to end from the start, each following the one before. */
function chain(kinds: Placed['kind'][], from = { x: 0, y: 0, z: 0, facing: 0 as Facing }): Run {
  const pieces: Placed[] = [];
  let here = from;
  for (const kind of kinds) {
    const piece: Placed = { kind, ...here };
    pieces.push(piece);
    const out = exitOf(piece);
    if (out) here = out;
  }
  return { name: 'made up', pieces };
}

/** The angle between two unit vectors, for asking whether a join has a kink in it. */
function angle(a: number[], b: number[]): number {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return Math.acos(dot);
}

describe('the track', () => {
  it('works a run out into a chain of segments, one to a piece', () => {
    const track = compile(FIRST);
    expect(track.segments.length).toBe(FIRST.pieces.length);
    for (let i = 0; i < track.segments.length - 1; i++) expect(track.segments[i].next).toBe(i + 1);
    expect(track.segments[track.segments.length - 1].next, 'the run ends at the cup').toBe(-1);
  });

  it('joins its segments without a gap or a kink', () => {
    const track = compile(FIRST);
    for (const seg of track.segments) {
      if (seg.next < 0) continue;
      const to = track.segments[seg.next];
      const last = seg.points.length - 3;
      const gap = Math.hypot(
        seg.points[last] - to.points[0],
        seg.points[last + 1] - to.points[1],
        seg.points[last + 2] - to.points[2],
      );
      expect(gap, `piece ${seg.piece} to ${to.piece}`).toBeLessThan(1e-6);
      const out = [seg.tangents[last], seg.tangents[last + 1], seg.tangents[last + 2]];
      const into = [to.tangents[0], to.tangents[1], to.tangents[2]];
      expect(angle(out, into), `piece ${seg.piece} to ${to.piece}`).toBeLessThan(1e-3);
    }
  });

  it('measures how far along each sample is, and how long the whole run is', () => {
    const track = compile(FIRST);
    let total = 0;
    for (const seg of track.segments) {
      expect(seg.arc[0]).toBe(0);
      for (let i = 1; i < seg.arc.length; i++) expect(seg.arc[i]).toBeGreaterThan(seg.arc[i - 1]);
      expect(seg.arc[seg.arc.length - 1]).toBeCloseTo(seg.length, 6);
      expect(seg.length).toBeGreaterThan(0);
      total += seg.length;
    }
    expect(track.length).toBeCloseTo(total, 6);
  });

  it('reads a spot anywhere along a segment, and its ends are its joins', () => {
    const track = compile(FIRST);
    const out = spot();
    for (const seg of track.segments) {
      at(track, track.segments.indexOf(seg), 0, out);
      expect(out.x).toBeCloseTo(seg.points[0], 6);
      expect(out.y).toBeCloseTo(seg.points[1], 6);
      expect(out.z).toBeCloseTo(seg.points[2], 6);
      at(track, track.segments.indexOf(seg), seg.length, out);
      const last = seg.points.length - 3;
      expect(out.x).toBeCloseTo(seg.points[last], 6);
      expect(out.y).toBeCloseTo(seg.points[last + 1], 6);
      expect(out.z).toBeCloseTo(seg.points[last + 2], 6);
    }
    // the middle of the first segment is a unit vector's worth of direction, and up is up
    at(track, 0, track.segments[0].length / 2, out);
    expect(Math.hypot(out.tx, out.ty, out.tz)).toBeCloseTo(1, 6);
    expect(Math.hypot(out.ux, out.uy, out.uz)).toBeCloseTo(1, 6);
  });

  it('says it is going the way its points actually go', () => {
    const track = compile(FIRST);
    for (const seg of track.segments) {
      for (let i = 0; i < seg.arc.length - 1; i++) {
        const a = i * 3,
          b = a + 3;
        const dx = seg.points[b] - seg.points[a],
          dy = seg.points[b + 1] - seg.points[a + 1],
          dz = seg.points[b + 2] - seg.points[a + 2];
        const d = Math.hypot(dx, dy, dz);
        // the two ends' directions average out to the way the line between them runs, near enough
        const mx = (seg.tangents[a] + seg.tangents[b]) / 2,
          my = (seg.tangents[a + 1] + seg.tangents[b + 1]) / 2,
          mz = (seg.tangents[a + 2] + seg.tangents[b + 2]) / 2;
        const m = Math.hypot(mx, my, mz);
        expect(angle([dx / d, dy / d, dz / d], [mx / m, my / m, mz / m]), `piece ${seg.piece} at ${i}`).toBeLessThan(
          5e-3,
        );
      }
    }
  });

  it('holds up square to the way it is going', () => {
    const track = compile(FIRST);
    for (const seg of track.segments) {
      for (let i = 0; i < seg.arc.length; i++) {
        const o = i * 3;
        const dot =
          seg.tangents[o] * seg.ups[o] + seg.tangents[o + 1] * seg.ups[o + 1] + seg.tangents[o + 2] * seg.ups[o + 2];
        expect(Math.abs(dot), `piece ${seg.piece} at ${i}`).toBeLessThan(1e-5);
      }
    }
  });

  it('finds nothing wrong with the run it comes with', () => {
    const track = compile(FIRST);
    expect(check(FIRST)).toEqual([]);
    expect(checkTrack(track)).toEqual([]);
  });

  describe('says what is wrong with a run', () => {
    it('a piece that joins nothing', () => {
      const run = chain(['start', 'ramp', 'finish']);
      run.pieces[2] = { ...run.pieces[2], x: run.pieces[2].x + 3 };
      expect(check(run).join('\n')).toMatch(/joins nothing/);
    });

    it('two pieces in the same place', () => {
      const run = chain(['start', 'straight', 'finish']);
      run.pieces.push({ kind: 'straight', x: 0, y: 0, z: 0, facing: 0 });
      expect(check(run).join('\n')).toMatch(/same place/);
    });

    it('no start', () => {
      expect(check(chain(['straight', 'finish'])).join('\n')).toMatch(/no start/);
    });

    it('no finish', () => {
      expect(check(chain(['start', 'straight'])).join('\n')).toMatch(/no finish/);
    });

    it('a run that never ends', () => {
      const run = chain(['start', 'curveLeft', 'curveLeft', 'curveLeft', 'curveLeft']);
      expect(check(run).join('\n')).toMatch(/never ends/);
    });
  });

  it('works the same run out the same way twice, to the last bit', () => {
    const one = compile(FIRST),
      two = compile(FIRST);
    expect(one.length).toBe(two.length);
    expect(one.samples).toBe(two.samples);
    for (let i = 0; i < one.segments.length; i++) {
      expect([...one.segments[i].points]).toEqual([...two.segments[i].points]);
      expect([...one.segments[i].tangents]).toEqual([...two.segments[i].tangents]);
      expect([...one.segments[i].ups]).toEqual([...two.segments[i].ups]);
      expect([...one.segments[i].arc]).toEqual([...two.segments[i].arc]);
    }
  });

  describe('turns by whole numbers', () => {
    it('four turns the same way come back to where they started', () => {
      let here = { x: 0, y: 0, z: 0, facing: 0 as Facing };
      for (let i = 0; i < 4; i++) here = exitOf({ kind: 'curveLeft', ...here })!;
      expect(here).toEqual({ x: 0, y: 0, z: 0, facing: 0 });
    });

    it('a turn each way leaves a marble going the way it was', () => {
      const left = exitOf({ kind: 'curveLeft', x: 0, y: 0, z: 0, facing: 0 })!;
      const back = exitOf({ kind: 'curveRight', ...left })!;
      expect(back).toEqual({ x: 2, y: 2, z: 0, facing: 0 });
    });

    it('a ramp goes one along and one down, whichever way it faces', () => {
      expect(exitOf({ kind: 'ramp', x: 0, y: 0, z: 0, facing: 1 })).toEqual({ x: 0, y: 1, z: -1, facing: 1 });
      expect(exitOf({ kind: 'ramp', x: 0, y: 0, z: 0, facing: 2 })).toEqual({ x: -1, y: 0, z: -1, facing: 2 });
    });

    it('the cup a marble stops in has no way out', () => {
      expect(exitOf({ kind: 'finish', x: 0, y: 0, z: 0, facing: 0 })).toBe(null);
    });
  });

  it('keeps what it makes within its ceiling', () => {
    const track = compile(FIRST);
    expect(track.samples).toBeGreaterThan(0);
    expect(track.samples).toBeLessThan(MAX_SAMPLES);
    let counted = 0;
    for (const seg of track.segments) counted += seg.arc.length;
    expect(counted).toBe(track.samples);
  });
});
