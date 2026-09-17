/**
 * The track: what a run of pieces becomes once it is worked out, so a marble
 * can ride it and the page can draw it.
 *
 * A run is a list of pieces placed on a lattice of whole numbers. Compiling
 * one walks it from the start gate through the portals, and gives back a
 * chain of segments: a sampled centre line with a frame and a distance along
 * it at every sample. Whole numbers are the point — a placement is exact, so
 * two joins that should meet do meet, and the same run gives the same track
 * to the last bit, every time, on every machine.
 *
 * Every portal is level and square to the lattice, and a piece does its
 * descending and its turning inside itself. That is what keeps the placement
 * arithmetic in whole numbers, and it is how the pieces of the real toy join
 * too.
 *
 * Nothing here knows about the renderer, the page, or chance. Compiling is
 * arithmetic and nothing else, which is what lets the same run be drawn, be
 * raced and be held to a figure without any of the three disagreeing.
 */

/** How far apart the lattice's points are, across. */
export const CELL = 6;
/** How far a piece drops when it goes down a level. */
export const LEVEL = 4;
/** How wide the channel is from its middle to its wall. */
export const HALF_WIDTH = 1.2;
/** How far apart the samples along a centre line are, near enough. */
export const SAMPLE_EVERY = 0.25;
/** The most pieces a run may have, and the most samples a track may come to. */
export const MAX_PIECES = 100;
export const MAX_SAMPLES = 6000;

/**
 * Which way a portal faces: a quarter turn anticlockwise from +x, so 0 is
 * +x, 1 is +y, 2 is -x and 3 is -y. A marble leaves a portal going this way.
 */
export type Facing = 0 | 1 | 2 | 3;

/** The kinds of piece there are. A new kind is a line in `SHAPES` and nothing else. */
export type Kind = 'start' | 'straight' | 'ramp' | 'curveLeft' | 'curveRight' | 'finish';

/** A piece as it was placed: which kind, which lattice point it enters at, and which way it faces. */
export interface Placed {
  kind: Kind;
  /** The lattice point the piece's entry portal sits at. */
  x: number;
  y: number;
  z: number;
  facing: Facing;
}

/** A run: a name and the pieces it is made of. Predefined runs and the player's own are the same shape. */
export interface Run {
  name: string;
  pieces: Placed[];
}

/** A stretch of track from one piece, sampled: where it goes, which way, and how far along. */
export interface Segment {
  /** Which piece of the run it came from. */
  piece: number;
  /** Where the centre line is at each sample, three numbers each. */
  points: Float32Array;
  /** Which way a marble is going at each sample, three numbers each, of unit length. */
  tangents: Float32Array;
  /** Which way is up out of the channel at each sample, three numbers each, of unit length. */
  ups: Float32Array;
  /** How far along the segment each sample is. */
  arc: Float32Array;
  /** How long the segment is. */
  length: number;
  /** How far along the whole run the segment begins: what orders one marble against another. */
  start: number;
  /** The segment a marble goes on to when it runs off the end, or -1 where the run finishes. */
  next: number;
}

/** A whole run worked out: the segments in the order a marble meets them. */
export interface Track {
  name: string;
  segments: Segment[];
  /** How long the run is, end to end. */
  length: number;
  /** How many samples it came to, all told: what `MAX_SAMPLES` is a ceiling on. */
  samples: number;
}

/** Somewhere on the track: where it is, which way it goes, and which way is up. */
export interface Spot {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  ux: number;
  uy: number;
  uz: number;
}

/** A spot to read into, so reading one makes nothing. */
export function spot(): Spot {
  return { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, ux: 0, uy: 0, uz: 0 };
}

/**
 * A piece's shape, in its own terms: entry at the origin heading +x, up +z.
 * `exit` is where the next piece's entry portal sits, in lattice points, and
 * how many quarter turns the marble has made by then; a piece with no exit is
 * where a run ends. `curve` is the centre line, from t=0 at the entry to t=1
 * at the exit, with the direction of travel beside it. `rough` is only how
 * long it is about, to decide how many samples to take.
 */
