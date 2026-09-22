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
  type Bowl,
  type Pose,
  type Track,
  at,
  FELT_GRIP,
  bowlHeight,
  moundHeight,
  moundSlope,
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
 * a gate's pen closes back to a chute took more than six, and a field
 * crowding into the narrowing at the end of the run, or out of a wheel's pen,
 * more than sixteen. Most steps need none, and stop at the first pass that
 * moves nothing by more than `MOVED`, so the ceiling costs nothing until a
 * pile needs it. Until that was the test, a marble merely touching a peg or
 * a paddle counted as moved, and a field at rest ran every pass there was.
 */
export const SETTLE = 48;
export const MOVED = 1e-4;

/** What a marble is doing. */
export const WAITING = 0,
  RACING = 1,
  FINISHED = 2,
  STALLED = 3,
  FLYING = 4,
  LOST = 5,
  SWIRLING = 6;

/**
 * How springy a peg or a moving part is, and how hard a funnel's rim grips a
 * marble pressed against it. The rim's grip is what makes a funnel slow a field:
 * the faster a marble goes round, the harder it is pressed into the rim, and
 * the more speed it loses, so a fast one circles longest.
 */
export const KNOCK = 0.5;
/**
 * The lane at the end of the run is lined with felt and tilted toward its
 * stop: whatever a marble comes over the line with, it is slowed to a crawl
 * of `LANE_PULL / LANE_BRAKE` and creeps on until it reaches its place in the
 * queue. Without the tilt one would come to rest short of the marble in
 * front and leave a gap; without the felt it would hit the stop at the speed
 * it finished at.
 */
export const LANE_PULL = 2.4;
export const LANE_BRAKE = 2;
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
/**
 * How fast going round a bowl costs a marble, a share of its speed each
 * second, over what rolling costs it anywhere. At a third, a marble went round
 * about once before it dropped through, and it had to: the run in ended on
 * the rim, and its end stood across the way round. With the run in over the
 * bowl, a lone marble goes round two to three times and a field half as many
 * again as it did; below this, it goes round no more, only slower.
 */
export const BOWL_DRAG = 0.05;
/**
 * How long a marble may go round a bowl before it is called. The longest any
 * marble has stayed in one, over three hundred races of The Tower and a
 * funnel fed by every sort of piece, is twenty seconds, three of them round
 * the mouth of the hole or waiting at it for the way down to clear; a race
 * that cannot end is noticed, not waited on, whatever is tuned later.
 */
export const BOWL_PATIENCE = 30;

/**
 * How many pieces past a jump a marble in the air looks for somewhere to come
 * down, and how long it may stay up before it is taken to have gone over the
 * edge of everything. A marble that has missed its landing is lost, not left
 * falling for ever.
 */
export const LANDING_LOOK = 3;
export const AIR_TIME = 4;

/**
 * How much further a marble may move in a step than its own speed and what
 * pushed it explain: a quarter of a marble's width. Honest motion leaves a
 * little over, since a marble's middle rides a radius off the floor and goes
 * further than the floor under it over a crest; the most seen, over every run
 * and every pair of pieces, is 0.19, at nearly thirty over the top of a drop.
 * The funnel's jumps, into its bowl and out of its hole, were 1 and more.
 */
export const JUMP = 0.25;

/**
 * How far a thing in the way may move a marble in one step: half a marble.
 * A gate's bar sliding across its pen sweeps 0.3 in a step, and a marble it
 * catches at the wall was set out of it all at once and thrown 0.61 — further
 * back up the run than it had come down it.
 */
export const SHOVE = RADIUS;

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
 * How far below its rim a bowl's floor is under a marble whose middle is `r`
 * from the bowl's middle. Out to the hole, the bowl's own shape; over the
 * hole's edge, the edge's slope carried on, which is a marble tipping over
 * it, until its middle is a radius inside the edge and it falls; and further
 * in, level, which is where one waits on another still under the hole. Taken
 * from the bowl's shape alone, the floor stopped at the edge, and a marble
 * went from its edge to the middle of the throat in one step.
 */
