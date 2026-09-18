/**
 * The run as it is drawn: the channel, which is built once when a run is put
 * on and never moves; and the marbles, which move every frame. The groups
 * are fixed once and only what is in them is written each frame. It is
 * handed what it draws from, and never the renderer.
 *
 * The channel is swept along the very samples the track worked out, so what
 * is drawn and what is raced cannot drift apart: a marble is never seen
 * beside the chute it is actually in.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { FIELD } from './field';
import { MARBLES, RADIUS, type Marbles } from './marbles';
import { spin } from './matrix';
import { sphere, sweep } from './meshes';
import { HALF_WIDTH, type Track } from './track';

/**
 * How high the wall of the channel stands above its floor. It has to rise
 * past a marble's middle to hold it in, and not much further: a wall a whole
 * marble high hides everything of a marble but its crown from any camera
 * above it, and half the field is always against one wall or the other.
 */
const WALL = RADIUS + 0.12;
/** How thick the chute is, so it is a trough and not a sheet of paper. */
const SKIN = 0.18;

/**
 * The channel in section, in its own terms: how far across, and how far up.
 * Down one wall, across the floor, up the other, then back along the
 * outside, so the trough has a thickness to it when seen from below.
 */
const PROFILE: readonly (readonly [number, number])[] = [
  [-HALF_WIDTH, WALL],
  [-HALF_WIDTH, 0],
  [HALF_WIDTH, 0],
  [HALF_WIDTH, WALL],
  [HALF_WIDTH + SKIN, WALL],
  [HALF_WIDTH + SKIN, -SKIN],
  [-HALF_WIDTH - SKIN, -SKIN],
  [-HALF_WIDTH - SKIN, WALL],
  [-HALF_WIDTH, WALL],
];

export class Scene {
  /** Where every marble is this frame, one placement each. */
  readonly marbles = new Float32Array(MARBLES * 16);
  /** What each marble is made of: colour and roughness, four numbers each. */
  readonly looks = new Float32Array(MARBLES * 4);

  constructor() {
    for (let i = 0; i < MARBLES; i++) {
      const look = FIELD[i % FIELD.length];
      this.looks[i * 4] = look.colour[0];
      this.looks[i * 4 + 1] = look.colour[1];
      this.looks[i * 4 + 2] = look.colour[2];
      this.looks[i * 4 + 3] = look.roughness;
    }
  }

  /** The run itself, built once: every piece swept into one mesh, since none of it ever moves. */
  static(track: Track): GameGroup[] {
    const b = sweep(
      track.segments[0].points,
      track.segments[0].tangents,
      track.segments[0].ups,
      track.segments[0].arc.length,
      PROFILE,
    );
    for (let i = 1; i < track.segments.length; i++) {
      const seg = track.segments[i];
      sweep(seg.points, seg.tangents, seg.ups, seg.arc.length, PROFILE, b);
    }
    const one = new Float32Array(16);
    spin(one, 0, 0, 0, 0, 0, 0, 1, 0);
    return [{ mesh: b.build(), matrices: one, albedo: [0.42, 0.44, 0.5], roughness: 0.65 }];
  }

  /** What moves: the marbles, their pool sized once and their looks set with it. */
  dynamic(): GameGroup[] {
    return [{ mesh: sphere(RADIUS), matrices: this.marbles, count: 0, materials: this.looks }];
  }

  /** Every marble where it is this frame, turned as far as it has rolled: how many were placed. */
  write(marbles: Marbles): number {
    for (let i = 0; i < marbles.count; i++) {
      // it rolls about whatever lies across its way, which is what makes the turn look like rolling and not spinning
      const seg = marbles.track.segments[marbles.segment[i]];
      const o =
        Math.min(Math.max(0, Math.round((marbles.along[i] / seg.length) * (seg.arc.length - 1))), seg.arc.length - 1) *
        3;
      const tx = seg.tangents[o],
        ty = seg.tangents[o + 1],
        tz = seg.tangents[o + 2];
      const ux = seg.ups[o],
        uy = seg.ups[o + 1],
        uz = seg.ups[o + 2];
      spin(
        this.marbles,
        i,
        marbles.x[i],
        marbles.y[i],
        marbles.z[i],
        ty * uz - tz * uy,
        tz * ux - tx * uz,
        tx * uy - ty * ux,
        marbles.rolled[i],
      );
    }
    return marbles.count;
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
  const pad = HALF_WIDTH + 2;
  return {
    min: [minX - pad, minY - pad, minZ - pad],
    max: [maxX + pad, maxY + pad, maxZ + pad],
  };
}
