/**
 * The meshes the scene draws and physics meets, held to facing the way a
 * ball meets them. Rapier's `FIX_INTERNAL_EDGES` reads a triangle's winding
 * as which side of it is solid, and a ball arriving on the back of a
 * triangle passes through it: the bowl's floor was wound facing down, and a
 * ball that came off the run in's lip and struck it went straight through
 * the bowl and out underneath, which read for a whole part of the plan as a
 * fast ball thrown wide of the funnel's way out. The renderer draws both
 * sides, so nothing on the screen ever showed it.
 */
import { describe, expect, it } from 'vitest';
import { MeshBuilder } from 'artshape-render/mesh/types';
import { bowl } from '../src/meshes';

const HOLE = 1,
  RIM = 6,
  WALL = 1.4,
  THROAT = 0.8,
  DEPTH = 2.2;
const height = (r: number) => -DEPTH * (1 - (r - HOLE) / (RIM - HOLE)) ** 2;

/** Each triangle's middle, its distance from the axis, and its normal by its winding, counter-clockwise in front. */
function triangles(positions: Float32Array, indices: Uint32Array | Uint16Array) {
  const out: { r: number; z: number; up: number; outward: number }[] = [];
  for (let t = 0; t < indices.length; t += 3) {
    const v = (k: number) => {
      const i = indices[t + k];
      return [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    };
    const [a, b, c] = [v(0), v(1), v(2)];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const length = Math.hypot(n[0], n[1], n[2]);
    const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const r = Math.hypot(m[0], m[1]);
    out.push({ r, z: m[2], up: n[2] / length, outward: (n[0] * m[0] + n[1] * m[1]) / r / length });
  }
  return out;
}

describe('a funnel bowl', () => {
  const built = bowl(HOLE, RIM, height, WALL, THROAT, new MeshBuilder()).build();
  const all = triangles(built.positions, built.indices);
  const top = height(RIM) + WALL;
  const floor = all.filter((f) => f.r < RIM - 0.01 && f.z > height(HOLE) && f.z < height(RIM) + 0.01);
  const near = (x: number, y: number) => Math.abs(x - y) < 0.02;

  it('faces up all over its floor, where a ball rolls and lands', () => {
    expect(floor.length).toBeGreaterThan(1000);
    for (const f of floor) expect(f.up).toBeGreaterThan(0);
  });

  it('faces in on the inside of its rim and its throat, and out on the outside of each', () => {
    const rimInside = all.filter((f) => near(f.r, RIM) && Math.abs(f.up) < 0.1);
    const throatInside = all.filter((f) => near(f.r, HOLE) && Math.abs(f.up) < 0.1);
    const outside = all.filter((f) => f.r > RIM + 0.05 && Math.abs(f.up) < 0.1);
    const throatOutside = all.filter((f) => f.r > HOLE + 0.05 && f.r < HOLE + 0.3 && Math.abs(f.up) < 0.1);
    for (const group of [rimInside, throatInside, outside, throatOutside]) expect(group.length).toBeGreaterThan(0);
    for (const f of [...rimInside, ...throatInside]) expect(f.outward).toBeLessThan(0);
    for (const f of [...outside, ...throatOutside]) expect(f.outward).toBeGreaterThan(0);
  });

  it('faces up along the top of its rim', () => {
    const rimTop = all.filter((f) => near(f.z, top) && f.r > RIM - 0.01);
    expect(rimTop.length).toBeGreaterThan(0);
    for (const f of rimTop) expect(f.up).toBeGreaterThan(0.99);
  });
});
