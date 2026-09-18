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
  widths?: Float32Array,
  base = 0,
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
    // where the channel is wider than `base`, every point of the section moves out by the difference, walls
    // and skin together, so a board is the same trough as a chute, only wider
    const [section, up] = profile[k];
    const across = widths ? Math.sign(section) * (Math.abs(section) - base + widths[i]) : section;
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

/** An upright post, `radius` round and `height` tall, standing on z = 0: a peg. */
export function post(radius: number, height: number, sides = 10): Mesh {
  const b = new MeshBuilder();
  for (let j = 0; j < sides; j++) {
    const a0 = (j / sides) * Math.PI * 2,
      a1 = ((j + 1) / sides) * Math.PI * 2;
    const p0: V3 = [Math.cos(a0) * radius, Math.sin(a0) * radius, 0],
      p1: V3 = [Math.cos(a1) * radius, Math.sin(a1) * radius, 0];
    face(b, p0, p1, [p1[0], p1[1], height], [p0[0], p0[1], height]);
    face(b, [0, 0, height], [p0[0], p0[1], height], [p1[0], p1[1], height], [0, 0, height]);
  }
  return b.build();
}

/** A bar `length` along x, `thick` along y and `height` up z, centred along and across and standing on z = 0. */
export function bar(length: number, thick: number, height: number): Mesh {
  const b = new MeshBuilder();
  const x = length / 2,
    y = thick / 2,
    z = height;
  face(b, [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]);
  face(b, [-x, -y, 0], [x, -y, 0], [x, -y, z], [-x, -y, z]);
  face(b, [x, y, 0], [-x, y, 0], [-x, y, z], [x, y, z]);
  face(b, [x, -y, 0], [x, y, 0], [x, y, z], [x, -y, z]);
  face(b, [-x, y, 0], [-x, -y, 0], [-x, -y, z], [-x, y, z]);
  return b.build();
}

/**
 * A paddle wheel: a hub along y, the axle, and `paddles` blades round it,
 * each `arm` long and `wide` across, the first pointing straight down (-z) and
 * the rest round from it the way the wheel turns.
 */
export function wheel(arm: number, wide: number, paddles: number): Mesh {
  const b = new MeshBuilder();
  const hub = 0.35,
    thick = 0.16;
  for (let k = 0; k < paddles; k++) {
    const a = (k / paddles) * Math.PI * 2;
    // straight down turned about y: down, then round toward +x, the way a paddle at the bottom carries marbles on
    const dx = Math.sin(a),
      dz = -Math.cos(a);
    const nx = -dz,
      nz = dx;
    const at = (r: number, s: number, side: number): V3 => [dx * r + nx * s, side, dz * r + nz * s];
    const y = wide / 2;
    face(b, at(hub, -thick, -y), at(arm, -thick, -y), at(arm, -thick, y), at(hub, -thick, y));
    face(b, at(hub, thick, y), at(arm, thick, y), at(arm, thick, -y), at(hub, thick, -y));
    face(b, at(arm, -thick, -y), at(arm, thick, -y), at(arm, thick, y), at(arm, -thick, y));
    face(b, at(hub, -thick, -y), at(hub, thick, -y), at(arm, thick, -y), at(arm, -thick, -y));
    face(b, at(hub, -thick, y), at(arm, -thick, y), at(arm, thick, y), at(hub, thick, y));
  }
  const y = wide / 2 + 0.1,
    sides = 12;
  for (let j = 0; j < sides; j++) {
    const a0 = (j / sides) * Math.PI * 2,
      a1 = ((j + 1) / sides) * Math.PI * 2;
    face(
      b,
      [Math.cos(a0) * hub, -y, Math.sin(a0) * hub],
      [Math.cos(a1) * hub, -y, Math.sin(a1) * hub],
      [Math.cos(a1) * hub, y, Math.sin(a1) * hub],
      [Math.cos(a0) * hub, y, Math.sin(a0) * hub],
    );
  }
  return b.build();
}

/**
 * A funnel's bowl, turned round its middle at `centre`: the floor from the
 * hole out to the rim at the height `height(r)` gives, smooth, and a rim wall
 * standing `wall` above it, with a thickness to it, all the way round: the
 * chute feeding it comes in over the wall, not through it.
 */
export function bowl(
  hole: number,
  rim: number,
  height: (r: number) => number,
  wall: number,
  into = new MeshBuilder(),
  centre: V3 = [0, 0, 0],
): MeshBuilder {
  const b = into;
  const [cx, cy, cz] = centre;
  const rings = 18,
    sides = 48;
  const at = (k: number) => hole + ((rim - hole) * k) / rings;
  const base = b.vertexCount;
  for (let k = 0; k <= rings; k++) {
    const r = at(k);
    // the floor's slope there, for a normal that leans the way the floor does
    const e = 1e-3;
    const s =
      (height(Math.min(rim, r + e)) - height(Math.max(hole, r - e))) / (Math.min(rim, r + e) - Math.max(hole, r - e));
    const l = Math.hypot(s, 1);
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const c = Math.cos(a),
        sn = Math.sin(a);
      b.vertex(cx + c * r, cy + sn * r, cz + height(r), (-c * s) / l, (-sn * s) / l, 1 / l, j / sides, k / rings);
    }
  }
  const row = sides + 1;
  for (let k = 0; k < rings; k++)
    for (let j = 0; j < sides; j++) {
      const a = base + k * row + j;
      b.quad(a, a + 1, a + row + 1, a + row);
    }
  // the rim wall, round the top edge: its inside, its top and its outside
  const z = cz + height(rim),
    out = rim + 0.18;
  const fine = sides * 2;
  for (let j = 0; j < fine; j++) {
    const a0 = (j / fine) * Math.PI * 2,
      a1 = ((j + 1) / fine) * Math.PI * 2;
    const p = (a: number, r: number, h: number): V3 => [cx + Math.cos(a) * r, cy + Math.sin(a) * r, h];
    face(b, p(a1, rim, z), p(a0, rim, z), p(a0, rim, z + wall), p(a1, rim, z + wall));
    face(b, p(a1, rim, z + wall), p(a0, rim, z + wall), p(a0, out, z + wall), p(a1, out, z + wall));
    face(b, p(a0, out, z - 0.18), p(a1, out, z - 0.18), p(a1, out, z + wall), p(a0, out, z + wall));
  }
  return b;
}

/**
 * A mound in a floor, standing on z = 0: `height` at its middle, falling
 * away as the square of a cosine to nothing at `radius`, as the solver has
 * it, with its normals leaning the way its sides do.
 */
export function mound(radius: number, height: number, rings = 8, sides = 20): Mesh {
  const b = new MeshBuilder();
  const k = Math.PI / (2 * radius);
  for (let i = 0; i <= rings; i++) {
    const r = (radius * i) / rings;
    const z = height * Math.cos(k * r) ** 2;
    // how steeply it falls there, for a normal that leans out by as much
    const s = -height * k * Math.sin(2 * k * r);
    const l = Math.hypot(s, 1);
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const c = Math.cos(a),
        sn = Math.sin(a);
      b.vertex(c * r, sn * r, z, (-c * s) / l, (-sn * s) / l, 1 / l, j / sides, i / rings);
    }
  }
  const row = sides + 1;
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * row + j;
      b.quad(a, a + row, a + row + 1, a + 1);
    }
  return b.build();
}
