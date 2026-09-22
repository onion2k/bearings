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
/** The most segments a track may come to: a piece is at most two parts. */
export const MAX_SEGMENTS = MAX_PIECES * 2;
/**
 * The most sweepers, gates or wheels a run may have of each, which is as many
 * as the scene has room to draw: a run with one more would race a part nobody
 * could see.
 */
export const MOVING_MOST = 6;
export const MAX_SAMPLES = 6000;

/**
 * Which way a portal faces: a quarter turn anticlockwise from +x, so 0 is
 * +x, 1 is +y, 2 is -x and 3 is -y. A marble leaves a portal going this way.
 */
export type Facing = 0 | 1 | 2 | 3;

/** The kinds of piece there are. A new kind is a line in `SHAPES` and nothing else. */
export type Kind =
  | 'start'
  | 'straight'
  | 'ramp'
  | 'drop'
  | 'curveLeft'
  | 'curveRight'
  | 'spiralLeft'
  | 'spiralRight'
  | 'jump'
  | 'pegs'
  | 'sweeper'
  | 'gate'
  | 'wheel'
  | 'funnel'
  | 'splitter'
  | 'joiner'
  | 'shallow'
  | 'shallowWide'
  | 'shallowBroad'
  | 'narrow'
  | 'bumps'
  | 'finish';

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
  /** What a save knows it by: never changed once a run is out, whatever it is called or wherever it is listed. */
  id: string;
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
  /**
   * Whether it ends in the air: the lip of a jump, where a marble leaves the
   * track and has to come down on the next segment. `gap` is how far there is
   * to go through the air, across the ground, to where the next one begins.
   */
  flies: boolean;
  gap: number;
  /** How far the channel reaches from its middle to its wall at each sample: a board is wide, a chute is not. */
  width: Float32Array;
  /** What is in the way on it, in its own terms: pegs, and the parts that move. */
  obstacles: Obstacle[];
  /** Where it is a bowl and not a channel: a marble circles it, and leaves by the hole in its middle. */
  funnel: Bowl | null;
  /** Low rounded lumps in its floor, which a marble rolls up over and is turned aside by. */
  mounds: Mound[];
  /** Felt from its start to `upto` along it, bringing any marble on it to `speed`; null where there is none. */
  felt: { upto: number; speed: number } | null;
  /** How far along the whole run the segment begins: what orders one marble against another. */
  start: number;
  /** The segment a marble goes on to when it runs off the end, or -1 where the run finishes. */
  next: number;
  /**
   * The segment it came from, explicitly: usually the one before it in `segments`, but not always, once a
   * splitter's two branches and a joiner's two entries mean a piece is not always fed by whatever was sampled
   * right before it. -1 where nothing feeds it, at the very start of the run.
   */
  prev: number;
  /**
   * Where a splitter hands the field on: `a` to whatever is left of the channel's middle as the field reaches
   * it, `b` to whatever is right of it, in place of `next`, which is left at -1 for a segment that forks.
   */
  fork: { a: number; b: number } | null;
  /**
   * Which side of a split the segment is on, so the two never jostle each other on their way to a joiner: 0 for
   * a segment that is nobody's branch, and otherwise a number no other branch shares, set the same for every
   * segment between a splitter and the joiner that closes it.
   */
  branch: number;
}

/** A whole run worked out: the segments in the order a marble meets them. */
export interface Track {
  name: string;
  segments: Segment[];
  /** How long the run is, end to end. */
  length: number;
  /** How many samples it came to, all told: what `MAX_SAMPLES` is a ceiling on. */
  samples: number;
  /** How many moving pieces keep time of their own: a race starts each somewhere in its turn. */
  slots: number;
}

/**
 * How a thing in the way moves. A peg does not. A sweeper swings across the
 * board and back. A gate is shut for part of every turn, then slides aside
 * over `slide` seconds toward one wall, the other wall on the next turn, and
 * back. A wheel's paddle comes down into the chute, goes along it the way the
 * marbles go, and lifts out again: `turn` is which of the wheel's paddles it
 * is, as a share of the way round, and `axle` how high the axle stands above
 * a marble's middle, and `arm` how long the paddle is.
 */
export type Motion =
  | { kind: 'fixed' }
  | { kind: 'sweep'; reach: number; period: number }
  | { kind: 'gate'; shut: number; period: number; slide: number }
  | { kind: 'paddle'; period: number; turn: number; axle: number; arm: number };

/**
 * A lump in the floor of a piece, in its own terms: its middle, how far it
 * spreads, and how high it stands there. It rises from the floor as a cosine
 * does from its trough, so there is no edge for a marble to catch on: only a
 * slope, steepest half way up, that a marble climbs and is turned down off.
 */
export interface Mound {
  along: number;
  across: number;
  radius: number;
  height: number;
}

/** How high the floor stands over the mounds at a point on a piece: nothing where there are none. */
export function moundHeight(seg: Segment, along: number, across: number): number {
  let h = 0;
  for (const m of seg.mounds) {
    const d = Math.hypot(along - m.along, across - m.across);
    if (d < m.radius) h = Math.max(h, m.height * Math.cos((Math.PI * d) / (2 * m.radius)) ** 2);
  }
  return h;
}

/**
 * Which way the floor slopes over the mounds at a point, along and across,
 * as how far it rises for a step each way: the steepest of the mounds there,
 * where two overlap, as the floor itself is the higher of them.
 */
export function moundSlope(seg: Segment, along: number, across: number, out: [number, number]): [number, number] {
  out[0] = 0;
  out[1] = 0;
  let top = 0;
  for (const m of seg.mounds) {
    const da = along - m.along,
      dc = across - m.across;
    const d = Math.hypot(da, dc);
    if (d >= m.radius || d < 1e-9) continue;
    const k = Math.PI / (2 * m.radius);
    const h = m.height * Math.cos(k * d) ** 2;
    if (h <= top) continue;
    top = h;
    // the height is height * cos^2(k d), which falls away at -height * k * sin(2 k d) for every step out from the middle
    const fall = -m.height * k * Math.sin(2 * k * d);
    out[0] = (fall * da) / d;
    out[1] = (fall * dc) / d;
  }
  return out;
}

/**
 * Something in a marble's way, in its segment's own terms: a rod with rounded
 * ends, lying along the piece or across it, `half` its length either side of
 * its middle — a peg is a rod of no length. Where it is at rest is `along`
 * and `across`; `slot` is the phase it keeps time with, and -1 for one that
 * never moves.
 */
export interface Obstacle {
  along: number;
  across: number;
  half: number;
  angle: number;
  radius: number;
  motion: Motion;
  slot: number;
}

/** Where a thing in the way is at a moment, which way it lies, how fast it is going, and whether it is there at all. */
export interface Pose {
  along: number;
  across: number;
  /** Which way it lies, along and across, of unit length. */
  da: number;
  dc: number;
  half: number;
  va: number;
  vc: number;
  /**
   * How thick it is where the marbles' middles are, from its middle to its
   * face: its own thickness for everything but a wheel's paddle, whose slice
   * at that height grows as it comes down.
   */
  radius: number;
  present: boolean;
}

