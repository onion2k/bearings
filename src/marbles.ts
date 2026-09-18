/**
 * The marbles, and what they do on a track: the race itself, without the
 * picture or the page.
 *
 * A marble does not move about freely; it rides the channel. What it is, is
 * how far along its segment it has got, how far across the channel it sits,
 * and how fast it is doing both. Gravity is taken along the track's own
 * direction, so a marble speeds up down a ramp and slows going along the
 * flat, and the walls of the channel keep it in. That is what buys the
 * shapes a marble run needs — a spiral or a crossover is nothing special to
 * a marble that only knows how far along it is.
 *
 * Because every marble is somewhere along one line, two of them touching is
 * one distance and not a search: ordering them by how far along the run they
 * are puts the only pairs that can touch next to each other. Eight marbles
 * cost nothing, and the answer is the same every time, which is what the
 * replays and every baseline rest on.
 */
import {
  HALF_WIDTH,
  LEVEL,
  type Pose,
  type Segment,
  type Track,
  at,
  bowlHeight,
  pose,
  pose0,
  spot,
  widthAt,
} from './track';
import { type Random, seeded } from './random';

/** How many marbles race. */
export const MARBLES = 8;
/** How big a marble is. */
export const RADIUS = 0.45;
/** How hard the world pulls down. */
export const GRAVITY = 30;
/**
 * A solid ball that rolls rather than slides gets five sevenths of the pull
 * along the slope, the rest going into its spin. It is the one piece of real
 * physics here and it is what makes the speeds look right.
 */
export const ROLLING = 5 / 7;
/**
 * How much every piece leans the way the run goes, as a grade. A real marble
 * run is set with a little fall even on its level pieces, because a marble
 * brought to rest on the true level stays there; here, once boards and gates
 * and wheels began holding the front of a field up, the queue behind backed
 * on to level bends and marbles were stranded on them. At this lean even the
 * least free-rolling marble is pulled harder than it is held back.
 */
export const LEAN = 0.05;
/** How much speed costs, with the speed and regardless of it. */
export const DRAG = 0.02;
export const RESIST = 0.6;
/** How much of its speed a marble keeps off a wall, and off another marble. */
export const BOUNCE = 0.4;
/** How far apart they sit on the start, waiting. */
export const SPACING = 1.1;
/**
 * The most passes a step takes to settle marbles pressed together. A clump of
 * three settles in two or three; a pile of five squeezed into the neck where
 * a gate's pen closes back to a chute took more than six, and was left a
 * little inside itself. Most steps need none, and stop at the first pass
 * that parts nothing, so the ceiling costs nothing until a pile needs it.
 */
export const SETTLE = 16;

/** What a marble is doing. */
export const WAITING = 0,
  RACING = 1,
  FINISHED = 2,
  STALLED = 3,
  FLYING = 4,
  LOST = 5,
  SWIRLING = 6;

/**
 * How springy a peg or a moving part is, how hard a funnel's rim grips a
 * marble pressed against it, and how fast a marble leaves a funnel's hole
 * for the piece below. The rim's grip is what makes a funnel slow a field:
 * the faster a marble goes round, the harder it is pressed into the rim, and
 * the more speed it loses, so a fast one circles longest.
 */
export const KNOCK = 0.5;
/**
 * How far off true a strike on something in the way may come away, either
 * way, in radians. Nothing on a real run is quite true, a peg or a paddle
 * least of all, and it is the pegs, gates and paddles that decide a race:
 * marbles that are all the same, struck by things that send each exactly the
 * same way, would finish in whatever order the grid and the moving parts'
 * starts put them, race after race.
 */
export const RATTLE = 0.3;
export const GRIP = 0.1;
export const DROP = 3;
/**
 * How fast going round a bowl costs a marble, a share of its speed each
 * second. Without it a marble off the rim keeps its way round, speeds up as it
 * falls in, and is thrown straight back out: it orbits for ever. With it the
 * orbit closes in lap by lap, as a real one does.
 */
export const BOWL_DRAG = 0.35;
/**
 * How long a marble may go round a bowl before it is called. Below a drag of
 * about a third a marble could be caught in an orbit that never closed; at
 * this one none has been, but a race that cannot end is noticed, not waited
 * on, whatever is tuned later.
 */
export const BOWL_PATIENCE = 15;

/**
 * How many pieces past a jump a marble in the air looks for somewhere to come
 * down, and how long it may stay up before it is taken to have gone over the
 * edge of everything. A marble that has missed its landing is lost, not left
 * falling for ever.
 */
export const LANDING_LOOK = 3;
export const AIR_TIME = 4;

/**
 * How slowly a marble may be going, and for how long, before the run is
 * called on it. A run that cannot be finished has to be noticed and said,
 * because the alternative is a race nobody is ever told is over. It is
 * longer than any gate holds a marble or a pile takes to drain through a
 * neck, so a marble waiting its turn is not taken for one stuck.
 */
export const CRAWL = 0.05;
export const PATIENCE = 6;

/** What happens in a race, for whoever shows it. Every one may be left out. */
export interface RaceEvents {
  /** They were let go. */
  released?(count: number): void;
  /** A marble reached the cup: which one, in which place, and how long it took. */
  finished?(marble: number, place: number, seconds: number): void;
  /** A marble came to rest short of the cup, and is not going to get there. */
  stalled?(marble: number, seconds: number): void;
  /** A marble off a jump came down nowhere it could land: off the run altogether. */
  lost?(marble: number, seconds: number): void;
}

export interface MarblesOptions {
  count?: number;
  /** Chance, for the small differences between one marble and another. */
  random?: Random;
}

/**
 * The field of marbles on a track. Everything about them is a typed array
 * the caller reads straight out for drawing, checking and hashing, indexed
 * by which marble it is.
 */
