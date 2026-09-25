/**
 * The marker over where the next piece of a run being built goes. It is a
 * few hundred pixels in a picture, under what the look gate forgives, so a
 * marker gone, or standing over the wrong lane, is caught here by where its
 * placement puts it and not by the picture.
 */
import { describe, expect, it } from 'vitest';
import { Designer } from '../src/designer';
import { Scene } from '../src/scene';
import { CELL, LEAN, LEVEL, type Kind, compile } from '../src/track';

function built(kinds: Kind[]): Designer {
  const d = new Designer('Mine');
  for (const k of kinds) expect(d.place(k), `${k} laid`).toBe(true);
  return d;
}

/** Where the marker stands, from its placement's translation. */
function markAt(scene: Scene, d: Designer): number[] | null {
  const track = compile(d.run);
  if (scene.mark(track, d.open) === 0) return null;
  return [scene.marker[12], scene.marker[13], scene.marker[14]];
}

describe('the marker over where the next piece goes', () => {
  it('stands over the open end, above the track there', () => {
    const d = built(['ramp', 'drop']);
    const end = d.open!;
    const at = markAt(new Scene(), d)!;
    expect(at).not.toBeNull();
    expect(at[0]).toBeCloseTo(end.x * CELL);
    expect(at[1]).toBeCloseTo(end.y * CELL);
    // over the floor where the run ends, which is its level lowered by the lean for however far it has come
    const floor = end.z * LEVEL - LEAN * compile(d.run).length;
    expect(at[2]).toBeGreaterThan(floor + 1);
    expect(at[2]).toBeLessThan(floor + 3);
  });

  it('stands over the end at its own level, where the run has passed over that cell higher up', () => {
    // a spiral winds down under where the run has been, and the end it hands on at is under another segment's
    const d = built(['ramp', 'spiralLeft']);
    const end = d.open!;
    const track = compile(d.run);
    const over = track.segments.filter((s) => {
      const o = s.points.length - 3;
      return Math.abs(s.points[o] - end.x * CELL) < 1e-3 && Math.abs(s.points[o + 1] - end.y * CELL) < 1e-3;
    });
    expect(over.length, 'segments ending over the one cell').toBeGreaterThan(1);
    const lowest = Math.min(...over.map((s) => s.points[s.points.length - 1]));
    const at = markAt(new Scene(), d)!;
    expect(at[2]).toBeLessThan(lowest + 3);
  });

  it('moves to whichever lane is chosen', () => {
    const d = built(['ramp', 'splitter', 'drop']);
    const scene = new Scene();
    const right = markAt(scene, d)!;
    expect(right[1]).toBeCloseTo(d.open!.y * CELL);
    d.choose('left');
    const left = markAt(scene, d)!;
    expect(left[0]).toBeCloseTo(d.open!.x * CELL);
    expect(left[1]).toBeCloseTo(d.open!.y * CELL);
    expect(left).not.toEqual(right);
    // the left lane still ends at the top, the right a drop lower
    expect(left[2]).toBeGreaterThan(right[2] + LEVEL / 2);
  });

  it('is not drawn once the run has ended, or where nothing is being built', () => {
    const d = built(['ramp', 'finish']);
    const scene = new Scene();
    expect(markAt(scene, d)).toBeNull();
    expect(scene.mark(compile(d.run), null)).toBe(0);
  });
});
