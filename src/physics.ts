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
import { MeshBuilder } from 'artshape-render/mesh/types';
import { bowl as bowlMesh } from './meshes';
import type { Random } from './random';
import type { Race, RaceEvents, RaceOptions, Roll } from './race';
import {
  type Compiled,
  HALF_WIDTH,
  PEG_HEIGHT,
  SAMPLE_EVERY,
  TROUGH_DEPTH,
  type Track,
  at,
  bowlHeight,
  moundHeight,
} from './track';

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
/**
 * How many steps of the world go to one step of the game, unless told
 * otherwise. At four, a ball at speed was found a hair inside another or
 * into the floor now and then; at eight, never, over every kind on 24
 * seeds, for 0.36 ms a frame against 0.18.
 */
export const SUBSTEPS = 8;

export interface PhysicsOptions extends RaceOptions {
  /** How many steps of the world to one of the game, for a test that wants to know what that buys. */
  substeps?: number;
}
/** What a ball and the track grip each other with, and how much of a knock comes back. */
const GRIP = 0.3;
const GIVE = 0.05;
/**
 * How far into its floor a ball may read as sitting before `check` calls it
 * through it: a flat chute's own contact settles well inside a hundredth,
 * but a cone's point and a mound's crest are less forgiving of an angled
 * strike, and pressed hard against either a ball read as sunk up to 0.128
 * over 48 seeds each, alone and fed by two drops, with nothing else wrong.
 */
const FLOOR_GIVE = 0.15;
/**
 * How long, after a ball was last on a funnel's bowl or what its hole hands
 * on to, it is still taken as falling through the throat rather than resting
 * on whatever segment happens to have the nearest sample to it: falling
 * through a throat and landing took under a quarter of a second on every
 * seed tried, off every speed a run feeds a funnel; this is four times that.
 * While it falls it can read as nowhere near any segment's own line, on
 * whichever segment the nearest sample happens to belong to, one piece past
 * the bowl or more before it lands on the real geometry underneath it.
 */
const THROAT_GRACE = 1;
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

/** A rotation from a right-handed frame, `x`, `y` and `z` as its columns, as a quaternion. */
function frameQuat(x: V3, y: V3, z: V3): { x: number; y: number; z: number; w: number } {
  const m00 = x[0],
    m01 = y[0],
    m02 = z[0],
    m10 = x[1],
    m11 = y[1],
    m12 = z[1],
    m20 = x[2],
    m21 = y[2],
    m22 = z[2];
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const S = Math.sqrt(tr + 1) * 2;
    return { w: S / 4, x: (m21 - m12) / S, y: (m02 - m20) / S, z: (m10 - m01) / S };
  }
  if (m00 > m11 && m00 > m22) {
    const S = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return { w: (m21 - m12) / S, x: S / 4, y: (m01 + m10) / S, z: (m02 + m20) / S };
  }
  if (m11 > m22) {
    const S = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return { w: (m02 - m20) / S, x: (m01 + m10) / S, y: S / 4, z: (m12 + m21) / S };
  }
  const S = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return { w: (m10 - m01) / S, x: (m02 + m20) / S, y: (m12 + m21) / S, z: S / 4 };
}

/** A right-handed frame with `t` along and `u` up, as a quaternion: what a thing stood on the track is turned by. */
function standing(t: V3, u: V3): { x: number; y: number; z: number; w: number } {
  const b: V3 = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
  // x across, y up and z back along, so that x cross y is z
  const back: V3 = [-t[0], -t[1], -t[2]];
  return frameQuat(b, u, back);
}

/**
 * The channel of the given segments as one mesh: floor, two walls and their
 * lips, and a ceiling wherever there is a lid. A bowl is not a channel and
 * is left out, to be met as the surface the scene turns it from.
 */
