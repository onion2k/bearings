/**
 * The shapes the run is drawn with: the channel, swept along the track's own
 * samples, and the marbles. Everything is in world units and Z is up, as the
 * renderer has it.
 *
 * The channel is flat-shaded, faces not sharing vertices, so its walls and
 * floor keep hard edges. The marble is the one smooth thing: light has to run
 * round it as round glass or steel, or a near-mirror marble and a chalky one
 * look alike, and telling eight apart at a glance is the point of them.
 */
import { MeshBuilder, type Mesh } from 'artshape-render/mesh/types';

type V3 = [number, number, number];

/** One flat-shaded quad, wound counter-clockwise seen from the normal. */
function face(b: MeshBuilder, p0: V3, p1: V3, p2: V3, p3: V3) {
  const ux = p1[0] - p0[0],
    uy = p1[1] - p0[1],
    uz = p1[2] - p0[2];
  const vx = p3[0] - p0[0],
    vy = p3[1] - p0[1],
    vz = p3[2] - p0[2];
  let nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  const a = b.vertex(p0[0], p0[1], p0[2], nx, ny, nz, 0, 0);
  b.vertex(p1[0], p1[1], p1[2], nx, ny, nz, 1, 0);
  b.vertex(p2[0], p2[1], p2[2], nx, ny, nz, 1, 1);
  b.vertex(p3[0], p3[1], p3[2], nx, ny, nz, 0, 1);
  b.quad(a, a + 1, a + 2, a + 3);
}

/**
 * A cross-section carried along a line: the channel a marble runs in, built
 * from the samples the track already worked out, so the shape drawn and the
 * shape raced are the same arithmetic and cannot drift apart.
 *
 * The profile is the section in the channel's own terms — how far across and
 * how far up — read in order, and joined into a strip between each pair of
 * samples. The renderer draws both sides of a triangle, so a chute seen from
 * inside needs nothing special done to it.
 */
export function sweep(
  points: Float32Array,
  tangents: Float32Array,
  ups: Float32Array,
  count: number,
  profile: readonly (readonly [number, number])[],
  into = new MeshBuilder(),
): MeshBuilder {
  const b = into;
  const at = (i: number, k: number): V3 => {
    const o = i * 3;
    const tx = tangents[o],
      ty = tangents[o + 1],
      tz = tangents[o + 2];
    const ux = ups[o],
      uy = ups[o + 1],
      uz = ups[o + 2];
    // across the channel: square to both the way it goes and the way up
    const bx = ty * uz - tz * uy,
      by = tz * ux - tx * uz,
      bz = tx * uy - ty * ux;
    const [across, up] = profile[k];
    return [
      points[o] + bx * across + ux * up,
      points[o + 1] + by * across + uy * up,
      points[o + 2] + bz * across + uz * up,
    ];
  };
  for (let i = 0; i + 1 < count; i++)
    for (let k = 0; k + 1 < profile.length; k++) face(b, at(i, k), at(i, k + 1), at(i + 1, k + 1), at(i + 1, k));
  return b;
}

/** A smooth ball, centred: its vertices shared and every normal pointing straight out from the middle. */
export function sphere(radius: number, rings = 16, segments = 24): Mesh {
  const b = new MeshBuilder();
  for (let i = 0; i <= rings; i++) {
    const phi = (i / rings) * Math.PI;
    for (let j = 0; j <= segments; j++) {
      const th = (j / segments) * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(th),
        ny = Math.sin(phi) * Math.sin(th),
        nz = Math.cos(phi);
      b.vertex(nx * radius, ny * radius, nz * radius, nx, ny, nz, j / segments, i / rings);
    }
  }
  const row = segments + 1;
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segments; j++) {
      const a = i * row + j;
      b.quad(a, a + row, a + row + 1, a + 1);
    }
  return b.build();
}
