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
  | 'brake'
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
  /**
   * A grid over the whole piece, where the run asks for one: a ceiling at
   * the walls' height that a ball leaving the floor meets. Written only
   * where it is asked for, so a piece without one is the shape it always was.
   */
  lid?: true;
}

/**
 * The kinds that cannot have a grid over them, and why, in the player's
 * terms: a jump's field flies over its walls, a funnel's drops into its
 * bowl from above them, and a wheel's paddles turn up through where a grid
 * would be.
 */
export const LIDLESS: readonly Kind[] = ['jump', 'funnel', 'wheel'];
const NO_LID: Partial<Record<Kind, string>> = {
  jump: 'its field flies over its walls',
  funnel: 'its field drops into its bowl from over its walls',
  wheel: 'its paddles turn up through where a grid would be',
};

/** Why a piece of `kind` cannot have a grid over it, or nothing where it can. */
export function lidRefused(kind: Kind): string {
  return LIDLESS.includes(kind) ? `a ${kind} cannot have a grid over it: ${NO_LID[kind]}` : '';
}

/** A run: a name and the pieces it is made of. Predefined runs and the player's own are the same shape. */
export interface Run {
  /** What a save knows it by: never changed once a run is out, whatever it is called or wherever it is listed. */
  id: string;
  name: string;
  pieces: Placed[];
  /** What the run is dressed as, for the eye alone: plain where it is not given, and nothing a marble meets either way. */
  theme?: Theme;
}

/** The ways a run can be dressed, beyond plain. */
export type Theme = 'industrial';
export const THEMES: readonly Theme[] = ['industrial'];

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
  /** A V for a floor rather than a flat one between walls: the lane at the end, and the narrow's groove. */
  trough: boolean;
  /**
   * Covered from `from` to `upto` along it by a lid at the walls' height,
   * which a ball that leaves the floor meets as a ceiling; null where it is
   * open.
   */
  lid: { from: number; upto: number } | null;
  /** How high its walls stand: the track's own, unless the piece's shape asks for more. */
  wall: number;
  /**
   * Where a wall is left open, at each sample: the left wall (1) or the right
   * (2) where it would stand inside the channel of another lane of the same
   * splitter or joiner, since two lanes that begin or end at one point share
   * a floor there, and a wall down the middle of it would be a wall a ball
   * met in the middle of the channel. Null where no wall is open.
   */
  open: Uint8Array | null;
  /** How far the flat of the floor reaches from the middle at each sample: the channel's width, or a trough's bottom. */
  floor: Float32Array;
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
  /** How high its walls stand over the floor, drawn and, met. */
  wall: number;
  /** How much every piece leans down along the run, taken into the geometry itself; 0 where it is not. */
  lean: number;
}

/**
 * How a run is worked out, beyond what `SHAPES` says: a kind of piece shaped
 * otherwise, for this compile alone, which is what a test or an experiment
 * tries a shape with before it is made the kind's own.
 */
export interface Compiled {
  shapes?: Partial<Record<Kind, Partial<Shape>>>;
}

/**
 * How high the walls stand over the floor, and where a grid lies over them:
 * a real marble banking through a bend at speed climbs a wall, and the
 * spike's balls hopped one of 0.57 and stayed in one of 1.2.
 */
export const WALL = 1.2;
/**
 * How much every piece leans the way the run goes, as a grade. A real marble
 * run is set with a little fall even on its level pieces, because a marble
 * brought to rest on the true level stays there, and it is taken into the
 * geometry itself; here, once boards and gates
 * and wheels began holding the front of a field up, the queue behind backed
 * on to level bends and marbles were stranded on them. At this lean even the
 * least free-rolling marble is pulled harder than it is held back.
 */
export const LEAN = 0.05;

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

/**
 * Where a thing in the way is at a moment by its clockwork: how far along its
 * piece and across it, how long it is, and how fast it is going across. A
 * sweeper's paddle and a gate's bar are driven toward this; a wheel turns at
 * its pace, and is read from its body.
 */
export interface Pose {
  along: number;
  across: number;
  half: number;
  vc: number;
}

/** A pose to read into, so reading one makes nothing. */
export function pose0(): Pose {
  return { along: 0, across: 0, half: 0, vc: 0 };
}

/**
 * Where an obstacle is at race time `t`, its turn begun at `phase` of the way
 * round. Pure: the same moment and phase give the same pose, which is what
 * keeps a race that meets a moving piece the same from the same seed.
 */
