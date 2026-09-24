/**
 * The run as it is drawn. What never moves is built once when a run is put
 * on: the channel, swept along the very samples the track worked out and as
 * wide as the track says at each; the pegs; and each funnel's bowl, turned
 * from the same height the marbles roll on. What moves is written every
 * frame: the marbles, and the sweepers, gates and wheels, each placed where
 * the race says it is, so what is seen is exactly what a marble hits. It is
 * handed what it draws from, and never the renderer.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { MeshBuilder } from 'artshape-render/mesh/types';
import { FIELD } from './field';
import { MARBLES, RADIUS } from './race';
import type { Race, Roll } from './race';
import { basis, spin } from './matrix';
import { bar, bowl as bowlMesh, cone, mound, sphere, sweep, wheel } from './meshes';
import {
  HALF_WIDTH,
  LANE_STOP,
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
/** How far out a gate's post stands from the wall it is on. */
const POST = 0.7;
/**
 * The channel in section, in its own terms: how far across, and how far up.
 * Down one wall, across the floor, up the other, then back along the
 * outside, so the trough has a thickness to it when seen from below.
 */
const profile = (wall: number): readonly (readonly [number, number])[] => [
  [-HALF_WIDTH, wall],
  [-HALF_WIDTH, 0],
  [HALF_WIDTH, 0],
  [HALF_WIDTH, wall],
  [HALF_WIDTH + SKIN, wall],
  [HALF_WIDTH + SKIN, -SKIN],
  [-HALF_WIDTH - SKIN, -SKIN],
  [-HALF_WIDTH - SKIN, wall],
  [-HALF_WIDTH, wall],
];

/**
 * Which edges of `profile` are a wall, its inside face, its top and its
 * outside, on the left and on the right: what is left out where physics has
 * that wall open.
 */
const LEFT_WALL = [0, 6, 7],
  RIGHT_WALL = [2, 3, 4];

/** A trough in section: the walls meet at a narrow bottom, a V a chute wide, for the lane at the end and the narrow. */
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

export class Scene {
  /** Where every marble is this frame, one placement each. */
  readonly marbles = new Float32Array(MARBLES * 16);
  /** What each marble is made of: colour and roughness, four numbers each. */
  readonly looks = new Float32Array(MARBLES * 4);
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
    }
  }

  /**
   * The run itself, built once: the channel as one mesh, the bowls as
   * another, the pegs as a group; and the moving parts noted, for writing
   * each frame. A funnel's own centre line is only for ordering the field,
   * and is not drawn: its bowl is.
   */
  static(track: Track): GameGroup[] {
    const channel = new MeshBuilder();
    const bowls = new MeshBuilder();
    const grid = new MeshBuilder();
    const rungs: number[] = [];
    const pegs: number[] = [];
    const posts: number[] = [];
    const mounds: number[] = [];
    // the floor under each funnel's hole, whose back end is walled
    const backs: number[] = [];
    // the line a race is won at, across the start of the last piece, and the stop at the far end of its lane
    const end = track.segments.length - 1;
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
      else
        sweep(
          seg.points,
          seg.tangents,
          seg.ups,
          seg.arc.length,
          seg.trough ? trough(seg.wall) : profile(seg.wall),
          channel,
          seg.width,
          HALF_WIDTH,
          seg.trough ? seg.floor : undefined,
          // a lane's wall left out wherever physics leaves it open, at both ends of the stretch, as it is met
          seg.open && !seg.trough ? openWall(seg.open) : undefined,
        );
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
      { mesh: channel.build(), matrices: one, albedo: [0.42, 0.44, 0.5], roughness: 0.65 },
      // a peg is a cone, which is what a ball there meets
      {
        mesh: cone(PEG_CONE, PEG_HEIGHT),
        matrices: pegAt,
        count: pegs.length / 3,
        albedo: [0.2, 0.2, 0.23],
        roughness: 0.5,
      },
      {
        mesh: bar(POST, 0.9, GATE_HEIGHT + 0.15),
        matrices: postAt,
        count: posts.length / 3,
        albedo: [0.25, 0.25, 0.28],
        roughness: 0.5,
      },
      // the mounds the same grey as the floor they rise out of, so they read as the floor's own shape
      {
        mesh: mound(MOUND.radius, MOUND.height),
        matrices: moundAt,
        count: mounds.length / 3,
        albedo: [0.42, 0.44, 0.5],
        roughness: 0.65,
      },
      { mesh: bar(HALF_WIDTH * 2, 0.12, 0.03), matrices: lineAt, albedo: [0.95, 0.72, 0.2], roughness: 0.4 },
      {
        mesh: bar((HALF_WIDTH + SKIN) * 2, LANE_STOP * 2, track.segments[end].wall),
        matrices: stopAt,
        albedo: [0.25, 0.25, 0.28],
        roughness: 0.5,
      },
      {
        mesh: bar((HALF_WIDTH + SKIN) * 2, OUTLET_BACK * 2, track.wall),
        matrices: backAt,
        count: backs.length,
        albedo: [0.42, 0.44, 0.5],
        roughness: 0.65,
      },
    ];
    // the grid the same dark as the pegs, so it reads as ironwork over the channel and not part of it
    if (grid.vertexCount > 0) {
      groups.push({ mesh: grid.build(), matrices: one, albedo: [0.2, 0.2, 0.23], roughness: 0.5 });
      groups.push({
        mesh: bar((HALF_WIDTH + SKIN) * 2, BAR, BAR),
        matrices: rungAt,
        count: rungs.length / 2,
        albedo: [0.2, 0.2, 0.23],
        roughness: 0.5,
      });
    }
    // a run without a funnel has no bowl to draw, and an empty mesh is not worth a buffer
    if (bowls.vertexCount > 0)
      groups.push({ mesh: bowls.build(), matrices: one, albedo: [0.42, 0.44, 0.5], roughness: 0.6 });
    return groups;
  }

  /** What moves: the marbles, then the sweepers, the gates and the wheels, each pool sized once. */
  dynamic(): GameGroup[] {
    return [
      { mesh: sphere(RADIUS), matrices: this.marbles, count: 0, materials: this.looks },
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
    ];
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

/** What `sweep` leaves out of a lane whose walls are open along `open`: the side's wall, where open at both ends. */
function openWall(open: Uint8Array): (i: number, k: number) => boolean {
  return (i, k) => {
    const both = open[i] & open[i + 1];
    return (both & 1 ? LEFT_WALL.includes(k) : false) || (both & 2 ? RIGHT_WALL.includes(k) : false);
  };
}
