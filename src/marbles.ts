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
import { HALF_WIDTH, type Track, at, spot } from './track';
import type { Random } from './random';

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
/** How much speed costs, with the speed and regardless of it. */
export const DRAG = 0.02;
export const RESIST = 0.6;
/** How much of its speed a marble keeps off a wall, and off another marble. */
export const BOUNCE = 0.4;
/** How far apart they sit on the start, waiting. */
export const SPACING = 1.1;
/**
 * The most passes a step takes to settle marbles pressed together. A clump of
 * three settles in two or three; the ceiling is only so a pathological pile
 * cannot cost a frame more than a fixed amount.
 */
export const SETTLE = 6;

/** What a marble is doing. */
export const WAITING = 0,
  RACING = 1,
  FINISHED = 2,
  STALLED = 3;

/**
 * How slowly a marble may be going, and for how long, before the run is
 * called on it. A run that cannot be finished has to be noticed and said,
 * because the alternative is a race nobody is ever told is over.
 */
export const CRAWL = 0.05;
export const PATIENCE = 3;

/** What happens in a race, for whoever shows it. Every one may be left out. */
export interface RaceEvents {
  /** They were let go. */
  released?(count: number): void;
  /** A marble reached the cup: which one, in which place, and how long it took. */
  finished?(marble: number, place: number, seconds: number): void;
  /** A marble came to rest short of the cup, and is not going to get there. */
  stalled?(marble: number, seconds: number): void;
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
   * How freely each runs, a little either side of one. Marbles that are all
   * the same would race the same way every time, and there would be nothing
   * to tell one from another or to back.
   */
  readonly form: Float32Array;
  /** How many have finished, how many stopped short, and the time of the race so far. */
  finishers = 0;
  stalled = 0;
  t = 0;

  /** How long each has been barely moving, for telling a slow marble from a stopped one. */
  private readonly crawling: Float32Array;