export class Marbles {
  readonly count: number;
  /** Which segment each is on. */
  readonly segment: Int32Array;
  /** How far along that segment, and how far across the channel from its middle. */
  readonly along: Float32Array;
  readonly across: Float32Array;
  /** How fast, along and across. */
  readonly speed: Float32Array;
  readonly drift: Float32Array;
  /** Where each one is, written every step for whoever draws it. */
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  /** How far it has rolled, for turning it as it is drawn. */
  readonly rolled: Float32Array;
  readonly state: Uint8Array;
  /** How long it took, once it is in the cup; -1 until then. */
  readonly took: Float32Array;
  /** Which place it came, from 1; 0 until it finishes. */
  readonly place: Int32Array;
  /**
   * How much of the usual friction and drag the marbles meet: 1 in every
   * race. It is the same for every marble, as everything about them is —
   * which one wins is the draw of the grid and the run, and a pick is a roll
   * of a die — and it is here for the tests, which turn it off for a marble
   * that never slows, or right up for one that cannot move.
   */
  friction = 1;
  /**
   * In the air: how fast each is going through it, where it left the lip,
   * and how long it has been up. Only a marble off a jump uses these; on the
   * track, where it is comes from how far along it is.
   */
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly vz: Float32Array;
  private readonly airX: Float32Array;
  private readonly airY: Float32Array;
  private readonly aloft: Float32Array;
  /** Where each marble in a funnel is in its bowl, across the ground from the bowl's middle. */
  private readonly bowlX: Float32Array;
  private readonly bowlY: Float32Array;
  /**
   * Where each moving piece begins its turn, a share of the way round, drawn
   * for each race: the same run meets its sweepers, gates and wheels at
   * different moments from one race to the next, and at the same moments
   * from the same seed.
   */
  readonly phase: Float32Array;
  private readonly at = pose0();
  /** How low the run goes: a marble fallen well below it has fallen off it. */
  private readonly bottom: number;
  /** How many have finished, how many stopped short, how many are lost, and the time of the race so far. */
  finishers = 0;
  stalled = 0;
  lost = 0;
  t = 0;

  /** How long each has been barely moving, for telling a slow marble from a stopped one. */
  private readonly crawling: Float32Array;

  private readonly here = spot();
  private readonly ahead = spot();
  private readonly order: Int32Array;
  /** Which slot on the start each marble drew. */
  readonly grid: Int32Array;
  /**
   * The field in the order of its slots on the grid, which is the order it
   * is stepped and parted in. Taken by marble instead, the lower-numbered of
   * two marbles level with each other was always the one parted forward, and
   * the one moved first; in the float arithmetic even the order two are
   * worked through in shows, and a marble won or lost races for being the
   * marble it was. By slot, a marble is only where it drew.
   */
  private readonly bySlot: Int32Array;
  /**
   * The race's own chance, for which way each strike on something in the way
   * comes off: started again from the same point whenever the field is set
   * up, so a race set up again without a fresh draw runs exactly as before.
   */
  private rattle: Random = () => 0.5;
  private rattleFrom = 0;

  constructor(
    readonly track: Track,
    private readonly events: RaceEvents = {},
    options: MarblesOptions = {},
  ) {
    const random = options.random ?? Math.random;
    this.count = options.count ?? MARBLES;
    const n = this.count;
    this.segment = new Int32Array(n);
    this.along = new Float32Array(n);
    this.across = new Float32Array(n);
    this.speed = new Float32Array(n);
    this.drift = new Float32Array(n);
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.z = new Float32Array(n);
    this.rolled = new Float32Array(n);
    this.state = new Uint8Array(n);
    this.took = new Float32Array(n);
    this.place = new Int32Array(n);
    this.order = new Int32Array(n);
    this.crawling = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.vz = new Float32Array(n);
    this.airX = new Float32Array(n);
    this.airY = new Float32Array(n);
    this.aloft = new Float32Array(n);
    this.bowlX = new Float32Array(n);
    this.bowlY = new Float32Array(n);
    this.phase = new Float32Array(track.slots);
    let bottom = Infinity;
    for (const seg of track.segments)
      for (let k = 2; k < seg.points.length; k += 3) bottom = Math.min(bottom, seg.points[k]);
    this.bottom = bottom;
    this.grid = new Int32Array(n);
    this.bySlot = new Int32Array(n);
    this.draw(random);
    this.reset();
  }