interface Shape {
  exit: { x: number; y: number; z: number; turn: number } | null;
  rough: number;
  curve(t: number, out: number[]): void;
}

/** A level run straight through: the start gate and the cup are this too, since both are somewhere a marble sits. */
function straightCurve(t: number, out: number[]): void {
  out[0] = CELL * t;
  out[1] = 0;
  out[2] = 0;
  out[3] = 1;
  out[4] = 0;
  out[5] = 0;
}

/**
 * A quarter turn, of the lattice's own radius, so it starts and ends square
 * to it. `side` is +1 to the left and -1 to the right.
 */
function turnCurve(side: number, t: number, out: number[]): void {
  // by how much it has come round so far, which keeps both turns one formula and the ends square to the lattice
  const phi = (Math.PI / 2) * t;
  out[0] = CELL * Math.sin(phi);
  out[1] = side * CELL * (1 - Math.cos(phi));
  out[2] = 0;
  out[3] = Math.cos(phi);
  out[4] = side * Math.sin(phi);
  out[5] = 0;
}

/**
 * The start gate's own slope: steep from the top and easing to level at the
 * exit. Nothing joins a start piece above, so its top end is free to be
 * steep — and it has to be, because a marble parked on a piece that is flat
 * where it stands feels no pull at all and never sets off.
 */
function launchCurve(t: number, out: number[]): void {
  out[0] = CELL * t;
  out[1] = 0;
  out[2] = -LEVEL * Math.sin((Math.PI * t) / 2);
  out[3] = CELL;
  out[4] = 0;
  out[5] = (-LEVEL * Math.PI * Math.cos((Math.PI * t) / 2)) / 2;
}

/**
 * A level down, eased in and out, so the ends are flat and join a level piece
 * without a kink in them. A kink is a marble catching on a seam, so the ease
 * is not a nicety.
 */
function rampCurve(t: number, out: number[]): void {
  out[0] = CELL * t;
  out[1] = 0;
  out[2] = (-LEVEL * (1 - Math.cos(Math.PI * t))) / 2;
  out[3] = CELL;
  out[4] = 0;
  out[5] = (-LEVEL * Math.PI * Math.sin(Math.PI * t)) / 2;
}

/** Every kind of piece there is. A new kind is a line here, and every path over the kinds gets it for nothing. */
const SHAPES: Record<Kind, Shape> = {
  start: {
    exit: { x: 1, y: 0, z: -1, turn: 0 },
    rough: Math.hypot(CELL, LEVEL) * 1.1,
    curve: launchCurve,
  },
  straight: { exit: { x: 1, y: 0, z: 0, turn: 0 }, rough: CELL, curve: straightCurve },
  ramp: {
    exit: { x: 1, y: 0, z: -1, turn: 0 },
    rough: Math.hypot(CELL, LEVEL) * 1.1,
    curve: rampCurve,
  },
  curveLeft: {
    exit: { x: 1, y: 1, z: 0, turn: 1 },
    rough: (Math.PI / 2) * CELL,
    curve: (t, out) => turnCurve(1, t, out),
  },
  curveRight: {
    exit: { x: 1, y: -1, z: 0, turn: -1 },
    rough: (Math.PI / 2) * CELL,
    curve: (t, out) => turnCurve(-1, t, out),
  },
  finish: { exit: null, rough: CELL, curve: straightCurve },
};

/** A piece's own x and y turned to face whichever way it was placed. */
function turnBy(facing: Facing, x: number, y: number, out: number[]): void {
  switch (facing) {
    case 0:
      out[0] = x;
      out[1] = y;
      return;
    case 1:
      out[0] = -y;
      out[1] = x;
      return;
    case 2:
      out[0] = -x;
      out[1] = -y;
      return;
    case 3:
      out[0] = y;
      out[1] = -x;
      return;
  }
}

