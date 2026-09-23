/**
 * The race as physics: the marbles as balls in Rapier, behind the same
 * `Race` the solver stands behind. Nothing acts on a ball after the gate
 * opens but gravity, the air and what it touches: no felt, no nudge, no
 * clamp, and nothing is ever put anywhere. What the solver does by rule the
 * pieces have to do by shape, so a kind of piece crosses over to physics
 * only once it races alone under physics as well as it does under the
 * solver, and `supports` says which have.
 *
 * The track is met as a mesh built from the very samples the scene draws,
 * so what is seen is what is raced. Rapier is handed in, loaded and ready,
 * rather than imported: it is three quarters of a megabyte the page fetches
 * only when it is wanted, and the game in Node has no page.
 */
import type RAPIER_ from '@dimforge/rapier3d-compat';
import {
  CRAWL,
  DRAG,
  FINISHED,
  GRAVITY,
  LEAN,
  LOST,
  MARBLES,
  PATIENCE,
  RACING,
  RADIUS,
  SPACING,
  STALLED,
  WAITING,
} from './marbles';
import type { Random } from './random';
import type { Race, RaceEvents, RaceOptions, Roll } from './race';
import { type Compiled, HALF_WIDTH, type Track, at } from './track';

/** Rapier, the module, once `init` has been awaited. */
export type Rapier = typeof RAPIER_;

/**
 * How high the walls stand under physics: a real marble banking through a
 * bend at speed climbs a wall the solver's marbles never could, and the
 * spike's balls hopped one of 0.57 and stayed in one of 1.2.
 */
export const PHYSICS_WALL = 1.2;
/** How a run is compiled for physics: leaning as the solver leans, walled for a real marble, and pinched against one wall. */
export const PHYSICAL: Compiled = { lean: LEAN, wall: PHYSICS_WALL, physics: true };
/** How thick the channel's lips are, so a ball on the wall's top meets an edge and not a line. */
const SKIN = 0.08;
/** How many steps of the world go to one step of the game: a ball at speed against a thin floor wants more than one. */
export const SUBSTEPS = 4;
/** What a ball and the track grip each other with, and how much of a knock comes back. */
const GRIP = 0.3;
const GIVE = 0.05;
/**
 * The lane at the end is polished: no grip at all. Its neck closes from a
 * chute's width to single file, and two balls arriving abreast wedged in it,
 * each held against the wall and the other by friction, an arch the field
 * behind then piled up on. With nothing for the walls to hold them by they
 * slide into single file, as they were meant to.
 */
const POLISHED = 0;
/**
 * The fastest the air lets anything go: falling straight down, where the
 * drag of the air (`DRAG`, the solver's own, a share of the speed squared)
 * balances gravity. Nothing on a run can go faster than this, and a ball
 * that does was thrown by something, which `check` rules on.
 */
export const TERMINAL = Math.sqrt(GRAVITY / DRAG);
/** How far below a channel's floor a ball counts as fallen through it, and how far out of everything as off the run. */
const THROUGH = RADIUS;
const OFF = 3;

type V3 = [number, number, number];

