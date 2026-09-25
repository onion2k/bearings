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
export function face(b: MeshBuilder, p0: V3, p1: V3, p2: V3, p3: V3) {
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
 * inside needs nothing special done to it. `skip`, where given, leaves out
 * the edge of the section from point `k` to the next between sample `i` and
 * the one after: a wall left open where it would stand in another lane.
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
  floors?: Float32Array,
  skip?: (i: number, k: number) => boolean,
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
    // a point on the floor sits at the floor's own reach where that is given, which is how a trough closes in
    const across =
      floors && up === 0 && Math.abs(section) < base
        ? Math.sign(section) * floors[i]
        : widths
          ? Math.sign(section) * (Math.abs(section) - base + widths[i])
          : section;
    return [
      points[o] + bx * across + ux * up,
      points[o + 1] + by * across + uy * up,
      points[o + 2] + bz * across + uz * up,
    ];
  };
  for (let i = 0; i + 1 < count; i++)
    for (let k = 0; k + 1 < profile.length; k++)
      if (!skip?.(i, k)) face(b, at(i, k), at(i, k + 1), at(i + 1, k + 1), at(i + 1, k));
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

/** A cone standing on z = 0, `radius` wide at its foot and `height` to its point: a peg. */
export function cone(radius: number, height: number, sides = 12): Mesh {
  const b = new MeshBuilder();
  const tip: V3 = [0, 0, height];
  for (let j = 0; j < sides; j++) {
    const a0 = (j / sides) * Math.PI * 2,
      a1 = ((j + 1) / sides) * Math.PI * 2;
    const p0: V3 = [Math.cos(a0) * radius, Math.sin(a0) * radius, 0],
      p1: V3 = [Math.cos(a1) * radius, Math.sin(a1) * radius, 0];
    // each side is a triangle, drawn as a quad whose top two corners are the one point
    face(b, p0, p1, tip, tip);
    face(b, [0, 0, 0], p1, p0, [0, 0, 0]);
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
 * chute feeding it comes in over the wall, not through it. The hole goes on
 * down as a throat `throat` long, which a marble falls through.
 */
export function bowl(
  hole: number,
  rim: number,
  height: (r: number) => number,
  wall: number,
  throat: number,
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
      // wound counter-clockwise seen from above, facing up: physics meets a triangle's front and lets a ball
      // through its back, and a bowl wound facing down let one that struck it hard fall straight through
      const a = base + k * row + j;
      b.quad(a, a + row, a + row + 1, a + 1);
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
  // the throat under the hole: its inside, its outside, and the ring it ends in
  const top = cz + height(hole),
    bottom = top - throat,
    skin = hole + 0.18;
  for (let j = 0; j < sides; j++) {
    const a0 = (j / sides) * Math.PI * 2,
      a1 = ((j + 1) / sides) * Math.PI * 2;
    const p = (a: number, r: number, h: number): V3 => [cx + Math.cos(a) * r, cy + Math.sin(a) * r, h];
    face(b, p(a1, hole, bottom), p(a0, hole, bottom), p(a0, hole, top), p(a1, hole, top));
    face(b, p(a0, skin, bottom), p(a1, skin, bottom), p(a1, skin, top), p(a0, skin, top));
    face(b, p(a0, hole, bottom), p(a1, hole, bottom), p(a1, skin, bottom), p(a0, skin, bottom));
  }
  return b;
}

/**
 * A mound in a floor, standing on z = 0: `height` at its middle, falling
 * away as the square of a cosine to nothing at `radius`, as the track has
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

/**
 * A box put straight into `b`, centred on `c` with its own three axes, each of
 * unit length and square to the others, and half as long along each as
 * `hx`, `hy` and `hz`: the one shape most of a works is made of, a plate, a
 * beam, a stripe or a flange, merged with the rest of its colour into one
 * mesh a run, so a run's dressing is a few draws and not one a bolt.
 */
export function block(b: MeshBuilder, c: V3, ax: V3, ay: V3, az: V3, hx: number, hy: number, hz: number, ends = true) {
  const p = (sx: number, sy: number, sz: number): V3 => [
    c[0] + ax[0] * hx * sx + ay[0] * hy * sy + az[0] * hz * sz,
    c[1] + ax[1] * hx * sx + ay[1] * hy * sy + az[1] * hz * sz,
    c[2] + ax[2] * hx * sx + ay[2] * hy * sy + az[2] * hz * sz,
  ];
  face(b, p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1));
  face(b, p(-1, 1, -1), p(1, 1, -1), p(1, -1, -1), p(-1, -1, -1));
  face(b, p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1));
  face(b, p(1, 1, -1), p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1));
  if (!ends) return;
  face(b, p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1));
  face(b, p(-1, 1, -1), p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1));
}

