/**
 * The run as it is drawn. What never moves is built once when a run is put
 * on: the channel, swept along the very samples the track worked out and as
 * wide as the track says at each; the pegs; and each funnel's bowl, turned
 * from the same height the marbles roll on. What moves is written every
 * frame: the marbles, and the sweepers, gates and wheels, each placed where
 * the race says it is, so what is seen is exactly what a marble hits. It is
 * handed what it draws from, and never the renderer.
 */
import { SPRITE_STRIDE } from 'artshape-render/game/particles';
import { type GameGroup, PATTERN_STRIDE } from 'artshape-render/game/renderer';
import { MeshBuilder } from 'artshape-render/mesh/types';
import { FIELD } from './field';
import { MARBLES, RADIUS } from './race';
import type { Race, Roll } from './race';
import { basis, spin } from './matrix';
import { seeded } from './random';
import {
  bar,
  ball,
  post,
  beam,
  block,
  bowl as bowlMesh,
  cog,
  column,
  cone,
  disc,
  dome,
  lattice,
  mound,
  sphere,
  hillOf,
  revolved,
  smoothCone,
  sweep,
  torus,
  tube,
  wheel,
  whisk,
  face,
} from './meshes';
import {
  STANDING,
  STEEL,
  type TrackColours,
  ARCH,
  CAKE,
  CANE,
  CHIMNEY,
  DONUT,
  PRETZEL,
  COG,
  CUPCAKE,
  GIANT,
  GUMDROPS,
  LOLLIPOP,
  POT,
  WHISK,
  type DecorKind,
  type Decoration,
  GIRDER,
  LAMP,
  MOST,
  PIPES,
  PISTON,
  PUFFS,
  STRIPE,
  TANK,
  cogTurn,
  puffOf,
  rodOut,
} from './decor';
import {
  CELL,
  HALF_WIDTH,
  LANE_STOP,
  LEAN,
  LEVEL,
  MOUND,
  MOVING_MOST,
  GATE_HEIGHT,
  PADDLE_HEIGHT,
  PEG_CONE,
  PEG_HEIGHT,
  TROUGH_DEPTH,
  TROUGH_FLAT,
  WHEEL,
  type Obstacle,
  type Pose,
  type Segment,
  type Spot,
  finishOf,
  type Track,
  at,
  bowlHeight,
  pose,
  pose0,
  spot,
  widthAt,
  OUTLET_BACK,
} from './track';

/**
 * How high the wall of the channel stands above its floor. It has to rise
 * past a marble's middle to hold it in, and not much further: a wall a whole
 * marble high hides everything of a marble but its crown from any camera
 * above it, and half the field is always against one wall or the other.
 */
/** How thick the chute is, so it is a trough and not a sheet of paper. */
const SKIN = 0.18;
/** The smoke's grey, pale enough to read against the dark as smoke and not as a hole in it. */
const SMOKE: [number, number, number] = [0.62, 0.62, 0.65];
/** How far out a gate's post stands from the wall it is on. */
const POST = 0.7;
/**
 * The channel in section, in its own terms: how far across, and how far up.
 * Down one wall, across the floor, up the other, then back along the
 * outside, so the trough has a thickness to it when seen from below.
 */
const profile = (wall: number, strips = 1): readonly (readonly [number, number])[] => [
  [-HALF_WIDTH, wall],
  // the floor in strips across, flat all the same, so that part of a lane's may be left out where it lies in another
  ...cutsOf(strips).map((a): [number, number] => [a, 0]),
  [HALF_WIDTH, wall],
  [HALF_WIDTH + SKIN, wall],
  [HALF_WIDTH + SKIN, -SKIN],
  [-HALF_WIDTH - SKIN, -SKIN],
  [-HALF_WIDTH - SKIN, wall],
  [-HALF_WIDTH, wall],
];

/** The marker over where the next piece goes: how wide, how tall, and how far over the end its base stands. */
const MARK = { radius: 0.6, height: 1.8, over: 1.8 };

/**
 * Which edges of `profile` are a wall, its inside face, its top and its
 * outside, on the left and on the right: what is left out where physics has
 * that wall open, for a floor in `strips`: after the left wall's inside
 * come the floor's strips.
 */
const leftWall = (strips: number) => [0, 5 + strips, 6 + strips];
const rightWall = (strips: number) => [1 + strips, 2 + strips, 3 + strips];
/** How many strips across a split's lane's floor is cut into: fine enough that the seam where one is left out is not seen. */
const LANE_STRIPS = 16;

/** A trough in section: the walls meet at a narrow bottom, a V a chute wide, for the lane at the end and the narrow. */
/**
 * Whether the middle of a floor strip of `seg`, between sample `i` and the
 * next and across edge `k` of the section, lies in the channel of segment
 * `other`: within its width and a hair of its floor.
 */
function inLane(track: Track, other: number, seg: Segment, i: number, k: number): boolean {
  const j = Math.min(i + 1, seg.arc.length - 1);
  const w = (seg.width[i] + seg.width[j]) / 2;
  // across the strip's middle, as `sweep` places a section's point by the width there
  const cuts = cutsOf(LANE_STRIPS);
  const a = (cuts[k - 1] + cuts[k]) / 2;
  const across = Math.sign(a) * (Math.abs(a) - HALF_WIDTH + w);
  const at = [0, 1, 2].map((c) => (seg.points[i * 3 + c] + seg.points[j * 3 + c]) / 2);
  const t = [0, 1, 2].map((c) => seg.tangents[i * 3 + c]);
  const u = [0, 1, 2].map((c) => seg.ups[i * 3 + c]);
  const b = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
  const x = at[0] + b[0] * across,
    y = at[1] + b[1] * across,
    z = at[2] + b[2] * across;
  const o = track.segments[other];
  let best = -1,
    along = Infinity;
  for (let n = 0; n < o.arc.length; n++) {
    const p = n * 3;
    const d =
      (x - o.points[p]) * o.tangents[p] +
      (y - o.points[p + 1]) * o.tangents[p + 1] +
      (z - o.points[p + 2]) * o.tangents[p + 2];
    if (Math.abs(d) < Math.abs(along)) {
      along = d;
      best = n;
    }
  }
  const p = best * 3;
  const px = x - o.points[p],
    py = y - o.points[p + 1],
    pz = z - o.points[p + 2];
  const ot = [o.tangents[p], o.tangents[p + 1], o.tangents[p + 2]];
  const ou = [o.ups[p], o.ups[p + 1], o.ups[p + 2]];
  const cross =
    px * (ot[1] * ou[2] - ot[2] * ou[1]) + py * (ot[2] * ou[0] - ot[0] * ou[2]) + pz * (ot[0] * ou[1] - ot[1] * ou[0]);
  const up = px * ou[0] + py * ou[1] + pz * ou[2];
  return Math.abs(cross) < o.width[best] && Math.abs(up) < 0.1;
}

/** Where a flat floor is cut across, from wall to wall: the strips a lane's floor is left out of in the other lane by. */
const cutsOf = (strips: number): number[] =>
  Array.from({ length: strips + 1 }, (_, k) => -HALF_WIDTH + (2 * HALF_WIDTH * k) / strips);
/** Which edges of a flat floor in `strips` are the floor. */
const floorOf = (strips: number): number[] => Array.from({ length: strips }, (_, k) => k + 1);
const FLOOR_OF_TROUGH: readonly number[] = [1, 2, 3];

const trough = (wall: number): readonly (readonly [number, number])[] => [
  [-HALF_WIDTH, wall],
  [-HALF_WIDTH, TROUGH_DEPTH],
  [-TROUGH_FLAT, 0],
  [TROUGH_FLAT, 0],
  [HALF_WIDTH, TROUGH_DEPTH],
  [HALF_WIDTH, wall],
  [HALF_WIDTH + SKIN, wall],
  [HALF_WIDTH + SKIN, -SKIN],
  [-HALF_WIDTH - SKIN, -SKIN],
  [-HALF_WIDTH - SKIN, wall],
  [-HALF_WIDTH, wall],
];

/**
 * A lid's grid: bars along the covered stretch at the walls' height, close
 * enough together that no ball fits between two, and rungs across it every
 * so often. What the physics meets is a ceiling from wall top to wall top;
 * the bars' undersides lie on it, so a ball seen against the grid is where
 * it is.
 */
const BAR = 0.1,
  BARS_ACROSS = [-0.8, 0, 0.8],
  RUNG_EVERY = 1.5;
/** A bar of the grid in section: a square stood on the walls' height, `across` from the middle. */
const barOf = (across: number, wall: number): readonly (readonly [number, number])[] => [
  [across - BAR / 2, wall],
  [across + BAR / 2, wall],
  [across + BAR / 2, wall + BAR],
  [across - BAR / 2, wall + BAR],
  [across - BAR / 2, wall],
];