/** The channel of the given segments as one mesh: floor, two walls and their lips, and a stop at the end of the run. */
function channelMesh(track: Track, which: (s: number) => boolean): { verts: Float32Array; idx: Uint32Array } {
  const verts: number[] = [];
  const idx: number[] = [];
  const push = (p: V3, b: V3, u: V3, across: number, up: number) =>
    verts.push(p[0] + b[0] * across + u[0] * up, p[1] + b[1] * across + u[1] * up, p[2] + b[2] * across + u[2] * up);
  const wall = track.wall;
  for (let s = 0; s < track.segments.length; s++) {
    if (!which(s)) continue;
    const seg = track.segments[s];
    const n = seg.arc.length;
    const base = verts.length / 3;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const p: V3 = [seg.points[o], seg.points[o + 1], seg.points[o + 2]];
      const t: V3 = [seg.tangents[o], seg.tangents[o + 1], seg.tangents[o + 2]];
      const u: V3 = [seg.ups[o], seg.ups[o + 1], seg.ups[o + 2]];
      const b: V3 = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
      const w = seg.width[i];
      // the section, six points a sample: outer lip, wall top, floor, floor, wall top, outer lip — or, for a
      // trough, the floor's two points at the bottom of a V a chute wide and as deep as the walls are high
      push(p, b, u, -w - SKIN, wall);
      push(p, b, u, -w, wall);
      push(p, b, u, -seg.floor[i], 0);
      push(p, b, u, seg.floor[i], 0);
      push(p, b, u, w, wall);
      push(p, b, u, w + SKIN, wall);
    }
    for (let i = 0; i + 1 < n; i++)
      for (let k = 0; k < 5; k++) {
        const a = base + i * 6 + k,
          c = base + (i + 1) * 6 + k;
        idx.push(a, a + 1, c, a + 1, c + 1, c);
      }
    // the end of the run is stopped, as the lane's stop stops the winner
    if (seg.next < 0 && !seg.fork) {
      const o = (n - 1) * 3;
      const p: V3 = [seg.points[o], seg.points[o + 1], seg.points[o + 2]];
      const t: V3 = [seg.tangents[o], seg.tangents[o + 1], seg.tangents[o + 2]];
      const u: V3 = [seg.ups[o], seg.ups[o + 1], seg.ups[o + 2]];
      const b: V3 = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
      const w = seg.width[n - 1];
      const e = verts.length / 3;
      const q: V3 = [p[0] + t[0] * 0.05, p[1] + t[1] * 0.05, p[2] + t[2] * 0.05];
      push(q, b, u, -w, 0);
      push(q, b, u, w, 0);
      push(q, b, u, w, wall);
      push(q, b, u, -w, wall);
      idx.push(e, e + 1, e + 2, e, e + 2, e + 3);
    }
  }
  return { verts: new Float32Array(verts), idx: new Uint32Array(idx) };
}

export class Physics implements Race {
  /** How many worlds are alive: one, for the run that is on, and never more however many runs are put on. */
  static alive = 0;

  readonly count: number;
  t = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly segment: Int32Array;
  readonly along: Float32Array;
  readonly across: Float32Array;
  readonly speed: Float32Array;
  readonly state: Uint8Array;
  readonly place: Int32Array;
  readonly took: Float32Array;
  readonly grid: Int32Array;
  readonly phase: Float32Array;
  finishers = 0;
  stalled = 0;
  lost = 0;

  private readonly world: RAPIER_.World;
  private readonly balls: RAPIER_.RigidBody[] = [];
  /** How long each has been barely moving, and the lowest the run goes, below which a ball is off it. */
  private readonly crawling: Float32Array;
  private readonly bottom: number;
  /** Where the run ends: the segment a ball is home on, and the one before it. */
  private readonly last: number;
  /** Which came home this step, to be placed in the order they crossed. */
  private readonly crossed: number[] = [];
  /** Whether the gate has opened: after it, nothing may put a ball anywhere. */
  private released = false;

  constructor(
    private readonly rapier: Rapier,
    readonly track: Track,
    private readonly events: RaceEvents = {},
    options: RaceOptions = {},
  ) {
    const random = options.random ?? Math.random;
    this.count = options.count ?? MARBLES;
    const n = this.count;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.z = new Float32Array(n);
    this.segment = new Int32Array(n);
    this.along = new Float32Array(n);
    this.across = new Float32Array(n);
    this.speed = new Float32Array(n);
    this.state = new Uint8Array(n);
    this.place = new Int32Array(n);
    this.took = new Float32Array(n);
    this.grid = new Int32Array(n);
    this.phase = new Float32Array(track.slots);
    this.crawling = new Float32Array(n);
    let bottom = Infinity;
    for (const seg of track.segments)
      for (let k = 2; k < seg.points.length; k += 3) bottom = Math.min(bottom, seg.points[k]);
    this.bottom = bottom;
    this.last = track.segments.findIndex((s) => s.next < 0 && !s.fork);

    this.world = new rapier.World({ x: 0, y: 0, z: -GRAVITY });
    Physics.alive++;
    const run = channelMesh(track, (s) => s !== this.last);
    this.world.createCollider(rapier.ColliderDesc.trimesh(run.verts, run.idx).setFriction(GRIP).setRestitution(GIVE));
    const lane = channelMesh(track, (s) => s === this.last);
    this.world.createCollider(
      rapier.ColliderDesc.trimesh(lane.verts, lane.idx).setFriction(POLISHED).setRestitution(GIVE),
    );
    for (let i = 0; i < n; i++) {
      // held still until the off: a ball let go on the gate's own slope would set off on its own
      const body = this.world.createRigidBody(rapier.RigidBodyDesc.fixed().setCcdEnabled(true).setCanSleep(false));
      this.world.createCollider(
        rapier.ColliderDesc.ball(RADIUS).setFriction(GRIP).setRestitution(GIVE).setDensity(1),
        body,
      );
      this.balls.push(body);
    }
    this.draw(random);
    this.reset();
  }