/** A pose to read into, so reading one makes nothing. */
export function pose0(): Pose {
  return { along: 0, across: 0, da: 1, dc: 0, half: 0, va: 0, vc: 0, radius: 0, present: true };
}

/**
 * Where along the chute a wheel's paddle is solid, at the height of a
 * marble's middle, for a ball of `ball` against it: the arm as a rod swung
 * `theta` from straight down about an axle `axle` above that height, `arm`
 * long and `thick` from its middle to its face. Its ends are rounded, so as
 * the tip comes down on a marble the part of it the marble meets grows from
 * nothing, as the paddle travels, rather than being there all at once.
 * Into `span`, from the axle's own place along the chute; whether any of it
 * is down there at all.
 */
function paddleSpan(axle: number, arm: number, thick: number, theta: number, span: number[]): boolean {
  const s = Math.sin(theta),
    c = Math.cos(theta);
  let lo = Infinity,
    hi = -Infinity;
  const take = (a: number, b: number) => {
    if (b <= a) return;
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  };
  // the rounded end at the tip, and the one at the axle, wherever either comes down to a marble's middle
  const tip = axle - arm * c;
  if (Math.abs(tip) < thick) {
    const w = Math.sqrt(thick * thick - tip * tip);
    take(arm * s - w, arm * s + w);
  }
  if (Math.abs(axle) < thick) {
    const w = Math.sqrt(thick * thick - axle * axle);
    take(-w, w);
  }
  // the arm between them: within `thick` of the line it lies along, and between its two ends
  if (Math.abs(c) > 1e-9) {
    let from = (axle * s - thick) / c,
      to = (axle * s + thick) / c;
    if (from > to) [from, to] = [to, from];
    if (Math.abs(s) > 1e-9) {
      let end = -(axle * c) / s,
        other = (arm - axle * c) / s;
      if (end > other) [end, other] = [other, end];
      take(Math.max(from, end), Math.min(to, other));
    } else if (axle * c >= 0 && axle * c <= arm) take(from, to);
  }
  span[0] = lo;
  span[1] = hi;
  return hi > lo;
}

/** A span to read into, and the same a moment on, so reading a paddle makes nothing. */
const span = [0, 0],
  later = [0, 0];
/** How long after a moment a paddle is read again, to tell how fast it goes on. */
const SOON = 1e-4;

/**
 * Where an obstacle is at race time `t`, its turn begun at `phase` of the way
 * round. Pure: the same moment and phase give the same pose, which is what
 * keeps a race that meets a moving piece the same from the same seed.
 */
export function pose(ob: Obstacle, t: number, phase: number, out: Pose, ball = 0): Pose {
  out.along = ob.along;
  out.across = ob.across;
  out.da = Math.cos(ob.angle);
  out.dc = Math.sin(ob.angle);
  out.half = ob.half;
  out.va = 0;
  out.vc = 0;
  out.radius = ob.radius;
  out.present = true;
  const m = ob.motion;
  switch (m.kind) {
    case 'fixed':
      return out;
    case 'sweep': {
      const w = (Math.PI * 2) / m.period;
      const a = w * t + Math.PI * 2 * phase;
      out.across = ob.across + m.reach * Math.sin(a);
      out.vc = m.reach * w * Math.cos(a);
      return out;
    }
    case 'gate': {
      // it slides aside rather than lifting, and to one side then the other: a gate that let the whole pen
      // go at once let it go in the order it came, while one that opens from a wall lets that side go first
      const turns = t / m.period + phase;
      const f = ((turns % 1) + 1) % 1;
      const toward = Math.floor(turns) % 2 === 0 ? 1 : -1;
      const open = f * m.period - m.shut;
      const until = m.period - m.shut;
      // how far aside, from shut to right out of the pen and back again, easing over `slide` at each end
      const aside = open <= 0 ? 0 : Math.min(1, open / m.slide, (until - open) / m.slide);
      out.across = ob.across + toward * aside * ob.half * 2;
      const moving = open > 0 && (open < m.slide || until - open < m.slide);
      out.vc = moving ? (toward * ob.half * 2 * (open < m.slide ? 1 : -1)) / m.slide : 0;
      // in the way while any of it is still across the pen
      out.present = aside < 0.999;
      return out;
    }
    case 'paddle': {
      // from straight down, round the way that carries a paddle on along the chute at the bottom of its turn
      const f = (((t / m.period + phase + m.turn) % 1) + 1) % 1;
      const theta = Math.PI * 2 * f - Math.PI;
      // in the way wherever the arm, as a rod swung from its axle, reaches a ball whose middle is at a marble's
      // height: the wheel that is drawn. Taken as the arm's slice through that height alone, a paddle was not
      // there at all until its tip got down to a marble's middle and then was there whole, so one that came down
      // where a marble sat shoved it its own whole reach, 0.63, in a single step
      out.present = paddleSpan(m.axle, m.arm, ob.radius + ball, theta, span);
      if (!out.present) return out;
      out.along = ob.along + (span[0] + span[1]) / 2;
      out.radius = (span[1] - span[0]) / 2 - ball;
      // how fast it goes on, read a moment on: its middle's own pace, and not how fast its faces part as it comes
      // down, which at the first touch of its tip is without limit and would throw whatever it touched
      const soon = theta + ((Math.PI * 2) / m.period) * SOON;
      if (paddleSpan(m.axle, m.arm, ob.radius + ball, soon, later))
        out.va = ((later[0] + later[1]) / 2 - (span[0] + span[1]) / 2) / SOON;
      return out;
    }
  }
}

/**
 * A funnel's bowl: the middle of its rim, how far across the rim and the
 * hole are, and how far down the hole is from the rim. The bowl is half a
 * cone and half the bell of a trumpet: steep enough at the rim that a marble
 * which has slowed is pulled in off it, and steeper still toward the hole,
 * so that the last laps are quick and tight. A trumpet alone is too flat at
 * the rim, and a marble crept round it for eight seconds. Its rim's wall
 * stands `wall` high, which is as high as anything dropped into it comes
 * from, so that however fast a marble comes off the lip, the wall stops it.
 * Its hole goes on down as a throat `throat` long, which keeps a marble
 * falling through it inside the hole until it lands on the floor below.
 */
export interface Bowl {
  x: number;
  y: number;
  z: number;
  rim: number;
  hole: number;
  depth: number;
  wall: number;
  throat: number;
}

/** How far below its rim a bowl is at `r` from its middle: nothing at the rim, all of its depth at the hole. */
export function bowlHeight(bowl: Pick<Bowl, 'rim' | 'hole' | 'depth'>, r: number): number {
  const at = Math.min(Math.max(r, bowl.hole), bowl.rim);
  const cone = (bowl.rim - at) / (bowl.rim - bowl.hole);
  const trumpet = (bowl.rim / at - 1) / (bowl.rim / bowl.hole - 1);
  return -bowl.depth * (0.5 * cone + 0.5 * trumpet);
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
  /** How far the channel reaches from its middle to its wall there. */
  w: number;
}

/** A spot to read into, so reading one makes nothing. */
export function spot(): Spot {
  return { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, ux: 0, uy: 0, uz: 0, w: HALF_WIDTH };
}