/** A moving part, and the piece it is on. */
interface Part {
  segment: number;
  ob: Obstacle;
}

export { boxOf } from './track';

type V3 = [number, number, number];

/**
 * Stripes swept along the outside of a wall in two colours in turn, each
 * plate over the samples it covers at the wall's own width there, so that
 * where a board flares the plate flares with it and never cuts inside; and a
 * band low on the wall, as tape is, since high on a tall wall round a tight
 * bend the wall's own sections cross over each other, and a band up there
 * would fold with them.
 */
function striped(track: Track, d: Decoration, first: MeshBuilder, second: MeshBuilder) {
  const seg = track.segments[d.segment];
  const o = d.side * (HALF_WIDTH + STRIPE.out);
  const thick = d.side * 0.03;
  const top = Math.min(seg.wall - 0.1, STRIPE.top);
  const plate: [number, number][] = [
    [o, 0.15],
    [o + thick, 0.15],
    [o + thick, top],
    [o, top],
    [o, 0.15],
  ];
  let from = 0,
    k = 0;
  while (from < seg.arc.length - 1) {
    let to = from + 1;
    while (to < seg.arc.length - 1 && seg.arc[to] - seg.arc[from] < STRIPE.block) to++;
    sweep(
      seg.points.subarray(from * 3),
      seg.tangents.subarray(from * 3),
      seg.ups.subarray(from * 3),
      to - from + 1,
      plate,
      k++ % 2 ? second : first,
      seg.width.subarray(from),
      HALF_WIDTH,
    );
    from = to;
  }
}

/** Floats a tube in a chain: where it begins, which way it goes, how long, how round, how far along its chain, and its sweet. */
const TUBE = 10;
/** The sweets a tube can be: a candy cane's stripes, red wound round white, and baked pretzel brown with no pattern. */
const CANDY = 0,
  BAKED = 1;

/** A chain of tubes through `path`, `r` round, each overlapping the next by its roundness so no gap shows at a bend. */
function chain(tubes: number[], path: readonly V3[], r: number, sweet: number) {
  let along = 0;
  for (let k = 0; k + 1 < path.length; k++) {
    const [ax, ay, az] = path[k],
      [bx, by, bz] = path[k + 1];
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const dx = (bx - ax) / len,
      dy = (by - ay) / len,
      dz = (bz - az) / len;
    const start = k === 0 ? 0 : r * 0.5;
    tubes.push(ax - dx * start, ay - dy * start, az - dz * start, dx, dy, dz, len + start, r, along - start, sweet);
    along += len;
  }
}

/**
 * Every tube, one placement each, stretched to its length along its axis,
 * which only a tube may be: a candy one striped by the renderer's swirl round
 * its axis, the stripes climbing as fast in the world whatever the tube's
 * length, and turned on by as far along its chain as it begins, so they carry
 * on from one tube into the next.
 */
function tubeGroup(tubes: number[]): GameGroup {
  const n = tubes.length / TUBE;
  const at = new Float32Array(n * 16),
    looks = new Float32Array(n * 4),
    swirls = new Float32Array(n * PATTERN_STRIDE);
  // how far round the swirl turns for a unit along a tube
  const climb = (4 * CANE.twist) / CANE.half;
  for (let k = 0; k < n; k++) {
    const [x, y, z, dx, dy, dz, len, r, along, sweet] = tubes.slice(k * TUBE, k * TUBE + TUBE);
    // two directions square to the axis and to each other, which with the axis make a right hand
    const ref: V3 = Math.abs(dz) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let ux = dy * ref[2] - dz * ref[1],
      uy = dz * ref[0] - dx * ref[2],
      uz = dx * ref[1] - dy * ref[0];
    const m = Math.hypot(ux, uy, uz);
    ux /= m;
    uy /= m;
    uz /= m;
    const vx = dy * uz - dz * uy,
      vy = dz * ux - dx * uz,
      vz = dx * uy - dy * ux;
    at.set([ux * r, uy * r, uz * r, 0, vx * r, vy * r, vz * r, 0, dx * len, dy * len, dz * len, 0, x, y, z, 1], k * 16);
    if (sweet === CANDY) {
      looks.set([0.82, 0.05, 0.08, 0.3], k * 4);
      const seed = ((((climb * along) / (Math.PI * 2)) % 1) + 1) % 1;
      swirls.set([1, (climb * len) / 4, seed, 0, 0.96, 0.94, 0.9, 0], k * PATTERN_STRIDE);
    } else looks.set([0.55, 0.3, 0.12, 0.6], k * 4);
  }
  return { mesh: tube(), matrices: at, count: n, materials: looks, patterns: swirls };
}

/** Donuts lying flat, dough under and icing over, the icing each its own colour in turn. */
function donutGroups(donuts: number[]): GameGroup[] {
  const n = donuts.length / 4;
  const at = new Float32Array(n * 16),
    icing = new Float32Array(n * 4);
  const icings: [number, number, number][] = [
    [1, 0.35, 0.65],
    [0.3, 0.15, 0.07],
    [0.98, 0.96, 0.93],
    [0.3, 0.7, 1],
    [0.7, 0.4, 1],
  ];
  for (let k = 0; k < n; k++) {
    spin(at, k, donuts[k * 4], donuts[k * 4 + 1], donuts[k * 4 + 2], 0, 0, 1, 0, DONUT.radius * donuts[k * 4 + 3]);
    icing.set([...icings[k % icings.length], 0.4], k * 4);
  }
  const t = DONUT.tube / DONUT.radius;
  return [
    { mesh: torus(t), matrices: at, count: n, albedo: [0.88, 0.6, 0.32], roughness: 0.7 },
    { mesh: torus(t, true), matrices: at, count: n, materials: icing },
  ];
}

/** Mountains in pastel bands, each its own colour, and the frosting on their tops. */
function mountainGroups(mountains: number[]): GameGroup[] {
  const n = mountains.length / 4;
  const at = new Float32Array(n * 16),
    looks = new Float32Array(n * 4),
    bands = new Float32Array(n * PATTERN_STRIDE),
    tops = new Float32Array(n * 4);
  const colours: [number, number, number][] = [
    [0.1, 0.62, 0.98],
    [0.98, 0.3, 0.65],
    [0.98, 0.8, 0.15],
    [0.55, 0.3, 0.98],
    [0.15, 0.85, 0.6],
  ];
  const caps: [number, number, number][] = [
    [0.99, 0.98, 0.97],
    [1, 0.66, 0.6],
    [0.95, 0.55, 0.85],
  ];
  for (let k = 0; k < n; k++) {
    const [x, y, z, height] = mountains.slice(k * 4, k * 4 + 4);
    spin(at, k, x, y, z, 0, 0, 1, (k * 1.7) % (Math.PI * 2), height);
    looks.set([...colours[k % colours.length], 0.85], k * 4);
    // bands round it, four or so up its height, in white
    bands.set([2, 3.6, (k * 0.29) % 1, 0, 0.99, 0.98, 0.97, 0], k * PATTERN_STRIDE);
    tops.set([...caps[k % caps.length], 0.6], k * 4);
  }
  // rounded at the top, as a scoop of ice cream is, and frosted from two thirds up, a little proud of it, dripping
  const hill = hillOf(0.75);
  return [
    { mesh: revolved(hill), matrices: at, count: n, materials: looks, patterns: bands },
    { mesh: revolved((z) => hill(z) * 1.04 + 0.004, 0.64, 1, 12, 48), matrices: at, count: n, materials: tops },
  ];
}

/** How many sprinkles on a mountain's frosting, and on a donut's icing. */
const SPRINKLES = { mountain: 40, donut: 22 } as const;
/** The colours sprinkles come in. */
const SPRINKLE: readonly [number, number, number][] = [
  [1, 0.25, 0.45],
  [0.2, 0.6, 1],
  [1, 0.85, 0.1],
  [0.3, 0.85, 0.35],
  [0.7, 0.35, 1],
  [0.98, 0.98, 0.98],
];

/**
 * Sprinkles on the frosting of every mountain and the icing of every donut:
 * small rods lying on the surface at every angle, each its own colour, from a
 * chance seeded by where each thing stands, so they are the same every time.
 */