/**
 * A beam from `a` to `c`, `half` from its middle to its sides, put into `b`: a strut, an arm or a brace, whichever
 * way it goes. Its ends are left open, since a beam's end meets another beam or a post and is never seen.
 */
export function beam(b: MeshBuilder, a: V3, c: V3, half: number) {
  const d: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  const ax: V3 = [d[0] / l, d[1] / l, d[2] / l];
  // any direction not along the beam, made square to it, and the third square to both
  const ref: V3 = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let ay: V3 = [ax[1] * ref[2] - ax[2] * ref[1], ax[2] * ref[0] - ax[0] * ref[2], ax[0] * ref[1] - ax[1] * ref[0]];
  const m = Math.hypot(ay[0], ay[1], ay[2]);
  ay = [ay[0] / m, ay[1] / m, ay[2] / m];
  const az: V3 = [ax[1] * ay[2] - ax[2] * ay[1], ax[2] * ay[0] - ax[0] * ay[2], ax[0] * ay[1] - ax[1] * ay[0]];
  block(b, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], ax, ay, az, l / 2, half, half, false);
}

/** An upright round column from `z0` to `z1` at `x`, `y`, narrowing from `r0` to `r1`, capped at its top, put into `b`. */
export function column(b: MeshBuilder, x: number, y: number, z0: number, z1: number, r0: number, r1 = r0, sides = 14) {
  for (let j = 0; j < sides; j++) {
    const a0 = (j / sides) * Math.PI * 2,
      a1 = ((j + 1) / sides) * Math.PI * 2;
    const c0 = Math.cos(a0),
      s0 = Math.sin(a0),
      c1 = Math.cos(a1),
      s1 = Math.sin(a1);
    face(
      b,
      [x + c0 * r0, y + s0 * r0, z0],
      [x + c1 * r0, y + s1 * r0, z0],
      [x + c1 * r1, y + s1 * r1, z1],
      [x + c0 * r1, y + s0 * r1, z1],
    );
    // the cap a fan to the middle, begun from the rim, since a quad begun at the middle has no edge to take a normal from
    face(b, [x + c0 * r1, y + s0 * r1, z1], [x + c1 * r1, y + s1 * r1, z1], [x, y, z1], [x, y, z1]);
  }
}

/** A ball at `c`, `r` round, put into `b`: few faces, since it is a lamp's bulb seen from afar. */
export function ball(b: MeshBuilder, c: V3, r: number, rings = 6, sides = 10) {
  const p = (i: number, j: number): V3 => {
    const phi = (i / rings) * Math.PI,
      th = (j / sides) * Math.PI * 2;
    return [c[0] + Math.sin(phi) * Math.cos(th) * r, c[1] + Math.sin(phi) * Math.sin(th) * r, c[2] + Math.cos(phi) * r];
  };
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) face(b, p(i + 1, j), p(i + 1, j + 1), p(i, j + 1), p(i, j));
}

/**
 * A girder's leg: a lattice column from `z0` up to `z1` at `x`, `y`, four
 * angles at its corners `half` from its middle, and in each bay a rung and a
 * brace across two opposite faces, turning a quarter each bay. Coarse on
 * purpose: from where the camera stands it reads as ironwork, and a leg
 * reaching down the whole height of a tall run had a million triangles
 * between its fifty in bays a third the size.
 */
export function lattice(b: MeshBuilder, x: number, y: number, z0: number, z1: number, half: number) {
  const bar = 0.04;
  const corners: [number, number][] = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
  for (const [cx, cy] of corners) beam(b, [x + cx, y + cy, z0], [x + cx, y + cy, z1], bar);
  const bays = Math.max(1, Math.round((z1 - z0) / (half * 5)));
  const bay = (z1 - z0) / bays;
  for (let k = 0; k < bays; k++) {
    const z = z0 + k * bay;
    for (const c of [k % 2, (k % 2) + 2]) {
      const [ax, ay] = corners[c],
        [bx, by] = corners[(c + 1) % 4];
      beam(b, [x + ax, y + ay, z + bay], [x + bx, y + by, z + bay], bar);
      beam(b, [x + ax, y + ay, z], [x + bx, y + by, z + bay], bar * 0.8);
    }
  }
}