/** Where a piece hands a marble on, and which way it is going by then; nothing where the run ends. */
export function exitOf(piece: Placed): { x: number; y: number; z: number; facing: Facing } | null {
  const { exit } = SHAPES[piece.kind];
  if (!exit) return null;
  const turned: number[] = [0, 0];
  turnBy(piece.facing, exit.x, exit.y, turned);
  return {
    x: piece.x + turned[0],
    y: piece.y + turned[1],
    z: piece.z + exit.z,
    facing: ((((piece.facing + exit.turn) % 4) + 4) % 4) as Facing,
  };
}

/** Which portal a piece is at, as one string, so a run can be walked by looking its joins up. */
function portalKey(x: number, y: number, z: number, facing: Facing): string {
  return `${x},${y},${z},${facing}`;
}

/** One piece sampled into a segment, in the world's own units. */
function sample(piece: Placed, index: number): Segment {
  const shape = SHAPES[piece.kind];
  const n = Math.max(8, Math.ceil(shape.rough / SAMPLE_EVERY)) + 1;
  const points = new Float32Array(n * 3),
    tangents = new Float32Array(n * 3),
    ups = new Float32Array(n * 3),
    arc = new Float32Array(n);
  const ox = piece.x * CELL,
    oy = piece.y * CELL,
    oz = piece.z * LEVEL;
  const local: number[] = [0, 0, 0, 0, 0, 0];
  const turned: number[] = [0, 0];
  for (let i = 0; i < n; i++) {
    shape.curve(i / (n - 1), local);
    turnBy(piece.facing, local[0], local[1], turned);
    const o = i * 3;
    points[o] = ox + turned[0];
    points[o + 1] = oy + turned[1];
    points[o + 2] = oz + local[2];
    turnBy(piece.facing, local[3], local[4], turned);
    const tl = Math.hypot(turned[0], turned[1], local[5]) || 1;
    const tx = turned[0] / tl,
      ty = turned[1] / tl,
      tz = local[5] / tl;
    tangents[o] = tx;
    tangents[o + 1] = ty;
    tangents[o + 2] = tz;
    // up is straight up with whatever leans along the track taken out of it, so the channel never rolls of its own accord
    let ux = -tx * tz,
      uy = -ty * tz,
      uz = 1 - tz * tz;
    const ul = Math.hypot(ux, uy, uz);
    // a piece heading straight up or down has no up of its own; none of these has, but a later one might
    if (ul < 1e-6) {
      ux = 1;
      uy = 0;
      uz = 0;
    } else {
      ux /= ul;
      uy /= ul;
      uz /= ul;
    }
    ups[o] = ux;
    ups[o + 1] = uy;
    ups[o + 2] = uz;
    if (i > 0)
      arc[i] =
        arc[i - 1] +
        Math.hypot(points[o] - points[o - 3], points[o + 1] - points[o - 2], points[o + 2] - points[o - 1]);
  }
  return { piece: index, points, tangents, ups, arc, length: arc[n - 1], start: 0, next: -1 };
}

/**
 * A run worked out into a track: walked from the start gate, piece by piece,
 * until it reaches a cup or runs out of track. A run with something wrong
 * with it gives back as much as could be walked rather than throwing, since
 * a player building one has a broken run in front of them most of the time;
 * `check` is what says what is wrong with it.
 */
export function compile(run: Run): Track {
  const track: Track = { name: run.name, segments: [], length: 0, samples: 0 };
  const entries = new Map<string, number>();
  run.pieces.forEach((p, i) => {
    if (p.kind === 'start') return;
    entries.set(portalKey(p.x, p.y, p.z, p.facing), i);
  });
  let index = run.pieces.findIndex((p) => p.kind === 'start');
  const seen = new Set<number>();
  while (index >= 0 && !seen.has(index) && track.segments.length < MAX_PIECES) {
    seen.add(index);
    const segment = sample(run.pieces[index], index);
    segment.start = track.length;
    if (track.segments.length > 0) track.segments[track.segments.length - 1].next = track.segments.length;
    track.segments.push(segment);
    track.length += segment.length;
    track.samples += segment.arc.length;
    const out = exitOf(run.pieces[index]);
    index = out ? (entries.get(portalKey(out.x, out.y, out.z, out.facing)) ?? -1) : -1;
  }
  return track;
}