function sprinkleGroup(mountains: number[], donuts: number[]): GameGroup {
  const n = (mountains.length / 4) * SPRINKLES.mountain + (donuts.length / 4) * SPRINKLES.donut;
  const at = new Float32Array(n * 16),
    looks = new Float32Array(n * 4);
  let k = 0;
  const put = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    turn: number,
    len: number,
    r: number,
  ) => {
    // lying along the surface: its axis square to the surface's normal, turned about the normal by `turn`
    const ref: V3 = Math.abs(nz) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let ax = ny * ref[2] - nz * ref[1],
      ay = nz * ref[0] - nx * ref[2],
      az = nx * ref[1] - ny * ref[0];
    const m = Math.hypot(ax, ay, az);
    ax /= m;
    ay /= m;
    az /= m;
    const bx = ny * az - nz * ay,
      by = nz * ax - nx * az,
      bz = nx * ay - ny * ax;
    const c = Math.cos(turn),
      sn = Math.sin(turn);
    const dx = ax * c + bx * sn,
      dy = ay * c + by * sn,
      dz = az * c + bz * sn;
    // across it: the normal, and the third direction square to both
    const ex = ny * dz - nz * dy,
      ey = nz * dx - nx * dz,
      ez = nx * dy - ny * dx;
    at.set(
      [
        ex * r,
        ey * r,
        ez * r,
        0,
        nx * r,
        ny * r,
        nz * r,
        0,
        dx * len,
        dy * len,
        dz * len,
        0,
        x - (dx * len) / 2,
        y - (dy * len) / 2,
        z - (dz * len) / 2,
        1,
      ],
      k * 16,
    );
    looks.set([...SPRINKLE[k % SPRINKLE.length], 0.35], k * 4);
    k++;
  };
  const hill = hillOf(0.75);
  for (let m = 0; m < mountains.length / 4; m++) {
    const [x, y, z, height] = mountains.slice(m * 4, m * 4 + 4);
    const random = seeded(Math.round(x * 131 + y * 17));
    for (let j = 0; j < SPRINKLES.mountain; j++) {
      const u = 0.68 + random() * 0.27;
      const a = random() * Math.PI * 2;
      const rr = hill(u) * 1.04 + 0.004;
      // the frosting's normal there, from its slope
      const dr = (hill(u + 1e-3) - hill(u - 1e-3)) / 2e-3;
      const l = Math.hypot(1, dr);
      put(
        x + Math.cos(a) * rr * height,
        y + Math.sin(a) * rr * height,
        z + u * height,
        Math.cos(a) / l,
        Math.sin(a) / l,
        -dr / l,
        random() * Math.PI,
        height * 0.028,
        height * 0.006,
      );
    }
  }
  for (let q = 0; q < donuts.length / 4; q++) {
    const [x, y, z, big] = donuts.slice(q * 4, q * 4 + 4);
    const random = seeded(Math.round(x * 97 + y * 53));
    const R = DONUT.radius * big,
      t = DONUT.tube * big * 1.06;
    for (let j = 0; j < SPRINKLES.donut; j++) {
      // over the icing's top, round the ring
      const u = random() * Math.PI * 2,
        v = (0.2 + random() * 0.6) * (Math.PI / 2);
      const nx = Math.cos(v) * Math.cos(u),
        ny = Math.cos(v) * Math.sin(u),
        nz = Math.sin(v);
      put(
        x + (R + t * Math.cos(v)) * Math.cos(u),
        y + (R + t * Math.cos(v)) * Math.sin(u),
        z + t * Math.sin(v),
        nx,
        ny,
        nz,
        random() * Math.PI,
        0.18 * big,
        0.035 * big,
      );
    }
  }
  return { mesh: tube(8), matrices: at, count: k, materials: looks };
}

/** Castle towers' roofs: cones swirled red and white. */
function roofGroup(roofs: number[]): GameGroup {
  const n = roofs.length / 4;
  const at = new Float32Array(n * 16),
    swirls = new Float32Array(n * PATTERN_STRIDE);
  for (let k = 0; k < n; k++) {
    const [x, y, z, r] = roofs.slice(k * 4, k * 4 + 4);
    spin(at, k, x, y, z, 0, 0, 1, 0, r / 0.75);
    swirls.set([1, 1.2, (k * 0.31) % 1, 0, 0.97, 0.95, 0.92, 0], k * PATTERN_STRIDE);
  }
  return {
    mesh: smoothCone(0.75),
    matrices: at,
    count: n,
    albedo: [0.85, 0.08, 0.12],
    roughness: 0.35,
    patterns: swirls,
  };
}

/** Chocolate cone trees. */
function treeGroup(trees: number[]): GameGroup {
  const n = trees.length / 4;
  const at = new Float32Array(n * 16);
  for (let k = 0; k < n; k++)
    spin(at, k, trees[k * 4], trees[k * 4 + 1], trees[k * 4 + 2], 0, 0, 1, 0, trees[k * 4 + 3]);
  // a chocolate kiss: wide and round at the bottom, drawn up to a soft point
  const kiss = (z: number) =>
    0.45 * Math.pow(1 - z, 1.3) * (0.7 + 0.6 * Math.sin(Math.min(1, z * 2.2) * Math.PI * 0.5));
  return { mesh: revolved(kiss, 0, 1, 16, 20), matrices: at, count: n, albedo: [0.33, 0.18, 0.09], roughness: 0.4 };
}

/** Clouds, soft white balls. */
function cloudGroup(clouds: number[]): GameGroup {
  const n = clouds.length / 4;
  const at = new Float32Array(n * 16);
  for (let k = 0; k < n; k++)
    spin(at, k, clouds[k * 4], clouds[k * 4 + 1], clouds[k * 4 + 2], 0, 0, 1, 0, clouds[k * 4 + 3]);
  return { mesh: sphere(1, 12, 18), matrices: at, count: n, albedo: [1, 1, 1], roughness: 1 };
}

/** A sweet factory's steam, pale and a little pink. */
const STEAM: [number, number, number] = [0.95, 0.84, 0.9];
/** The colours gumdrops and lollipops come in, in turn. */
const GUM: readonly [number, number, number][] = [
  [0.9, 0.12, 0.3],
  [0.15, 0.7, 0.25],
  [0.95, 0.6, 0.08],
  [0.55, 0.2, 0.8],
  [0.95, 0.85, 0.1],
];

/**
 * A thing turning about an axle across the way, level, as a cog or a whisk
 * does: placed `angle` round from `frames`' entry `k` (its middle, the way
 * along, its reach), written into `out` at `k`.
 */
function turned(out: Float32Array, k: number, frames: Float32Array, angle: number) {
  const o = k * 9;
  const tx = frames[o + 3],
    ty = frames[o + 4];
  // the axle is across the way, level: its own y; its x and z turn about it in the upright plane along the way
  const flat = Math.hypot(tx, ty) || 1;
  const ax = ty / flat,
    ay = -tx / flat;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  // x, y and z make a right hand: x along the way turned, y the axle to the left, z up turned
  basis(
    out,
    k,
    frames[o],
    frames[o + 1],
    frames[o + 2],
    (tx / flat) * c,
    (ty / flat) * c,
    s,
    -ax,
    -ay,
    0,
    -(tx / flat) * s,
    -(ty / flat) * s,
    c,
    frames[o + 6],
  );
}

/** Across the channel to the right of the way it goes, at a spot: square to the way and to up. */
function right(h: Spot): V3 {
  return [h.ty * h.uz - h.tz * h.uy, h.tz * h.ux - h.tx * h.uz, h.tx * h.uy - h.ty * h.ux];
}

export class Scene {
  /** Where every marble is this frame, one placement each. */
  readonly marbles = new Float32Array(MARBLES * 16);
  /** What each marble is made of: colour and roughness, four numbers each. */
  readonly looks = new Float32Array(MARBLES * 4);
  /** Where the next piece of a run being built goes, marked over it: none while nothing is being built. */
  readonly marker = new Float32Array(16);
  /** What of a run's dressing moves: each cog, each piston's rod and each puff of smoke, the pools sized once by the most a run may have. */
  readonly cogs = new Float32Array(MOST.cog * 2 * 16);
  readonly rods = new Float32Array(MOST.piston * 16);
  /** The smoke, a soft sprite a puff, as the renderer takes them: where, how big, what colour and how thick. */
  readonly smoke = new Float32Array((MOST.chimney + MOST.fudgePot) * PUFFS * SPRITE_STRIDE);
  /** The whisks turning on a sweet factory's walls. */
  readonly whisks = new Float32Array(MOST.whisk * 16);
  /** Where each whisk turns, worked out once a run, as a cog's is. */
  private whiskFrames = new Float32Array(MOST.whisk * 9);
  private whiskCount = 0;
  /** What is drawn over each marble's colour: its pattern, sized to the marble, as the renderer takes it. */
  readonly patterns = new Float32Array(MARBLES * PATTERN_STRIDE);
  /** Where each pair of cogs turns, worked out once a run: its middle, the way along, and the axle, nine numbers a cog. */
  private cogFrames = new Float32Array(MOST.cog * 2 * 9);
  private readonly puff: [number, number, number, number, number] = [0, 0, 0, 0, 0];

  /** Where each moving part is this frame: the sweepers' paddles, the gates' bars and the wheels. */
  readonly sweepers = new Float32Array(MOVING_MOST * 16);
  readonly gates = new Float32Array(MOVING_MOST * 16);
  readonly wheels = new Float32Array(MOVING_MOST * 16);
  private sweeping: Part[] = [];
  private gating: Part[] = [];
  private turning: Part[] = [];
  private readonly here = spot();
  private readonly at = pose0();