  /** Whether every piece of `track` is one physics races yet: so far, only what has no more to it than a channel. */
  static supports(track: Track): boolean {
    return track.segments.every(
      (s) =>
        s.obstacles.length === 0 &&
        !s.funnel &&
        !s.flies &&
        !s.fork &&
        s.branch === 0 &&
        s.mounds.length === 0 &&
        !s.felt,
    );
  }

  /** The world let go of: Rapier's memory is its own, and a run put on after this one wants a world of its own. */
  dispose(): void {
    this.world.free();
    Physics.alive--;
  }

  draw(random: Random): void {
    const n = this.count;
    for (let i = 0; i < n; i++) this.grid[i] = i;
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const swap = this.grid[i];
      this.grid[i] = this.grid[j];
      this.grid[j] = swap;
    }
    for (let s = 0; s < this.phase.length; s++) this.phase[s] = random();
  }

  reset(): void {
    this.t = 0;
    this.finishers = 0;
    this.stalled = 0;
    this.lost = 0;
    this.crossed.length = 0;
    this.released = false;
    // two abreast on the gate as the solver sets them, but in a zigzag, each row's second a half space behind
    // its first: a field held in level rows is mirror-symmetric, and down a mirror-symmetric run it stays so,
    // arriving at the end in pairs that sit abreast in the trough with nothing to say which goes first
    const wall = HALF_WIDTH - RADIUS;
    const rows = Math.ceil(this.count / 2);
    const gate = this.track.segments[0];
    const room = gate.length - RADIUS * 2;
    const gap = rows > 1 ? Math.min(SPACING, room / (rows - 1)) : SPACING;
    for (let i = 0; i < this.count; i++) {
      const slot = this.grid[i];
      const along = Math.max(0, gate.length - RADIUS - Math.floor(slot / 2) * gap - (slot % 2) * (gap / 2));
      const across = slot % 2 === 0 ? -wall : wall;
      this.state[i] = WAITING;
      this.place[i] = 0;
      this.took[i] = -1;
      this.crawling[i] = 0;
      this.set(i, 0, along, across, true);
    }
    this.read();
  }

  /** A ball put on the track, `along` a segment and `across` its channel, still, and held there if `held`. */
  private set(i: number, segment: number, along: number, across: number, held: boolean): void {
    const h = at(this.track, segment, along);
    const bx = h.ty * h.uz - h.tz * h.uy,
      by = h.tz * h.ux - h.tx * h.uz,
      bz = h.tx * h.uy - h.ty * h.ux;
    const lift = RADIUS + 0.02;
    const body = this.balls[i];
    body.setBodyType(held ? this.rapier.RigidBodyType.Fixed : this.rapier.RigidBodyType.Dynamic, true);
    body.setTranslation(
      { x: h.x + bx * across + h.ux * lift, y: h.y + by * across + h.uy * lift, z: h.z + bz * across + h.uz * lift },
      true,
    );
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.segment[i] = segment;
    this.along[i] = along;
    this.across[i] = across;
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    for (let i = 0; i < this.count; i++) {
      this.state[i] = RACING;
      this.balls[i].setBodyType(this.rapier.RigidBodyType.Dynamic, true);
    }
    this.events.released?.(this.count);
  }

  private get away(): boolean {
    for (let i = 0; i < this.count; i++) if (this.state[i] !== WAITING) return true;
    return false;
  }

  put(marble: number, segment: number, along: number, across: number): boolean {
    if (marble < 0 || marble >= this.count || this.released) return false;
    this.set(marble, segment, along, across, false);
    this.state[marble] = RACING;
    this.read();
    return true;
  }

  get over(): boolean {
    return this.finishers + this.stalled + this.lost >= this.count;
  }

  /** One step of the game: several of the world, the air taking its share each, and then what became of each ball. */
  step(dt: number): void {
    if (!this.away) return;
    this.t += dt;
    this.world.timestep = dt / SUBSTEPS;
    for (let k = 0; k < SUBSTEPS; k++) {
      this.breathe(dt / SUBSTEPS);
      this.world.step();
    }
    this.read();
    this.reckon(dt);
  }

  /** The air's drag on every ball alike, a share of the speed squared, as the solver has it: what gives a run a top speed. */
  private breathe(dt: number): void {
    for (let i = 0; i < this.count; i++) {
      if (this.state[i] !== RACING) continue;
      const body = this.balls[i];
      const v = body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed < 1e-6) continue;
      const k = -DRAG * speed * dt * body.mass();
      body.applyImpulse({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
    }
  }

  /** Where every ball is now, and where on the track that is: the nearest sample of its own segment or the next. */
  private read(): void {
    const { segments } = this.track;
    for (let i = 0; i < this.count; i++) {
      const p = this.balls[i].translation();
      const v = this.balls[i].linvel();
      this.x[i] = p.x;
      this.y[i] = p.y;
      this.z[i] = p.z;
      this.speed[i] = Math.hypot(v.x, v.y, v.z);
      // its own segment and its neighbours first; the whole run only if it is nowhere near them
      let best = Infinity,
        onSeg = this.segment[i],
        onSample = 0;
      const look = (s: number) => {
        if (s < 0 || s >= segments.length) return;
        const seg = segments[s];
        for (let k = 0; k < seg.arc.length; k++) {
          const o = k * 3;
          const d = Math.hypot(seg.points[o] - p.x, seg.points[o + 1] - p.y, seg.points[o + 2] - p.z);
          if (d < best) {
            best = d;
            onSeg = s;
            onSample = k;
          }
        }
      };
      const here = segments[this.segment[i]];
      look(this.segment[i]);
      look(here.next);
      look(here.prev);
      if (best > RADIUS * 4) for (let s = 0; s < segments.length; s++) look(s);
      const seg = segments[onSeg];
      const o = onSample * 3;
      // along, to within a sample, and across from the sample's own frame
      const tx = seg.tangents[o],
        ty = seg.tangents[o + 1],
        tz = seg.tangents[o + 2];
      const ux = seg.ups[o],
        uy = seg.ups[o + 1],
        uz = seg.ups[o + 2];
      const dx = p.x - seg.points[o],
        dy = p.y - seg.points[o + 1],
        dz = p.z - seg.points[o + 2];
      this.segment[i] = onSeg;
      this.along[i] = Math.min(Math.max(seg.arc[onSample] + dx * tx + dy * ty + dz * tz, 0), seg.length);
      this.across[i] = dx * (ty * uz - tz * uy) + dy * (tz * ux - tx * uz) + dz * (tx * uy - ty * ux);
    }
  }

  /** What became of each ball this step: home, off the run, or come to rest short of the end. */
  private reckon(dt: number): void {
    const { segments } = this.track;
    for (let i = 0; i < this.count; i++) {
      if (this.state[i] !== RACING) continue;
      const seg = segments[this.segment[i]];
      // over the line into the lane at the end: home, placed once everyone this step is in
      if (this.segment[i] === this.last && this.along[i] > 0) {
        this.crossed.push(i);
        continue;
      }
      // below everything, or clean out of the channel: off the run, told of, given no place
      const o = this.nearest(i) * 3;
      const under = this.z[i] - seg.points[o + 2];
      if (
        this.z[i] < this.bottom - OFF ||
        Math.abs(this.across[i]) > seg.width[this.nearest(i)] + OFF ||
        under < -THROUGH
      ) {
        this.state[i] = LOST;
        this.lost++;
        this.events.lost?.(i, this.t);
        continue;
      }
      // barely moving for long enough means it is not going to arrive
      if (this.speed[i] < CRAWL) {
        this.crawling[i] += dt;
        if (this.crawling[i] >= PATIENCE) {
          this.state[i] = STALLED;
          this.stalled++;
          this.events.stalled?.(i, this.t);
        }
      } else this.crawling[i] = 0;
    }
    if (this.crossed.length) {
      // two over the line in one step are placed by which is further in: it crossed first
      this.crossed.sort((a, b) => this.along[b] - this.along[a]);
      for (const i of this.crossed) {
        this.state[i] = FINISHED;
        this.took[i] = this.t;
        this.place[i] = ++this.finishers;
        this.events.finished?.(i, this.place[i], this.t);
      }
      this.crossed.length = 0;
    }
  }

  /** The sample of a ball's own segment nearest to how far along it is. */
  private nearest(i: number): number {
    const seg = this.track.segments[this.segment[i]];
    return Math.min(Math.max(0, Math.round((this.along[i] / seg.length) * (seg.arc.length - 1))), seg.arc.length - 1);
  }

  far(i: number): number {
    return this.track.segments[this.segment[i]].start + this.along[i];
  }

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

  running(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.count; i++) if (this.state[i] === RACING) out.push(i);
    return out.sort((a, b) => this.far(b) - this.far(a));
  }

  /** Which way a ball is turned: its body's own turning, as an axis and an angle, since physics keeps the whole of it. */
  roll(i: number, out: Roll): Roll {
    const q = this.balls[i].rotation();
    const half = Math.min(1, Math.abs(q.w));
    const angle = 2 * Math.acos(half);
    const s = Math.sqrt(Math.max(0, 1 - half * half));
    if (s < 1e-6) {
      out.ax = 0;
      out.ay = 1;
      out.az = 0;
      out.angle = 0;
    } else {
      const sign = q.w < 0 ? -1 : 1;
      out.ax = (sign * q.x) / s;
      out.ay = (sign * q.y) / s;
      out.az = (sign * q.z) / s;
      out.angle = angle;
    }
    return out;
  }

  /**
   * A ball meddled with, for a test of the rules and nothing else: nothing in
   * the game may do this once a race has begun, which is the rule `check`
   * holds, and a test has to be able to break it to see it hold.
   */
  meddle(i: number, how: { speed?: number; at?: number }): void {
    const body = this.balls[i];
    if (how.speed !== undefined) {
      const v = body.linvel();
      const l = Math.hypot(v.x, v.y, v.z) || 1;
      body.setLinvel({ x: (v.x / l) * how.speed, y: (v.y / l) * how.speed, z: (v.z / l) * how.speed }, true);
    }
    if (how.at !== undefined) body.setTranslation(this.balls[how.at].translation(), true);
    this.read();
  }

  /** What must always hold of the field as it stands, a line each. */
  check(): string[] {
    const problems: string[] = [];
    const doing = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < this.count; i++) {
      const state = this.state[i];
      if (state > STALLED + 2) problems.push(`ball ${i} is doing ${state}, which is nothing a ball does`);
      else doing[state]++;
      if (![this.x[i], this.y[i], this.z[i], this.speed[i]].every(Number.isFinite))
        problems.push(`ball ${i} is not a number`);
      // nothing on a run goes faster than falling through the air lets it: a ball that does was thrown
      if (this.speed[i] > TERMINAL * 1.05)
        problems.push(
          `ball ${i} is going ${this.speed[i].toFixed(1)}, faster than the air allows (${TERMINAL.toFixed(1)})`,
        );
      if (state !== RACING && state !== FINISHED) continue;
      // on the track and not through its floor, beyond the give a contact leaves: a trough's floor is the V's
      // sides, which its walls stand for
      const seg = this.track.segments[this.segment[i]];
      if (seg.trough) continue;
      const o = this.nearest(i) * 3;
      const up =
        seg.ups[o] * (this.x[i] - seg.points[o]) +
        seg.ups[o + 1] * (this.y[i] - seg.points[o + 1]) +
        seg.ups[o + 2] * (this.z[i] - seg.points[o + 2]);
      if (up < RADIUS - 0.1)
        problems.push(`ball ${i} is ${(RADIUS - up).toFixed(3)} into the floor of piece ${seg.piece}`);
    }
    if (doing[FINISHED] !== this.finishers)
      problems.push(`${doing[FINISHED]} balls home, and ${this.finishers} counted`);
    if (doing[STALLED] !== this.stalled) problems.push(`${doing[STALLED]} balls stopped, and ${this.stalled} counted`);
    if (doing[LOST] !== this.lost) problems.push(`${doing[LOST]} balls lost, and ${this.lost} counted`);
    for (let a = 0; a < this.count; a++)
      for (let b = a + 1; b < this.count; b++) {
        const on = (i: number) => this.state[i] === RACING || this.state[i] === FINISHED;
        if (!on(a) || !on(b)) continue;
        const apart = Math.hypot(this.x[b] - this.x[a], this.y[b] - this.y[a], this.z[b] - this.z[a]);
        if (apart < RADIUS * 2 - 0.05)
          problems.push(`balls ${a} and ${b} are ${apart.toFixed(3)} apart, inside each other`);
      }
    return problems;
  }
}