export function pose(ob: Obstacle, t: number, phase: number, out: Pose): Pose {
  out.along = ob.along;
  out.across = ob.across;
  out.half = ob.half;
  out.vc = 0;
  const m = ob.motion;
  switch (m.kind) {
    case 'fixed':
    case 'paddle':
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
export interface Part {
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
  /** A V for a floor rather than a flat one between walls, closing to it from a chute's over `TROUGH_IN`. */
  trough?: boolean;
  /**
   * How high its walls stand, where higher than the track's own: a spiral's,
   * since a ball at a drop's speed rides its outer wall
   * higher than a chute's would hold. Banking the floor was tried for that
   * first and made it worse: a wall square to a banked floor leans outward,
   * and a ball pressed into it at speed is shoved up and over it.
   */
  wall?: number;
  /**
   * A lid over the part from `from` to `upto`, as shares of its length: a
   * grid at the walls' height that a ball leaving the floor meets as a
   * ceiling. What holds a ball on a crest no rounding can: over a drop a
   * ball at two drops' speed clears the whole cell and comes down a level
   * above whatever is next, and a crest it would stay on at that speed
   * would be two cells across.
   */
  lid?: { from: number; upto: number };
}

export interface Shape extends Part {
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
export function straightCurve(t: number, out: number[]): void {
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
 * How high a spiral's walls stand: half as high again as the
 * rest of the run's. Off a drop into a spiral, a ball rides the outer wall
 * 1.3 high at a wall of 1.2 and eight in 192 went over; at 1.8, none.
 */
export const SPIRAL_WALL = 1.8;
/**
 * How high a wheel's pen walls stand. It can have no grid over
 * it, since its paddles turn up through where one would be, and a field fed
 * off two drops that met a paddle coming round was thrown up and over walls
 * of 1.2, 13 of 192 off a broad shallow; at 1.8 one; at 2.4 none, fed off a
 * jump, a groove or a broad shallow.
 */
export const WHEEL_WALL = 2.4;
/**
 * Where a wheel's pen begins to close as a share of the
 * piece: a field the wheel lets go abreast came to rest in a neck that closed
 * over the ramp's flat end and arched there, three abreast, as a hopper
 * does; closing from 0.7, where the ramp is still steep enough to keep it
 * rolling, none stopped fed off a drop and a bend over 48 seeds, and fed
 * straight off two drops, one seed in 48 still arched.
 */
export const WHEEL_CLOSE = 0.7;

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
export function boardCurve(t: number, out: number[]): void {
  out[0] = CELL * 2 * t;
  out[1] = 0;
  out[2] = (-LEVEL * (1 - Math.cos(Math.PI * t))) / 2;
  out[3] = CELL * 2;
  out[4] = 0;
  out[5] = (-LEVEL * Math.PI * Math.sin(Math.PI * t)) / 2;
}

/**
 * How a brake snakes: how far the channel swings either side of straight,
 * and how far along it goes from one swing to the next. Tighter, and its
 * inner wall folds back through itself: the swing's own radius of turn,
 * 1/(amp (2π/wave)²), has to stay well past a chute's half width. At 0.6
 * every 8, a field arriving at 20 leaves at 11 and one at 27 at 10, on 24
 * seeds with none lost; at 0.4 every 4, a radius of one, balls were lost.
 */
export const BRAKE_SWING = 0.6;
export const BRAKE_WAVE = 8;

/**
 * A brake: a board's fall, two cells and a level, with the channel snaking
 * from side to side along it, eased in from straight and out again. A ball
 * with speed is thrown from wall to wall and gives most of it up; a slow
 * one wanders through and keeps what it had. What takes speed off honestly,
 * since a real ball on a real floor has nothing else to lose it to, and a
 * long descent otherwise only ever gets faster.
 */
function brakeCurve(t: number, out: number[]): void {
  boardCurve(t, out);
  const L = CELL * 2;
  const x = L * t,
    k = (Math.PI * 2) / BRAKE_WAVE,
    ease = Math.sin(Math.PI * t);
  out[1] = BRAKE_SWING * ease * Math.sin(k * x);
  out[4] = BRAKE_SWING * L * (ease * k * Math.cos(k * x) + (Math.PI / L) * Math.cos(Math.PI * t) * Math.sin(k * x));
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
export function opening(wide: number, open: number, close: number): (t: number) => number {
  const ease = (x: number) => (1 - Math.cos(Math.PI * Math.min(Math.max(x, 0), 1))) / 2;
  return (t) =>
    HALF_WIDTH +
    (wide - HALF_WIDTH) * (t < open ? ease(t / open) : t > close ? 1 - ease((t - close) / (1 - close)) : 1);
}

/**
 * A trough: how flat its bottom is either side of its middle, a hair so its
 * two floor points are not one, and over how much of the lane it closes to
 * that from a chute's flat floor, since a ball coming in at the wall met a
 * V's side as a step when it began at once. Its top stays a chute's width:
 * narrowed, so that its sides were too steep for two balls to sit on
 * abreast, its walls converged as a hopper's do and the field arched in it.
 */
export const TROUGH_FLAT = 0.05;
export const TROUGH_IN = 0.3;
/** How high a trough's V reaches up its walls, which stand on above it: a ball on the V's side has a wall above it and not a lip. */
export const TROUGH_DEPTH = 0.8;

/**
 * How far the lane's cup falls below level at `t` of the way along it, and
 * how fast, its bottom at `dip`: eased from level to a level down, and eased
 * up again half of it to level at its end, level at every turn.
 */
function cup(t: number, dip: number): [number, number] {
  if (t < dip) {
    const a = (Math.PI * t) / dip;
    return [(-LEVEL * (1 - Math.cos(a))) / 2, (-LEVEL * Math.PI * Math.sin(a)) / (2 * dip)];
  }
  const a = (Math.PI * (t - dip)) / (1 - dip);
  return [-LEVEL + (LEVEL * (1 - Math.cos(a))) / 4, (LEVEL * Math.PI * Math.sin(a)) / (4 * (1 - dip))];
}

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

/** How wide a peg board is. */
const BOARD = 3.6;
/** How tall a peg stands, drawn and, met. */
export const PEG_HEIGHT = 0.8;
/** How tall a sweeper's paddle and a gate's bar stand, drawn and, met. */
export const PADDLE_HEIGHT = 0.7;
export const GATE_HEIGHT = 0.8;
/**
 * A peg is a cone, this wide at its foot, and not a post: a
 * ball on a gentle board came to rest against a post as often as not, held
 * there by the floor's own friction from as much as forty degrees off dead
 * astern, and a steeper board or a polished post held more, not fewer. A
 * cone's side leans in, so a ball pressed against it is pushed up and off.
 * At 0.35 wide a ball wedged now and then between a cone and the next row's
 * neighbour; at 0.28 none did in 192.
 */
export const PEG_CONE = 0.28;
/**
 * How far apart a board's pegs stand across it. At 1.6 apart, a gap is wider
 * than a ball and narrower than two: two balls coming down abreast wedged in it
 * together, an arch of two between two cones, in 28 of 192 races fed off a
 * straight. At 2.4 apart, a gap is wide enough for two, rows staggered by
 * half of it so nothing goes straight down, the first row with a peg on the
 * middle so the stream from the chute is split rather than aimed at a gap.
 * Four rows of them stop nothing over 48 seeds fed off the gate, a straight,
 * a ramp or two drops.
 */
export const PEG_SPACING = 2.4;
/**
 * Where a gate's bar stands as a share of the piece, and so
 * where its pen begins to close. A crowd let go from a standstill at 0.6,
 * into a neck closing over the ramp's flattening end, came to rest there
 * arched, all eight, on one seed in 48; let go halfway down, it has picked
 * up speed before the neck and the neck closes over twice the distance,
 * and none did, alone or on First Drop, The Chute or The Tower. At 0.4 The
 * Tower's field reached its spiral fast enough to lose a third of it.
 */
export const GATE_AT = 0.5;

/**
 * A paddle wheel: how wide its pen is either side of the middle; how far its
 * paddles reach across, which is the pen less a paddle's own thickness, so
 * no marble gets round an end; how thick a paddle is, how high the axle
 * stands above a marble's middle, how long a paddle is — just far enough to
 * dip to the floor — and how long the wheel takes to go round. The axle's
 * height sets how far apart two paddles are along the pen while both are
 * down, and so whether a whole field fits between them.
 */
export const WHEEL = { pen: 2.6, half: 2.42, radius: 0.18, axle: 1.35, arm: 1.81, period: 4.8 };

/**
 * Rows of pegs, each row shifted half a gap from the one before, so that a
 * marble falling straight down a board meets a peg in every other row. The
 * gaps are wider than a marble, so nothing can wedge; what a marble cannot
 * do is go down in a straight line.
 */
/** A gate's bar, right across its pen `u` of the way down the piece, where the pen begins to close. */
function gateBar(u: number): (Omit<Obstacle, 'along' | 'slot'> & { u: number })[] {
  return [
    {
      u,
      across: 0,
      half: 3.2,
      angle: Math.PI / 2,
      radius: 0.2,
      motion: { kind: 'gate', shut: 1.6, period: 2.6, slide: 0.35 },
    },
  ];
}

/** A board's pegs, `PEG_SPACING` apart, a row with one on the middle first and a row without next. */
function pegRows(): (Omit<Obstacle, 'along' | 'slot'> & { u: number })[] {
  const out: (Omit<Obstacle, 'along' | 'slot'> & { u: number })[] = [];
  // four rows, the last well short of where the board closes: with a fifth nearer the neck, a ball came to rest dead
  // astern of its middle peg, held there by another against the peg beside it, in 6 of 384 races off the gate
  [0.22, 0.36, 0.5, 0.64].forEach((u, r) => {
    const across = r % 2 === 0 ? [-PEG_SPACING, 0, PEG_SPACING] : [-PEG_SPACING / 2, PEG_SPACING / 2];
    for (const c of across) out.push({ u, across: c, half: 0, angle: 0, radius: PEG_CONE, motion: { kind: 'fixed' } });
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

/**
 * Half the thickness of the block that closes the lane at the end: a solid
 * block, since a sheet there was got through by a queue pressing on it.
 */
export const LANE_STOP = 0.5;
/**
 * Half the thickness of the wall at the head of a funnel's way out, behind
 * where a ball falls out of the throat, met and drawn alike.
 */
export const OUTLET_BACK = 0.12;

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
  // under a grid: its crest holds a ball only below 7, and fed off two drops one left it and came down on the
  // grid over whatever was next, or over a spiral's or a jump's wall
  ramp: {
    exit: { x: 1, y: 0, z: -1, turn: 0 },
    rough: Math.hypot(CELL, LEVEL) * 1.1,
    curve: rampCurve,
    lid: { from: 0, upto: 1 },
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
  // under a grid the whole way: a ball at any speed leaves the crest of a fall this steep, and at two drops'
  // speed clears the cell and comes down a level above whatever is next; no crest within a cell holds it
  drop: {
    exit: { x: 1, y: 0, z: -2, turn: 0 },
    rough: Math.hypot(CELL, LEVEL * 2) * 1.1,
    curve: dropCurve,
    lid: { from: 0, upto: 1 },
  },
  // walled higher, since a ball at a drop's speed rides a spiral's outer wall higher than a chute's holds
  spiralLeft: {
    exit: { x: 0, y: 0, z: -2, turn: 0 },
    rough: Math.hypot(Math.PI * 2 * SPIRAL_RADIUS, LEVEL * 2) * 1.1,
    curve: (t, out) => spiralCurve(1, t, out),
    wall: SPIRAL_WALL,
  },
  spiralRight: {
    exit: { x: 0, y: 0, z: -2, turn: 0 },
    rough: Math.hypot(Math.PI * 2 * SPIRAL_RADIUS, LEVEL * 2) * 1.1,
    curve: (t, out) => spiralCurve(-1, t, out),
    wall: SPIRAL_WALL,
  },
  // a jump that carries its own landing, so it joins whatever is before and after it: a run-up down a level, the
  // lip, a cell of air, and a board beyond to come down on. A ball reaches the lip at 13 to 19 whatever it came
  // in at, from a standstill on the gate to two drops' speed, off the run-up's own fall less what its ease at the
  // top, its dip and the air take, and clears the cell of air to the landing every time, 24 seeds at each. The
  // run-up's first half, the ramp's own crest, is under a grid: fed straight off another jump's landing at 17 a
  // ball left that crest and went over the wall, 9 of 192, as off a drop's; the lip, at the far end, is open
  jump: {
    exit: { x: 5, y: 0, z: -3, turn: 0 },
    rough: CELL * 2.3,
    curve: runUpCurve,
    flies: true,
    lid: { from: 0, upto: 0.5 },
    then: [
      {
        at: { x: 3, y: 0, z: -2 },
        rough: CELL * 2.1,
        curve: boardCurve,
        width: opening(HALF_WIDTH * 2, 0.1, 0.85),
      },
    ],
  },
  // A board with something on it is under a grid at the walls' own height, the whole way. What stands on it
  // throws a fast ball up as well as aside, a cone's leaning side, a mound's rise, a paddle or a bar: off two
  // drops a ball rode as much as 2.6 over the floor from halfway down any of the four, over walls of 1.2, and
  // walled higher it arrived at whatever came next above that piece's walls, landing on a drop's grid or going
  // over a turn's wall. Under a grid a ball is thrown back down, nothing leaves higher than a chute's walls, and
  // bouncing between the board and its grid shuffles a field: over 48 seeds of each of nine ways in and out, off
  // the gate, a straight or two drops, into a drop, a turn or a straight, none was lost, stopped or through
  // anything, where uncovered bumps into a drop lost 10 in 192. The pegs are cones, `PEG_CONE` wide at the foot,
  // since a ball comes to rest against a post and is pushed off a cone
  pegs: {
    exit: { x: 2, y: 0, z: -1, turn: 0 },
    rough: CELL * 2.1,
    curve: boardCurve,
    width: opening(BOARD, 0.15, 0.8),
    obstacles: pegRows(),
    lid: { from: 0, upto: 1 },
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
    lid: { from: 0, upto: 1 },
  },
  gate: {
    exit: { x: 1, y: 0, z: -1, turn: 0 },
    rough: Math.hypot(CELL, LEVEL) * 1.1,
    curve: rampCurve,
    // a pen a board wide ahead of the gate, closing to the chute after it: a gate across a chute lets a field
    // go only in the order it came, first held first out; a pen lets the held pile spread out abreast, and it
    // comes out of the neck in whatever order the jostle gives it. The bar stands halfway down the piece
    // (`GATE_AT`) and the pen closes from the bar on, over the rest of it: a crowd let go from a standstill into
    // a neck closing over the ramp's flattening end arched in it as a hopper does, all eight, where let go
    // halfway down it has speed first and the neck closes over twice the distance
    width: opening(3.2, 0.2, GATE_AT),
    obstacles: gateBar(GATE_AT),
    lid: { from: 0, upto: 1 },
  },
  wheel: {
    exit: { x: 1, y: 0, z: -1, turn: 0 },
    rough: Math.hypot(CELL, LEVEL) * 1.1,
    curve: rampCurve,
    // a pen, and a wheel right across it. A wheel over one half of its pen was a wheel the field could miss: a
    // marble comes into a pen within a chute's width of its middle and keeps its line, and after a bend the whole
    // field comes down the outside, so on Switchback it passed the wheel by in every race of sixty
    width: opening(WHEEL.pen, 0.25, WHEEL_CLOSE),
    wall: WHEEL_WALL,
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
  // a groove in its middle that sorts a field toward single file, a V a chute wide: a neck barely a ball wide,
  // fed by a crowd, arches as a hopper does, and not one ball in 192 came through it; in a V a ball alone
  // settles into its bottom and only two arriving abreast can sit on its sides together
  narrow: {
    exit: { x: 2, y: 0, z: -1, turn: 0 },
    rough: CELL * 2.1,
    curve: boardCurve,
    trough: true,
  },
  // the channel snaking from wall to wall down a board's fall: what a fast field is slowed by
  brake: { exit: { x: 2, y: 0, z: -1, turn: 0 }, rough: CELL * 2.3, curve: brakeCurve },
  // a board with mounds in its floor, which turn a marble aside as it rolls over one, as a soft peg would
  bumps: {
    exit: { x: 2, y: 0, z: -1, turn: 0 },
    rough: CELL * 2.1,
    curve: boardCurve,
    width: opening(3.2, 0.15, 0.85),
    mounds: moundRows(),
    lid: { from: 0, upto: 1 },
  },
  // the end: past the line at its start, a lane that is a cup, down a level over most of it and up again to its
  // end, where the field comes to rest in a dip and against each other with no stop to be pressed into, in a V
  // a chute wide: a neck closing to single file, fed a crowd of eight, arched as a hopper does however it was
  // shaped, and a face at the end pressed the first ball into the corner and out over the top. Under a grid:
  // balls that barely grip each other pass a knock down a queue at rest as a Newton's cradle does, and fed off
  // three drops 23 in 192 at the front were sent up the rise and out over the stop
  finish: {
    exit: null,
    rough: CELL * 2.1,
    trough: true,
    lid: { from: 0, upto: 1 },
    curve: (t, out) => {
      laneCurve(t, out);
      // where its bottom is: the fall, a level, and the rise, half of one, curve alike there with the bottom here
      const dip = Math.SQRT2 / (1 + Math.SQRT2);
      // eased from level at every turn, where it begins, at its bottom and at its end: a kink where it began left the
      // queue's last ball, pressed into a sharp crest there by the rest, read as sunk 0.2 into the floor; one at its
      // bottom was a V each ball slammed into; and rising to its end, the stop leaned back with it, and a ball run
      // fast up the rise went over its top
      const [z, dz] = cup(t, dip);
      out[2] += z;
      out[5] += dz;
    },
  },
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

/**
 * The cell beside an end, on its left as the field goes: where a splitter's
 * second lane begins beside its first, and where a joiner's second entry
 * stands beside its first.
 */
export function leftOf(end: { x: number; y: number; z: number; facing: Facing }): {
  x: number;
  y: number;
  z: number;
  facing: Facing;
} {
  const turned: number[] = [0, 0];
  turnBy(end.facing, 0, 1, turned);
  return { x: end.x + turned[0], y: end.y + turned[1], z: end.z, facing: end.facing };
}

/** Which portal a piece is at, as one string, so a run can be walked by looking its joins up. */
function portalKey(x: number, y: number, z: number, facing: Facing): string {
  return `${x},${y},${z},${facing}`;
}

/** One piece sampled into a segment, in the world's own units. */
/** A piece's parts, each worked out into a segment of its own, in the order a marble meets them. */
function sample(piece: Placed, index: number, wall: number, shapes: Compiled['shapes']): Segment[] {
  const shape: Shape = { ...SHAPES[piece.kind], ...shapes?.[piece.kind] };
  // a grid the run asks for goes over every part of the piece from end to end, a bowl excepted, which has none
  const covered = <P extends Part>(part: P): P =>
    piece.lid && !part.bowl ? { ...part, lid: { from: 0, upto: 1 } } : part;
  const out = [samplePart(piece, index, covered(shape), { x: 0, y: 0, z: 0 }, wall)];
  for (const part of shape.then ?? []) out.push(samplePart(piece, index, covered(part), part.at, wall));
  // a splitter's second branch begins at the same entry as the first, not further along it
  if (shape.fork) out.push(samplePart(piece, index, shape.fork.part, { x: 0, y: 0, z: 0 }, wall));
  // a joiner's second entry, off to one side of the one every other piece has, reaching the same exit as it
  if (shape.joins) out.push(samplePart(piece, index, shape.joins, shape.joins.at, wall));
  return out;
}

/** One part of a piece, begun `at` cells along and to the left and levels up from the piece's entry, walled `wall` high unless its shape says higher. */
function samplePart(
  piece: Placed,
  index: number,
  shape: Part,
  at: { x: number; y: number; z: number },
  wall: number,
): Segment {
  const trough = shape.trough ?? false;
  const n = Math.max(8, Math.ceil(shape.rough / SAMPLE_EVERY)) + 1;
  const points = new Float32Array(n * 3),
    tangents = new Float32Array(n * 3),
    ups = new Float32Array(n * 3),
    arc = new Float32Array(n),
    width = new Float32Array(n),
    floor = new Float32Array(n);
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
    floor[i] = width[i];
    // a trough is a chute wide, its floor closing from flat to the bottom of a V over its first stretch, and,
    // unless it is the lane at the end, opening out flat again over its last: a groove that met the next piece
    // as a V handed a ball riding high on its side on to it 0.8 up, above the grid over whatever came next
    if (trough) {
      const x = i / (n - 1);
      width[i] = HALF_WIDTH;
      floor[i] = Math.max(
        TROUGH_FLAT,
        HALF_WIDTH * (1 - x / TROUGH_IN),
        piece.kind === 'finish' ? 0 : HALF_WIDTH * (1 - (1 - x) / TROUGH_IN),
      );
    }
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
    floor,
    obstacles,
    funnel,
    mounds,
    trough,
    lid: shape.lid ? { from: shape.lid.from * length, upto: shape.lid.upto * length } : null,
    open: null,
    wall: Math.max(wall, shape.wall ?? 0),
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
export function compile(run: Run, options: Compiled & { problems?: string[] } = {}): Track {
  const { problems } = options;
  const lean = LEAN;
  const track: Track = {
    name: run.name,
    segments: [],
    length: 0,
    samples: 0,
    slots: 0,
    wall: WALL,
    lean,
  };
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
      segs = sample(run.pieces[pieceIndex], pieceIndex, track.wall, options.shapes);
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
    // a piece is reached a second time only through a joiner's own second entry: anything else is the run coming
    // back round on itself, or one lane of a split running into what the other has already walked, and `before`
    // is left a dead end, since wiring it on into what is walked already left a gap and two ideas of how far
    // along the run the piece is
    const reachedBefore = onwardDone.has(match.piece);
    if (reachedBefore && (!SHAPES[run.pieces[match.piece].kind].joins || committed.has(target))) {
      problems?.push('the run never ends: it comes back round on itself');
      return;
    }
    // the gap, if any, is added before the target is committed, so its own start already stands beyond it
    if (before?.flies || before?.funnel) {
      const last = before.points.length - 3;
      before.gap = Math.hypot(target.points[0] - before.points[last], target.points[1] - before.points[last + 1]);
      if (!committed.has(target)) track.length += before.gap;
    }
    // geometry is committed per entry, since each is its own segment, but the piece as a whole is only walked on
    // from once
    commit(match.piece, segs, match.part, branch);
    target.prev = before ? (segmentIndex.get(before) ?? -1) : -1;
    if (forks) segs[1].prev = target.prev; // the fork's other branch shares the very same predecessor
    if (before) {
      // reaching a splitter hands the field on by which side of the middle it is on, in place of a plain next
      if (forks) before.fork = { a: segmentIndex.get(segs[1])!, b: segmentIndex.get(segs[0])! };
      else before.next = segmentIndex.get(target)!;
    }
    if (reachedBefore) {
      // the two lanes need not have brought the field the same distance: a ball arrives when it arrives, and each
      // lane leans at its own rate so that both reach the joiner at one height (`branchLean`)
      // the field arriving this way goes on exactly where the field that arrived first already does
      target.next = segs[1 - match.part].next;
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
  leanTrack(track, lean);
  openWalls(run, track);
  return track;
}

/**
 * The lean taken into the geometry: every sample lowered by `lean` times how
 * far along the run it is, so that a level piece slopes and a queue on it
 * drains. A shear, so joins stay joined:
 * where one segment ends and the next begins is the same distance along the
 * run, and lowered by the same amount. The tangents lean with the points,
 * and up is squared to the leaned way again.
 */
function leanTrack(track: Track, lean: number): void {
  const { from, rate } = branchLean(track);
  track.segments.forEach((seg, s) => {
    const r = lean * rate[s];
    for (let i = 0; i < seg.arc.length; i++) {
      const o = i * 3;
      seg.points[o + 2] -= lean * from[s] + r * seg.arc[i];
      // the way a point lowered by `r` for every step along the curve goes: the curve's own way, and `r` down for
      // every step of it. Taken as `r` for every step of its level part alone, a steep piece's tangents parted from
      // its points by a hundredth of a radian
      const tx = seg.tangents[o],
        ty = seg.tangents[o + 1],
        tz = seg.tangents[o + 2] - r;
      const tl = Math.hypot(tx, ty, tz) || 1;
      seg.tangents[o] = tx / tl;
      seg.tangents[o + 1] = ty / tl;
      seg.tangents[o + 2] = tz / tl;
      // up stays what it was, less whatever of it now lies along the leaned way
      const along =
        seg.ups[o] * seg.tangents[o] + seg.ups[o + 1] * seg.tangents[o + 1] + seg.ups[o + 2] * seg.tangents[o + 2];
      let ux = seg.ups[o] - along * seg.tangents[o],
        uy = seg.ups[o + 1] - along * seg.tangents[o + 1],
        uz = seg.ups[o + 2] - along * seg.tangents[o + 2];
      const ul = Math.hypot(ux, uy, uz) || 1;
      ux /= ul;
      uy /= ul;
      uz /= ul;
      seg.ups[o] = ux;
      seg.ups[o + 1] = uy;
      seg.ups[o + 2] = uz;
    }
    if (seg.funnel) seg.funnel.z -= lean * from[s];
  });
}

/**
 * How far along the run each segment's lean begins, and at what rate it
 * leans for its own length. A segment on no branch leans from its own start
 * at the lean's own rate. A branch's lanes are not the same length — a lane
 * moved a cell across is about half again longer than one gone straight —
 * so leaned by their own lengths the longer came back to the joiner lower,
 * and met the piece after it as a step up: 0.28 on The Fork, which stopped
 * a slow field against it. Each lane leans instead at whatever rate brings it
 * from where the fork leaves the run to where the join takes it up again.
 */
function branchLean(track: Track): { from: Float64Array; rate: Float64Array } {
  const { segments } = track;
  const from = new Float64Array(segments.length),
    rate = new Float64Array(segments.length).fill(1);
  segments.forEach((seg, s) => (from[s] = seg.start));
  for (const fork of segments) {
    if (!fork.fork) continue;
    const begin = fork.start + fork.length;
    for (const head of [fork.fork.a, fork.fork.b]) {
      // the lane from the fork until it hands on to a segment on no branch, where the run is one again
      const lane: number[] = [];
      let length = 0,
        s = head;
      for (let guard = 0; s >= 0 && segments[s].branch !== 0 && guard < segments.length; guard++) {
        lane.push(s);
        length += segments[s].length;
        s = segments[s].next;
      }
      if (s < 0 || length <= 0) continue;
      const scale = (segments[s].start - begin) / length;
      let so = 0;
      for (const k of lane) {
        from[k] = begin + so * scale;
        rate[k] = scale;
        so += segments[k].length;
      }
    }
  }
  return { from, rate };
}

/**
 * The walls a splitter's two lanes, or a joiner's two entries, leave open
 * where they share a floor: a wall of one lane whose foot stands inside the
 * other lane's channel is not there, so where the two begin or end at one
 * point there is one channel, and they part at the crotch where the two
 * inner walls meet, as a real Y does.
 */
function openWalls(run: Run, track: Track): void {
  const byPiece = new Map<number, Segment[]>();
  for (const seg of track.segments) {
    const kind = run.pieces[seg.piece]?.kind;
    if (kind !== 'splitter' && kind !== 'joiner') continue;
    byPiece.set(seg.piece, [...(byPiece.get(seg.piece) ?? []), seg]);
  }
  for (const lanes of byPiece.values())
    for (const lane of lanes) {
      const n = lane.arc.length;
      let any = false;
      const open = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const o = i * 3;
        const tx = lane.tangents[o],
          ty = lane.tangents[o + 1],
          tz = lane.tangents[o + 2];
        const ux = lane.ups[o],
          uy = lane.ups[o + 1],
          uz = lane.ups[o + 2];
        const bx = ty * uz - tz * uy,
          by = tz * ux - tx * uz,
          bz = tx * uy - ty * ux;
        for (const [side, bit] of [
          [-1, 1],
          [1, 2],
        ] as const) {
          const w = lane.width[i] * side;
          const fx = lane.points[o] + bx * w,
            fy = lane.points[o + 1] + by * w,
            fz = lane.points[o + 2] + bz * w;
          for (const other of lanes) {
            if (other === lane || !inside(other, fx, fy, fz)) continue;
            open[i] |= bit;
            any = true;
          }
        }
      }
      lane.open = any ? open : null;
    }
}

/** Whether a point stands inside a segment's channel: between its walls, near its floor, and within its length. */
function inside(seg: Segment, x: number, y: number, z: number): boolean {
  let best = Infinity,
    k = 0;
  for (let j = 0; j < seg.arc.length; j++) {
    const d = Math.hypot(seg.points[j * 3] - x, seg.points[j * 3 + 1] - y, seg.points[j * 3 + 2] - z);
    if (d < best) {
      best = d;
      k = j;
    }
  }
  const o = k * 3;
  const dx = x - seg.points[o],
    dy = y - seg.points[o + 1],
    dz = z - seg.points[o + 2];
  const tx = seg.tangents[o],
    ty = seg.tangents[o + 1],
    tz = seg.tangents[o + 2];
  const ux = seg.ups[o],
    uy = seg.ups[o + 1],
    uz = seg.ups[o + 2];
  const along = seg.arc[k] + dx * tx + dy * ty + dz * tz;
  const across = dx * (ty * uz - tz * uy) + dy * (tz * ux - tx * uz) + dz * (tx * uy - ty * ux);
  const up = dx * ux + dy * uy + dz * uz;
  return along >= 0 && along <= seg.length && Math.abs(across) < seg.width[k] - 1e-3 && Math.abs(up) < seg.wall;
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
  run.pieces.forEach((p, i) => {
    if (p.lid && lidRefused(p.kind)) problems.push(`piece ${i}: ${lidRefused(p.kind)}`);
  });

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
  const track = compile(run, { problems: forked });
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
      if (!(w >= HALF_WIDTH - 1e-4)) {
        problems.push(`segment ${i} is narrower than a chute somewhere, at ${w}`);
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

/** The whole run's extent, for the sun's shadow to be fitted to and the camera to be set by. */
export function boxOf(track: Track): { min: [number, number, number]; max: [number, number, number] } {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (const seg of track.segments)
    for (let i = 0; i < seg.arc.length; i++) {
      const o = i * 3;
      minX = Math.min(minX, seg.points[o]);
      maxX = Math.max(maxX, seg.points[o]);
      minY = Math.min(minY, seg.points[o + 1]);
      maxY = Math.max(maxY, seg.points[o + 1]);
      minZ = Math.min(minZ, seg.points[o + 2]);
      maxZ = Math.max(maxZ, seg.points[o + 2]);
    }
  const pad = HALF_WIDTH + 4;
  return {
    min: [minX - pad, minY - pad, minZ - pad],
    max: [maxX + pad, maxY + pad, maxZ + pad],
  };
}