/** Where along the track a distance falls: the sample at or before it. */
function find(arc: Float32Array, s: number): number {
  let lo = 0,
    hi = arc.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arc[mid] <= s) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Somewhere on the track, `s` along its segment: read between the samples either side of it. */
export function at(track: Track, segment: number, s: number, out: Spot = spot()): Spot {
  const seg = track.segments[segment];
  const along = Math.min(Math.max(s, 0), seg.length);
  const i = Math.min(find(seg.arc, along), seg.arc.length - 2);
  const span = seg.arc[i + 1] - seg.arc[i];
  const f = span > 1e-12 ? (along - seg.arc[i]) / span : 0;
  const a = i * 3,
    b = a + 3;
  out.x = seg.points[a] + (seg.points[b] - seg.points[a]) * f;
  out.y = seg.points[a + 1] + (seg.points[b + 1] - seg.points[a + 1]) * f;
  out.z = seg.points[a + 2] + (seg.points[b + 2] - seg.points[a + 2]) * f;
  const tx = seg.tangents[a] + (seg.tangents[b] - seg.tangents[a]) * f,
    ty = seg.tangents[a + 1] + (seg.tangents[b + 1] - seg.tangents[a + 1]) * f,
    tz = seg.tangents[a + 2] + (seg.tangents[b + 2] - seg.tangents[a + 2]) * f;
  // between two samples a direction comes out short, so it is made unit again rather than left to shrink
  const tl = Math.hypot(tx, ty, tz) || 1;
  out.tx = tx / tl;
  out.ty = ty / tl;
  out.tz = tz / tl;
  const ux = seg.ups[a] + (seg.ups[b] - seg.ups[a]) * f,
    uy = seg.ups[a + 1] + (seg.ups[b + 1] - seg.ups[a + 1]) * f,
    uz = seg.ups[a + 2] + (seg.ups[b + 2] - seg.ups[a + 2]) * f;
  const ul = Math.hypot(ux, uy, uz) || 1;
  out.ux = ux / ul;
  out.uy = uy / ul;
  out.uz = uz / ul;
  return out;
}

/**
 * What is wrong with a run, in the player's terms, a line each: this is what
 * the designer shows while a run is being built, so it says what is wrong and
 * not merely that something is.
 *
 * Two pieces are in the same place when they stand at the same lattice point.
 * That catches the mistake a builder actually makes; two pieces whose bodies
 * cross without sharing a point are not caught yet, and want the real
 * geometry the designer will have.
 */