/**
 * A piece's shape, in its own terms: entry at the origin heading +x, up +z.
 * `exit` is where the next piece's entry portal sits, in lattice points, and
 * how many quarter turns the marble has made by then; a piece with no exit is
 * where a run ends. `curve` is the centre line, from t=0 at the entry to t=1
 * at the exit, with the direction of travel beside it. `rough` is only how
 * long it is about, to decide how many samples to take.
 */
/**
 * A stretch of one piece: the curve it follows, and what it has. Most pieces
 * are one part; a jump is its run-up and, past the air, its own landing, and
 * a funnel is the run in to its bowl, the bowl, and the floor under its hole,
 * so that each joins the pieces either side of it like any other piece does.
 */
interface Part {
  rough: number;
  curve(t: number, out: number[]): void;
  /** It ends at a lip rather than a join: a marble comes down on the part or piece after it, across a gap. */
  flies?: boolean;
  /** How far across it reaches from its middle, from t=0 to t=1; a chute's width where there is none. */
  width?(t: number): number;
  /** What is in its way, in its own terms: `u` is how far along it, as a share of its length. */
  obstacles?: (Omit<Obstacle, 'along' | 'slot'> & { u: number })[];
  /** A bowl in place of a channel: its rim through the part's start, its middle `rim` to the left. */
  bowl?: { rim: number; hole: number; depth: number; wall: number; throat: number };
  /** Lumps in its floor, in its own terms: `u` is how far along it, as a share of its length. */
  mounds?: (Omit<Mound, 'along'> & { u: number })[];
  /** Felt over its first `upto` share, which brings whatever marble crosses it to `speed`, whatever it came in at. */
  felt?: { upto: number; speed: number };
}

