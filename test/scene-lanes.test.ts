/**
 * Where a split's two lanes overlap, at the fork and where they join again,
 * their floors lie almost on top of each other, each leaning at its own rate,
 * and where the one poked through the other a sliver of it showed as a
 * wedge. Only one floor is drawn where they overlap, the first lane's, but
 * along the seam where the second's strips cross the first's edge, which no
 * strip can follow exactly: no deeper in than a strip.
 */
import { describe, expect, it } from 'vitest';
import { PIECES } from '../src/catalog';
import { RUNS } from '../src/runs';
import { Scene } from '../src/scene';
import { type Track, compile } from '../src/track';

/** Whether a point lies on segment `s`'s floor: within its width, over its floor, at the sample it is squarest to. */
function onFloor(track: Track, s: number, x: number, y: number, z: number): boolean {
  const seg = track.segments[s];
  let best = -1,
    along = Infinity;
  for (let i = 0; i < seg.arc.length; i++) {
    const o = i * 3;
    const a =
      (x - seg.points[o]) * seg.tangents[o] +
      (y - seg.points[o + 1]) * seg.tangents[o + 1] +
      (z - seg.points[o + 2]) * seg.tangents[o + 2];
    if (Math.abs(a) < Math.abs(along)) {
      along = a;
      best = i;
    }
  }
  const o = best * 3;
  const spacing = best + 1 < seg.arc.length ? seg.arc[best + 1] - seg.arc[best] : seg.arc[best] - seg.arc[best - 1];
  if (Math.abs(along) > spacing / 2 + 1e-3) return false;
  const px = x - seg.points[o],
    py = y - seg.points[o + 1],
    pz = z - seg.points[o + 2];
  const tx = seg.tangents[o],
    ty = seg.tangents[o + 1],
    tz = seg.tangents[o + 2];
  const ux = seg.ups[o],
    uy = seg.ups[o + 1],
    uz = seg.ups[o + 2];
  const across = px * (ty * uz - tz * uy) + py * (tz * ux - tx * uz) + pz * (tx * uy - ty * ux);
  const up = px * ux + py * uy + pz * uz;
  return Math.abs(across) < seg.width[best] - 0.05 && Math.abs(up) < 0.05;
}

/**
 * How far inside segment `s`'s channel, from its nearer wall, a point lies at its floor's height: less than nothing
 * outside it, and nothing at all where it is nowhere near its floor.
 */
function depth(track: Track, s: number, x: number, y: number, z: number): number | null {
  const seg = track.segments[s];
  let best = 0,
    far = Infinity;
  for (let i = 0; i < seg.arc.length; i++) {
    const d = Math.hypot(x - seg.points[i * 3], y - seg.points[i * 3 + 1], z - seg.points[i * 3 + 2]);
    if (d < far) {
      far = d;
      best = i;
    }
  }
  const o = best * 3;
  const tx = seg.tangents[o],
    ty = seg.tangents[o + 1],
    tz = seg.tangents[o + 2];
  const ux = seg.ups[o],
    uy = seg.ups[o + 1],
    uz = seg.ups[o + 2];
  const px = x - seg.points[o],
    py = y - seg.points[o + 1],
    pz = z - seg.points[o + 2];
  const across = px * (ty * uz - tz * uy) + py * (tz * ux - tx * uz) + pz * (tx * uy - ty * ux);
  const up = px * ux + py * uy + pz * uz;
  if (Math.abs(up) > 0.05 || far > seg.width[best] + 1) return null;
  return seg.width[best] - Math.abs(across);
}

/** How far into the first lane an overlap may reach: a strip of the second lane's floor across its edge, and no more. */
const SEAM = (2 * 1.2) / 16 + 0.05;

describe('the lanes of a split, drawn', () => {
  for (const run of [PIECES.find((r) => r.name === 'Splitter')!, RUNS.find((r) => r.name === 'The Fork')!])
    it(`draws one floor where ${run.name}'s lanes overlap, and not two`, () => {
      const track = compile(run);
      // the floor is the group coloured as the floor, drawn once for the whole run
      const floor = new Scene().static(track)[1];
      const { positions, indices } = floor.mesh;
      // each segment with a lane's open wall has a partner of the same piece, the other lane
      const lanes = track.segments.flatMap((s, i) => (s.open ? [i] : []));
      expect(lanes.length).toBeGreaterThanOrEqual(2);
      const tri = (t: number, k: number) => [0, 1, 2].map((c) => positions[indices[t + k] * 3 + c]);
      /** Whether (x, y) is inside triangle `t` seen from above, and how high that triangle is there. */
      const under = (t: number, x: number, y: number): number | null => {
        const [a, b, c] = [tri(t, 0), tri(t, 1), tri(t, 2)];
        const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        if (Math.abs(d) < 1e-9) return null;
        const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d;
        const l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < 1e-3 || l2 < 1e-3 || l3 < 1e-3) return null;
        return l1 * a[2] + l2 * b[2] + l3 * c[2];
      };
      let doubled = 0,
        tried = 0;
      for (let t = 0; t < indices.length; t += 3) {
        const [x, y, z] = [0, 1, 2].map((k) => (tri(t, 0)[k] + tri(t, 1)[k] + tri(t, 2)[k]) / 3);
        if (!lanes.some((s) => onFloor(track, s, x, y, z))) continue;
        tried++;
        // another floor triangle over or under this one's middle, within a hair: the same spot drawn twice
        for (let u = 0; u < indices.length; u += 3) {
          if (u === t) continue;
          const h = under(u, x, y);
          // drawn twice over, and further into both lanes than a strip along the seam where one gives way to the other
          // along the seam: within a strip of a lane's edge, either side of it, where the other lane's floor is too
          const edges = lanes.map((l) => depth(track, l, x, y, z)).filter((d): d is number => d !== null);
          const seam = edges.some((d) => Math.abs(d) < SEAM);
          if (h !== null && Math.abs(h - z) < 0.05 && !seam) {
            doubled++;
            break;
          }
        }
      }
      expect(tried, 'faces on the lanes tried').toBeGreaterThan(20);
      expect(doubled, 'faces of one lane drawn over the other, away from the seam').toBe(0);
    });
});