/** A cog, its axle along y and its teeth round it in x and z, 1 round to its teeth's tips, for scaling to any size. */
export function cog(teeth = 12, thick = 0.2): Mesh {
  const b = new MeshBuilder();
  const inner = 0.78,
    hub = 0.22,
    y = thick / 2;
  const steps = teeth * 4;
  const r = (k: number) => (k % 4 === 1 || k % 4 === 2 ? 1 : inner);
  const pt = (k: number, rr: number, side: number): V3 => {
    const a = (k / steps) * Math.PI * 2;
    return [Math.cos(a) * rr, side, Math.sin(a) * rr];
  };
  for (let k = 0; k < steps; k++) {
    const n = k + 1;
    // the rim, its teeth, and the faces of both
    const rn = r(n === steps ? 0 : n);
    face(b, pt(k, r(k), -y), pt(k, r(k), y), pt(n, rn, y), pt(n, rn, -y));
    face(b, pt(n, hub, y), pt(n, rn, y), pt(k, r(k), y), pt(k, hub, y));
    face(b, pt(k, hub, -y), pt(k, r(k), -y), pt(n, rn, -y), pt(n, hub, -y));
  }
  // a boss round the axle, standing proud of both faces
  const boss = y + 0.06;
  for (let k = 0; k < 12; k++) {
    const a0 = (k / 12) * Math.PI * 2,
      a1 = ((k + 1) / 12) * Math.PI * 2;
    const p = (a: number, side: number): V3 => [Math.cos(a) * hub, side, Math.sin(a) * hub];
    face(b, p(a0, -boss), p(a0, boss), p(a1, boss), p(a1, -boss));
    face(b, p(a1, boss), p(a0, boss), [0, boss, 0], [0, boss, 0]);
    face(b, p(a0, -boss), p(a1, -boss), [0, -boss, 0], [0, -boss, 0]);
  }
  return b.build();
}

/** A gumdrop: a dome `1` round at its foot on z = 0, rising to `tall` of that, smooth, and flat underneath, for scaling. */
export function dome(tall = 0.8, rings = 4, sides = 10): Mesh {
  const b = new MeshBuilder();
  const p = (i: number, j: number): V3 => {
    const phi = (i / rings) * (Math.PI / 2),
      th = (j / sides) * Math.PI * 2;
    return [Math.cos(phi) * Math.cos(th), Math.cos(phi) * Math.sin(th), Math.sin(phi) * tall];
  };
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) face(b, p(i, j), p(i, j + 1), p(i + 1, j + 1), p(i + 1, j));
  for (let j = 0; j < sides; j++) face(b, p(0, j + 1), p(0, j), [0, 0, 0], [0, 0, 0]);
  return b.build();
}

/** A round sweet `1` across its face and `thick` through, its face in x and y and its axis along z, for scaling. */
export function disc(thick = 0.3, sides = 28): Mesh {
  const b = new MeshBuilder();
  const z = thick / 2;
  for (let j = 0; j < sides; j++) {
    const a0 = (j / sides) * Math.PI * 2,
      a1 = ((j + 1) / sides) * Math.PI * 2;
    const p = (a: number, side: number): V3 => [Math.cos(a), Math.sin(a), side];
    face(b, p(a0, -z), p(a1, -z), p(a1, z), p(a0, z));
    face(b, p(a0, z), p(a1, z), [0, 0, z], [0, 0, z]);
    face(b, p(a1, -z), p(a0, -z), [0, 0, -z], [0, 0, -z]);
  }
  return b.build();
}

/**
 * A whisk: its wires four loops round its axle, along y, each in a plane
 * through the axle, reaching `1` from it and `wide` either side along it, and
 * a knob at the middle; for turning about the axle as a cog does.
 */
export function whisk(wide = 0.1): Mesh {
  const b = new MeshBuilder();
  const steps = 20;
  for (let k = 0; k < 4; k++) {
    const th = (k / 4) * Math.PI;
    const dx = Math.cos(th),
      dz = Math.sin(th);
    const at = (s: number): V3 => {
      const a = (s / steps) * Math.PI * 2;
      return [dx * Math.cos(a), Math.sin(a) * wide, dz * Math.cos(a)];
    };
    for (let s = 0; s < steps; s++) beam(b, at(s), at(s + 1), 0.025);
  }
  ball(b, [0, 0, 0], 0.12);
  return b.build();
}

/**
 * A smooth tube `1` round and `1` long, standing on z = 0 along its axis,
 * capped at its top. Its side's normals point straight out from the axis and
 * its cap's straight along it, so it may be stretched along its length
 * without its light going wrong, where any other shape stretched one way
 * lights as though it were not: a cane its whole height is one of these.
 */