interface Shape extends Part {
  exit: { x: number; y: number; z: number; turn: number } | null;
  /** More parts of the same piece, in order, each begun `at` cells along, cells to the left and levels up from its entry. */
  then?: (Part & { at: { x: number; y: number; z: number } })[];
  /**
   * A second branch off the very same entry as the shape's own curve, ending somewhere else: what makes a
   * splitter. The shape's own curve is where the channel's right goes; `fork`'s is where its left goes.
   */
  fork?: { part: Part; exit: { x: number; y: number; z: number; turn: number } };
  /**
   * A second entry, offset from the piece's own, whose part reaches the very same exit as the shape's own
   * curve does: what makes a joiner. The shape's own curve is the entry any other piece would have; `joins`
   * is the one a splitter's other branch reaches instead.
   */
  joins?: Part & { at: { x: number; y: number; z: number } };
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

/** A drop: two levels down in one cell, eased at both ends like a ramp but twice as steep in the middle. */
function dropCurve(t: number, out: number[]): void {
  out[0] = CELL * t;
  out[1] = 0;
  out[2] = -LEVEL * (1 - Math.cos(Math.PI * t));
  out[3] = CELL;
  out[4] = 0;
  out[5] = -LEVEL * Math.PI * Math.sin(Math.PI * t);
}

/** How far across a spiral's circle is from its middle: half a cell, so the whole tower stands in one. */
const SPIRAL_RADIUS = CELL / 2;

/**
 * A spiral: once right round while it falls two levels, coming out where it
 * went in and going the same way, so a spiral stacks on a spiral into a
 * tower. The fall is eased like a ramp's, so it leaves and joins level.
 */
function spiralCurve(side: number, t: number, out: number[]): void {
  const phi = Math.PI * 2 * t;
  out[0] = SPIRAL_RADIUS * Math.sin(phi);
  out[1] = side * SPIRAL_RADIUS * (1 - Math.cos(phi));
  out[2] = -LEVEL * (1 - Math.cos(Math.PI * t));
  out[3] = SPIRAL_RADIUS * Math.PI * 2 * Math.cos(phi);
  out[4] = side * SPIRAL_RADIUS * Math.PI * 2 * Math.sin(phi);
  out[5] = -LEVEL * Math.PI * Math.sin(Math.PI * t);
}

/**
 * The run up to a jump's lip: a cell down a level, eased like a ramp, then the
 * dip and the lip, so it leaves a level cell ahead and a quarter level lower
 * again, pointing up.
 */
function runUpCurve(t: number, out: number[]): void {
  if (t <= 0.5) rampCurve(t * 2, out);
  else {
    jumpCurve(t * 2 - 1, out);
    out[0] += CELL;
    out[2] -= LEVEL;
  }
  // each half is run at twice the pace of the whole
  out[3] *= 2;
  out[4] *= 2;
  out[5] *= 2;
}

/**
 * The pace a jump's felt brings a marble to, and how hard it grips: whatever
 * came before the jump, a marble leaves the felt at this, reaches the lip at
 * a pace of its own, and comes down on the landing beyond it.
 */
export const FELT_SPEED = 15;
export const FELT_GRIP = 6;

/** How steeply a jump's lip throws a marble up, in radians: enough to clear the gap, not to go over the moon. */
const LIP = 0.35;

/**
 * A jump's take-off: in level, down into a dip, and up to a lip a quarter of
 * a level below where it came in, rising at `LIP` as it ends. A cubic with no
 * slope at its start, so it joins the piece before without a kink; the
 * marble carries on through the air from the lip to the piece two cells on.
 */
function jumpCurve(t: number, out: number[]): void {
  const h = -LEVEL / 4,
    s = Math.tan(LIP) * CELL;
  const b = s - 2 * h,
    a = h - b;
  out[0] = CELL * t;
  out[1] = 0;
  out[2] = a * t * t + b * t * t * t;
  out[3] = CELL;
  out[4] = 0;
  out[5] = 2 * a * t + 3 * b * t * t;
}

/** A board: two cells along and a level down, eased at both ends, and gentle enough for marbles to bounce about on. */
function boardCurve(t: number, out: number[]): void {
  out[0] = CELL * 2 * t;
  out[1] = 0;
  out[2] = (-LEVEL * (1 - Math.cos(Math.PI * t))) / 2;
  out[3] = CELL * 2;
  out[4] = 0;
  out[5] = (-LEVEL * Math.PI * Math.sin(Math.PI * t)) / 2;
}

/**
 * A cell along and a cell to one `side` or the other, easing out from the
 * entry and back to level by the exit, so it starts and ends heading the
 * one way whichever side it moves to: what a splitter's two branches part
 * on, and, run the other way round, what a joiner's second entry closes
 * back in on.
 */
function forkCurve(side: number, t: number, out: number[]): void {
  const ease = (1 - Math.cos(Math.PI * t)) / 2,
    slope = (Math.PI * Math.sin(Math.PI * t)) / 2;
  out[0] = CELL * t;
  out[1] = side * CELL * ease;
  out[2] = 0;
  out[3] = CELL;
  out[4] = side * CELL * slope;
  out[5] = 0;
}

/**
 * A width that opens from the chute to `wide` over the start of a piece and
 * closes back to the chute over its end, eased both ways, so that the walls
 * never meet a marble at a corner. Where it closes, the field is squeezed
 * back into single file, which is where a board does half its work.
 */
function opening(wide: number, open: number, close: number): (t: number) => number {
  const ease = (x: number) => (1 - Math.cos(Math.PI * Math.min(Math.max(x, 0), 1))) / 2;
  return (t) =>
    HALF_WIDTH +
    (wide - HALF_WIDTH) * (t < open ? ease(t / open) : t > close ? 1 - ease((t - close) / (1 - close)) : 1);
}

/**
 * How narrow a squeeze is, from its middle to its wall: a marble and a
 * tenth, so a marble fits and two cannot pass. And the end of the run's lane,
 * the same, so the field waits in it in single file.
 */
export const NARROW = 0.55;
export const LANE = 0.55;

/** The end of the run: two cells of level lane, for eight marbles to wait in nose to tail. */
function laneCurve(t: number, out: number[]): void {
  out[0] = CELL * 2 * t;
  out[1] = 0;
  out[2] = 0;
  out[3] = CELL * 2;
  out[4] = 0;
  out[5] = 0;
}

/**
 * Mounds over a bumpy board, in rows that stagger like the pegs' do, so a
 * marble rolling straight down it meets one row after another off the middle
 * of a mound, and is turned one way and then the other.
 */
function moundRows(): (Omit<Mound, 'along'> & { u: number })[] {
  const out: (Omit<Mound, 'along'> & { u: number })[] = [];
  [0.25, 0.4, 0.55, 0.7].forEach((u, r) => {
    for (const across of r % 2 === 0 ? [-1.8, 0, 1.8] : [-0.9, 0.9]) out.push({ u, across, ...MOUND });
  });
  return out;
}

/** How far a mound spreads from its middle, and how high it stands there: every mound is this one, so one mesh draws them all. */
export const MOUND = { radius: 0.75, height: 0.3 };

/** How wide a peg board is, and its pegs: how thick, how far apart across and along, and in how many rows. */
const BOARD = 3.6;
export const PEG = 0.22;

/**
 * A paddle wheel, which the scene draws as the solver has it: how wide its
 * pen is either side of the middle; how far its paddles reach across, which
 * is the pen less a paddle's own thickness, so no marble gets round an end;
 * how thick a paddle is, how high the axle stands above a marble's middle,
 * how long a paddle is — just far enough to dip to the floor — and how long
 * the wheel takes to go round.
 *
 * The axle's height sets how far apart two paddles are along the pen while
 * both are down, and so whether a whole field fits between them: at 1 they
 * were 2.0 apart and the one coming down pressed marbles into each other,
 * and at 1.1 they were 2.2 apart, which was room enough while a paddle was
 * only its slice at the height of the marbles' middles. Met as the arm it is
 * drawn as, which is what `pose` now hands the solver, a paddle takes up more
 * of the pen than that slice did, and at 1.1 a crowd was pressed together
 * again — 3,798 frames of it over 24 seeds out of a gate and into a funnel.
 * At 1.35, with the arm grown to match, none is, and the wheel still holds
 * every marble from about half a second to a second and a half.
 */
export const WHEEL = { pen: 2.6, half: 2.42, radius: 0.18, axle: 1.35, arm: 1.81, period: 4.8 };

/**
 * Rows of pegs, each row shifted half a gap from the one before, so that a
 * marble falling straight down a board meets a peg in every other row. The
 * gaps are wider than a marble, so nothing can wedge; what a marble cannot
 * do is go down in a straight line.
 */
function pegRows(): (Omit<Obstacle, 'along' | 'slot'> & { u: number })[] {
  const out: (Omit<Obstacle, 'along' | 'slot'> & { u: number })[] = [];
  const rows = [0.22, 0.34, 0.46, 0.58, 0.7];
  rows.forEach((u, r) => {
    const across = r % 2 === 0 ? [-2.4, -0.8, 0.8, 2.4] : [-1.6, 0, 1.6];
    for (const c of across) out.push({ u, across: c, half: 0, angle: 0, radius: PEG, motion: { kind: 'fixed' } });
  });
  return out;
}

/** A funnel's centre line: once and a quarter round, closing in from the rim to the hole, for ordering and framing only. */
function funnelCurve(t: number, out: number[]): void {
  const rim = CELL,
    hole = FUNNEL_HOLE;
  // closing in slowly at first, so that it leaves the piece before it level and square
  const r = rim - (rim - hole) * t * t;
  const dr = -2 * (rim - hole) * t;
  const phi = -Math.PI / 2 + Math.PI * 2.5 * t;
  const dphi = Math.PI * 2.5;
  out[0] = r * Math.cos(phi);
  out[1] = rim + r * Math.sin(phi);
  out[2] = bowlHeight({ rim, hole, depth: FUNNEL_DEPTH }, r);
  out[3] = dr * Math.cos(phi) - r * Math.sin(phi) * dphi;
  out[4] = dr * Math.sin(phi) + r * Math.cos(phi) * dphi;
  // how fast it falls with t: the bowl's own slope times how fast it closes in
  const eps = 1e-4;
  const h = (x: number) => bowlHeight({ rim, hole, depth: FUNNEL_DEPTH }, x);
  out[5] = ((h(r + eps) - h(r - eps)) / (2 * eps)) * dr;
}

/** A funnel's hole, big enough for a marble with room to spare, and how far below the rim it is. */
const FUNNEL_HOLE = 1;
const FUNNEL_DEPTH = 2.2;

/**
 * How far a funnel's run in bends in over its bowl, and how far down it goes
 * to its lip. The lip is far enough in that a marble anywhere across it is
 * over the bowl, and high enough that one going round under it passes clear
 * beneath, the rim's wall too. The wall stands as high as the lip: a marble
 * off the lip only ever falls, so however fast it comes off, it meets the
 * wall and not the air over it.
 */
const FUNNEL_IN = 2.2;
const FUNNEL_DROP = 2.6;
const FUNNEL_WALL = LEVEL - FUNNEL_DROP;

/**
 * Under a funnel's hole, the funnel's own way out: a ramp a level down,
 * begun `FUNNEL_BEHIND` behind the hole's middle and handing a marble on a
 * cell beyond it. A marble falls through the hole on to it and is carried
 * off down it, clear of the next to fall. Handed on under the hole's middle,
 * as the funnel once did, the floor there had to be level to meet the piece
 * after, and each marble that fell crept off it while the rest queued in the
 * hole: a field took half as long again to get out of the bowl. The hole goes
 * on down as a throat to a marble's height and a hair above the highest the
 * ramp is anywhere under the hole, which is at its back edge.
 */
const FUNNEL_BEHIND = 1.5;
const FUNNEL_OUT = FUNNEL_BEHIND + CELL;
const FUNNEL_THROAT = LEVEL - FUNNEL_DEPTH - 1 - outletFloor((FUNNEL_BEHIND - FUNNEL_HOLE) / FUNNEL_OUT);

/** How high a funnel's way out is, `t` along it: a level down, eased at both ends like a ramp. */
function outletFloor(t: number): number {
  return (-LEVEL * (1 - Math.cos(Math.PI * t))) / 2;
}

/** A funnel's way out: from behind its hole, under it and on down a level, to hand a marble on level a cell beyond. */
function outletCurve(t: number, out: number[]): void {
  out[0] = FUNNEL_OUT * t;
  out[1] = 0;
  out[2] = outletFloor(t);
  out[3] = FUNNEL_OUT;
  out[4] = 0;
  out[5] = (-LEVEL * Math.PI * Math.sin(Math.PI * t)) / 2;
}

/**
 * A funnel's run in: a cell along, bending left over the bowl and back so
 * that it ends heading round the bowl the way a field goes round it, and
 * easing down to a level lip, so that a marble leaves it going across the
 * ground and drops straight into the bowl.
 */
function funnelInCurve(t: number, out: number[]): void {
  const ease = (1 - Math.cos(Math.PI * t)) / 2,
    slope = (Math.PI * Math.sin(Math.PI * t)) / 2;
  out[0] = CELL * t;
  out[1] = FUNNEL_IN * ease;
  out[2] = -FUNNEL_DROP * ease;
  out[3] = CELL;
  out[4] = FUNNEL_IN * slope;
  out[5] = -FUNNEL_DROP * slope;
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
  drop: {
    exit: { x: 1, y: 0, z: -2, turn: 0 },
    rough: Math.hypot(CELL, LEVEL * 2) * 1.1,
    curve: dropCurve,
  },
  spiralLeft: {
    exit: { x: 0, y: 0, z: -2, turn: 0 },
    rough: Math.hypot(Math.PI * 2 * SPIRAL_RADIUS, LEVEL * 2) * 1.1,
    curve: (t, out) => spiralCurve(1, t, out),
  },
  spiralRight: {
    exit: { x: 0, y: 0, z: -2, turn: 0 },
    rough: Math.hypot(Math.PI * 2 * SPIRAL_RADIUS, LEVEL * 2) * 1.1,
    curve: (t, out) => spiralCurve(-1, t, out),
  },
  // a jump that carries its own landing, so it joins whatever is before and after it: felt down a level that
  // brings any marble to the same pace whatever it came in at, the lip, a cell of air, and a board beyond to come
  // down on. Off a lip left to the piece before it, the field fell short off a slow one and flew over one that
  // was fed fast, and came down only on a level piece: off a drop, a spiral or the narrow, every marble was lost
  jump: {
    exit: { x: 5, y: 0, z: -3, turn: 0 },
    rough: CELL * 2.3,
    curve: runUpCurve,
    flies: true,
    felt: { upto: 0.5, speed: FELT_SPEED },
    then: [
      {
        at: { x: 3, y: 0, z: -2 },
        rough: CELL * 2.1,
        curve: boardCurve,
        width: opening(HALF_WIDTH * 2, 0.1, 0.85),
      },
    ],
  },
  pegs: {
    exit: { x: 2, y: 0, z: -1, turn: 0 },
    rough: CELL * 2.1,
    curve: boardCurve,
    width: opening(BOARD, 0.15, 0.8),
    obstacles: pegRows(),
  },
  sweeper: {
    exit: { x: 2, y: 0, z: -1, turn: 0 },
    rough: CELL * 2.1,
    curve: boardCurve,
    width: opening(3.2, 0.2, 0.78),
    obstacles: [
      // a paddle set at a slant across the board, swinging from wall to wall and back every second and a half:
      // lying along the board it only threw marbles aside, and they carried on in the order they came; at a
      // slant it holds some back and flicks others on, and that is what changes the order
      { u: 0.52, across: 0, half: 1.3, angle: 0.9, radius: 0.28, motion: { kind: 'sweep', reach: 1.9, period: 1.6 } },
    ],
  },
  gate: {
    exit: { x: 1, y: 0, z: -1, turn: 0 },
    rough: Math.hypot(CELL, LEVEL) * 1.1,
    curve: rampCurve,
    // a pen a board wide ahead of the gate, closing to the chute after it: a gate across a chute lets a field
    // go only in the order it came, first held first out; a pen lets the held pile spread out abreast, and it
    // comes out of the neck in whatever order the jostle gives it. It closed from the pen's own width to the
    // chute's over the last fifth of the piece: a field spread out abreast the whole pen, held there while the
    // gate was shut, had to be undone in that short a stretch the moment it opened, and seed 19 once shoved a
    // marble 1.8, twice its own width, in a single step. Closing from the gate itself (`u` below) on, over the
    // rest of the piece, asks far less of any one step without asking less of the pen: nothing narrows before
    // the gate, so the field waiting on it is exactly as wide as it ever was
    width: opening(3.2, 0.2, 0.6),
    obstacles: [
      {
        u: 0.6,
        across: 0,
        half: 3.2,
        angle: Math.PI / 2,
        radius: 0.2,
        motion: { kind: 'gate', shut: 1.6, period: 2.6, slide: 0.35 },
      },
    ],
  },
  wheel: {
    exit: { x: 1, y: 0, z: -1, turn: 0 },
    rough: Math.hypot(CELL, LEVEL) * 1.1,
    curve: rampCurve,
    // a pen, and a wheel right across it. A wheel over one half of its pen was a wheel the field could miss: a
    // marble comes into a pen within a chute's width of its middle and keeps its line, and after a bend the whole
    // field comes down the outside, so on Switchback it passed the wheel by in every race of sixty
    width: opening(WHEEL.pen, 0.25, 0.8),
    // four paddles, one down in the chute at a time for 1.2 s: a marble that catches one up is held behind it
    // until it lifts out, and one that arrives as a paddle lifts runs on under the wheel. A wheel turning twice as
    // fast held only one marble at a time, and handed a field on in the order it came; this one gathers those
    // that come close together behind a paddle, abreast across the pen, and lets them all go at once. A paddle's
    // tip comes to the chute's floor at the bottom of its turn, so the wheel the marbles meet is the wheel drawn
    obstacles: [0, 0.25, 0.5, 0.75].map((turn) => ({
      u: 0.5,
      across: 0,
      half: WHEEL.half,
      angle: Math.PI / 2,
      radius: WHEEL.radius,
      motion: { kind: 'paddle' as const, period: WHEEL.period, turn, axle: WHEEL.axle, arm: WHEEL.arm },
    })),
  },
  // a run in that ends at a lip over the bowl, and then the bowl a level down: a bowl level with its entry lay over
  // whatever came in from the left, a turn to the left most of all, whose arc is the bowl's own rim. The run in
  // once came down to the rim and ended on it, half outside the bowl, and a marble coming off it was set down
  // inside the rim where it had never been; its end stood in the way of everything going round. Over the bowl,
  // each drops in where it comes off, at whatever pace it came, and those going round pass under it. Then the way
  // out under the hole, which each falls through the throat on to, and which carries it off to the piece after
  funnel: {
    exit: { x: 2, y: 1, z: -3, turn: 0 },
    rough: CELL * 1.2,
    curve: funnelInCurve,
    flies: true,
    then: [
      {
        at: { x: 1, y: 0, z: -1 },
        rough: Math.PI * 2.5 * CELL * 0.7,
        curve: funnelCurve,
        bowl: { rim: CELL, hole: FUNNEL_HOLE, depth: FUNNEL_DEPTH, wall: FUNNEL_WALL, throat: FUNNEL_THROAT },
      },
      { at: { x: 1 - FUNNEL_BEHIND / CELL, y: 1, z: -2 }, rough: FUNNEL_OUT * 1.1, curve: outletCurve },
    ],
  },
  // a channel that parts in two, level, by which side of the middle the field is on when it reaches the fork:
  // its own curve is the lane straight ahead, `fork`'s is the one that moves a cell across to open a second
  // lane beside it, and the two are raced apart, never jostling each other, until a joiner brings them back.
  // a channel that parts in two, level, by which side of the middle the field is on when it reaches the fork:
  // its own curve is the lane straight ahead, `fork`'s is the one that moves a cell across to open a second
  // lane beside it, and the two are raced apart, never jostling each other, until a joiner brings them back.
  // Both keep a chute's own width the whole way — a narrower one, tried first, pinched two marbles still side
  // by side from the wide chute before it before they had anywhere near enough of the piece to settle apart
  // in — and the wedge that keeps the two walls from crossing while they still can is `scene.ts`'s own business,
  // a solid divider drawn over the point they share, not a change to what the channel itself is
  splitter: {
    exit: { x: 1, y: 0, z: 0, turn: 0 },
    rough: CELL,
    curve: straightCurve,
    fork: {
      exit: { x: 1, y: 1, z: 0, turn: 0 },
      part: { rough: CELL * 1.1, curve: (t, out) => forkCurve(1, t, out) },
    },
  },
  // the piece a splitter's two branches close back into: its own curve carries on the lane that never left,
  // `joins` is the other, a cell across from it, whose part comes back in over the same cell that lane opened
  // by. A joiner may be placed anywhere both branches happen to reach, not only right after the splitter that
  // opened them, as long as the one that moved comes back the same cell it went out by
  joiner: {
    exit: { x: 1, y: 0, z: 0, turn: 0 },
    rough: CELL,
    curve: straightCurve,
    joins: { at: { x: 0, y: 1, z: 0 }, rough: CELL * 1.1, curve: (t, out) => forkCurve(-1, t, out) },
  },
  // a straight two cells along and one level down, half as steep as a ramp: at a chute's width, and opening to
  // two chutes and three in its middle, where a field spreads out and finds its own lines
  shallow: { exit: { x: 2, y: 0, z: -1, turn: 0 }, rough: CELL * 2.1, curve: boardCurve },
  shallowWide: {
    exit: { x: 2, y: 0, z: -1, turn: 0 },
    rough: CELL * 2.1,
    curve: boardCurve,
    width: opening(HALF_WIDTH * 2, 0.2, 0.8),
  },
  shallowBroad: {
    exit: { x: 2, y: 0, z: -1, turn: 0 },
    rough: CELL * 2.1,
    curve: boardCurve,
    width: opening(HALF_WIDTH * 3, 0.2, 0.8),
  },
  // squeezed down to single file in its middle and let out again: two abreast coming in leave one behind the other
  narrow: {
    exit: { x: 2, y: 0, z: -1, turn: 0 },
    rough: CELL * 2.1,
    curve: boardCurve,
    width: opening(NARROW, 0.3, 0.7),
  },
  // a board with mounds in its floor, which turn a marble aside as it rolls over one, as a soft peg would
  bumps: {
    exit: { x: 2, y: 0, z: -1, turn: 0 },
    rough: CELL * 2.1,
    curve: boardCurve,
    width: opening(3.2, 0.15, 0.85),
    mounds: moundRows(),
  },
  // the end: past the line at its start, a lane one marble wide, where the field rolls up and waits in the order
  // it finished
  finish: { exit: null, rough: CELL * 2.1, curve: laneCurve, width: opening(LANE, 0.25, 1) },
};

/** Every kind of piece there is, in the order the catalog shows them. */
export const KINDS = Object.keys(SHAPES) as readonly Kind[];

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
/** A piece's parts, each worked out into a segment of its own, in the order a marble meets them. */
function sample(piece: Placed, index: number): Segment[] {
  const shape = SHAPES[piece.kind];
  const out = [samplePart(piece, index, shape, { x: 0, y: 0, z: 0 })];
  for (const part of shape.then ?? []) out.push(samplePart(piece, index, part, part.at));
  // a splitter's second branch begins at the same entry as the first, not further along it
  if (shape.fork) out.push(samplePart(piece, index, shape.fork.part, { x: 0, y: 0, z: 0 }));
  // a joiner's second entry, off to one side of the one every other piece has, reaching the same exit as it
  if (shape.joins) out.push(samplePart(piece, index, shape.joins, shape.joins.at));
  return out;
}

/** One part of a piece, begun `at` cells along and to the left and levels up from the piece's entry. */
function samplePart(piece: Placed, index: number, shape: Part, at: { x: number; y: number; z: number }): Segment {
  const n = Math.max(8, Math.ceil(shape.rough / SAMPLE_EVERY)) + 1;
  const points = new Float32Array(n * 3),
    tangents = new Float32Array(n * 3),
    ups = new Float32Array(n * 3),
    arc = new Float32Array(n),
    width = new Float32Array(n);
  const local: number[] = [0, 0, 0, 0, 0, 0];
  const turned: number[] = [0, 0];
  // where the part begins: its piece's entry, moved on by `at` in the piece's own frame
  turnBy(piece.facing, at.x * CELL, at.y * CELL, turned);
  const ox = piece.x * CELL + turned[0],
    oy = piece.y * CELL + turned[1],
    oz = (piece.z + at.z) * LEVEL;
  for (let i = 0; i < n; i++) {
    shape.curve(i / (n - 1), local);
    width[i] = shape.width ? shape.width(i / (n - 1)) : HALF_WIDTH;
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
  const length = arc[n - 1];
  // what is in the way, placed along the piece by how far it has really come, and keeping no time until compiled
  const obstacles: Obstacle[] = (shape.obstacles ?? []).map(({ u, ...rest }) => ({
    ...rest,
    along: u * length,
    slot: -1,
  }));
  const mounds: Mound[] = (shape.mounds ?? []).map(({ u, ...rest }) => ({ ...rest, along: u * length }));
  let funnel: Bowl | null = null;
  if (shape.bowl) {
    // the bowl's middle is `rim` to the left of the entry, so the rim runs through it heading the way the piece faces
    turnBy(piece.facing, 0, shape.bowl.rim, turned);
    funnel = { x: ox + turned[0], y: oy + turned[1], z: oz, ...shape.bowl };
  }
  return {
    piece: index,
    points,
    tangents,
    ups,
    arc,
    length,
    start: 0,
    next: -1,
    prev: -1,
    fork: null,
    branch: 0,
    flies: !!shape.flies,
    gap: 0,
    width,
    obstacles,
    funnel,
    mounds,
    felt: shape.felt ? { upto: shape.felt.upto * length, speed: shape.felt.speed } : null,
  };
}

/** Where a piece's `fork` exit or `joins` entry sits, worked out the same way `exitOf` works out the main one. */
function sideOf(
  piece: Placed,
  side: { x: number; y: number; z: number; turn?: number },
): { x: number; y: number; z: number; facing: Facing } {
  const turned: number[] = [0, 0];
  turnBy(piece.facing, side.x, side.y, turned);
  return {
    x: piece.x + turned[0],
    y: piece.y + turned[1],
    z: piece.z + side.z,
    facing: ((((piece.facing + (side.turn ?? 0)) % 4) + 4) % 4) as Facing,
  };
}

/**
 * A run worked out into a track: walked from the start gate, piece by piece,
 * until it reaches a cup or runs out of track. A run with something wrong
 * with it gives back as much as could be walked rather than throwing, since
 * a player building one has a broken run in front of them most of the time;
 * `check` is what says what is wrong with it. `problems`, given, is told of
 * anything a splitter or joiner gets wrong on the way, which `check` reads.
 */
export function compile(run: Run, problems?: string[]): Track {
  const track: Track = { name: run.name, segments: [], length: 0, samples: 0, slots: 0 };
  // every piece's own entry, and a joiner's second one besides, each to which piece and which of its segments
  const entries = new Map<string, { piece: number; part: number }>();
  run.pieces.forEach((p, i) => {
    if (p.kind === 'start') return;
    entries.set(portalKey(p.x, p.y, p.z, p.facing), { piece: i, part: 0 });
    const { joins } = SHAPES[p.kind];
    if (joins) {
      const at = sideOf(p, joins.at);
      entries.set(portalKey(at.x, at.y, at.z, p.facing), { piece: i, part: 1 });
    }
  });

  const segmentsByPiece = new Map<number, Segment[]>();
  const segmentIndex = new Map<Segment, number>();
  const committed = new Set<Segment>();
  const onwardDone = new Set<number>();
  const onStack = new Set<number>();
  let nextBranch = 1;

  /** A segment appended to the track, its bookkeeping done, at wherever `track.length` stands. */
  function append(segment: Segment, branch: number): void {
    segment.start = track.length;
    segment.branch = branch;
    if (segment.obstacles.some((o) => o.motion.kind !== 'fixed')) {
      for (const o of segment.obstacles) if (o.motion.kind !== 'fixed') o.slot = track.slots;
      track.slots++;
    }
    segmentIndex.set(segment, track.segments.length);
    track.segments.push(segment);
    committed.add(segment);
    track.length += segment.length;
    track.samples += segment.arc.length;
  }

  /** This piece's segments, sampled the first time anything reaches it, geometry only until committed. */
  function geometryOf(pieceIndex: number): Segment[] {
    let segs = segmentsByPiece.get(pieceIndex);
    if (!segs) {
      segs = sample(run.pieces[pieceIndex], pieceIndex);
      segmentsByPiece.set(pieceIndex, segs);
    }
    return segs;
  }

  /**
   * Commits `part` of a piece to the track, wherever `track.length` now stands: the whole piece at once, in
   * order, unless it forks or joins. A splitter's two branches both begin at the one point it forks from; a
   * joiner's two entries are committed apart, each the first time its own branch reaches it. Answers whether
   * this was the first time `part` itself was committed, which is always so except a joiner's second entry.
   */
  function commit(pieceIndex: number, segs: Segment[], part: number, branch: number): boolean {
    if (committed.has(segs[part])) return false;
    const shape = SHAPES[run.pieces[pieceIndex].kind];
    if (shape.joins) {
      append(segs[part], branch);
      return true;
    }
    const base = track.length;
    segs.forEach((seg, k) => {
      if (shape.fork && k === 1) track.length = base; // the left branch begins at the very same point as the right
      // the gap, if the one before flies or drops, is added before this one is committed, not after
      if (k > 0 && !shape.fork) {
        const from = segs[k - 1];
        if (from.flies || from.funnel) {
          const last = from.points.length - 3;
          from.gap = Math.hypot(seg.points[0] - from.points[last], seg.points[1] - from.points[last + 1]);
          track.length += from.gap;
        }
      }
      append(seg, shape.fork ? nextBranch++ : branch);
      if (k > 0 && !shape.fork) {
        segs[k - 1].next = segmentIndex.get(seg)!;
        seg.prev = segmentIndex.get(segs[k - 1])!;
      }
    });
    return true;
  }

  /** `before` wired on to whatever `x,y,z,facing` matches, walking on from it the first time it is reached. */
  function walk(before: Segment | null, x: number, y: number, z: number, facing: Facing, branch: number) {
    const match = entries.get(portalKey(x, y, z, facing));
    if (!match) return; // a dead end: `before` keeps its default, and this branch of the walk stops here
    const segs = geometryOf(match.piece);
    const target = segs[match.part];
    const forks = !!SHAPES[run.pieces[match.piece].kind].fork;
    // the gap, if any, is added before the target is committed, so its own start already stands beyond it
    if (before?.flies || before?.funnel) {
      const last = before.points.length - 3;
      before.gap = Math.hypot(target.points[0] - before.points[last], target.points[1] - before.points[last + 1]);
      if (!committed.has(target)) track.length += before.gap;
    }
    // a piece is reached a second time only through a joiner's own second entry: geometry is committed per
    // entry, since each is its own segment, but the piece as a whole is only walked on from once
    const reachedBefore = onwardDone.has(match.piece);
    commit(match.piece, segs, match.part, branch);
    target.prev = before ? (segmentIndex.get(before) ?? -1) : -1;
    if (forks) segs[1].prev = target.prev; // the fork's other branch shares the very same predecessor
    if (before) {
      // reaching a splitter hands the field on by which side of the middle it is on, in place of a plain next
      if (forks) before.fork = { a: segmentIndex.get(segs[1])!, b: segmentIndex.get(segs[0])! };
      else before.next = segmentIndex.get(target)!;
    }
    if (reachedBefore) {
      // reached before with nowhere else to have come from but a joiner's own second entry is the run coming
      // back round on itself instead: the same piece, the same one entry, asked for all over again
      if (!SHAPES[run.pieces[match.piece].kind].joins) {
        problems?.push('the run never ends: it comes back round on itself');
        return;
      }
      // the two branches that meet at a joiner ought to have brought the field about the same distance: each
      // entry's own start, not the track's current length, which by now may have gone all the way to the
      // finish and back through whatever the first entry found. A lane that moved a cell across is inherently
      // longer than a plain straight of the same span — about half again, over just one cell — so an exact
      // match is not asked for, only that the gap between the two stays a small share of the whole, which any
      // branch of a few pieces or more comes to on its own
      const other = segs[1 - match.part];
      const longer = Math.max(target.start, other.start);
      if (Math.abs(target.start - other.start) > Math.max(1, longer * 0.15) && problems)
        problems.push(
          `piece ${match.piece}, a joiner, is reached ${other.start.toFixed(2)} along one branch and ${target.start.toFixed(2)} along the other`,
        );
      // the field arriving this way goes on exactly where the field that arrived first already does
      target.next = other.next;
      return;
    }
    onwardDone.add(match.piece);
    continueFrom(match.piece, segs, match.part, branch);
  }

  /** Walks on from a piece just committed for the first time: forks it if it has to, joins the field back if it just did. */
  function continueFrom(pieceIndex: number, segs: Segment[], firstPart: number, branch: number) {
    if (onStack.has(pieceIndex)) {
      problems?.push('the run never ends: it comes back round on itself');
      return;
    }
    onStack.add(pieceIndex);
    const piece = run.pieces[pieceIndex];
    const shape = SHAPES[piece.kind];
    // for a joiner this is whichever entry got here first; for anything else there is only ever the one
    const last = shape.joins ? segs[firstPart] : segs[segs.length - 1];
    if (shape.fork) {
      // two branches from the one entry, each its own length, so each continues on from wherever it itself
      // ends: the field parts by which side of the channel it is on, and is raced apart until a joiner closes it
      const right = exitOf(piece);
      track.length = segs[0].start + segs[0].length;
      if (right) walk(segs[0], right.x, right.y, right.z, right.facing, segs[0].branch);
      const left = sideOf(piece, shape.fork.exit);
      track.length = segs[1].start + segs[1].length;
      walk(segs[1], left.x, left.y, left.z, left.facing, segs[1].branch);
      onStack.delete(pieceIndex);
      return;
    }
    // a joiner's own onward continuation is a field made whole again, not one of a split any longer
    const onward = shape.joins ? 0 : branch;
    const out = exitOf(piece);
    if (out) walk(last, out.x, out.y, out.z, out.facing, onward);
    onStack.delete(pieceIndex);
  }

  const start = run.pieces.findIndex((p) => p.kind === 'start');
  if (start < 0) return track;
  const segs = geometryOf(start);
  commit(start, segs, 0, 0);
  onwardDone.add(start);
  continueFrom(start, segs, 0, 0);
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

/** How far the channel reaches from its middle to its wall, `s` along a segment: what `at` gives as `w`, without the rest of it. */
export function widthAt(track: Track, segment: number, s: number): number {
  const seg = track.segments[segment];
  const along = Math.min(Math.max(s, 0), seg.length);
  const i = Math.min(find(seg.arc, along), seg.arc.length - 2);
  const span = seg.arc[i + 1] - seg.arc[i];
  const f = span > 1e-12 ? (along - seg.arc[i]) / span : 0;
  return seg.width[i] + (seg.width[i + 1] - seg.width[i]) * f;
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
  out.w = seg.width[i] + (seg.width[i + 1] - seg.width[i]) * f;
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

  for (const kind of ['sweeper', 'gate', 'wheel'] as const) {
    const n = run.pieces.filter((p) => p.kind === kind).length;
    if (n > MOVING_MOST) problems.push(`a run may have ${MOVING_MOST} ${kind}s, and this one has ${n}`);
  }

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
    const { fork } = SHAPES[p.kind];
    if (fork) {
      const side = sideOf(p, fork.exit);
      exits.add(portalKey(side.x, side.y, side.z, side.facing));
    }
  }
  run.pieces.forEach((p, i) => {
    if (p.kind === 'start') return;
    if (!exits.has(portalKey(p.x, p.y, p.z, p.facing))) problems.push(`piece ${i}, a ${p.kind}, joins nothing`);
    const { joins } = SHAPES[p.kind];
    if (joins) {
      const at = sideOf(p, joins.at);
      if (!exits.has(portalKey(at.x, at.y, at.z, p.facing)))
        problems.push(`piece ${i}, a ${p.kind}, has a second entry that joins nothing`);
    }
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

  // working the whole thing out finds what the walk above cannot, on the far side of a splitter: a branch that
  // never reaches a joiner, or reaches one a different distance along than the branch that closes it does
  const forked: string[] = [];
  const track = compile(run, forked);
  problems.push(...forked);

  // a run that walks clean can still pass through itself, where two parts that do not join come to the same place
  if (problems.length === 0) problems.push(...clashes(run, track));
  return problems;
}

/**
 * How near two parts of a run that do not join may come across the ground,
 * wall to wall, and how far one must pass over the other in height to be
 * clear of it whatever: a marble and a wall's height, and a skin under the one
 * above.
 */
const CLEAR = 0.3,
  OVER = 1.6;

/**
 * Where two parts of a run that do not join run through each other: the same
 * place at the same height, as a funnel's bowl level with its entry did over
 * a turn to the left before it, whose arc was the bowl's own rim. Asked of
 * every pair of segments that are not neighbours, a sample in two; checked
 * once when a run is laid out, and never as it is raced, which is why it is
 * here and not in `checkTrack`.
 */
function clashes(run: Run, track: Track): string[] {
  const out: string[] = [];
  const { segments } = track;
  // whether two segments join, straight on or by a splitter's fork: neighbours by position no longer means
  // neighbours in the run, since a splitter and a joiner each have more than one segment meeting at one point
  const joined = (a: number, b: number): boolean => {
    const A = segments[a],
      B = segments[b];
    return (
      A.next === b ||
      B.next === a ||
      !!(A.fork && (A.fork.a === b || A.fork.b === b)) ||
      !!(B.fork && (B.fork.a === a || B.fork.b === a))
    );
  };
  for (let a = 0; a < segments.length; a++)
    for (let b = a + 1; b < segments.length; b++) {
      if (joined(a, b)) continue;
      const A = segments[a],
        B = segments[b];
      if (A.piece === B.piece) continue;
      let near = Infinity;
      for (let i = 0; i < A.arc.length && near >= CLEAR; i += 2)
        for (let j = 0; j < B.arc.length; j += 2) {
          if (Math.abs(A.points[i * 3 + 2] - B.points[j * 3 + 2]) > OVER) continue;
          const apart =
            Math.hypot(A.points[i * 3] - B.points[j * 3], A.points[i * 3 + 1] - B.points[j * 3 + 1]) -
            A.width[i] -
            B.width[j];
          near = Math.min(near, apart);
        }
      if (near < CLEAR)
        out.push(
          `pieces ${A.piece} and ${B.piece}, a ${run.pieces[A.piece].kind} and a ${run.pieces[B.piece].kind}, run through each other`,
        );
    }
  return out;
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
    const prev = seg.prev < 0 ? null : track.segments[seg.prev];
    const before = prev ? prev.start + prev.length + prev.gap : 0;
    const drops = seg.flies || seg.funnel !== null;
    if (drops !== seg.gap > 0 && seg.next >= 0)
      problems.push(`segment ${i} has a gap of ${seg.gap} and flies ${seg.flies}`);
    if (Math.abs(seg.width[0] - HALF_WIDTH) > 1e-4)
      problems.push(`segment ${i} is ${seg.width[0]} wide where it begins`);
    if (!seg.funnel && seg.next !== -1 && Math.abs(seg.width[seg.width.length - 1] - HALF_WIDTH) > 1e-4)
      problems.push(`segment ${i} is ${seg.width[seg.width.length - 1]} wide where it ends`);
    for (const w of seg.width)
      if (!(w >= NARROW - 1e-4)) {
        problems.push(`segment ${i} is narrower than single file somewhere, at ${w}`);
        break;
      }
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
    if (!seg.flies && !seg.funnel && seg.next >= 0 && seg.next < track.segments.length) {
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