function channelMesh(track: Track, which: (s: number) => boolean): { verts: Float32Array; idx: Uint32Array } {
  const verts: number[] = [];
  const idx: number[] = [];
  const push = (p: V3, b: V3, u: V3, across: number, up: number) =>
    verts.push(p[0] + b[0] * across + u[0] * up, p[1] + b[1] * across + u[1] * up, p[2] + b[2] * across + u[2] * up);
  for (let s = 0; s < track.segments.length; s++) {
    if (!which(s)) continue;
    const seg = track.segments[s];
    if (seg.funnel) continue;
    const { wall } = seg;
    const n = seg.arc.length;
    // the floor is two points, its edges, unless mounds stand in it, when it is sampled as often across as the
    // track is along, so that a mound is met as the shape it is drawn as
    let widest = 0;
    for (let i = 0; i < n; i++) widest = Math.max(widest, seg.floor[i]);
    const cols = seg.mounds.length > 0 ? Math.max(2, Math.ceil((2 * widest) / SAMPLE_EVERY) + 1) : 2;
    // the section: outer lip, wall top, the foot of the wall, the floor's columns, foot, wall top, outer lip.
    // For a trough the floor's two points are the bottom of a V that rises to the walls' feet, and the walls
    // stand on above it; for a flat channel the foot is a point half way up the wall
    const P = cols + 6;
    const base = verts.length / 3;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const p: V3 = [seg.points[o], seg.points[o + 1], seg.points[o + 2]];
      const t: V3 = [seg.tangents[o], seg.tangents[o + 1], seg.tangents[o + 2]];
      const u: V3 = [seg.ups[o], seg.ups[o + 1], seg.ups[o + 2]];
      const b: V3 = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
      const w = seg.width[i];
      const foot = seg.trough ? TROUGH_DEPTH : wall / 2;
      push(p, b, u, -w - SKIN, wall);
      push(p, b, u, -w, wall);
      push(p, b, u, -w, foot);
      for (let j = 0; j < cols; j++) {
        const across = -seg.floor[i] + (2 * seg.floor[i] * j) / (cols - 1);
        push(p, b, u, across, seg.mounds.length > 0 ? moundHeight(seg, seg.arc[i], across) : 0);
      }
      push(p, b, u, w, foot);
      push(p, b, u, w, wall);
      push(p, b, u, w + SKIN, wall);
    }
    for (let i = 0; i + 1 < n; i++) {
      for (let k = 0; k + 1 < P; k++) {
        const a = base + i * P + k,
          c = base + (i + 1) * P + k;
        idx.push(a, a + 1, c, a + 1, c + 1, c);
      }
      // under a lid, a ceiling from wall top to wall top, wherever both ends of the stretch are covered
      if (seg.lid && seg.arc[i] >= seg.lid.from - 1e-6 && seg.arc[i + 1] <= seg.lid.upto + 1e-6) {
        const a = base + i * P + 1,
          c = base + (i + 1) * P + 1,
          across = P - 3;
        idx.push(a, c, a + across, a + across, c, c + across);
      }
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
  /** The sim time up to which each ball is still taken as falling through a funnel's throat, not yet landed. */
  private readonly throatUntil: Float32Array;
  private readonly bottom: number;
  /** Where the run ends: the segment a ball is home on, and the one before it. */
  private readonly last: number;
  /** Which came home this step, to be placed in the order they crossed. */
  private readonly crossed: number[] = [];
  /** Whether the gate has opened: after it, nothing may put a ball anywhere. */
  private released = false;
  private readonly substeps: number;

  constructor(
    private readonly rapier: Rapier,
    readonly track: Track,
    private readonly events: RaceEvents = {},
    options: PhysicsOptions = {},
  ) {
    const random = options.random ?? Math.random;
    this.substeps = options.substeps ?? SUBSTEPS;
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
    this.throatUntil = new Float32Array(n).fill(-1);
    let bottom = Infinity;
    for (const seg of track.segments)
      for (let k = 2; k < seg.points.length; k += 3) bottom = Math.min(bottom, seg.points[k]);
    this.bottom = bottom;
    this.last = track.segments.findIndex((s) => s.next < 0 && !s.fork);

    this.world = new rapier.World({ x: 0, y: 0, z: -GRAVITY });
    Physics.alive++;
    // the mesh's own edges are told from its true ones, so a ball rolling from one triangle to the next on a
    // flat floor is not bumped by the seam between them, as Rapier otherwise has it
    const flags = rapier.TriMeshFlags.FIX_INTERNAL_EDGES;
    // a run being built is a start gate and nothing else until a piece goes on, and a mesh of nothing is refused
    const run = channelMesh(track, (s) => s !== this.last);
    if (run.idx.length > 0)
      this.world.createCollider(
        rapier.ColliderDesc.trimesh(run.verts, run.idx, flags).setFriction(GRIP).setRestitution(GIVE),
      );
    const lane = channelMesh(track, (s) => s === this.last);
    this.world.createCollider(
      rapier.ColliderDesc.trimesh(lane.verts, lane.idx, flags).setFriction(POLISHED).setRestitution(GIVE),
    );
    track.segments.forEach((seg, s) => {
      // what stands still in the way: a peg is a cone, its point up, stood on the floor where the track has it
      for (const ob of seg.obstacles) {
        if (ob.motion.kind !== 'fixed') continue;
        const h = at(track, s, ob.along);
        const t: V3 = [h.tx, h.ty, h.tz],
          u: V3 = [h.ux, h.uy, h.uz];
        const b: V3 = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
        const half = PEG_HEIGHT / 2;
        this.world.createCollider(
          rapier.ColliderDesc.cone(half, ob.radius)
            .setTranslation(
              h.x + b[0] * ob.across + u[0] * half,
              h.y + b[1] * ob.across + u[1] * half,
              h.z + b[2] * ob.across + u[2] * half,
            )
            .setRotation(standing(t, u))
            .setFriction(GRIP)
            .setRestitution(GIVE),
        );
      }
      // a funnel's bowl, its rim wall and its throat: the very surface the scene turns, so what is drawn is met
      if (seg.funnel) {
        const bowl = seg.funnel;
        const built = bowlMesh(
          bowl.hole,
          bowl.rim,
          (r) => bowlHeight(bowl, r),
          bowl.wall,
          bowl.throat,
          new MeshBuilder(),
          [bowl.x, bowl.y, bowl.z],
        ).build();
        this.world.createCollider(
          rapier.ColliderDesc.trimesh(built.positions, built.indices, flags).setFriction(GRIP).setRestitution(GIVE),
        );
      }
      // the way out from under a funnel's hole is walled at its back, as the scene draws it, so a ball dropping
      // out of the throat cannot bounce off the back of it
      if (s > 0 && track.segments[s - 1].funnel) {
        const t: V3 = [seg.tangents[0], seg.tangents[1], seg.tangents[2]];
        const u: V3 = [seg.ups[0], seg.ups[1], seg.ups[2]];
        const b: V3 = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
        const BACK = 0.12;
        this.world.createCollider(
          rapier.ColliderDesc.cuboid(BACK, HALF_WIDTH + SKIN, seg.wall / 2)
            .setTranslation(
              seg.points[0] - t[0] * BACK + u[0] * (seg.wall / 2),
              seg.points[1] - t[1] * BACK + u[1] * (seg.wall / 2),
              seg.points[2] - t[2] * BACK + u[2] * (seg.wall / 2),
            )
            .setRotation(frameQuat(t, b, u))
            .setFriction(GRIP)
            .setRestitution(GIVE),
        );
      }
    });
    // the run ends in a cup, the lane rising again over its last stretch, so the field comes to rest in its dip and
    // nothing presses on what stands at the end; a face at the foot of the slope had the whole field pressing the
    // first ball into the corner it made with the trough and the wall, and out over the top. What stands at the
    // end now only ever meets a ball that has come up the rise, slowly: a solid block, since a sheet was got through
    const end = track.segments[this.last];
    const o = (end.arc.length - 1) * 3;
    const t: V3 = [end.tangents[o], end.tangents[o + 1], end.tangents[o + 2]];
    const u: V3 = [end.ups[o], end.ups[o + 1], end.ups[o + 2]];
    const b: V3 = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
    const STOP = 0.5;
    const c: V3 = [
      end.points[o] + t[0] * STOP + u[0] * end.wall,
      end.points[o + 1] + t[1] * STOP + u[1] * end.wall,
      end.points[o + 2] + t[2] * STOP + u[2] * end.wall,
    ];
    this.world.createCollider(
      rapier.ColliderDesc.cuboid(STOP, end.width[end.width.length - 1] + SKIN, end.wall * 2)
        .setTranslation(c[0], c[1], c[2])
        .setRotation(frameQuat(t, b, u))
        .setFriction(POLISHED)
        .setRestitution(GIVE),
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

  /**
   * Whether every piece of `track` is one physics races yet: a channel, with
   * pegs and mounds in it or not, and a funnel, whose run in is the one lip
   * a ball may fly off. Not yet the parts that move, a jump, or a branch.
   */
  static supports(track: Track): boolean {
    return track.segments.every(
      (s) =>
        s.obstacles.every((ob) => ob.motion.kind === 'fixed') &&
        (!s.flies || (s.next >= 0 && track.segments[s.next].funnel !== null)) &&
        !s.fork &&
        s.branch === 0 &&
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
      this.throatUntil[i] = -1;
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
    this.world.timestep = dt / this.substeps;
    for (let k = 0; k < this.substeps; k++) {
      this.breathe(dt / this.substeps);
      this.world.step();
    }
    this.read();
    this.reckon(dt);
  }

  /** The air's drag on every ball alike, a share of the speed squared, as the solver has it: what gives a run a top speed. */
  private breathe(dt: number): void {
    for (let i = 0; i < this.count; i++) {
      if (this.state[i] !== RACING && this.state[i] !== FINISHED) continue;
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
      // below everything, or clean out of the channel: off the run, told of, given no place. A bowl's own centre
      // line is only for ordering, so a ball in one is off the run only if it is below everything; a segment
      // that flies is left on purpose, so a ball still nearest its last sample while falling toward what comes
      // after it is not through a floor that was never there to catch it; and a ball still falling through a
      // funnel's throat, on to whichever segment happens to have the nearest sample to it before it has truly
      // arrived anywhere, reads as far off that line as the throat is wide, which is no line it follows at all
      const lenient = seg.flies || this.inThroat(i, this.segment[i]);
      const o = this.nearest(i) * 3;
      const under = this.z[i] - seg.points[o + 2];
      if (
        this.z[i] < this.bottom - OFF ||
        (!lenient && (Math.abs(this.across[i]) > seg.width[this.nearest(i)] + OFF || under < -THROUGH))
      ) {
        this.state[i] = LOST;
        this.lost++;
        // held where it fell out, out of the race and out of the way: left to fall it fell for ever, faster than
        // anything the air allows, since nothing below the run is there to stop it
        this.balls[i].setBodyType(this.rapier.RigidBodyType.Fixed, true);
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

  /**
   * Whether a segment is the one a funnel's bowl hands a ball on to: what
   * the outlet is. A ball falls through the hole and the throat to land on
   * it, a drop no `Segment` represents, so while it is still arriving it
   * can read as far off this segment's own line as the throat is wide,
   * exactly as it does on the bowl itself.
   */
  private afterBowl(segment: number): boolean {
    return segment > 0 && this.track.segments[segment - 1].funnel !== null;
  }

  /**
   * Whether ball `i` is still to be taken as falling through a funnel's
   * throat: on the bowl or its outlet now, which keeps the grace period
   * running, or within it from the last time it was.
   */
  private inThroat(i: number, segment: number): boolean {
    const seg = this.track.segments[segment];
    if (seg.funnel || this.afterBowl(segment)) {
      this.throatUntil[i] = this.t + THROAT_GRACE;
      return true;
    }
    return this.t < this.throatUntil[i];
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
  meddle(i: number, how: { speed?: number; at?: number; lift?: number }): void {
    const body = this.balls[i];
    if (how.speed !== undefined) {
      const v = body.linvel();
      const l = Math.hypot(v.x, v.y, v.z) || 1;
      body.setLinvel({ x: (v.x / l) * how.speed, y: (v.y / l) * how.speed, z: (v.z / l) * how.speed }, true);
    }
    if (how.at !== undefined) body.setTranslation(this.balls[how.at].translation(), true);
    if (how.lift !== undefined) {
      const seg = this.track.segments[this.segment[i]];
      const o = this.nearest(i) * 3;
      const p = body.translation();
      body.setTranslation(
        { x: p.x + seg.ups[o] * how.lift, y: p.y + seg.ups[o + 1] * how.lift, z: p.z + seg.ups[o + 2] * how.lift },
        true,
      );
    }
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
      // sides, which its walls stand for, a segment that flies has no floor for a ball past its lip to be
      // measured against, and a ball still falling through a funnel's throat, on to whichever segment happens
      // to be nearest, has no floor there yet either
      const seg = this.track.segments[this.segment[i]];
      if (seg.trough || seg.flies || this.inThroat(i, this.segment[i])) continue;
      const o = this.nearest(i) * 3;
      const up =
        seg.ups[o] * (this.x[i] - seg.points[o]) +
        seg.ups[o + 1] * (this.y[i] - seg.points[o + 1]) +
        seg.ups[o + 2] * (this.z[i] - seg.points[o + 2]);
      if (up < RADIUS - FLOOR_GIVE)
        problems.push(`ball ${i} is ${(RADIUS - up).toFixed(3)} into the floor of piece ${seg.piece}`);
      // and under a lid, not through it: a lid is what holds a ball on a crest it would otherwise leave
      if (seg.lid && this.along[i] >= seg.lid.from && this.along[i] <= seg.lid.upto && up > seg.wall - RADIUS + 0.1)
        problems.push(`ball ${i} is ${(up + RADIUS - seg.wall).toFixed(3)} through the lid of piece ${seg.piece}`);
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