function floorUnder(bowl: Bowl, r: number): number {
  if (r >= bowl.hole) return bowlHeight(bowl, r);
  const eps = 1e-3;
  const edge = (bowlHeight(bowl, bowl.hole + eps) - bowlHeight(bowl, bowl.hole)) / eps;
  return bowlHeight(bowl, bowl.hole) - edge * (bowl.hole - Math.max(r, bowl.hole - RADIUS));
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
  private readonly there = spot();
  /** Somewhere in the world a marble is, worked out into and read straight back, so working it out makes nothing. */
  private readonly point = [0, 0, 0];
  /**
   * The most each marble has moved in a step beyond what its own speed and
   * everything that pushed it explain, since the field was last set on the
   * gate: a marble set down somewhere it never went, as the funnel once set
   * one down inside its rim and again below its hole. Kept since the gate, and
   * not for the last step only, because the rules are asked after every tenth
   * step, and a jump has to be there to be seen whenever they are.
   */
  readonly jumped: Float32Array;
  /** Which piece of the run each marble was on after its worst jump, to say where to look. */
  readonly jumpedOn: Int32Array;
  /** Where each marble was as the step began, the fastest it went of its own in it, and how far it was pushed. */
  private readonly fromX: Float32Array;
  private readonly fromY: Float32Array;
  private readonly fromZ: Float32Array;
  private readonly went: Float32Array;
  private readonly pushed: Float32Array;
  /**
   * The furthest a thing in the way has moved a marble in one shove since the
   * field was set on the gate, and which piece did it: what `SHOVE` is the
   * ceiling on, and `checkMarbles` rules on.
   */
  readonly shoved: Float32Array;
  readonly shovedOn: Int32Array;
  /** Where on the track each marble was before it was pushed, to tell how far the push took it. */
  private readonly holdSegment: Int32Array;
  private readonly holdAlong: Float32Array;
  private readonly holdAcross: Float32Array;
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
  /** Those over the line this step, and how many: their places are given out once everything has moved. */
  private readonly crossed: Int32Array;
  private crossing = 0;
  private readonly slope: [number, number] = [0, 0];

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
    this.crossed = new Int32Array(n);
    this.jumped = new Float32Array(n);
    this.jumpedOn = new Int32Array(n);
    this.fromX = new Float32Array(n);
    this.fromY = new Float32Array(n);
    this.fromZ = new Float32Array(n);
    this.went = new Float32Array(n);
    this.pushed = new Float32Array(n);
    this.shoved = new Float32Array(n);
    this.shovedOn = new Int32Array(n);
    this.holdSegment = new Int32Array(n);
    this.holdAlong = new Float32Array(n);
    this.holdAcross = new Float32Array(n);
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
    this.crossing = 0;
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
      this.jumped[i] = 0;
      this.jumpedOn[i] = 0;
      this.shoved[i] = 0;
      this.shovedOn[i] = 0;
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
    // where each is as the step begins, from what it is doing and not from where it was last drawn: whatever it
    // was set to between steps, as the field is on the gate and a test sets a scene, is where it is, not a jump
    for (let i = 0; i < this.count; i++) {
      // one waiting on the gate or lost off the run is not moving of its own, and is not held to it
      if (this.state[i] === WAITING || this.state[i] === LOST) continue;
      this.locate(i);
      this.fromX[i] = this.point[0];
      this.fromY[i] = this.point[1];
      this.fromZ[i] = this.point[2];
      this.went[i] = 0;
      this.pushed[i] = 0;
    }
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
      if (this.state[i] === FINISHED) {
        this.lane(i, dt);
        continue;
      }
      if (this.state[i] !== RACING) continue;
      at(track, this.segment[i], this.along[i], this.here);
      // gravity along the track: down its own slope, less the share that goes into the marble's spin
      const pull = GRAVITY * (LEAN - this.here.tz) * ROLLING;
      const drag = DRAG * this.friction * this.speed[i] * Math.abs(this.speed[i]);
      this.speed[i] += (pull - drag) * dt;
      const seg = track.segments[this.segment[i]];
      // felt takes a fast marble down to its pace and lets gravity bring a slow one up to it
      if (seg.felt && this.along[i] < seg.felt.upto)
        this.speed[i] += (seg.felt.speed - this.speed[i]) * Math.min(1, FELT_GRIP * dt);
      // up a mound's side a marble is pulled back down it, which turns it away from the middle of the mound
      if (seg.mounds.length > 0) {
        moundSlope(seg, this.along[i], this.across[i], this.slope);
        this.speed[i] -= GRAVITY * ROLLING * this.slope[0] * dt;
        this.drift[i] -= GRAVITY * ROLLING * this.slope[1] * dt;
      }
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
      this.went[i] = Math.max(this.went[i], Math.hypot(this.speed[i], this.drift[i]));
      this.hold(i);
      this.walls(i);
      this.knock(i, true);
      this.pushedFromHold(i);

      // off the end of a piece and on to the next. Reaching the cup at all is finishing: a marble that
      // rolled to a halt inside it would otherwise never be called home.
      while (this.along[i] > track.segments[this.segment[i]].length) {
        // off the lip of a jump there is no next piece to run on to, only air
        if (track.segments[this.segment[i]].flies) {
          this.takeOff(i);
          break;
        }
        const here = track.segments[this.segment[i]];
        // a splitter hands the field on by which side of the middle it is on as it reaches the fork, in place
        // of the one `next` every other piece has
        const next = here.fork ? (this.across[i] < 0 ? here.fork.a : here.fork.b) : here.next;
        if (next < 0) {
          this.finish(i);
          break;
        }
        this.along[i] -= here.length;
        this.segment[i] = next;
        if (track.segments[next].next < 0 && !track.segments[next].fork) {
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
        const prev = track.segments[this.segment[i]].prev;
        if (prev < 0 || track.segments[prev].flies || track.segments[prev].funnel) {
          // the end of the track stops it, as a wall would
          this.hold(i);
          this.along[i] = 0;
          if (this.speed[i] < 0) this.speed[i] = 0;
          this.pushedFromHold(i);
        } else {
          this.segment[i] = prev;
          this.along[i] += track.segments[prev].length;
        }
      }
    }
    this.touching();
    this.jostle();
    // once everything has moved, pushes and all, since a marble pushed over the line has crossed it as surely as
    // one that rolled over it
    this.placeFinishers();
    this.write();
    this.reckon(dt);
  }

  /**
   * How far each marble moved in the step against what explains it: its own
   * speed, and everything that pushed it. What is left over is a jump, and
   * the biggest of those is kept until the field is set on the gate again.
   */
  private reckon(dt: number) {
    for (let i = 0; i < this.count; i++) {
      // one still on the gate was not looked at as the step began, and one lost has gone off everything
      if (this.state[i] === WAITING || this.state[i] === LOST) continue;
      const moved = Math.hypot(this.x[i] - this.fromX[i], this.y[i] - this.fromY[i], this.z[i] - this.fromZ[i]);
      const beyond = moved - this.went[i] * dt - this.pushed[i];
      if (beyond > this.jumped[i]) {
        this.jumped[i] = beyond;
        this.jumpedOn[i] = this.track.segments[this.segment[i]].piece;
      }
    }
  }

  /** Where a marble is in the world as it stands, into `point`: on the track, in the air or in a bowl. */
  private locate(i: number) {
    const s = this.state[i];
    if (s === FLYING || s === LOST) {
      this.point[0] = this.x[i];
      this.point[1] = this.y[i];
      this.point[2] = this.z[i];
    } else if (s === SWIRLING) {
      const bowl = this.track.segments[this.segment[i]].funnel!;
      this.point[0] = bowl.x + this.bowlX[i];
      this.point[1] = bowl.y + this.bowlY[i];
      this.point[2] = bowl.z + floorUnder(bowl, Math.hypot(this.bowlX[i], this.bowlY[i])) + RADIUS;
    } else this.onTrack(i);
  }

  /**
   * A marble past the line, rolling on down the lane at the end of the run to
   * wait in it: the winner against the stop, and each after it a marble's
   * length behind the one that finished before it, so the field ends lined
   * up in the order it came home.
   */
  private lane(i: number, dt: number) {
    const seg = this.track.segments[this.segment[i]];
    this.speed[i] += (LANE_PULL - LANE_BRAKE * this.speed[i]) * dt;
    this.along[i] += this.speed[i] * dt;
    this.rolled[i] += (this.speed[i] * dt) / RADIUS;
    this.drift[i] -= this.drift[i] * 2 * dt;
    this.across[i] += this.drift[i] * dt;
    this.went[i] = Math.max(this.went[i], Math.hypot(this.speed[i], this.drift[i]));
    // the walls, the marble in front and the stop are what hold it where it waits
    this.hold(i);
    this.walls(i);
    const wait = seg.length - RADIUS - (this.place[i] - 1) * RADIUS * 2;
    if (this.along[i] >= wait) {
      this.along[i] = wait;
      this.speed[i] = 0;
    }
    if (this.along[i] < 0) this.along[i] = 0;
    this.pushedFromHold(i);
  }

  /**
   * The places for those over the line this step, given out in the order they
   * crossed it: a marble further past it for its speed crossed it earlier in
   * the step. Given out in the order the step reached them instead, two that
   * crossed together were placed by their slots on the grid, and the lane
   * lined them up the other way round.
   */
  private placeFinishers() {
    const n = this.crossing;
    if (n === 0) return;
    const since = (i: number) => this.along[i] / Math.max(this.speed[i], 1e-6);
    // few enough to sort in place, which makes nothing
    for (let a = 1; a < n; a++)
      for (let b = a; b > 0 && since(this.crossed[b]) > since(this.crossed[b - 1]); b--) {
        const swap = this.crossed[b];
        this.crossed[b] = this.crossed[b - 1];
        this.crossed[b - 1] = swap;
      }
    for (let k = 0; k < n; k++) {
      const i = this.crossed[k];
      this.took[i] = this.t;
      this.place[i] = ++this.finishers;
      this.events.finished?.(i, this.place[i], this.t);
    }
    this.crossing = 0;
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
   * and a wheel's paddle carries what it catches up. Whether it had to move
   * the marble, by more than a settled field does.
   */
  private knock(i: number, bounce: boolean): boolean {
    const seg = this.track.segments[this.segment[i]];
    let hit = false;
    for (const ob of seg.obstacles) {
      const p = pose(ob, this.t, ob.slot >= 0 ? this.phase[ob.slot] : 0, this.at, RADIUS);
      if (!p.present) continue;
      // the nearest point on the rod to the marble, and the way from it to the marble
      const pa = this.along[i] - p.along,
        pc = this.across[i] - p.across;
      const s = Math.min(Math.max(pa * p.da + pc * p.dc, -p.half), p.half);
      const qa = pa - p.da * s,
        qc = pc - p.dc * s;
      const d = Math.hypot(qa, qc);
      const reach = p.radius + RADIUS;
      if (d >= reach) continue;
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
      // as far out as it is in, but never more than half a marble in one step: a moving part sweeping across a
      // marble puts it deep inside itself in a single step, and setting it out of that all at once threw it
      // further than anything on the run travels. What is left over is seen to over the steps after, by which
      // time the part has usually gone by of its own accord
      const out = Math.min(reach - d, SHOVE);
      // touching is not a push: only one that moves a marble on counts, so a settled field stops settling
      if (out > MOVED) hit = true;
      const was = { along: this.along[i], across: this.across[i] };
      this.along[i] = Math.min(Math.max(this.along[i] + na * out, 0), seg.length);
      this.across[i] += nc * out;
      // pushed out sideways into a wall, a marble has nowhere to go and the two stay inside each other: a paddle
      // swung to the wall, or a gate sliding shut across its pen, would crush it. It is let out along the piece
      // instead, past the end of the thing, the way the marbles go, and no further than the same half a marble.
      const wall = widthAt(this.track, this.segment[i], this.along[i]) - RADIUS;
      if (Math.abs(this.across[i]) > wall) {
        this.across[i] = Math.sign(this.across[i]) * wall;
        const ahead = Math.abs(na) > 0.2 ? Math.sign(na) : 1;
        const left = SHOVE - Math.abs(this.across[i] - was.across);
        for (let k = 0; k < 12 && this.inside(i, p, reach); k++) {
          if (Math.abs(this.along[i] + ahead * 0.12 - was.along) > left) break;
          this.along[i] = Math.min(Math.max(this.along[i] + ahead * 0.12, 0), seg.length);
        }
      }
      const shove = Math.hypot(this.along[i] - was.along, this.across[i] - was.across);
      if (shove > this.shoved[i]) {
        this.shoved[i] = shove;
        this.shovedOn[i] = seg.piece;
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
    const slope = (floorUnder(bowl, r + eps) - floorUnder(bowl, r - eps)) / (2 * eps);
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
    // round the bowl and down or up its slope, as steep as it is anywhere between where it was and where it is
    const there = Math.hypot(x, y) || 1e-6;
    const steeper = Math.max(
      Math.abs(slope),
      Math.abs((floorUnder(bowl, there + eps) - floorUnder(bowl, there - eps)) / (2 * eps)),
    );
    this.went[i] = Math.max(this.went[i], Math.hypot(this.vx[i], this.vy[i]) * Math.hypot(1, steeper));
    // the rim: set back inside it, and gripped by how hard it is pressed out into it
    const edge = bowl.rim - RADIUS;
    const out = Math.hypot(x, y);
    if (out > edge) {
      const nx = x / out,
        ny = y / out;
      // the rim stops it, and it is set back as far as it went past
      this.pushed[i] += Math.hypot(out - edge, floorUnder(bowl, out) - floorUnder(bowl, edge));
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
    const now = Math.hypot(x, y);
    this.along[i] = Math.min(seg.length, (seg.length * (bowl.rim - now)) / (bowl.rim - bowl.hole));
    this.placeInBowl(i);
    // its middle a radius inside the hole's edge, it has tipped over the edge, and falls through the throat on to
    // the way out under it: it was once taken from the hole and set down on the piece below in one step. It
    // cannot fall on to one still sitting under the hole, which cannot be pushed back up to make room, nor catch
    // up one still falling, so it waits in the hole until the way down is clear
    if (now >= bowl.hole - RADIUS || this.blocked(i, this.segment[i], bowl)) return;
    // falling as it was going: round and in as it went, and down as fast as the edge was taking it down
    this.vz[i] = (slope * (x * this.vx[i] + y * this.vy[i])) / (now || 1);
    this.airX[i] = this.x[i];
    this.airY[i] = this.y[i];
    this.aloft[i] = 0;
    this.state[i] = FLYING;
  }

  /**
   * Whether the way down a bowl's throat is taken: by one falling through it,
   * or one on the floor under the hole, stopped there for good or not. One
   * stopped under the hole keeps the next in the hole until the bowl calls it.
   */
  private blocked(i: number, s: number, bowl: Bowl): boolean {
    const under = this.track.segments[s].next;
    const after = under >= 0 ? this.track.segments[under].next : -1;
    for (let j = 0; j < this.count; j++) {
      if (j === i) continue;
      if (this.state[j] === FLYING && this.segment[j] === s) return true;
      const on = this.state[j] === RACING || this.state[j] === FINISHED || this.state[j] === STALLED;
      if (
        on &&
        (this.segment[j] === under || this.segment[j] === after) &&
        Math.hypot(this.x[j] - bowl.x, this.y[j] - bowl.y) < bowl.hole + RADIUS
      )
        return true;
    }
    return false;
  }

  /** Falling through a bowl's throat: kept inside it, and sent off its wall as off the rim. */
  private throat(i: number, bowl: Bowl) {
    const edge = bowl.hole - RADIUS;
    const x = this.x[i] - bowl.x,
      y = this.y[i] - bowl.y;
    const r = Math.hypot(x, y);
    if (r <= edge) return;
    const nx = x / r,
      ny = y / r;
    this.x[i] = bowl.x + nx * edge;
    this.y[i] = bowl.y + ny * edge;
    const vn = this.vx[i] * nx + this.vy[i] * ny;
    if (vn > 0) {
      this.vx[i] -= (1 + BOUNCE) * vn * nx;
      this.vy[i] -= (1 + BOUNCE) * vn * ny;
    }
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
    this.z[i] = bowl.z + floorUnder(bowl, r) + RADIUS;
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
    // how far the others and the rim pushed each: until now it was where its own way round took it
    for (let i = 0; i < this.count; i++) {
      if (this.state[i] !== SWIRLING) continue;
      const x = this.x[i],
        y = this.y[i],
        z = this.z[i];
      this.placeInBowl(i);
      this.pushed[i] += Math.hypot(this.x[i] - x, this.y[i] - y, this.z[i] - z);
    }
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
    this.went[i] = Math.max(this.went[i], Math.hypot(this.vx[i], this.vy[i], this.vz[i]));
    this.rolled[i] += (Math.hypot(this.vx[i], this.vy[i]) * dt) / RADIUS;
    const from = this.track.segments[this.segment[i]].funnel;
    if (from) {
      const x = this.x[i],
        y = this.y[i];
      this.throat(i, from);
      this.pushed[i] += Math.hypot(this.x[i] - x, this.y[i] - y);
    }
    if (this.landFrom(i, this.segment[i], 0)) return;
    if (this.aloft[i] > AIR_TIME || this.z[i] < this.bottom - LEVEL * 2) {
      this.state[i] = LOST;
      this.lost++;
      this.events.lost?.(i, this.t);
    }
  }

  /**
   * Whether a marble in flight comes down within `LANDING_LOOK` pieces of
   * `s`, tried a piece at a time, and both ways at a splitter, since the
   * side it will fall to has not been decided for something still in the
   * air.
   */
  private landFrom(i: number, s: number, depth: number): boolean {
    if (depth >= LANDING_LOOK) return false;
    const seg = this.track.segments[s];
    const onward = (n: number): boolean => n >= 0 && (this.land(i, n) || this.landFrom(i, n, depth + 1));
    return seg.fork ? onward(seg.fork.a) || onward(seg.fork.b) : onward(seg.next);
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
    if (seg.funnel) return this.landInBowl(i, s, seg.funnel);
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
    if (seg.next < 0 && !seg.fork) this.finish(i);
    return true;
  }

  /**
   * Whether a marble in the air comes down in a funnel's bowl this step, and
   * if it does, puts it there: inside the rim, falling and not rising, and
   * down at the bowl's floor where it is or just through it. It goes on round
   * the bowl the way it was going across the ground; what it had downward is
   * the landing, and goes. One that reaches the rim's wall still in the air
   * comes off it back into the bowl, as it would off the rim going round.
   */
  private landInBowl(i: number, s: number, bowl: Bowl): boolean {
    const edge = bowl.rim - RADIUS;
    let x = this.x[i] - bowl.x,
      y = this.y[i] - bowl.y;
    let r = Math.hypot(x, y);
    // it came off a lip inside the rim, so anywhere past the rim below the wall's top it has met the wall, however
    // far past it a fast marble has gone in a step
    if (r > edge && this.z[i] - RADIUS < bowl.z + bowl.wall) {
      const nx = x / r,
        ny = y / r;
      x = nx * edge;
      y = ny * edge;
      r = edge;
      // the rim's wall stops it
      this.pushed[i] += Math.hypot(bowl.x + x - this.x[i], bowl.y + y - this.y[i]);
      this.x[i] = bowl.x + x;
      this.y[i] = bowl.y + y;
      const vn = this.vx[i] * nx + this.vy[i] * ny;
      if (vn > 0) {
        this.vx[i] -= (1 + BOUNCE) * vn * nx;
        this.vy[i] -= (1 + BOUNCE) * vn * ny;
      }
    }
    if (r > edge) return false;
    if (this.vz[i] > 0) return false;
    const up = this.z[i] - RADIUS - (bowl.z + bowlHeight(bowl, r));
    if (up > 0 || up < -RADIUS * 3) return false;
    const seg = this.track.segments[s];
    this.segment[i] = s;
    this.bowlX[i] = x;
    this.bowlY[i] = y;
    this.vz[i] = 0;
    this.along[i] = Math.min(seg.length, (seg.length * (bowl.rim - r)) / (bowl.rim - bowl.hole));
    this.across[i] = 0;
    this.aloft[i] = 0;
    this.crawling[i] = 0;
    this.state[i] = SWIRLING;
    this.placeInBowl(i);
    return true;
  }

  /** A marble in the cup: how long it took, and what place it came. */
  private finish(i: number) {
    // over the line, and on into the lane at whatever speed it crossed it; its place waits for the end of the step
    this.state[i] = FINISHED;
    this.crossed[this.crossing++] = i;
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
    for (let k = 0; k < this.count; k++) {
      const s = this.state[this.bySlot[k]];
      if (s === RACING || s === FINISHED) this.order[n++] = this.bySlot[k];
    }
    for (let k = 0; k < n; k++) this.hold(this.order[k]);
    this.settle(n);
    // how far the others, the walls and anything in the way pushed each, settling them
    for (let k = 0; k < n; k++) this.pushedFromHold(this.order[k]);
  }

  /** The first `n` of `order` settled: their speeds exchanged where they close, and then parted. */
  private settle(n: number) {
    const runs = this.order;
    const touch = RADIUS * 2;
    // first the speed: what two marbles closing on each other give each other, once for each touch
    for (let k = 0; k < n; k++)
      for (let j = k + 1; j < n; j++) {
        const a = runs[k],
          b = runs[j];
        if (this.apart(a, b)) continue;
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
    if (this.apart(a, b)) return false;
    const touch = RADIUS * 2;
    const da = this.far(b) - this.far(a),
      dc = this.across[b] - this.across[a];
    const d2 = da * da + dc * dc;
    if (d2 >= (touch - MOVED) * (touch - MOVED)) return false;
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
        const prev = seg.prev;
        const before = prev < 0 ? undefined : track.segments[prev];
        // nor is a marble in the lane pushed back over the line it has crossed
        if (!before || before.flies || before.funnel || this.state[i] === FINISHED) {
          this.along[i] = 0;
          return;
        }
        this.segment[i] = prev;
        this.along[i] += before.length;
      } else if (this.along[i] > seg.length) {
        // a splitter hands a shoved marble on by which side of the middle it is on, same as one that got there
        // on its own
        const next = seg.fork ? (this.across[i] < 0 ? seg.fork.a : seg.fork.b) : seg.next;
        if (next < 0 || seg.flies || track.segments[next].funnel) {
          this.along[i] = seg.length;
          return;
        }
        this.along[i] -= seg.length;
        this.segment[i] = next;
        // pushed over the line is over it: held short of it instead, a crowd squeezing into the last of a run was
        // pressed inside one another against it
        if (this.state[i] === RACING && track.segments[next].next < 0 && !track.segments[next].fork) this.finish(i);
      } else return;
    }
  }

  /** Where every marble is, from where it is on the track and how far across it sits. */
  private write() {
    for (let i = 0; i < this.count; i++) {
      // in the air or gone, a marble is where its flight put it, not anywhere on the track
      if (this.state[i] === FLYING || this.state[i] === LOST || this.state[i] === SWIRLING) continue;
      this.onTrack(i);
      this.x[i] = this.point[0];
      this.y[i] = this.point[1];
      this.z[i] = this.point[2];
    }
  }

  /** Where a marble on the track is in the world, into `point`: a radius up off the floor, and across the channel. */
  private onTrack(i: number) {
    this.onTrackAt(this.segment[i], this.along[i], this.across[i]);
  }

  /** Where a marble would be in the world, `along` a segment and `across` its channel, into `point`. */
  private onTrackAt(segment: number, along: number, across: number) {
    const h = at(this.track, segment, along, this.there);
    // across the channel, square to both the way it is going and the way up
    const bx = h.ty * h.uz - h.tz * h.uy;
    const by = h.tz * h.ux - h.tx * h.uz;
    const bz = h.tx * h.uy - h.ty * h.ux;
    // on a mound it rides up over it, by the height of the floor under it
    const seg = this.track.segments[segment];
    const lift = RADIUS + (seg.mounds.length > 0 ? moundHeight(seg, along, across) : 0);
    this.point[0] = h.x + bx * across + h.ux * lift;
    this.point[1] = h.y + by * across + h.uy * lift;
    this.point[2] = h.z + bz * across + h.uz * lift;
  }

  /** Where on the track a marble is now, kept to tell later how far it has been pushed from it. */
  private hold(i: number) {
    this.holdSegment[i] = this.segment[i];
    this.holdAlong[i] = this.along[i];
    this.holdAcross[i] = this.across[i];
  }

  /**
   * How far a marble on the track has been pushed since it was held, added
   * to what pushed it this step. Most steps nothing pushes a marble, and
   * then nothing is worked out.
   */
  private pushedFromHold(i: number) {
    if (
      this.segment[i] === this.holdSegment[i] &&
      this.along[i] === this.holdAlong[i] &&
      this.across[i] === this.holdAcross[i]
    )
      return;
    this.onTrackAt(this.holdSegment[i], this.holdAlong[i], this.holdAcross[i]);
    const x = this.point[0],
      y = this.point[1],
      z = this.point[2];
    this.onTrack(i);
    this.pushed[i] += Math.hypot(this.point[0] - x, this.point[1] - y, this.point[2] - z);
  }

  /**
   * Whether two marbles are on branches a splitter parted, so nothing between them is measured: `far` overlaps
   * across a splitter's two lanes on its own, which would otherwise read them as touching however far apart
   * they really are, on their own side of it.
   */
  apart(a: number, b: number): boolean {
    const ba = this.track.segments[this.segment[a]].branch,
      bb = this.track.segments[this.segment[b]].branch;
    return ba !== 0 && bb !== 0 && ba !== bb;
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
    // nothing moves a marble in a step but its own speed and what pushes it: anything more is a jump, as the funnel
    // once set a marble down inside its rim where it had never been, and again on the piece below its hole
    // nothing in the way shoves a marble half its own width or more in one go: a gate's bar sliding across its pen
    // caught one at the wall, set it out of itself all at once, and threw it 0.61 back up the run
    if (marbles.shoved[i] > SHOVE + 1e-3)
      problems.push(
        `marble ${i} was shoved ${marbles.shoved[i].toFixed(3)} in one go by something in the way on piece ${marbles.shovedOn[i]}`,
      );
    if (marbles.jumped[i] > JUMP)
      problems.push(
        `marble ${i} moved ${marbles.jumped[i].toFixed(3)} further in a step than its speed and what pushed it explain, on to piece ${marbles.jumpedOn[i]}`,
      );
    const piece = track.segments[seg];
    if (marbles.along[i] < -1e-3 || marbles.along[i] > piece.length + 1e-3)
      problems.push(`marble ${i} is ${marbles.along[i]} along a segment ${piece.length} long`);
    const state = marbles.state[i];
    if (state > SWIRLING) problems.push(`marble ${i} is doing ${state}, which is nothing a marble does`);
    else doing[state]++;
    if (state === FLYING && !piece.flies && !piece.funnel)
      problems.push(`marble ${i} is in the air off a piece with no lip and no hole`);
    // through a funnel's hole a marble falls down its throat, which keeps it inside the hole all the way down
    if (
      state === FLYING &&
      piece.funnel &&
      Math.hypot(marbles.x[i] - piece.funnel.x, marbles.y[i] - piece.funnel.y) > piece.funnel.hole - RADIUS + 1e-3
    )
      problems.push(`marble ${i} is falling through a funnel's hole, outside its throat`);
    // off a funnel's lip a marble drops into the bowl under it, and the rim's wall keeps it there: anywhere outside
    // it, it has gone off the side of the run in, as every marble did when the run in ended on the rim
    const into = state === FLYING && piece.next >= 0 ? track.segments[piece.next].funnel : null;
    if (into && Math.hypot(marbles.x[i] - into.x, marbles.y[i] - into.y) > into.rim - RADIUS + 1e-3)
      problems.push(`marble ${i} is in the air off the side of a funnel's run in, outside its bowl`);
    // a splitter's fork stands in place of `next` on the piece before it, so a segment with no `next` is not
    // yet the end unless it has no fork either
    if (state === FINISHED && (piece.next !== -1 || piece.fork))
      problems.push(`marble ${i} is home on a piece short of the end`);
    if (state === RACING && piece.next === -1 && !piece.fork)
      problems.push(`marble ${i} is still racing past the line`);
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
      pose(ob, marbles.t, ob.slot >= 0 ? marbles.phase[ob.slot] : 0, at, RADIUS);
      if (!at.present) continue;
      const pa = marbles.along[i] - at.along,
        pc = marbles.across[i] - at.across;
      const s = Math.min(Math.max(pa * at.da + pc * at.dc, -at.half), at.half);
      const d = Math.hypot(pa - at.da * s, pc - at.dc * s);
      if (d < at.radius + RADIUS - 0.05)
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
      // as well as along it. Off a jump nothing touches in the air; down a funnel's throat, two falling at once are
      // shut in together, so those on the track, in a bowl and down its throat are held to it
      let apart = Infinity;
      const onTrack = (i: number) => marbles.state[i] === RACING || marbles.state[i] === FINISHED;
      if (onTrack(a) && onTrack(b) && !marbles.apart(a, b))
        apart = Math.hypot(marbles.far(b) - marbles.far(a), marbles.across[b] - marbles.across[a]);
      else if (
        marbles.state[a] === SWIRLING &&
        marbles.state[b] === SWIRLING &&
        marbles.segment[a] === marbles.segment[b]
      )
        apart = Math.hypot(marbles.x[b] - marbles.x[a], marbles.y[b] - marbles.y[a]);
      else if (
        marbles.state[a] === FLYING &&
        marbles.state[b] === FLYING &&
        marbles.segment[a] === marbles.segment[b] &&
        track.segments[marbles.segment[a]].funnel
      )
        apart = Math.hypot(marbles.x[b] - marbles.x[a], marbles.y[b] - marbles.y[a], marbles.z[b] - marbles.z[a]);
      if (apart < RADIUS * 2 - 0.05)
        problems.push(`marbles ${a} and ${b} are ${apart.toFixed(3)} apart, inside each other`);
    }
  return problems;
}