  private readonly here = spot();
  private readonly ahead = spot();
  private readonly order: Int32Array;
  /** Which slot on the start each marble drew. */
  readonly grid: Int32Array;

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
    this.form = new Float32Array(n);
    this.order = new Int32Array(n);
    this.crawling = new Float32Array(n);
    for (let i = 0; i < n; i++) this.form[i] = 0.82 + random() * 0.36;
    this.grid = new Int32Array(n);
    this.draw(random);
    this.reset();
  }

  /**
   * The grid drawn again. It is drawn rather than handed out in order,
   * because the same marble on pole every race would be no race at all; and
   * it is drawn afresh for each one, while a marble keeps the form it was
   * born with.
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
  }

  /** Everything back on the start, waiting, with the race not yet run. */
  reset() {
    this.t = 0;
    this.finishers = 0;
    this.stalled = 0;
    // two abreast, so the grid is half as long and a marble has somewhere to go from the off
    const wall = HALF_WIDTH - RADIUS;
    const rows = Math.ceil(this.count / 2);
    const room = this.track.segments[0].length - RADIUS * 2;
    const gap = rows > 1 ? Math.min(SPACING, room / (rows - 1)) : SPACING;
    for (let i = 0; i < this.count; i++) {
      this.crawling[i] = 0;
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
    }
    this.write();
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

  /** Whether the race is done with: everything either in the cup or stopped short of it. */
  get over(): boolean {
    return this.finishers + this.stalled >= this.count;
  }

  /** One fixed step of the race. */
  step(dt: number) {
    this.t += dt;
    const { track } = this;
    for (let i = 0; i < this.count; i++) {
      if (this.state[i] !== RACING) continue;
      at(track, this.segment[i], this.along[i], this.here);
      // gravity along the track: down its own slope, less the share that goes into the marble's spin
      const pull = -GRAVITY * this.here.tz * ROLLING * this.form[i];
      const resist = (RESIST / this.form[i]) * Math.sign(this.speed[i]);
      const drag = (DRAG / this.form[i]) * this.speed[i] * Math.abs(this.speed[i]);
      this.speed[i] += (pull - drag - resist) * dt;
      // a marble at rest on the flat stays at rest rather than shuffling backwards on its own resistance
      if (pull === 0 && Math.abs(this.speed[i]) < RESIST * dt) this.speed[i] = 0;
      // going round a bend throws a marble at the outer wall, and the wall holds it in
      const bend = this.bend(this.segment[i], this.along[i]);
      // out on the wide line there is further to go, so the same speed buys less of the run
      const wide = Math.max(0.5, 1 + this.across[i] * bend);
      this.along[i] += (this.speed[i] * dt) / wide;
      this.rolled[i] += (this.speed[i] * dt) / RADIUS;
      this.drift[i] += bend * this.speed[i] * this.speed[i] * dt;
      this.drift[i] -= this.drift[i] * 2 * dt;
      this.across[i] += this.drift[i] * dt;
      const wall = HALF_WIDTH - RADIUS;
      if (this.across[i] > wall) {
        this.across[i] = wall;
        if (this.drift[i] > 0) this.drift[i] = -this.drift[i] * BOUNCE;
      } else if (this.across[i] < -wall) {
        this.across[i] = -wall;
        if (this.drift[i] < 0) this.drift[i] = -this.drift[i] * BOUNCE;
      }

      // off the end of a piece and on to the next. Reaching the cup at all is finishing: a marble that
      // rolled to a halt inside it would otherwise never be called home.
      while (this.along[i] > track.segments[this.segment[i]].length) {
        const next = track.segments[this.segment[i]].next;
        if (next < 0) {
          this.finish(i);
          break;
        }
        this.along[i] -= track.segments[this.segment[i]].length;
        this.segment[i] = next;
        if (track.segments[next].next < 0) {
          this.finish(i);
          break;
        }
      }
      if (this.state[i] !== RACING) continue;

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
      // and never back off the start
      if (this.along[i] < 0) {
        const seg0 = this.segment[i];
        if (seg0 === 0) {
          this.along[i] = 0;
          if (this.speed[i] < 0) this.speed[i] = 0;
        } else {
          this.segment[i] = seg0 - 1;
          this.along[i] += track.segments[seg0 - 1].length;
        }
      }
    }
    this.touching();
    this.write();
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
    for (let i = 0; i < this.count; i++) if (this.state[i] === RACING) this.order[n++] = i;
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
    const wall = HALF_WIDTH - RADIUS;
    const da = this.far(b) - this.far(a),
      dc = this.across[b] - this.across[a];
    const d2 = da * da + dc * dc;
    if (d2 >= touch * touch - 1e-9) return false;
    const d = Math.sqrt(d2);
    const nx = d > 1e-6 ? da / d : 0,
      ny = d > 1e-6 ? dc / d : 1;
    const half = (touch - d) / 2;
    this.across[a] = Math.min(wall, Math.max(-wall, this.across[a] - ny * half));
    this.across[b] = Math.min(wall, Math.max(-wall, this.across[b] + ny * half));
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
      if (this.along[i] < 0) {
        if (this.segment[i] === 0) {
          this.along[i] = 0;
          return;
        }
        this.segment[i]--;
        this.along[i] += track.segments[this.segment[i]].length;
      } else if (this.along[i] > seg.length) {
        if (seg.next < 0) {
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
    return this.track.segments[this.segment[i]].start + this.along[i];
  }

  /**
   * The marble still racing that is furthest on, or -1 with none racing. The
   * camera asks every frame, so this makes nothing, unlike `running`.
   */
  leader(): number {
    let best = -1,
      far = -Infinity;
    for (let i = 0; i < this.count; i++) {
      if (this.state[i] !== RACING) continue;
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
    for (let i = 0; i < this.count; i++) if (this.state[i] === RACING) racing.push(i);
    return racing.sort((a, b) => this.far(b) - this.far(a));
  }
}

/** What must always hold of a field of marbles, a line each. */
export function checkMarbles(marbles: Marbles): string[] {
  const problems: string[] = [];
  const { track } = marbles;
  let waiting = 0,
    racing = 0,
    finished = 0;
  for (let i = 0; i < marbles.count; i++) {
    const seg = marbles.segment[i];
    if (seg < 0 || seg >= track.segments.length) {
      problems.push(`marble ${i} is on segment ${seg}, which is not one`);
      continue;
    }
    if (!Number.isFinite(marbles.along[i]) || !Number.isFinite(marbles.speed[i]) || !Number.isFinite(marbles.x[i]))
      problems.push(`marble ${i} is not a number`);
    const length = track.segments[seg].length;
    if (marbles.along[i] < -1e-3 || marbles.along[i] > length + 1e-3)
      problems.push(`marble ${i} is ${marbles.along[i]} along a segment ${length} long`);
    const wall = HALF_WIDTH - RADIUS;
    if (Math.abs(marbles.across[i]) > wall + 1e-3)
      problems.push(`marble ${i} is ${marbles.across[i]} across a channel it may be ${wall} across`);
    if (marbles.state[i] === WAITING) waiting++;
    else if (marbles.state[i] === RACING) racing++;
    else finished++;
  }
  if (waiting + racing + finished !== marbles.count)
    problems.push(`${marbles.count} marbles, and ${waiting + racing + finished} of them doing something`);
  if (finished !== marbles.finishers) problems.push(`${finished} marbles in the cup, and ${marbles.finishers} counted`);
  // two marbles in the same place would be one passing through the other, across the channel as well as along it
  const running = marbles.running();
  for (let k = 0; k < running.length; k++)
    for (let j = k + 1; j < running.length; j++) {
      const a = running[k],
        b = running[j];
      const apart = Math.hypot(marbles.far(b) - marbles.far(a), marbles.across[b] - marbles.across[a]);
      if (apart < RADIUS * 2 - 0.05)
        problems.push(`marbles ${a} and ${b} are ${apart.toFixed(3)} apart, inside each other`);
    }
  return problems;
}