export function tube(sides = 20): Mesh {
  const b = new MeshBuilder();
  for (let j = 0; j <= sides; j++) {
    const a = (j / sides) * Math.PI * 2;
    const c = Math.cos(a),
      s = Math.sin(a);
    b.vertex(c, s, 0, c, s, 0, j / sides, 0);
    b.vertex(c, s, 1, c, s, 0, j / sides, 1);
  }
  for (let j = 0; j < sides; j++) b.quad(j * 2, j * 2 + 2, j * 2 + 3, j * 2 + 1);
  const top = b.vertex(0, 0, 1, 0, 0, 1, 0.5, 0.5);
  const rim = top + 1;
  for (let j = 0; j <= sides; j++) {
    const a = (j / sides) * Math.PI * 2;
    b.vertex(Math.cos(a), Math.sin(a), 1, 0, 0, 1, 0, 0);
  }
  for (let j = 0; j < sides; j++) b.quad(top, rim + j, rim + j + 1, top);
  return b.build();
}

/**
 * A smooth cone standing on z = 0, `ratio` round at its foot for every one
 * of its height `1`, its normals leaning out as its side does: a mountain, a
 * tower's roof or a chocolate tree, scaled the same all ways to its size.
 */
export function smoothCone(ratio = 0.75, sides = 28): Mesh {
  const b = new MeshBuilder();
  const slant = Math.hypot(1, ratio);
  for (let j = 0; j <= sides; j++) {
    const a = (j / sides) * Math.PI * 2;
    const c = Math.cos(a),
      s = Math.sin(a);
    // out from the axis and up by as much as the side leans in
    const nx = (c * 1) / slant,
      ny = (s * 1) / slant,
      nz = ratio / slant;
    b.vertex(c * ratio, s * ratio, 0, nx, ny, nz, j / sides, 0);
    b.vertex(0, 0, 1, nx, ny, nz, j / sides, 1);
  }
  for (let j = 0; j < sides; j++) b.quad(j * 2, j * 2 + 2, j * 2 + 3, j * 2 + 1);
  return b.build();
}

/**
 * The frosting over a mountain's top: the upper part of a cone as `smoothCone`
 * makes it, from `from` of its height to its point, a little proud of it, its
 * lower edge dripping down in rounded tongues.
 */
export function frosting(ratio = 0.75, from = 0.62, sides = 48): Mesh {
  const b = new MeshBuilder();
  const proud = 1.04;
  const slant = Math.hypot(1, ratio);
  for (let j = 0; j <= sides; j++) {
    const a = (j / sides) * Math.PI * 2;
    const c = Math.cos(a),
      s = Math.sin(a);
    // the edge lower where a drip runs down, six of them round
    const edge = from - 0.08 * Math.max(0, Math.cos(a * 6)) ** 2;
    const r = ratio * (1 - edge) * proud;
    const nx = c / slant,
      ny = s / slant,
      nz = ratio / slant;
    b.vertex(c * r, s * r, edge, nx, ny, nz, j / sides, 0);
    b.vertex(0, 0, 1.01, nx, ny, nz, j / sides, 1);
  }
  for (let j = 0; j < sides; j++) b.quad(j * 2, j * 2 + 2, j * 2 + 3, j * 2 + 1);
  return b.build();
}

/** A ring `1` round its middle and `tube` thick, lying flat on z = 0 at its middle, smooth: a donut. */
export function torus(tube: number, top = false, rings = 28, sides = 14): Mesh {
  const b = new MeshBuilder();
  // `top` is the icing: the upper half only, a little fuller than the dough
  const t = top ? tube * 1.06 : tube;
  const span = top ? Math.PI : Math.PI * 2;
  for (let i = 0; i <= rings; i++) {
    const u = (i / rings) * Math.PI * 2;
    for (let j = 0; j <= sides; j++) {
      const v = (j / sides) * span;
      const nx = Math.cos(v) * Math.cos(u),
        ny = Math.cos(v) * Math.sin(u),
        nz = Math.sin(v);
      b.vertex(
        (1 + t * Math.cos(v)) * Math.cos(u),
        (1 + t * Math.cos(v)) * Math.sin(u),
        t * Math.sin(v),
        nx,
        ny,
        nz,
        i / rings,
        j / sides,
      );
    }
  }
  const row = sides + 1;
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) b.quad(i * row + j, (i + 1) * row + j, (i + 1) * row + j + 1, i * row + j + 1);
  return b.build();
}

/**
 * A smooth solid turned about z from `z0` to `z1` of a unit height, `r(z)`
 * from its axis at each height, its normals worked out from the profile's own
 * slope so light runs round it smoothly; open at the bottom and closed at a
 * top where `r` comes to nothing. A mountain, a tree, a frosting.
 */