  constructor() {
    for (let i = 0; i < MARBLES; i++) {
      const look = FIELD[i % FIELD.length];
      this.looks[i * 4] = look.colour[0];
      this.looks[i * 4 + 1] = look.colour[1];
      this.looks[i * 4 + 2] = look.colour[2];
      this.looks[i * 4 + 3] = look.roughness;
      // the pattern repeats once across the marble, whatever size a marble is, and each is turned by its own seed
      const { kind, second, seed } = look.pattern;
      this.patterns.set([kind, 1 / RADIUS, seed, 0, second[0], second[1], second[2], 0], i * PATTERN_STRIDE);
    }
  }

  /**
   * The run itself, built once: the channel as one mesh, the bowls as
   * another, the pegs as a group; and the moving parts noted, for writing
   * each frame. A funnel's own centre line is only for ordering the field,
   * and is not drawn: its bowl is.
   */
  static(track: Track, dressing: readonly Decoration[] = [], colours: TrackColours = STEEL): GameGroup[] {
    const channel = new MeshBuilder();
    const floor = new MeshBuilder();
    const bowls = new MeshBuilder();
    const grid = new MeshBuilder();
    const rungs: number[] = [];
    const pegs: number[] = [];
    const posts: number[] = [];
    const mounds: number[] = [];
    // the floor under each funnel's hole, whose back end is walled
    const backs: number[] = [];
    // the line a race is won at, across the start of the last piece, and the stop at the far end of its lane: the
    // segment the race ends at, as the race finds it, and not the last in the list, which on a run with a split is a
    // lane's, and drew a stop across the lane where it joins the other
    const end = Math.max(0, finishOf(track));
    const lineAt = new Float32Array(16),
      stopAt = new Float32Array(16);
    this.onTrack(track, lineAt, 0, end, 0.06, 0, 0, Math.PI / 2);
    this.onTrack(track, stopAt, 0, end, track.segments[end].length, 0, 0, Math.PI / 2);
    // a spot is read no further than the end of its piece, so the stop is moved on by half its own thickness from
    // there, to stand just beyond the lane and not half in it where the winner waits, as the block met does
    const last = at(track, end, track.segments[end].length, this.here);
    stopAt[12] += last.tx * LANE_STOP;
    stopAt[13] += last.ty * LANE_STOP;
    stopAt[14] += last.tz * LANE_STOP;
    this.sweeping = [];
    this.gating = [];
    this.turning = [];
    track.segments.forEach((seg, s) => {
      const bowl = seg.funnel;
      // the chute feeding a bowl comes in over its rim, so the rim's wall goes all the way round
      if (bowl)
        bowlMesh(bowl.hole, bowl.rim, (r) => bowlHeight(bowl, r), bowl.wall, bowl.throat, bowls, [
          bowl.x,
          bowl.y,
          bowl.z,
        ]);
      else {
        // the floor and the walls swept apart, the same section, so that a theme may colour them apart: the floor is
        // the section's edges along the bottom, one across a flat channel and the three of a trough's V
        // a split's lane has its floor in strips, which part of may be left out; every other piece has one strip
        const strips = seg.open ? LANE_STRIPS : 1;
        const floorEdges = seg.trough ? FLOOR_OF_TROUGH : floorOf(strips);
        const open = seg.open && !seg.trough ? openWall(seg.open, strips) : undefined;
        // the first lane of the same piece, where this is the second of a split's two, which overlap at a fork and a join
        const partner = seg.open ? track.segments.findIndex((o, j) => j < s && o.open && o.piece === seg.piece) : -1;
        for (const [into, isFloor] of [
          [floor, true],
          [channel, false],
        ] as const)
          sweep(
            seg.points,
            seg.tangents,
            seg.ups,
            seg.arc.length,
            seg.trough ? trough(seg.wall) : profile(seg.wall, strips),
            into,
            seg.width,
            HALF_WIDTH,
            seg.trough ? seg.floor : undefined,
            // a lane's wall left out wherever physics leaves it open, at both ends of the stretch, as it is met; and
            // the second lane's floor left out where it lies in the first's, which is drawn there once
            (i, k) =>
              floorEdges.includes(k) !== isFloor ||
              (open?.(i, k) ?? false) ||
              (isFloor && partner >= 0 && inLane(track, partner, seg, i, k)),
          );
      }
      // a lid's grid over whatever stretch is covered: bars swept along the samples under it, and rungs across
      if (seg.lid) {
        let from = 0;
        while (from < seg.arc.length - 1 && seg.arc[from] < seg.lid.from - 1e-6) from++;
        let to = from;
        while (to < seg.arc.length - 1 && seg.arc[to + 1] <= seg.lid.upto + 1e-6) to++;
        const count = to - from + 1;
        if (count > 1)
          for (const across of BARS_ACROSS)
            sweep(
              seg.points.subarray(from * 3),
              seg.tangents.subarray(from * 3),
              seg.ups.subarray(from * 3),
              count,
              barOf(across, seg.wall),
              grid,
            );
        for (let along = seg.lid.from + RUNG_EVERY / 2; along <= seg.lid.upto; along += RUNG_EVERY)
          rungs.push(s, along);
      }
      for (const m of seg.mounds) mounds.push(s, m.along, m.across);
      if (s > 0 && track.segments[s - 1].funnel) backs.push(s);
      for (const ob of seg.obstacles) {
        if (ob.motion.kind === 'fixed') pegs.push(s, ob.along, ob.across);
        else if (ob.motion.kind === 'sweep') this.sweeping.push({ segment: s, ob });
        else if (ob.motion.kind === 'gate') {
          this.gating.push({ segment: s, ob });
          // a post on each wall, which the gate slides into and out of
          const w = widthAt(track, s, ob.along) + POST / 2;
          posts.push(s, ob.along, -w, s, ob.along, w);
        }
        // a wheel's paddles turn as one: its first paddle stands for the whole wheel
        else if (ob.motion.turn === 0) this.turning.push({ segment: s, ob });
      }
    });
    const pegAt = new Float32Array(Math.max(1, pegs.length / 3) * 16);
    for (let k = 0; k < pegs.length; k += 3) this.onTrack(track, pegAt, k / 3, pegs[k], pegs[k + 1], pegs[k + 2], 0, 0);
    const postAt = new Float32Array(Math.max(1, posts.length / 3) * 16);
    for (let k = 0; k < posts.length; k += 3)
      this.onTrack(track, postAt, k / 3, posts[k], posts[k + 1], posts[k + 2], 0, Math.PI / 2);
    const rungAt = new Float32Array(Math.max(1, rungs.length / 2) * 16);
    for (let k = 0; k < rungs.length; k += 2)
      this.onTrack(track, rungAt, k / 2, rungs[k], rungs[k + 1], 0, track.segments[rungs[k]].wall, Math.PI / 2);
    const moundAt = new Float32Array(Math.max(1, mounds.length / 3) * 16);
    for (let k = 0; k < mounds.length; k += 3)
      this.onTrack(track, moundAt, k / 3, mounds[k], mounds[k + 1], mounds[k + 2], 0, 0);
    // each wall stands just behind the floor it ends, as the lane's stop stands just beyond its lane
    const backAt = new Float32Array(Math.max(1, backs.length) * 16);
    backs.forEach((s, k) => {
      this.onTrack(track, backAt, k, s, 0, 0, 0, Math.PI / 2);
      const h = at(track, s, 0, this.here);
      backAt[k * 16 + 12] -= h.tx * OUTLET_BACK;
      backAt[k * 16 + 13] -= h.ty * OUTLET_BACK;
      backAt[k * 16 + 14] -= h.tz * OUTLET_BACK;
    });
    const one = new Float32Array(16);
    spin(one, 0, 0, 0, 0, 0, 0, 1, 0);
    const groups: GameGroup[] = [
      { mesh: channel.build(), matrices: one, albedo: colours.walls, roughness: 0.65 },
      { mesh: floor.build(), matrices: one, albedo: colours.floor, roughness: 0.65 },
      // a peg is a cone, which is what a ball there meets
      {
        mesh: cone(PEG_CONE, PEG_HEIGHT),
        matrices: pegAt,
        count: pegs.length / 3,
        albedo: colours.pegs,
        roughness: 0.5,
      },
      {
        mesh: bar(POST, 0.9, GATE_HEIGHT + 0.15),
        matrices: postAt,
        count: posts.length / 3,
        albedo: colours.trim,
        roughness: 0.5,
      },
      // the mounds the same grey as the floor they rise out of, so they read as the floor's own shape
      {
        mesh: mound(MOUND.radius, MOUND.height),
        matrices: moundAt,
        count: mounds.length / 3,
        albedo: colours.floor,
        roughness: 0.65,
      },
      // the line and the stop only where the run ends in a finish, and not at an open end of one being built
      {
        mesh: bar(HALF_WIDTH * 2, 0.12, 0.03),
        matrices: lineAt,
        count: track.finished ? 1 : 0,
        albedo: [0.95, 0.72, 0.2],
        roughness: 0.4,
      },
      {
        mesh: bar((HALF_WIDTH + SKIN) * 2, LANE_STOP * 2, track.segments[end].wall),
        matrices: stopAt,
        count: track.finished ? 1 : 0,
        albedo: colours.trim,
        roughness: 0.5,
      },
      {
        mesh: bar((HALF_WIDTH + SKIN) * 2, OUTLET_BACK * 2, track.wall),
        matrices: backAt,
        count: backs.length,
        albedo: colours.walls,
        roughness: 0.65,
      },
    ];
    // the grid the same dark as the pegs, so it reads as ironwork over the channel and not part of it
    if (grid.vertexCount > 0) {
      groups.push({ mesh: grid.build(), matrices: one, albedo: colours.grid, roughness: 0.5 });
      groups.push({
        mesh: bar((HALF_WIDTH + SKIN) * 2, BAR, BAR),
        matrices: rungAt,
        count: rungs.length / 2,
        albedo: colours.grid,
        roughness: 0.5,
      });
    }
    // a run without a funnel has no bowl to draw, and an empty mesh is not worth a buffer
    if (bowls.vertexCount > 0)
      groups.push({ mesh: bowls.build(), matrices: one, albedo: colours.floor, roughness: 0.6 });
    groups.push(...this.decor(track, dressing));
    return groups;
  }