export function check(run: Run): string[] {
  const problems: string[] = [];
  if (run.pieces.length > MAX_PIECES)
    problems.push(`a run may have ${MAX_PIECES} pieces, and this one has ${run.pieces.length}`);

  const starts = run.pieces.filter((p) => p.kind === 'start').length;
  if (starts === 0) problems.push('there is no start for a marble to leave from');
  else if (starts > 1) problems.push(`there are ${starts} starts, and a run may have one`);

  const standing = new Map<string, number>();
  run.pieces.forEach((p, i) => {
    const key = `${p.x},${p.y},${p.z}`;
    const other = standing.get(key);
    if (other === undefined) standing.set(key, i);
    else problems.push(`pieces ${other} and ${i} are in the same place, at ${key}`);
  });

  const exits = new Set<string>();
  for (const p of run.pieces) {
    const out = exitOf(p);
    if (out) exits.add(portalKey(out.x, out.y, out.z, out.facing));
  }
  run.pieces.forEach((p, i) => {
    if (p.kind === 'start') return;
    if (!exits.has(portalKey(p.x, p.y, p.z, p.facing))) problems.push(`piece ${i}, a ${p.kind}, joins nothing`);
  });

  // walk it as a marble would, which is the only way to tell a run that ends from one that goes round for ever
  if (starts > 0) {
    const entries = new Map<string, number>();
    run.pieces.forEach((p, i) => {
      if (p.kind !== 'start') entries.set(portalKey(p.x, p.y, p.z, p.facing), i);
    });
    let index = run.pieces.findIndex((p) => p.kind === 'start');
    const seen = new Set<number>();
    let ends: Placed | null = null;
    while (index >= 0) {
      if (seen.has(index)) {
        problems.push('the run never ends: it comes back round on itself');
        break;
      }
      seen.add(index);
      const piece = run.pieces[index];
      const out = exitOf(piece);
      if (!out) {
        ends = piece;
        break;
      }
      index = entries.get(portalKey(out.x, out.y, out.z, out.facing)) ?? -1;
    }
    if (!ends && !problems.some((p) => p.includes('never ends')))
      problems.push('there is no finish: the track stops in mid air');
  } else if (!run.pieces.some((p) => p.kind === 'finish')) {
    problems.push('there is no finish for a marble to stop in');
  }

  return problems;
}

/**
 * What must hold of a track once it is worked out, a line each. These are the
 * rules the game checks as it plays, and they are here rather than in the
 * invariants because they are the track's own business.
 */
export function checkTrack(track: Track): string[] {
  const problems: string[] = [];
  if (track.samples > MAX_SAMPLES)
    problems.push(`the track came to ${track.samples} samples, past the ${MAX_SAMPLES} it may`);
  track.segments.forEach((seg, i) => {
    if (seg.next !== -1 && (seg.next < 0 || seg.next >= track.segments.length))
      problems.push(`segment ${i} goes on to ${seg.next}, which is not a segment`);
    if (!(seg.length > 0)) problems.push(`segment ${i} is ${seg.length} long`);
    const before = i === 0 ? 0 : track.segments[i - 1].start + track.segments[i - 1].length;
    if (Math.abs(seg.start - before) > 1e-4)
      problems.push(`segment ${i} begins ${seg.start} along, and the one before ends ${before}`);
    if (seg.arc[0] !== 0) problems.push(`segment ${i} starts ${seg.arc[0]} along itself`);
    for (let k = 1; k < seg.arc.length; k++) {
      if (!(seg.arc[k] > seg.arc[k - 1])) {
        problems.push(`segment ${i} does not go forward at sample ${k}`);
        break;
      }
    }
    for (let k = 0; k < seg.arc.length; k++) {
      const o = k * 3;
      const t = Math.hypot(seg.tangents[o], seg.tangents[o + 1], seg.tangents[o + 2]);
      const u = Math.hypot(seg.ups[o], seg.ups[o + 1], seg.ups[o + 2]);
      // up leaning along the track would tip a marble by itself, so it has to stay square to it
      const square =
        seg.tangents[o] * seg.ups[o] + seg.tangents[o + 1] * seg.ups[o + 1] + seg.tangents[o + 2] * seg.ups[o + 2];
      if (
        !Number.isFinite(t) ||
        Math.abs(t - 1) > 1e-3 ||
        !Number.isFinite(u) ||
        Math.abs(u - 1) > 1e-3 ||
        Math.abs(square) > 1e-3
      ) {
        problems.push(`segment ${i} has no sound frame at sample ${k}`);
        break;
      }
    }
    if (seg.next >= 0 && seg.next < track.segments.length) {
      const to = track.segments[seg.next];
      const last = seg.points.length - 3;
      const gap = Math.hypot(
        seg.points[last] - to.points[0],
        seg.points[last + 1] - to.points[1],
        seg.points[last + 2] - to.points[2],
      );
      if (gap > 1e-6) problems.push(`segment ${i} leaves a gap of ${gap} before ${seg.next}`);
    }
  });
  return problems;
}