export function revolved(r: (z: number) => number, z0 = 0, z1 = 1, rows = 24, sides = 32, lift = 0): Mesh {
  const b = new MeshBuilder();
  const e = 1e-3;
  for (let i = 0; i <= rows; i++) {
    const z = z0 + ((z1 - z0) * i) / rows;
    const rr = r(z);
    // the profile's slope: outward normal of (r, z) is (dz, -dr) turned round the axis
    const dr = (r(Math.min(1, z + e)) - r(Math.max(0, z - e))) / (Math.min(1, z + e) - Math.max(0, z - e));
    const l = Math.hypot(1, dr);
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const c = Math.cos(a),
        s = Math.sin(a);
      b.vertex(c * rr, s * rr, z + lift, c / l, s / l, -dr / l, j / sides, i / rows);
    }
  }
  const row = sides + 1;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < sides; j++) b.quad(i * row + j, i * row + j + 1, (i + 1) * row + j + 1, (i + 1) * row + j);
  return b.build();
}

/** A mountain's profile, `ratio` round at its foot for its height of one, easing into a rounded top and not a point. */
export const hillOf =
  (ratio: number) =>
  (z: number): number =>
    ratio * Math.pow(Math.max(0, Math.cos((Math.min(1, z) * Math.PI) / 2)), 0.75);

/**
 * A lump of rock inside a ball `1` round, its faces flat and its surface
 * pushed in by a chance from `seed`, so no two are the same: space debris.
 * Never out past the ball, since debris is kept clear of the run by how far
 * the ball reaches.
 */
export function rock(seed: number, rings = 5, sides = 8): Mesh {
  const b = new MeshBuilder();
  let s = seed * 9301 + 49297;
  const next = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const bump: number[] = [];
  for (let i = 0; i <= rings; i++) for (let j = 0; j < sides; j++) bump.push(0.55 + next() * 0.45);
  const p = (i: number, j: number): V3 => {
    const phi = (i / rings) * Math.PI,
      th = ((j % sides) / sides) * Math.PI * 2;
    // the poles one point each, however many sides meet there
    const r = i === 0 || i === rings ? bump[i * sides] : bump[i * sides + (j % sides)];
    return [Math.sin(phi) * Math.cos(th) * r, Math.sin(phi) * Math.sin(th) * r * 0.8, Math.cos(phi) * r];
  };
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) face(b, p(i + 1, j), p(i + 1, j + 1), p(i, j + 1), p(i, j));
  return b.build();
}

/**
 * A satellite dish on its own, its bowl opening along +x and a little up, a
 * feed horn on struts at its focus and a hinge under it, for turning about
 * the mast it stands on (z): `1` round across its rim.
 */
export function satelliteDish(): Mesh {
  const b = new MeshBuilder();
  const rings = 6,
    sides = 20,
    tilt = 0.6;
  const c = Math.cos(tilt),
    s = Math.sin(tilt);
  // a bowl in its own frame, opening along +u, then tilted up by `tilt`
  const at = (u: number, v: number, w: number): V3 => [u * c - w * s, v, u * s + w * c];
  const bowl = (i: number, j: number): V3 => {
    const r = i / rings,
      a = (j / sides) * Math.PI * 2;
    return at(0.35 * r * r, Math.cos(a) * r, Math.sin(a) * r);
  };
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) face(b, bowl(i, j), bowl(i, j + 1), bowl(i + 1, j + 1), bowl(i + 1, j));
  for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3])
    beam(b, at(0.35, Math.cos(a), Math.sin(a)), at(0.9, 0, 0), 0.02);
  ball(b, at(0.95, 0, 0), 0.08, 3, 6);
  beam(b, [0, 0, -0.5], at(0, 0, 0), 0.06);
  return b.build();
}

/** A turning radar antenna: a lattice bar across a short post, `1` long either side of it, and a knob on its post. */
export function radar(): Mesh {
  const b = new MeshBuilder();
  beam(b, [0, 0, 0], [0, 0, 0.35], 0.06);
  for (const z of [0.3, 0.55]) beam(b, [-1, 0, z], [1, 0, z], 0.035);
  for (let k = -5; k < 5; k++) beam(b, [k / 5, 0, k % 2 ? 0.3 : 0.55], [(k + 1) / 5, 0, k % 2 ? 0.55 : 0.3], 0.02);
  ball(b, [0, 0, 0.42], 0.08, 3, 6);
  return b.build();
}