  /**
   * The race drawn again: which slot each marble starts from, where each
   * moving piece begins its turn, and the race's own chance for how strikes
   * come off. The grid is drawn rather than handed out in order, because the
   * same marble on pole every race would be no race at all, and it is drawn
   * afresh for each race; the game draws it as the gate opens, after the
   * players have picked.
   */
  draw(random: Random) {
    const n = this.count;
    for (let i = 0; i < n; i++) this.grid[i] = i;
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const swap = this.grid[i];
      this.grid[i] = this.grid[j];
      this.grid[j] = swap;
    }
    for (let s = 0; s < this.phase.length; s++) this.phase[s] = random();
    this.rattleFrom = Math.floor(random() * 4294967296);
  }

  /** Everything back on the start, waiting, with the race not yet run. */
  reset() {
    this.t = 0;
    this.rattle = seeded(this.rattleFrom);
    this.finishers = 0;
    this.stalled = 0;
    this.lost = 0;
    // two abreast, so the grid is half as long and a marble has somewhere to go from the off
    const wall = HALF_WIDTH - RADIUS;
    const rows = Math.ceil(this.count / 2);
    const room = this.track.segments[0].length - RADIUS * 2;
    const gap = rows > 1 ? Math.min(SPACING, room / (rows - 1)) : SPACING;
    for (let i = 0; i < this.count; i++) {
      this.crawling[i] = 0;
      this.vx[i] = this.vy[i] = this.vz[i] = 0;
      this.aloft[i] = 0;
      this.segment[i] = 0;
      // the one at the front of the grid is nearest the drop, and they alternate across the channel
      const slot = this.grid[i];
      this.along[i] = Math.max(0, this.track.segments[0].length - RADIUS - Math.floor(slot / 2) * gap);
      this.across[i] = slot % 2 === 0 ? -wall : wall;
      this.speed[i] = 0;
      this.drift[i] = 0;
      this.rolled[i] = 0;
      this.state[i] = WAITING;
      this.took[i] = -1;
      this.place[i] = 0;
      this.bySlot[slot] = i;
    }
    this.write();
  }

  /** Whether a marble is on the track and rolling, as it is now. */
  private stillRacing(i: number): boolean {
    return this.state[i] === RACING;
  }

  /** Let them go. */
  release() {
    let let_go = 0;
    for (let i = 0; i < this.count; i++)
      if (this.state[i] === WAITING) {
        this.state[i] = RACING;
        let_go++;
      }
    if (let_go > 0) this.events.released?.(let_go);
  }

  /** Whether the race is done with: everything in the cup, stopped short of it, or lost off the run. */
  get over(): boolean {
    return this.finishers + this.stalled + this.lost >= this.count;
  }

  /** One fixed step of the race. */
  step(dt: number) {
    this.t += dt;
    const { track } = this;
    for (let k = 0; k < this.count; k++) {
      const i = this.bySlot[k];
      if (this.state[i] === FLYING) {
        this.fly(i, dt);
        continue;
      }
      if (this.state[i] === SWIRLING) {
        this.swirl(i, dt);
        continue;
      }
      if (this.state[i] !== RACING) continue;
      at(track, this.segment[i], this.along[i], this.here);
      // gravity along the track: down its own slope, less the share that goes into the marble's spin
      const pull = GRAVITY * (LEAN - this.here.tz) * ROLLING;
      const drag = DRAG * this.friction * this.speed[i] * Math.abs(this.speed[i]);
      this.speed[i] += (pull - drag) * dt;
      // rolling resistance only ever slows a marble to a stop, never past it: taken as a push the other way it
      // could be bigger than the speed it was slowing, throwing a marble back and forth, and a marble that
      // should have stuck fast was jittered all the way to the cup
      const resist = RESIST * this.friction * dt;
      this.speed[i] = Math.abs(this.speed[i]) <= resist ? 0 : this.speed[i] - resist * Math.sign(this.speed[i]);
      // going round a bend throws a marble at the outer wall, and the wall holds it in
      const bend = this.bend(this.segment[i], this.along[i]);
      // out on the wide line there is further to go, so the same speed buys less of the run
      const wide = Math.max(0.5, 1 + this.across[i] * bend);
      this.along[i] += (this.speed[i] * dt) / wide;
      this.rolled[i] += (this.speed[i] * dt) / RADIUS;
      this.drift[i] += bend * this.speed[i] * this.speed[i] * dt;
      // a chute settles a marble into its middle; a board lets it wander, which is what a board is for
      this.drift[i] -= this.drift[i] * (this.here.w > HALF_WIDTH * 1.5 ? 0.3 : 2) * dt;
      this.across[i] += this.drift[i] * dt;
      this.walls(i);
      this.knock(i, true);

      // off the end of a piece and on to the next. Reaching the cup at all is finishing: a marble that
      // rolled to a halt inside it would otherwise never be called home.
      while (this.along[i] > track.segments[this.segment[i]].length) {
        // off the lip of a jump there is no next piece to run on to, only air
        if (track.segments[this.segment[i]].flies) {
          this.takeOff(i);
          break;
        }
        const next = track.segments[this.segment[i]].next;
        if (next < 0) {
          this.finish(i);
          break;
        }
        this.along[i] -= track.segments[this.segment[i]].length;
        this.segment[i] = next;
        if (track.segments[next].funnel) {
          this.enter(i);
          break;
        }
        if (track.segments[next].next < 0) {
          this.finish(i);
          break;
        }
      }
      // over a join it may have finished, or gone into a bowl: asked afresh, since the type checker takes the
      // state it was in at the top of the step to hold through the calls that change it
      if (!this.stillRacing(i)) continue;

      // barely moving for long enough means it is not going to arrive
      if (Math.abs(this.speed[i]) < CRAWL) {
        this.crawling[i] += dt;
        if (this.crawling[i] >= PATIENCE) {
          this.state[i] = STALLED;
          this.stalled++;
          this.events.stalled?.(i, this.t);
          continue;
        }
      } else this.crawling[i] = 0;
      // and never back off the start, nor back up over a gap into the air it came down out of
      if (this.along[i] < 0) {
        const seg0 = this.segment[i];
        if (seg0 === 0 || track.segments[seg0 - 1].flies || track.segments[seg0 - 1].funnel) {
          this.along[i] = 0;
          if (this.speed[i] < 0) this.speed[i] = 0;
        } else {
          this.segment[i] = seg0 - 1;
          this.along[i] += track.segments[seg0 - 1].length;
        }
      }
    }
    this.touching();
    this.jostle();
    this.write();
  }

  /**
   * The walls, wherever the piece has them at the marble's new place: a board
   * closing up to a chute can narrow faster than a step covers, so the wall is
   * read where the marble is now and not where it was.
   */
  private walls(i: number) {
    const wall = widthAt(this.track, this.segment[i], this.along[i]) - RADIUS;
    if (this.across[i] > wall) {
      this.across[i] = wall;
      if (this.drift[i] > 0) this.drift[i] = -this.drift[i] * BOUNCE;
    } else if (this.across[i] < -wall) {
      this.across[i] = -wall;
      if (this.drift[i] < 0) this.drift[i] = -this.drift[i] * BOUNCE;
    }
  }

  /**
   * Whatever is in the way on the marble's piece, met in the piece's own
   * along-and-across: set out of it, and — when `bounce` — sent off it,
   * with the thing's own movement counted, so a sweeper throws what it hits
   * and a wheel's paddle carries what it catches up. Whether it met anything.
   */
  private knock(i: number, bounce: boolean): boolean {
    const seg = this.track.segments[this.segment[i]];
    let hit = false;
    for (const ob of seg.obstacles) {
      const p = pose(ob, this.t, ob.slot >= 0 ? this.phase[ob.slot] : 0, this.at);
      if (!p.present) continue;
      // the nearest point on the rod to the marble, and the way from it to the marble
      const pa = this.along[i] - p.along,
        pc = this.across[i] - p.across;
      const s = Math.min(Math.max(pa * p.da + pc * p.dc, -p.half), p.half);
      const qa = pa - p.da * s,
        qc = pc - p.dc * s;
      const d = Math.hypot(qa, qc);
      const reach = ob.radius + RADIUS;
      if (d >= reach) continue;
      hit = true;
      let na = d > 1e-6 ? qa / d : -1,
        nc = d > 1e-6 ? qc / d : 0;
      // square on to a peg there is no side to roll off by, and on a slope it would sit on the peg's crown for
      // ever; it is given a side by the slot it drew on the grid, so the same race does the same thing every
      // time, and no marble is sent one way more often than another for being the marble it is
      if (ob.half === 0 && Math.abs(nc) < 0.05) {
        nc += this.grid[i] % 2 === 0 ? 0.08 : -0.08;
        const l = Math.hypot(na, nc);
        na /= l;
        nc /= l;
      }
      const out = reach - d;
      this.along[i] = Math.min(Math.max(this.along[i] + na * out, 0), seg.length);
      this.across[i] += nc * out;
      // pushed out sideways into a wall, a marble has nowhere to go and the two stay inside each other: a paddle
      // swung to the wall, or a gate sliding shut across its pen, would crush it. It is let out along the piece
      // instead, past the end of the thing, the way the marbles go.
      const wall = widthAt(this.track, this.segment[i], this.along[i]) - RADIUS;
      if (Math.abs(this.across[i]) > wall) {
        this.across[i] = Math.sign(this.across[i]) * wall;
        const ahead = Math.abs(na) > 0.2 ? Math.sign(na) : 1;
        for (let k = 0; k < 12 && this.inside(i, p, reach); k++)
          this.along[i] = Math.min(Math.max(this.along[i] + ahead * 0.12, 0), seg.length);
      }
      if (!bounce) continue;
      const rv = (this.speed[i] - p.va) * na + (this.drift[i] - p.vc) * nc;
      if (rv < 0) {
        // it comes away a little to one side or the other of true, by the race's own draw, which is taken in the
        // order of the grid so no marble is dealt a better share of it than another. Only the way it comes away
        // is turned, and not how hard: the blow is as hard as it was square on, so a gate sliding sideways past
        // a marble lends it none of that sideways speed. Turned by so little, it still sends the marble clear.
        const a = (this.rattle() * 2 - 1) * RATTLE;
        const c = Math.cos(a),
          s = Math.sin(a);
        const give = -(1 + KNOCK) * rv;
        this.speed[i] += give * (na * c - nc * s);
        this.drift[i] += give * (na * s + nc * c);
      }
    }
    return hit;
  }

  /** Whether a marble is inside a thing in the way as it stands, by more than the give a push leaves. */
  private inside(i: number, p: Pose, reach: number): boolean {
    const pa = this.along[i] - p.along,
      pc = this.across[i] - p.across;
    const s = Math.min(Math.max(pa * p.da + pc * p.dc, -p.half), p.half);
    return Math.hypot(pa - p.da * s, pc - p.dc * s) < reach - 1e-3;
  }

  /**
   * Into a funnel's bowl, on its rim, going round it the way it came in: its
   * speed along the track becomes its way round, and what it had across the
   * track its way in toward the middle.
   */
  private enter(i: number) {
    const seg = this.track.segments[this.segment[i]];
    const bowl = seg.funnel!;
    const o = 0;
    const r = bowl.rim - RADIUS;
    // the rim point it came in at, from the bowl's middle, and round it the way the track was heading
    const ex = seg.points[o] - bowl.x,
      ey = seg.points[o + 1] - bowl.y;
    const el = Math.hypot(ex, ey) || 1;
    this.bowlX[i] = (ex / el) * r;
    this.bowlY[i] = (ey / el) * r;
    const tx = seg.tangents[o],
      ty = seg.tangents[o + 1];
    const tl = Math.hypot(tx, ty) || 1;
    this.vx[i] = (tx / tl) * this.speed[i] - (ex / el) * this.drift[i];
    this.vy[i] = (ty / tl) * this.speed[i] - (ey / el) * this.drift[i];
    this.vz[i] = 0;
    this.along[i] = 0;
    this.across[i] = 0;
    this.crawling[i] = 0;
    this.aloft[i] = 0;
    this.state[i] = SWIRLING;
    this.placeInBowl(i);
  }

  /**
   * A step round a funnel. The bowl's slope pulls a marble toward the middle;
   * going round, it is thrown out against the rim, and the rim grips it the
   * harder the faster it goes. Slowed enough, the slope wins and takes it down
   * to the hole, and out on to the piece below.
   */
  private swirl(i: number, dt: number) {
    const seg = this.track.segments[this.segment[i]];
    const bowl = seg.funnel!;
    // round and round for longer than any bowl should hold a marble is a marble that will never get out
    this.aloft[i] += dt;
    if (this.aloft[i] > BOWL_PATIENCE) {
      this.state[i] = STALLED;
      this.stalled++;
      this.events.stalled?.(i, this.t);
      return;
    }
    let x = this.bowlX[i],
      y = this.bowlY[i];
    const r = Math.hypot(x, y) || 1e-6;
    const rx = x / r,
      ry = y / r;
    // the pull down the bowl's own slope, less the share that goes into a rolling marble's spin
    const eps = 1e-3;
    const slope = (bowlHeight(bowl, r + eps) - bowlHeight(bowl, r - eps)) / (2 * eps);
    const inward = GRAVITY * ROLLING * Math.sin(Math.atan(slope));
    const v = Math.hypot(this.vx[i], this.vy[i]);
    // what slows it only ever slows it, to a stop at most and never on round the other way
    if (v > 1e-6) {
      const slow = (RESIST + DRAG * v * v + BOWL_DRAG * v) * this.friction * dt;
      const keep = Math.max(0, v - slow) / v;
      this.vx[i] *= keep;
      this.vy[i] *= keep;
    }
    this.vx[i] -= inward * rx * dt;
    this.vy[i] -= inward * ry * dt;
    x += this.vx[i] * dt;
    y += this.vy[i] * dt;
    // the rim: set back inside it, and gripped by how hard it is pressed out into it
    const edge = bowl.rim - RADIUS;
    const out = Math.hypot(x, y);
    if (out > edge) {
      const nx = x / out,
        ny = y / out;
      x = nx * edge;
      y = ny * edge;
      const vn = this.vx[i] * nx + this.vy[i] * ny;
      if (vn > 0) {
        this.vx[i] -= (1 + BOUNCE) * vn * nx;
        this.vy[i] -= (1 + BOUNCE) * vn * ny;
      }
      const round = Math.hypot(this.vx[i], this.vy[i]);
      const pressed = (round * round) / edge - inward;
      if (pressed > 0 && round > 1e-6) {
        const lose = Math.min(round, GRIP * pressed * dt);
        this.vx[i] -= (this.vx[i] / round) * lose;
        this.vy[i] -= (this.vy[i] / round) * lose;
      }
    }
    this.bowlX[i] = x;
    this.bowlY[i] = y;
    this.rolled[i] += (Math.hypot(this.vx[i], this.vy[i]) * dt) / RADIUS;
    // how far in it has come, as how far along the bowl's own piece, for ordering the field
    this.along[i] = Math.min(seg.length, (seg.length * (bowl.rim - Math.hypot(x, y))) / (bowl.rim - bowl.hole));
    // through the hole, and down on to the piece below, heading off the way that piece goes: across its chute
    // by as far as it went through the hole off the middle, so two falling close together do not land as one
    // its middle over the hole is a marble falling through it: the bowl stops at the hole's edge, so anything
    // asked of it further in would leave a flat ring round the hole for a slowed marble to sit in for ever
    if (Math.hypot(x, y) < bowl.hole) {
      const below = this.track.segments[seg.next];
      const tx = below.tangents[0],
        ty = below.tangents[1];
      const tl = Math.hypot(tx, ty) || 1;
      const wall = below.width[0] - RADIUS;
      // across the chute is to the right of the way it goes: (ty, -tx) on the ground
      const across = Math.min(wall, Math.max(-wall, (x * ty - y * tx) / tl));
      // a marble cannot drop through a hole on to one still sitting under it: it waits in the hole until the
      // one below has rolled clear, as the one below cannot be pushed back up into the bowl to make room
      for (let j = 0; j < this.count; j++)
        if (
          j !== i &&
          this.state[j] === RACING &&
          this.segment[j] === seg.next &&
          Math.hypot(this.along[j], this.across[j] - across) < RADIUS * 2
        ) {
          this.placeInBowl(i);
          return;
        }
      this.segment[i] = seg.next;
      this.along[i] = 0;
      this.across[i] = across;
      this.speed[i] = DROP + Math.hypot(this.vx[i], this.vy[i]) * 0.3;
      this.drift[i] = 0;
      this.vx[i] = this.vy[i] = this.vz[i] = 0;
      this.state[i] = RACING;
      if (this.track.segments[seg.next].next < 0) this.finish(i);
      return;
    }
    this.placeInBowl(i);
  }

  /** How far a marble in a bowl is from the bowl's middle, across the ground. */
  bowlRadius(i: number): number {
    return Math.hypot(this.bowlX[i], this.bowlY[i]);
  }

  /** Where a marble in a bowl is in the world: over its place in the bowl, a radius up off the bowl's floor. */
  private placeInBowl(i: number) {
    const bowl = this.track.segments[this.segment[i]].funnel!;
    const r = Math.hypot(this.bowlX[i], this.bowlY[i]);
    this.x[i] = bowl.x + this.bowlX[i];
    this.y[i] = bowl.y + this.bowlY[i];
    this.z[i] = bowl.z + bowlHeight(bowl, r) + RADIUS;
  }

  /**
   * Marbles in the same bowl that have run into one another, sent off each
   * other and parted across the bowl. Going round a rim they run nose to
   * tail, and one coming in at the entry lands among them, so parting one pair
   * pushes the next together: they are settled over as many passes as it
   * takes, and kept inside the rim on every one, as on the track.
   */
  private jostle() {
    const touch = RADIUS * 2;
    // first the speed, once for each touch
    for (let ka = 0; ka < this.count; ka++) {
      const a = this.bySlot[ka];
      if (this.state[a] !== SWIRLING) continue;
      for (let kb = ka + 1; kb < this.count; kb++) {
        const b = this.bySlot[kb];
        if (this.state[b] !== SWIRLING || this.segment[b] !== this.segment[a]) continue;
        const dx = this.bowlX[b] - this.bowlX[a],
          dy = this.bowlY[b] - this.bowlY[a];
        const d = Math.hypot(dx, dy);
        if (d >= touch) continue;
        const nx = d > 1e-6 ? dx / d : 1,
          ny = d > 1e-6 ? dy / d : 0;
        const closing = (this.vx[b] - this.vx[a]) * nx + (this.vy[b] - this.vy[a]) * ny;
        if (closing >= 0) continue;
        const give = (-(1 + BOUNCE) * closing) / 2;
        this.vx[a] -= give * nx;
        this.vy[a] -= give * ny;
        this.vx[b] += give * nx;
        this.vy[b] += give * ny;
      }
    }
    // then where they are, until nothing in any bowl is inside anything else
    for (let pass = 0; pass < SETTLE; pass++) {
      let parted = false;
      for (let ka = 0; ka < this.count; ka++) {
        const a = this.bySlot[ka];
        if (this.state[a] !== SWIRLING) continue;
        for (let kb = ka + 1; kb < this.count; kb++) {
          const b = this.bySlot[kb];
          if (this.state[b] !== SWIRLING || this.segment[b] !== this.segment[a]) continue;
          const dx = this.bowlX[b] - this.bowlX[a],
            dy = this.bowlY[b] - this.bowlY[a];
          const d = Math.hypot(dx, dy);
          if (d >= touch - 1e-9) continue;
          parted = true;
          const nx = d > 1e-6 ? dx / d : 1,
            ny = d > 1e-6 ? dy / d : 0;
          const half = (touch - d) / 2;
          this.bowlX[a] -= nx * half;
          this.bowlY[a] -= ny * half;
          this.bowlX[b] += nx * half;
          this.bowlY[b] += ny * half;
        }
      }
      for (let i = 0; i < this.count; i++) {
        if (this.state[i] !== SWIRLING) continue;
        const edge = this.track.segments[this.segment[i]].funnel!.rim - RADIUS;
        const r = Math.hypot(this.bowlX[i], this.bowlY[i]);
        if (r > edge) {
          this.bowlX[i] *= edge / r;
          this.bowlY[i] *= edge / r;
        }
      }
      if (!parted) break;
    }
    for (let i = 0; i < this.count; i++) if (this.state[i] === SWIRLING) this.placeInBowl(i);
  }

  /** Off the lip: the speed it had along the track and across it becomes its way through the air. */
  private takeOff(i: number) {
    const seg = this.track.segments[this.segment[i]];
    this.along[i] = seg.length;
    at(this.track, this.segment[i], seg.length, this.here);
    const h = this.here;
    const bx = h.ty * h.uz - h.tz * h.uy,
      by = h.tz * h.ux - h.tx * h.uz,
      bz = h.tx * h.uy - h.ty * h.ux;
    this.x[i] = h.x + bx * this.across[i] + h.ux * RADIUS;
    this.y[i] = h.y + by * this.across[i] + h.uy * RADIUS;
    this.z[i] = h.z + bz * this.across[i] + h.uz * RADIUS;
    this.vx[i] = h.tx * this.speed[i] + bx * this.drift[i];
    this.vy[i] = h.ty * this.speed[i] + by * this.drift[i];
    this.vz[i] = h.tz * this.speed[i] + bz * this.drift[i];
    this.airX[i] = this.x[i];
    this.airY[i] = this.y[i];
    this.aloft[i] = 0;
    this.crawling[i] = 0;
    this.state[i] = FLYING;
  }

  /**
   * A step in the air: the whole of gravity, since nothing rolls in the air,
   * and then a look for somewhere to come down on the next few pieces. Nothing
   * touches a marble in the air; one that lands on another is parted from it
   * with everything else on the track, since landing comes before that.
   */
  private fly(i: number, dt: number) {
    this.aloft[i] += dt;
    this.vz[i] -= GRAVITY * dt;
    this.x[i] += this.vx[i] * dt;
    this.y[i] += this.vy[i] * dt;
    this.z[i] += this.vz[i] * dt;
    this.rolled[i] += (Math.hypot(this.vx[i], this.vy[i]) * dt) / RADIUS;
    let s = this.track.segments[this.segment[i]].next;
    for (let k = 0; k < LANDING_LOOK && s >= 0; k++) {
      if (this.land(i, s)) return;
      s = this.track.segments[s].next;
    }
    if (this.aloft[i] > AIR_TIME || this.z[i] < this.bottom - LEVEL * 2) {
      this.state[i] = LOST;
      this.lost++;
      this.events.lost?.(i, this.t);
    }
  }

  /**
   * Whether a marble in the air comes down on a segment this step, and if it
   * does, puts it there: over the piece and not off either end of it, inside
   * its channel, falling and not rising, and down at the height a marble rests
   * at or just through it. It keeps the speed it had along the piece and
   * across it; what it had into the piece is the landing, and goes.
   */
  private land(i: number, s: number): boolean {
    const seg = this.track.segments[s];
    const n = seg.arc.length;
    let best = 0,
      bd = Infinity;
    for (let k = 0; k < n; k++) {
      const o = k * 3;
      const dx = this.x[i] - seg.points[o],
        dy = this.y[i] - seg.points[o + 1],
        dz = this.z[i] - seg.points[o + 2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    const o = best * 3;
    const tx = seg.tangents[o],
      ty = seg.tangents[o + 1],
      tz = seg.tangents[o + 2];
    const ux = seg.ups[o],
      uy = seg.ups[o + 1],
      uz = seg.ups[o + 2];
    const bx = ty * uz - tz * uy,
      by = tz * ux - tx * uz,
      bz = tx * uy - ty * ux;
    const rx = this.x[i] - seg.points[o],
      ry = this.y[i] - seg.points[o + 1],
      rz = this.z[i] - seg.points[o + 2];
    const along = rx * tx + ry * ty + rz * tz,
      up = rx * ux + ry * uy + rz * uz,
      across = rx * bx + ry * by + rz * bz;
    if ((best === 0 && along < 0) || (best === n - 1 && along > 0)) return false;
    const width = seg.width[best];
    if (Math.abs(across) > width) return false;
    if (up > RADIUS || up < -RADIUS * 2) return false;
    if (this.vx[i] * ux + this.vy[i] * uy + this.vz[i] * uz > 0) return false;
    const wall = width - RADIUS;
    this.segment[i] = s;
    this.along[i] = Math.min(Math.max(seg.arc[best] + along, 0), seg.length);
    this.across[i] = Math.min(Math.max(across, -wall), wall);
    this.speed[i] = this.vx[i] * tx + this.vy[i] * ty + this.vz[i] * tz;
    this.drift[i] = this.vx[i] * bx + this.vy[i] * by + this.vz[i] * bz;
    this.vx[i] = this.vy[i] = this.vz[i] = 0;
    this.aloft[i] = 0;
    this.state[i] = RACING;
    if (seg.next < 0) this.finish(i);
    return true;
  }

  /** A marble in the cup: how long it took, and what place it came. */
  private finish(i: number) {
    const seg = this.track.segments[this.segment[i]];
    this.along[i] = seg.length;
    this.speed[i] = 0;
    this.drift[i] = 0;
    this.state[i] = FINISHED;
    this.took[i] = this.t;
    this.place[i] = ++this.finishers;
    this.events.finished?.(i, this.place[i], this.t);
  }

  /**
   * How sharply the track turns where a marble is, and which way: read from
   * how much its direction has changed over a short step along it.
   */
  private bend(segment: number, along: number): number {
    const seg = this.track.segments[segment];
    const step = 0.5;
    const back = Math.max(0, Math.min(along, seg.length) - step);
    const on = Math.min(seg.length, back + step * 2);
    if (on - back < 1e-6) return 0;
    at(this.track, segment, back, this.here);
    at(this.track, segment, on, this.ahead);
    // which way it turned, about the channel's own up: positive is to the left, so a marble is thrown right
    const cx = this.here.ty * this.ahead.tz - this.here.tz * this.ahead.ty;
    const cy = this.here.tz * this.ahead.tx - this.here.tx * this.ahead.tz;
    const cz = this.here.tx * this.ahead.ty - this.here.ty * this.ahead.tx;
    const turned = cx * this.here.ux + cy * this.here.uy + cz * this.here.uz;
    return turned / (on - back);
  }

  /**
   * Marbles that have caught one another up, settled in the channel's own two
   * directions: how far along the run they are, and how far across it. Doing
   * it across as well as along is what lets one marble go round another —
   * resolved along the run alone, a field stays in the order it started in
   * for ever, and no amount of one marble being better than another can
   * change it. The channel is wide enough for two abreast, so it should be.
   *
   * Eight marbles is twenty-eight pairs, which is nothing, so every pair is
   * asked rather than only the ones that happen to be near in the order.
   */
  private touching() {
    let n = 0;
    for (let k = 0; k < this.count; k++) if (this.state[this.bySlot[k]] === RACING) this.order[n++] = this.bySlot[k];
    const runs = this.order;
    const touch = RADIUS * 2;
    // first the speed: what two marbles closing on each other give each other, once for each touch
    for (let k = 0; k < n; k++)
      for (let j = k + 1; j < n; j++) {
        const a = runs[k],
          b = runs[j];
        const da = this.far(b) - this.far(a),
          dc = this.across[b] - this.across[a];
        const d2 = da * da + dc * dc;
        if (d2 >= touch * touch) continue;
        // two marbles exactly on top of one another have no line between them: part them across the channel
        const d = Math.sqrt(d2);
        const nx = d > 1e-6 ? da / d : 0,
          ny = d > 1e-6 ? dc / d : 1;
        const closing = (this.speed[b] - this.speed[a]) * nx + (this.drift[b] - this.drift[a]) * ny;
        if (closing >= 0) continue;
        const give = (-(1 + BOUNCE) * closing) / 2;
        this.speed[a] -= give * nx;
        this.drift[a] -= give * ny;
        this.speed[b] += give * nx;
        this.drift[b] += give * ny;
      }
    // then where they are, over as many passes as it takes a clump to settle: parting one pair can push
    // one of them into a third, and a single pass leaves that third inside it
    for (let pass = 0; pass < SETTLE; pass++) {
      let parted = false;
      for (let k = 0; k < n; k++) for (let j = k + 1; j < n; j++) parted = this.part(runs[k], runs[j]) || parted;
      // parting two can push one into a peg or a wall, so those are kept to on every pass as well
      for (let k = 0; k < n; k++) {
        parted = this.knock(runs[k], false) || parted;
        this.walls(runs[k]);
      }
      if (!parted) break;
    }
  }

  /**
   * Two marbles set apart so they are touching and no closer: across the
   * channel as far as the walls allow, and along the run for whatever the
   * walls would not take. Pushed across alone, a marble pinned on a wall
   * takes none of the push, and the pair are left inside each other.
   * Whether they had to be moved at all.
   */
  private part(a: number, b: number): boolean {
    const touch = RADIUS * 2;
    const da = this.far(b) - this.far(a),
      dc = this.across[b] - this.across[a];
    const d2 = da * da + dc * dc;
    if (d2 >= touch * touch - 1e-9) return false;
    const wallA = widthAt(this.track, this.segment[a], this.along[a]) - RADIUS,
      wallB = widthAt(this.track, this.segment[b], this.along[b]) - RADIUS;
    const d = Math.sqrt(d2);
    const nx = d > 1e-6 ? da / d : 0,
      ny = d > 1e-6 ? dc / d : 1;
    const half = (touch - d) / 2;
    this.across[a] = Math.min(wallA, Math.max(-wallA, this.across[a] - ny * half));
    this.across[b] = Math.min(wallB, Math.max(-wallB, this.across[b] + ny * half));
    // along the run, exactly as far again as leaves them touching with the gap across that the walls allowed
    const across = this.across[b] - this.across[a];
    const need = Math.sqrt(Math.max(0, touch * touch - across * across));
    const along = this.far(b) - this.far(a);
    if (Math.abs(along) < need) {
      // level with each other along the run, the one later in the field goes back, so the answer is the same every time
      const ahead = along > 0 || (along === 0 && nx >= 0) ? 1 : -1;
      const more = (need - Math.abs(along)) / 2;
      this.shove(a, -ahead * more);
      this.shove(b, ahead * more);
    }
    return true;
  }

  /** A marble moved along the run by a little, over a join if it has to go. */
  private shove(i: number, by: number) {
    const { track } = this;
    this.along[i] += by;
    for (;;) {
      const seg = track.segments[this.segment[i]];
      // a push stops at the air either way: nothing is pushed back up onto the lip it flew from or into the
      // bowl it dropped out of, nor on across a gap or into a bowl without flying or dropping into it
      if (this.along[i] < 0) {
        const before = track.segments[this.segment[i] - 1] as Segment | undefined;
        if (!before || before.flies || before.funnel) {
          this.along[i] = 0;
          return;
        }
        this.segment[i]--;
        this.along[i] += track.segments[this.segment[i]].length;
      } else if (this.along[i] > seg.length) {
        if (seg.next < 0 || seg.flies || track.segments[seg.next].funnel) {
          this.along[i] = seg.length;
          return;
        }
        this.along[i] -= seg.length;
        this.segment[i] = seg.next;
      } else return;
    }
  }

  /** Where every marble is, from where it is on the track and how far across it sits. */
  private write() {
    for (let i = 0; i < this.count; i++) {
      // in the air or gone, a marble is where its flight put it, not anywhere on the track
      if (this.state[i] === FLYING || this.state[i] === LOST || this.state[i] === SWIRLING) continue;
      at(this.track, this.segment[i], this.along[i], this.here);
      // across the channel, square to both the way it is going and the way up
      const bx = this.here.ty * this.here.uz - this.here.tz * this.here.uy;
      const by = this.here.tz * this.here.ux - this.here.tx * this.here.uz;
      const bz = this.here.tx * this.here.uy - this.here.ty * this.here.ux;
      this.x[i] = this.here.x + bx * this.across[i] + this.here.ux * RADIUS;
      this.y[i] = this.here.y + by * this.across[i] + this.here.uy * RADIUS;
      this.z[i] = this.here.z + bz * this.across[i] + this.here.uz * RADIUS;
    }
  }

  /** How far along the whole run a marble is: what places it against the others. */
  far(i: number): number {
    const seg = this.track.segments[this.segment[i]];
    if (this.state[i] !== FLYING && this.state[i] !== LOST) return seg.start + this.along[i];
    // in the air: the lip, and then as far as it has gone across the ground the way the lip pointed
    const o = seg.tangents.length - 3;
    const l = Math.hypot(seg.tangents[o], seg.tangents[o + 1]) || 1;
    const flown = ((this.x[i] - this.airX[i]) * seg.tangents[o] + (this.y[i] - this.airY[i]) * seg.tangents[o + 1]) / l;
    return seg.start + seg.length + flown;
  }

  /**
   * The marble still racing that is furthest on, or -1 with none racing. The
   * camera asks every frame, so this makes nothing, unlike `running`.
   */
  leader(): number {
    let best = -1,
      far = -Infinity;
    for (let i = 0; i < this.count; i++) {
      if (this.state[i] !== RACING && this.state[i] !== FLYING && this.state[i] !== SWIRLING) continue;
      const d = this.far(i);
      if (d > far) {
        far = d;
        best = i;
      }
    }
    return best;
  }

  /** Who is winning: the marbles still racing, the one furthest on first. */
  running(): number[] {
    const racing: number[] = [];
    for (let i = 0; i < this.count; i++)
      if (this.state[i] === RACING || this.state[i] === FLYING || this.state[i] === SWIRLING) racing.push(i);
    return racing.sort((a, b) => this.far(b) - this.far(a));
  }
}

/** What must always hold of a field of marbles, a line each. */
export function checkMarbles(marbles: Marbles): string[] {
  const problems: string[] = [];
  const { track } = marbles;
  // how many are doing each thing there is to do, by the state's own number
  const doing = [0, 0, 0, 0, 0, 0, 0];
  const at = pose0();
  for (let i = 0; i < marbles.count; i++) {
    const seg = marbles.segment[i];
    if (seg < 0 || seg >= track.segments.length) {
      problems.push(`marble ${i} is on segment ${seg}, which is not one`);
      continue;
    }
    const numbers = [
      marbles.along[i],
      marbles.speed[i],
      marbles.x[i],
      marbles.y[i],
      marbles.z[i],
      marbles.vx[i],
      marbles.vy[i],
      marbles.vz[i],
    ];
    if (!numbers.every(Number.isFinite)) problems.push(`marble ${i} is not a number`);
    const piece = track.segments[seg];
    if (marbles.along[i] < -1e-3 || marbles.along[i] > piece.length + 1e-3)
      problems.push(`marble ${i} is ${marbles.along[i]} along a segment ${piece.length} long`);
    const state = marbles.state[i];
    if (state > SWIRLING) problems.push(`marble ${i} is doing ${state}, which is nothing a marble does`);
    else doing[state]++;
    if (state === FLYING && !piece.flies) problems.push(`marble ${i} is in the air off a piece with no lip`);
    if (state === SWIRLING) {
      if (!piece.funnel) problems.push(`marble ${i} is going round a piece that is no funnel`);
      else if (marbles.bowlRadius(i) > piece.funnel.rim - RADIUS + 1e-3)
        problems.push(`marble ${i} is ${marbles.bowlRadius(i).toFixed(3)} out in a bowl ${piece.funnel.rim} across`);
      continue;
    }
    const wall = widthAt(track, seg, marbles.along[i]) - RADIUS;
    if (Math.abs(marbles.across[i]) > wall + 1e-3)
      problems.push(`marble ${i} is ${marbles.across[i]} across a channel it may be ${wall} across`);
    if (state !== RACING) continue;
    // nothing sits inside a peg, a sweeper, a shut gate or a wheel's paddle, beyond the give a push leaves
    for (const ob of piece.obstacles) {
      pose(ob, marbles.t, ob.slot >= 0 ? marbles.phase[ob.slot] : 0, at);
      if (!at.present) continue;
      const pa = marbles.along[i] - at.along,
        pc = marbles.across[i] - at.across;
      const s = Math.min(Math.max(pa * at.da + pc * at.dc, -at.half), at.half);
      const d = Math.hypot(pa - at.da * s, pc - at.dc * s);
      if (d < ob.radius + RADIUS - 0.05)
        problems.push(`marble ${i} is ${d.toFixed(3)} from the middle of a ${ob.motion.kind}, inside it`);
    }
  }
  if (doing.reduce((a, b) => a + b, 0) !== marbles.count)
    problems.push(`${marbles.count} marbles, and ${doing.reduce((a, b) => a + b, 0)} of them doing something`);
  if (doing[FINISHED] !== marbles.finishers)
    problems.push(`${doing[FINISHED]} marbles in the cup, and ${marbles.finishers} counted`);
  if (doing[STALLED] !== marbles.stalled)
    problems.push(`${doing[STALLED]} marbles stopped short, and ${marbles.stalled} counted`);
  if (doing[LOST] !== marbles.lost) problems.push(`${doing[LOST]} marbles lost, and ${marbles.lost} counted`);
  for (let a = 0; a < marbles.count; a++)
    for (let b = a + 1; b < marbles.count; b++) {
      // two marbles in the same place on the track would be one passing through the other, across the channel
      // as well as along it; in the air nothing touches, so only those on the track and in a bowl are held to it
      let apart = Infinity;
      if (marbles.state[a] === RACING && marbles.state[b] === RACING)
        apart = Math.hypot(marbles.far(b) - marbles.far(a), marbles.across[b] - marbles.across[a]);
      else if (
        marbles.state[a] === SWIRLING &&
        marbles.state[b] === SWIRLING &&
        marbles.segment[a] === marbles.segment[b]
      )
        apart = Math.hypot(marbles.x[b] - marbles.x[a], marbles.y[b] - marbles.y[a]);
      if (apart < RADIUS * 2 - 0.05)
        problems.push(`marbles ${a} and ${b} are ${apart.toFixed(3)} apart, inside each other`);
    }
  return problems;
}