  /**
   * What a run is dressed with that stands still, a mesh a colour: ironwork,
   * copper pipe, brick, painted tanks, the lamps' bulbs and the stripes'
   * yellow and black; and where each cog turns, noted for `animate`. Nothing
   * where nothing is dressed, so a plain run draws as it always has.
   */
  decor(track: Track, dressing: readonly Decoration[]): GameGroup[] {
    const iron = new MeshBuilder(),
      copper = new MeshBuilder(),
      brick = new MeshBuilder(),
      paint = new MeshBuilder(),
      bulbs = new MeshBuilder(),
      yellow = new MeshBuilder(),
      black = new MeshBuilder();
    // and a sweet factory's
    const candyRed = new MeshBuilder(),
      candyWhite = new MeshBuilder(),
      chocolate = new MeshBuilder(),
      fudge = new MeshBuilder(),
      paper = new MeshBuilder(),
      frosting = new MeshBuilder(),
      cherry = new MeshBuilder();
    // gumdrops and the lollipops' sweets are placed one each, the gumdrops each their colour and the sweets each
    // their colour and swirl
    const gumdrops: number[] = [];
    // the tubes, one after another: where each begins, which way it goes, how long and round, how far along its
    // chain it begins, and which sweet it is; and the donuts, mountains, roofs, trees and clouds, one each
    const tubes: number[] = [];
    const donuts: number[] = [];
    const mountains: number[] = [];
    const roofs: number[] = [];
    // a rounded ring round each tower under its battlements, as the references' towers have
    const rims: number[] = [];
    const trees: number[] = [];
    const clouds: number[] = [];
    const cakeSponge = new MeshBuilder(),
      sponge = new MeshBuilder(),
      earth = new MeshBuilder(),
      water = new MeshBuilder(),
      foam = new MeshBuilder();
    const sweets: number[] = [];
    const h = this.here;
    let cogs = 0,
      whisks = 0;
    // the frame at the spot a thing stands by, worked out afresh for each before it is drawn
    let t: V3 = [0, 0, 0],
      l: V3 = [0, 0, 0],
      u: V3 = [0, 0, 0];
    let off = (across: number, up: number): V3 => [across, 0, up];
    // how each kind is drawn: one for every kind there is, which the compiler holds it to
    const draw: Record<DecorKind, (d: Decoration) => void> = {
      lamp: (d) => {
        // a pole up from beside the wall, an arm in over the middle, a shade and its bulb under it
        const top = d.z + LAMP.height;
        column(iron, d.x, d.y, d.z - 0.3, top + 0.1, LAMP.pole, LAMP.pole, 8);
        const over = off(0, LAMP.height);
        beam(iron, [d.x, d.y, top], over, 0.06);
        const c = Math.cos(d.heading),
          sn = Math.sin(d.heading);
        block(iron, [over[0], over[1], over[2] - 0.12], [c, sn, 0], [-sn, c, 0], [0, 0, 1], 0.28, 0.28, 0.12);
        ball(bulbs, [over[0], over[1], over[2] - 0.34], 0.17);
      },
      pipes: (d) => {
        // two pipes swept along the samples beside the wall, and a flange round each every few units
        const seg = track.segments[d.segment];
        for (const p of PIPES) {
          const across = d.side * (HALF_WIDTH + p.out);
          const ring: [number, number][] = [];
          for (let k = 0; k <= 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            ring.push([across + Math.cos(a) * p.radius, p.up + Math.sin(a) * p.radius]);
          }
          sweep(seg.points, seg.tangents, seg.ups, seg.arc.length, ring, copper);
          for (let a = 0.3; a < d.length; a += 3.2) {
            at(track, d.segment, a, h);
            const [fx, fy, fz] = right(h);
            const c: V3 = [
              h.x + fx * across + h.ux * p.up,
              h.y + fy * across + h.uy * p.up,
              h.z + fz * across + h.uz * p.up,
            ];
            block(
              iron,
              c,
              [h.tx, h.ty, h.tz],
              [-fx, -fy, -fz],
              [h.ux, h.uy, h.uz],
              0.06,
              p.radius + 0.05,
              p.radius + 0.05,
            );
          }
        }
      },
      stripes: (d) => {
        striped(track, d, yellow, black);
      },
      cog: (d) => {
        // noted where each of the pair turns: the big one here, the small one along from it, both on the axle across
        for (const [a, r] of [
          [d.along, COG.big],
          [d.along + COG.apart, COG.small],
        ] as const) {
          at(track, d.segment, a, h);
          const [cx, cy, cz] = right(h);
          const across = d.side * (h.w + COG.out);
          const o = cogs * 9;
          this.cogFrames[o] = h.x + cx * across + h.ux * COG.up;
          this.cogFrames[o + 1] = h.y + cy * across + h.uy * COG.up;
          this.cogFrames[o + 2] = h.z + cz * across + h.uz * COG.up;
          this.cogFrames[o + 3] = h.tx;
          this.cogFrames[o + 4] = h.ty;
          this.cogFrames[o + 5] = h.tz;
          this.cogFrames[o + 6] = r;
          this.cogFrames[o + 7] = d.side;
          this.cogFrames[o + 8] = 0;
          cogs++;
        }
        // an iron plate the pair is bolted to, behind them against the wall
        const back = off(d.side * (h.w + COG.out - 0.12), COG.up);
        block(iron, back, t, l, u, 0.2, 0.03, 0.2);
      },
      piston: (d) => {
        // the cylinder, iron, with a collar at its mouth; its rod moves
        column(iron, d.x, d.y, d.z, d.z + d.height, PISTON.radius, PISTON.radius, 12);
        column(iron, d.x, d.y, d.z + d.height - 0.12, d.z + d.height, PISTON.radius + 0.07, PISTON.radius + 0.07, 12);
      },
      chimney: (d) => {
        // brick up from the ground, narrowing, with an iron band round its top
        column(brick, d.x, d.y, d.z, d.z + d.height, CHIMNEY.radius, CHIMNEY.radius * 0.8, 14);
        column(
          iron,
          d.x,
          d.y,
          d.z + d.height - 0.5,
          d.z + d.height - 0.2,
          CHIMNEY.radius * 0.84,
          CHIMNEY.radius * 0.84,
          14,
        );
      },
      tank: (d) => {
        // a painted tank on the ground, an iron roof, a gauge and a ladder up its side
        column(paint, d.x, d.y, d.z, d.z + d.height, TANK.radius, TANK.radius, 18);
        column(iron, d.x, d.y, d.z + d.height, d.z + d.height + 0.5, TANK.radius + 0.05, 0.15, 18);
        const face: V3 = [
          Math.cos(d.heading + (Math.PI / 2) * d.side),
          Math.sin(d.heading + (Math.PI / 2) * d.side),
          0,
        ];
        // `face` is toward the track: the gauge is on that side, to be read, and the ladder round the back
        const g: V3 = [
          d.x + face[0] * (TANK.radius + 0.03),
          d.y + face[1] * (TANK.radius + 0.03),
          d.z + d.height * 0.6,
        ];
        block(bulbs, g, [face[1], -face[0], 0], face, [0, 0, 1], 0.18, 0.03, 0.18);
        for (const s of [-1, 1]) {
          const rail: V3 = [
            d.x - face[0] * (TANK.radius + 0.12) + face[1] * s * 0.22,
            d.y - face[1] * (TANK.radius + 0.12) - face[0] * s * 0.22,
            0,
          ];
          beam(iron, [rail[0], rail[1], d.z], [rail[0], rail[1], d.z + d.height + 0.3], 0.03);
        }
      },
      girder: (d) => {
        // a girder's leg, and a plate it stands on
        lattice(iron, d.x, d.y, d.z, d.z + d.height, GIRDER.half);
        block(
          iron,
          [d.x, d.y, d.z + 0.04],
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
          GIRDER.half + 0.15,
          GIRDER.half + 0.15,
          0.04,
        );
      },
      lollipop: (d) => {
        // a white stick up from beside the wall and in over the middle, and the sweet hanging at its end, glowing
        const top = d.z + LOLLIPOP.height;
        column(candyWhite, d.x, d.y, d.z - 0.3, top + 0.05, LOLLIPOP.pole, LOLLIPOP.pole, 8);
        const over = off(0, LOLLIPOP.height);
        beam(candyWhite, [d.x, d.y, top], over, 0.05);
        beam(candyWhite, over, [over[0], over[1], over[2] - 0.1], 0.04);
        // facing down the channel, at the field coming along it
        sweets.push(over[0], over[1], over[2] - 0.1 - LOLLIPOP.disc, d.heading + Math.PI / 2, LOLLIPOP.disc, 0);
      },
      candyStripes: (d) => {
        // red and white in turn, low on the wall, as the works' hazard stripes are and for the same reasons
        striped(track, d, candyRed, candyWhite);
      },
      gumdrops: (d) => {
        // a row of them along the outside of the wall, each its own colour
        const seg = track.segments[d.segment];
        for (let a = GUMDROPS.every / 2; a < seg.length; a += GUMDROPS.every) {
          at(track, d.segment, a, h);
          const [gx, gy, gz] = right(h);
          const across = d.side * (h.w + GUMDROPS.out);
          gumdrops.push(
            h.x + gx * across + h.ux * (GUMDROPS.up - GUMDROPS.radius * 0.6),
            h.y + gy * across + h.uy * (GUMDROPS.up - GUMDROPS.radius * 0.6),
            h.z + gz * across + h.uz * (GUMDROPS.up - GUMDROPS.radius * 0.6),
          );
        }
      },
      whisk: (d) => {
        // noted where it turns, as a cog is, and a pink plate it is fixed to behind it against the wall
        const across = d.side * (h.w + WHISK.out);
        const [cx, cy, cz] = right(h);
        const o = whisks * 9;
        this.whiskFrames.set(
          [
            h.x + cx * across + h.ux * WHISK.up,
            h.y + cy * across + h.uy * WHISK.up,
            h.z + cz * across + h.uz * WHISK.up,
            h.tx,
            h.ty,
            h.tz,
            WHISK.reach,
            d.side,
            0,
          ],
          o,
        );
        whisks++;
        block(frosting, off(d.side * (h.w + WHISK.out - 0.15), WHISK.up), t, l, u, 0.16, 0.03, 0.16);
      },
      cane: (d) => {
        // a candy cane's post, one smooth tube its whole height on a white foot
        tubes.push(d.x, d.y, d.z, 0, 0, 1, d.height, CANE.half, 0, CANDY);
        column(candyWhite, d.x, d.y, d.z, d.z + 0.08, CANE.half + 0.14, CANE.half + 0.14, 14);
      },
      arch: () => {
        // up one post, over the channel in a half round, and down the other: a chain of tubes, the stripes carried on
        // round it by how far along the chain each tube begins
        const span = h.w + ARCH.out;
        const path: V3[] = [off(-span, -0.3), off(-span, ARCH.rise)];
        for (let k = 1; k < 16; k++) {
          const t = Math.PI - (k / 16) * Math.PI;
          path.push(off(Math.cos(t) * span, ARCH.rise + Math.sin(t) * span));
        }
        path.push(off(span, ARCH.rise), off(span, -0.3));
        chain(tubes, path, ARCH.thick, CANDY);
      },
      standingLollipop: (d) => {
        // a white stick up beside the wall, and a swirled sweet on it facing along the channel, at the field coming
        const r = STANDING.radius;
        column(candyWhite, d.x, d.y, d.z, d.z + d.height - r, 0.06, 0.06, 8);
        sweets.push(d.x, d.y, d.z + d.height - r, d.heading + Math.PI / 2, r, 0);
      },
      donut: (d) => {
        // lying on the ground, dough under and icing over, each its own icing, as big as the dressing made it
        const big = d.height / (DONUT.tube * 2);
        donuts.push(d.x, d.y, d.z + DONUT.tube * big, big);
      },
      pretzel: (d) => {
        // a baked knot lying on the ground: a loop either side and a twist across the middle
        const big = d.height / (PRETZEL.tube * 2);
        const r = (PRETZEL.radius - PRETZEL.tube) * big;
        const c = Math.cos(d.heading),
          sn = Math.sin(d.heading);
        const path: V3[] = [];
        for (let k = 0; k <= 40; k++) {
          const t = (k / 40) * Math.PI * 2;
          const px = r * Math.sin(2 * t) * 0.95,
            py = r * (0.55 * Math.cos(t) + 0.45 * Math.cos(3 * t));
          path.push([d.x + px * c - py * sn, d.y + px * sn + py * c, d.z + PRETZEL.tube * big]);
        }
        chain(tubes, path, PRETZEL.tube * big, BAKED);
      },
      cake: (d) => {
        // sponge and chocolate in layers, pink icing over the top, and a cherry
        const big = d.height / CAKE.height;
        const r = CAKE.radius * big,
          layer = 0.35 * big;
        for (let k = 0; k < 4; k++)
          column(k % 2 ? chocolate : cakeSponge, d.x, d.y, d.z + k * layer, d.z + (k + 1) * layer, r, r, 22);
        column(frosting, d.x, d.y, d.z + 4 * layer, d.z + 4 * layer + 0.15 * big, r * 1.03, r * 1.03, 22);
        ball(cherry, [d.x, d.y, d.z + d.height - 0.2 * big], 0.2 * big);
      },
      ground: (d) => {
        // the pink ground under everything, as far out as the backdrop goes
        const e = d.length;
        const z = d.z;
        block(earth, [d.x, d.y, z - 0.05], [1, 0, 0], [0, 1, 0], [0, 0, 1], e, e, 0.05);
      },
      river: (d) => {
        // a winding river across the ground, lying a hair over it, with white water at its banks
        const c = Math.cos(d.heading),
          sn = Math.sin(d.heading);
        const at = (t: number, across: number): V3 => {
          const along = t * d.length;
          const wide = across + Math.sin(t * 9) * 6;
          return [d.x + along * c - wide * sn, d.y + along * sn + wide * c, d.z + 0.03];
        };
        for (let k = -40; k < 40; k++) {
          const t0 = k / 40,
            t1 = (k + 1) / 40;
          face(water, at(t0, -3), at(t1, -3), at(t1, 3), at(t0, 3));
          face(foam, at(t0, 3), at(t1, 3), at(t1, 3.6), at(t0, 3.6));
          face(foam, at(t0, -3.6), at(t1, -3.6), at(t1, -3), at(t0, -3));
        }
      },
      mountain: (d) => {
        mountains.push(d.x, d.y, d.z, d.height);
      },
      tower: (d) => {
        // a round tower with battlements, and a swirled cone for a roof
        const r = d.height * 0.16,
          body = d.height * 0.72;
        column(sponge, d.x, d.y, d.z, d.z + body, r, r, 20);
        column(sponge, d.x, d.y, d.z + body - 0.9, d.z + body, r * 1.15, r * 1.15, 20);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          block(
            sponge,
            [d.x + Math.cos(a) * r * 1.08, d.y + Math.sin(a) * r * 1.08, d.z + body + 0.35],
            [Math.cos(a), Math.sin(a), 0],
            [-Math.sin(a), Math.cos(a), 0],
            [0, 0, 1],
            0.3,
            0.4,
            0.35,
          );
        }
        roofs.push(d.x, d.y, d.z + body, r * 1.25);
        rims.push(d.x, d.y, d.z + body - 1.1, r * 1.12);
      },
      tree: (d) => {
        // a chocolate cone on a stub of a trunk
        column(chocolate, d.x, d.y, d.z, d.z + d.height * 0.15, d.height * 0.05, d.height * 0.05, 8);
        trees.push(d.x, d.y, d.z + d.height * 0.15, d.height * 0.85);
      },
      cloud: (d) => {
        // three soft balls of cloud together
        // a puffy heap of balls, the biggest in the middle and smaller round and under it
        for (const [ox, oy, oz, r] of [
          [0, 0, 0.1, 1],
          [0.95, 0.35, -0.2, 0.8],
          [-0.95, -0.25, -0.25, 0.85],
          [0.4, -0.6, -0.3, 0.7],
          [-0.35, 0.65, -0.3, 0.7],
          [1.7, 0, -0.45, 0.55],
          [-1.75, 0.1, -0.5, 0.55],
        ])
          clouds.push(
            d.x + ox * d.height,
            d.y + oy * d.height,
            d.z + d.height * 0.5 + oz * d.height,
            r * d.height * 0.6,
          );
      },
      giantLollipop: (d) => {
        // a tall white stick, and a great swirled sweet on it facing the run
        const r = GIANT.radius;
        column(candyWhite, d.x, d.y, d.z, d.z + d.height - r, GIANT.stick, GIANT.stick, 10);
        const toward = d.heading + (Math.PI / 2) * d.side;
        sweets.push(d.x, d.y, d.z + d.height - r, toward - Math.PI / 2, r, 0);
      },
      fudgePot: (d) => {
        // a dark pot of fudge, its rim a little proud, and its steam rising from the top
        column(chocolate, d.x, d.y, d.z, d.z + POT.height - 0.1, POT.radius, POT.radius * 1.05, 18);
        column(
          chocolate,
          d.x,
          d.y,
          d.z + POT.height - 0.18,
          d.z + POT.height,
          POT.radius * 1.12,
          POT.radius * 1.12,
          18,
        );
        column(
          fudge,
          d.x,
          d.y,
          d.z + POT.height - 0.2,
          d.z + POT.height - 0.05,
          POT.radius * 0.98,
          POT.radius * 0.98,
          18,
        );
      },
      cupcake: (d) => {
        // a paper case widening to its top, frosting piled on it, and a cherry
        const c = CUPCAKE.radius;
        column(paper, d.x, d.y, d.z, d.z + 0.9, c * 0.8, c, 16);
        column(frosting, d.x, d.y, d.z + 0.9, d.z + 1.45, c * 1.05, c * 0.45, 16);
        ball(frosting, [d.x, d.y, d.z + 1.45], c * 0.5);
        ball(cherry, [d.x, d.y, d.z + CUPCAKE.height - 0.2], 0.2);
      },
    };
    for (const d of dressing) {
      at(track, d.segment, d.along, h);
      const [bx, by, bz] = right(h);
      // along, to the left and up make a right hand, which a box's faces are wound by
      t = [h.tx, h.ty, h.tz];
      l = [-bx, -by, -bz];
      u = [h.ux, h.uy, h.uz];
      // read at the spot as it stands when called, as it always was: what turns moves the spot along before it is done
      off = (across: number, up: number): V3 => [
        h.x + bx * across + h.ux * up,
        h.y + by * across + h.uy * up,
        h.z + bz * across + h.uz * up,
      ];
      draw[d.kind](d);
    }
    this.cogCount = cogs;
    this.whiskCount = whisks;
    const one = new Float32Array(16);
    spin(one, 0, 0, 0, 0, 0, 0, 1, 0);
    const groups: GameGroup[] = [];
    const add = (mesh: MeshBuilder, albedo: [number, number, number], roughness: number) => {
      if (mesh.vertexCount > 0) groups.push({ mesh: mesh.build(), matrices: one, albedo, roughness });
    };
    add(iron, [0.16, 0.16, 0.18], 0.5);
    add(copper, [0.72, 0.4, 0.22], 0.35);
    add(brick, [0.5, 0.2, 0.15], 0.85);
    add(paint, [0.25, 0.42, 0.36], 0.55);
    add(bulbs, [1, 0.93, 0.72], 0.25);
    add(yellow, [0.95, 0.72, 0.1], 0.5);
    add(black, [0.06, 0.06, 0.07], 0.6);
    add(candyRed, [0.82, 0.05, 0.08], 0.3);
    add(candyWhite, [0.95, 0.93, 0.9], 0.3);
    add(chocolate, [0.2, 0.1, 0.05], 0.6);
    add(fudge, [0.36, 0.19, 0.08], 0.35);
    add(paper, [0.55, 0.78, 0.92], 0.75);
    add(frosting, [1, 0.78, 0.87], 0.55);
    add(cherry, [0.7, 0.02, 0.05], 0.2);
    // the gumdrops, sugared, each its own colour in turn
    if (gumdrops.length) {
      const n = gumdrops.length / 3;
      const at = new Float32Array(n * 16),
        looks = new Float32Array(n * 4);
      for (let k = 0; k < n; k++) {
        spin(at, k, gumdrops[k * 3], gumdrops[k * 3 + 1], gumdrops[k * 3 + 2], 0, 0, 1, 0, GUMDROPS.radius);
        looks.set([...GUM[k % GUM.length], 0.85], k * 4);
      }
      groups.push({ mesh: dome(0.85), matrices: at, count: n, materials: looks });
    }
    add(sponge, [0.98, 0.6, 0.32], 0.7);
    add(cakeSponge, [1, 0.88, 0.62], 0.75);
    add(earth, [0.98, 0.4, 0.68], 0.95);
    add(water, [0.15, 0.6, 0.98], 0.15);
    add(foam, [0.97, 0.97, 1], 0.6);
    if (tubes.length) groups.push(tubeGroup(tubes));
    if (donuts.length) groups.push(...donutGroups(donuts));
    if (mountains.length) groups.push(...mountainGroups(mountains));
    if (donuts.length || mountains.length) groups.push(sprinkleGroup(mountains, donuts));
    if (roofs.length) groups.push(roofGroup(roofs));
    if (rims.length) {
      const at = new Float32Array((rims.length / 4) * 16);
      for (let k = 0; k < rims.length / 4; k++)
        spin(at, k, rims[k * 4], rims[k * 4 + 1], rims[k * 4 + 2], 0, 0, 1, 0, rims[k * 4 + 3]);
      groups.push({
        mesh: torus(0.12),
        matrices: at,
        count: rims.length / 4,
        albedo: [0.98, 0.72, 0.45],
        roughness: 0.6,
      });
    }
    if (trees.length) groups.push(treeGroup(trees));
    if (clouds.length) groups.push(cloudGroup(clouds));
    // the lollipops' sweets, upright and facing the way given, each a swirl of its colour and white
    if (sweets.length) {
      const n = sweets.length / 6;
      const at = new Float32Array(n * 16),
        looks = new Float32Array(n * 4),
        swirls = new Float32Array(n * PATTERN_STRIDE);
      for (let k = 0; k < n; k++) {
        const [x, y, z, face, r] = sweets.slice(k * 6, k * 6 + 5);
        // its face across `face`, upright: x along the way it faces across, z up, and its own axis y the way it faces
        const c = Math.cos(face),
          sn = Math.sin(face);
        basis(at, k, x, y, z, c, sn, 0, 0, 0, 1, sn, -c, 0, r);
        looks.set([...GUM[k % GUM.length], 0.25], k * 4);
        swirls.set([1, 1.6, (k * 0.37) % 1, 0, 0.97, 0.95, 0.92, 0], k * PATTERN_STRIDE);
      }
      groups.push({ mesh: disc(0.3), matrices: at, count: n, materials: looks, patterns: swirls });
    }
    return groups;
  }
  private cogCount = 0;

  /**
   * What of a run's dressing moves, where the clock has it at `t` seconds:
   * the cogs turning, a big one each way and its small one back the faster,
   * the pistons' rods out and in, and the smoke rising from every chimney.
   * How many of each: the cogs, the rods and the puffs. Written in place and
   * making nothing, since it is every frame.
   */
  animate(dressing: readonly Decoration[], t: number): [number, number, number, number] {
    const turn = cogTurn(t);
    for (let k = 0; k < this.cogCount; k++) {
      // the big one turns one way; the small one, meshed with it, the other and faster by as much as it is smaller
      const angle = k % 2 === 0 ? turn : -turn * (COG.big / COG.small) + Math.PI / 12;
      turned(this.cogs, k, this.cogFrames, angle);
    }
    // a whisk turns faster than a cog, and each a little out of step with the next
    for (let k = 0; k < this.whiskCount; k++) turned(this.whisks, k, this.whiskFrames, turn * 3 + k * 0.7);
    let rods = 0,
      puffs = 0;
    for (const d of dressing) {
      if (d.kind === 'piston' && rods < MOST.piston) {
        spin(this.rods, rods++, d.x, d.y, d.z + d.height - 1 + rodOut(d, t), 0, 0, 1, 0);
      } else if ((d.kind === 'chimney' || d.kind === 'fudgePot') && puffs < (MOST.chimney + MOST.fudgePot) * PUFFS) {
        const grey = d.kind === 'chimney' ? SMOKE : STEAM;
        for (let j = 0; j < PUFFS; j++) {
          const p = puffOf(d, j, t, this.puff);
          const o = puffs++ * SPRITE_STRIDE;
          this.smoke[o] = p[0];
          this.smoke[o + 1] = p[1];
          this.smoke[o + 2] = p[2];
          this.smoke[o + 3] = p[3];
          this.smoke[o + 4] = grey[0];
          this.smoke[o + 5] = grey[1];
          this.smoke[o + 6] = grey[2];
          this.smoke[o + 7] = p[4];
        }
      }
    }
    return [this.cogCount, rods, puffs, this.whiskCount];
  }

  /** What moves: the marbles, then the sweepers, the gates and the wheels, each pool sized once. */
  dynamic(): GameGroup[] {
    return [
      { mesh: sphere(RADIUS), matrices: this.marbles, count: 0, materials: this.looks, patterns: this.patterns },
      {
        mesh: bar(2 * 1.3 + 2 * 0.28, 0.56, PADDLE_HEIGHT),
        matrices: this.sweepers,
        count: 0,
        albedo: [0.85, 0.36, 0.08],
        roughness: 0.45,
      },
      { mesh: bar(1, 0.4, GATE_HEIGHT), matrices: this.gates, count: 0, albedo: [0.7, 0.1, 0.08], roughness: 0.5 },
      {
        mesh: wheel(WHEEL.arm, WHEEL.half * 2, 4),
        matrices: this.wheels,
        count: 0,
        albedo: [0.68, 0.5, 0.16],
        roughness: 0.3,
      },
      // the gold of the board's own highlights, so it reads as the builder's and not as part of the run
      {
        mesh: cone(MARK.radius, MARK.height),
        matrices: this.marker,
        count: 0,
        albedo: [0.95, 0.72, 0.2],
        roughness: 0.4,
      },
      // brass cogs and a steel rod in each piston; the smoke is sprites, which the renderer draws apart from these
      { mesh: cog(12, COG.thick), matrices: this.cogs, count: 0, albedo: [0.72, 0.56, 0.26], roughness: 0.35 },
      { mesh: post(0.1, 1.2), matrices: this.rods, count: 0, albedo: [0.72, 0.74, 0.78], roughness: 0.25 },
      { mesh: whisk(), matrices: this.whisks, count: 0, albedo: [0.82, 0.83, 0.86], roughness: 0.2 },
    ];
  }

  /**
   * The marker over `end`, where the next piece of a run being built goes:
   * a cone point up, standing clear over the walls and any grid, over the
   * end of whichever segment of `track` ends there. How many to draw: one,
   * or none where nothing is being built or nothing ends there.
   */
  mark(track: Track, end: { x: number; y: number; z: number } | null): number {
    if (!end) return 0;
    // a segment ends where a piece hands on, its cell and level times the lattice's, lowered by the lean for however
    // far along the run it is; of the segments ending over that cell, the one lowered by as much as that says
    const x = end.x * CELL,
      y = end.y * CELL,
      z = end.z * LEVEL;
    let best = Infinity,
      found = -1;
    for (let k = 0; k < track.segments.length; k++) {
      const seg = track.segments[k];
      const o = seg.points.length - 3;
      if (Math.abs(seg.points[o] - x) > 1e-3 || Math.abs(seg.points[o + 1] - y) > 1e-3) continue;
      const off = Math.abs(seg.points[o + 2] - (z - LEAN * (seg.start + seg.length)));
      if (off < best) {
        best = off;
        found = k;
      }
    }
    if (found < 0) return 0;
    const { points } = track.segments[found];
    const o = points.length - 3;
    spin(this.marker, 0, points[o], points[o + 1], points[o + 2] + MARK.over, 0, 0, 1, 0);
    return 1;
  }

  /**
   * Something placed on a segment at `along` and `across`, `lift` up off the
   * floor, lying at `angle` from the way the piece goes and, where `tilt` is
   * given, turned about the way across by it: a peg stands, a paddle and a
   * bar lie across the floor, a wheel turns about its axle. `length`
   * stretches it along its own x, which only a box may be: its faces' normals
   * lie along its own axes, and the shader makes them unit again, so a
   * stretched box is lit as a longer one would be.
   */
  private onTrack(
    track: Track,
    out: Float32Array,
    i: number,
    segment: number,
    along: number,
    across: number,
    lift: number,
    angle: number,
    tilt = 0,
    length = 1,
  ) {
    const h = at(track, segment, along, this.here);
    // across the channel, to the right of the way it goes
    const bx = h.ty * h.uz - h.tz * h.uy,
      by = h.tz * h.ux - h.tx * h.uz,
      bz = h.tx * h.uy - h.ty * h.ux;
    const x = h.x + bx * across + h.ux * lift,
      y = h.y + by * across + h.uy * lift,
      z = h.z + bz * across + h.uz * lift;
    const c = Math.cos(angle),
      s = Math.sin(angle);
    // the thing's own x lies at `angle` in the floor; its z is up; its y makes a right hand of the two
    let ax = h.tx * c + bx * s,
      ay = h.ty * c + by * s,
      az = h.tz * c + bz * s;
    let ux = h.ux,
      uy = h.uy,
      uz = h.uz;
    if (tilt !== 0) {
      // turned about the way across: the thing's x and z swing round together in the plane they share
      const ct = Math.cos(tilt),
        st = Math.sin(tilt);
      const nx = ax * ct + ux * st,
        ny = ay * ct + uy * st,
        nz = az * ct + uz * st;
      ux = -ax * st + ux * ct;
      uy = -ay * st + uy * ct;
      uz = -az * st + uz * ct;
      ax = nx;
      ay = ny;
      az = nz;
    }
    basis(
      out,
      i,
      x,
      y,
      z,
      ax * length,
      ay * length,
      az * length,
      uy * az - uz * ay,
      uz * ax - ux * az,
      ux * ay - uy * ax,
      ux,
      uy,
      uz,
    );
  }

  /** A roll to read into, so drawing a marble makes nothing. */
  private readonly turned: Roll = { ax: 0, ay: 0, az: 0, angle: 0 };

  /** Every marble where it is this frame, turned as the race has it: how many were placed. */
  write(marbles: Race): number {
    for (let i = 0; i < marbles.count; i++) {
      const r = marbles.roll(i, this.turned);
      spin(this.marbles, i, marbles.x[i], marbles.y[i], marbles.z[i], r.ax, r.ay, r.az, r.angle);
    }
    return marbles.count;
  }

  /**
   * The moving parts where they are at the race's own time: the sweepers'
   * paddles across the board, the gates' bars slid shut or aside, and the
   * wheels turned. How many of each there are.
   */
  moving(marbles: Race): [number, number, number] {
    const { track } = marbles;
    const phase = (ob: Obstacle) => (ob.slot >= 0 ? marbles.phase[ob.slot] : 0);
    // where the race says a part is: a part is a body a jammed ball can hold back, and
    // is drawn where it is, not where its clockwork would have it
    const now = (part: Part): Pose => {
      const p = pose(part.ob, marbles.t, phase(part.ob), this.at);
      const really = marbles.where?.(part.ob);
      if (really !== undefined) p.across = really;
      return p;
    };
    this.sweeping.slice(0, MOVING_MOST).forEach((part, k) => {
      const p = now(part);
      this.onTrack(track, this.sweepers, k, part.segment, p.along, p.across, 0, part.ob.angle);
    });
    // a gate is drawn only as far as it is in the pen: the rest has gone into the wall, the way a pocket door does
    let gates = 0;
    for (const part of this.gating.slice(0, MOVING_MOST)) {
      const p = now(part);
      const w = widthAt(track, part.segment, p.along);
      const from = Math.max(-w, p.across - p.half),
        to = Math.min(w, p.across + p.half);
      if (to - from < 0.02) continue;
      this.onTrack(track, this.gates, gates++, part.segment, p.along, (from + to) / 2, 0, part.ob.angle, 0, to - from);
    }
    this.turning.slice(0, MOVING_MOST).forEach((part, k) => {
      const m = part.ob.motion as { period: number; axle: number };
      // the first paddle's own angle from straight down turns the whole wheel
      const f = (((marbles.t / m.period + phase(part.ob)) % 1) + 1) % 1;
      const theta = marbles.where?.(part.ob) ?? Math.PI * 2 * f - Math.PI;
      this.onTrack(track, this.wheels, k, part.segment, part.ob.along, part.ob.across, RADIUS + m.axle, 0, theta);
    });
    return [
      Math.min(MOVING_MOST, this.sweeping.length),
      Math.min(MOVING_MOST, this.gating.length),
      Math.min(MOVING_MOST, this.turning.length),
    ];
  }
}

/** What `sweep` leaves out of a lane whose walls are open along `open`: the side's wall, where open at both ends. */
function openWall(open: Uint8Array, strips: number): (i: number, k: number) => boolean {
  const left = leftWall(strips),
    right = rightWall(strips);
  return (i, k) => {
    const both = open[i] & open[i + 1];
    return (both & 1 ? left.includes(k) : false) || (both & 2 ? right.includes(k) : false);
  };
}
