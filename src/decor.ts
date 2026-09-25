/**
 * What a run is dressed with: lamps, pipes, cogs, chimneys and the rest of a
 * works, worked out from the run's own shape when it names a theme. Nothing
 * here is met by a marble; the race is run on the track alone, and this only
 * says where each thing stands, so that the scene can draw it and a test can
 * hold it clear of where a marble goes. Without it every run hangs bare in
 * the dark.
 *
 * Every thing is tried against every channel before it stands: what is fixed
 * to a piece's wall keeps outside the wall's own skin, and what stands on its
 * own keeps a hand's width off anything. Where a thing will not fit it is
 * left out, never squeezed in, so a run that folds tight is dressed less and
 * never dressed through itself. There is no floor: a girder stands on the
 * wall or grid of the piece below it, or reaches down to a ground a little
 * under the run's lowest point, which is where chimneys and tanks stand too.
 */
import { type Run, type Spot, type Track, HALF_WIDTH, at, boxOf, spot } from './track';

/** Every kind of thing a run can be dressed with. */
export type DecorKind = 'lamp' | 'pipes' | 'cog' | 'chimney' | 'girder' | 'tank' | 'piston' | 'stripes';
export const DECOR_KINDS: readonly DecorKind[] = [
  'lamp',
  'pipes',
  'cog',
  'chimney',
  'girder',
  'tank',
  'piston',
  'stripes',
];

/**
 * How many of each a run may have at most. Lamps are lights, and the renderer
 * has sixteen, one of them the light over the whole run; cogs, pistons and
 * chimneys' smoke move, and their pools are sized once by these.
 */
export const MOST: Record<DecorKind, number> = {
  lamp: 12,
  pipes: 24,
  cog: 8,
  chimney: 3,
  girder: 24,
  tank: 3,
  piston: 6,
  stripes: 40,
};

/** The puffs of smoke over each chimney, rising and swelling in turn. */
export const PUFFS = 5;

/**
 * A lamp: its pole this far out from the channel's edge, the lamp this high over the floor, its shade this far
 * round, and the shade and bulb hanging this far under the arm.
 */
export const LAMP = { out: 0.32, height: 4.2, pole: 0.09, shade: 0.4, hangs: 0.55 } as const;
/** Two pipes along the outside of a wall: how far out from the channel's edge, how high their middles, how thick. */
export const PIPES = [
  { out: 0.44, up: 0.35, radius: 0.2 },
  { out: 0.4, up: 0.85, radius: 0.13 },
] as const;
/** A pair of cogs on a wall, meshing: the big one's and the small one's reach, how far out, how high, how thick, how far apart. */
export const COG = { big: 0.75, small: 0.45, out: 0.42, up: 0.5, thick: 0.16, apart: 1.12 } as const;
/** A piston stood on the outside of a wall: its cylinder's reach, how far out, how far its body reaches under and over the floor, and its stroke. */
export const PISTON = { out: 0.8, radius: 0.28, below: 1.4, above: 0.3, stroke: 0.8 } as const;
/**
 * A chimney and a tank stand this far out from the channel's edge, this wide; a chimney no taller than
 * `tallest`, since one reaching from the ground to over the top of a tall run was a pole fifty times its width.
 */
export const CHIMNEY = { out: 2.7, radius: 1.05, tallest: 22 } as const;
export const TANK = { out: 2.3, radius: 0.9, height: 3.2 } as const;
/** A girder's leg, a lattice column this far from its middle to its corners. */
export const GIRDER = { half: 0.24 } as const;
/** Hazard stripes, a plate on the outside of each wall, in blocks this long, a band up to this high. */
export const STRIPE = { out: 0.19, block: 0.7, top: 1.05 } as const;

/** How far below the run's lowest point the ground is that chimneys, tanks and the lowest girders stand on. */
const GROUND = 2;
/** How far over the run's highest point a chimney stands. */
const OVER = 3.5;
/** How far off a channel's edge a thing fixed to a wall keeps: the wall's own skin, as drawn. */
const SKIN = 0.18;
/** How far back from a funnel's bowl a chimney or a tank keeps, so as not to stand between the camera and the field in it. */
const BOWL_ROOM = 3;
/** How far off anything else standing a thing on its own keeps. */
const ROOM = 0.35;
/**
 * How far off any channel's edge a chimney or a tank keeps: past whatever is fixed to
 * a wall, a cog or a pipe, which reach up to this far out from it.
 */
const CLEAR = 0.7;
/** How far over and under a channel's floor and wall top a thing is taken as being in its way. */
const ABOVE = 0.4;

/** No segment spared from being in a thing's way. */
const NONE: ReadonlySet<number> = new Set();

/** One thing standing by the run. */
export interface Decoration {
  kind: DecorKind;
  /** Which piece of the run it belongs to, and which of the track's segments it stands by. */
  piece: number;
  segment: number;
  /** How far along its segment it stands, or begins, and how far it runs on from there: nothing for what stands in one place. */
  along: number;
  length: number;
  /** Which side of the channel: 1 to the right of the way it goes, -1 to the left. */
  side: 1 | -1;
  /** Its foot, in the world. */
  x: number;
  y: number;
  z: number;
  /** How tall it stands from its foot. */
  height: number;
  /** Which way the track goes where it stands, as a turn about Z. */
  heading: number;
}

/** A thing standing on its own, kept clear of by the next: a round column from `lo` to `hi`. */
interface Column {
  x: number;
  y: number;
  r: number;
  lo: number;
  hi: number;
}

/** Where the right of the way the track goes is, at a spot: square to its way and its up. */
function rightOf(h: Spot): [number, number, number] {
  return [h.ty * h.uz - h.tz * h.uy, h.tz * h.ux - h.tx * h.uz, h.tx * h.uy - h.ty * h.ux];
}

/** A point `across` to the right of a spot's middle and `up` over its floor. */
function off(h: Spot, across: number, up: number): [number, number, number] {
  const [bx, by, bz] = rightOf(h);
  return [h.x + bx * across + h.ux * up, h.y + by * across + h.uy * up, h.z + bz * across + h.uz * up];
}

/** What `run` is dressed with, on `track`, its own working out: nothing, unless it names a theme. */
export function dress(run: Run, track: Track): Decoration[] {
  if (run.theme !== 'industrial' || track.segments.length === 0) return [];
  const { segments } = track;
  let low = Infinity,
    high = -Infinity;
  for (const seg of segments)
    for (let i = 2; i < seg.points.length; i += 3) {
      low = Math.min(low, seg.points[i]);
      high = Math.max(high, seg.points[i]);
    }
  // the box the run is framed and its shadow fitted by, which nothing standing on its own may reach out of
  const box = boxOf(track);
  const ground = low - GROUND;
  const standing: Column[] = [];

  /** Whether a round column `r` wide from `lo` to `hi` comes within `keep` of any channel, bowl or thing already standing. */
  const inTheWay = (
    x: number,
    y: number,
    r: number,
    lo: number,
    hi: number,
    keep: number,
    mine: ReadonlySet<number> = NONE,
  ): boolean => {
    for (let s = 0; s < segments.length; s++) {
      if (mine.has(s)) continue;
      const seg = segments[s];
      const b = seg.funnel;
      if (b) {
        if (
          Math.hypot(x - b.x, y - b.y) < b.rim + 0.3 + r + keep &&
          hi > b.z - b.depth - 1.5 &&
          lo < b.z + b.wall + ABOVE
        )
          return true;
        continue;
      }
      const { points, width, wall } = seg;
      for (let i = 0; i < width.length; i++) {
        const z = points[i * 3 + 2];
        if (hi < z - ABOVE || lo > z + wall + ABOVE) continue;
        if (Math.hypot(x - points[i * 3], y - points[i * 3 + 1]) < width[i] + r + keep) return true;
      }
    }
    for (const c of standing) if (hi > c.lo && lo < c.hi && Math.hypot(x - c.x, y - c.y) < c.r + r + ROOM) return true;
    return false;
  };

  // each piece stood by through one of its segments: the longest of those a thing can be fixed to, which is to say not
  // a funnel's bowl, not a jump's air, not a wall left open to a lane beside it, and not of changing width
  const by = new Map<number, number>();
  segments.forEach((seg, s) => {
    if (seg.funnel || seg.flies || seg.open) return;
    const best = by.get(seg.piece);
    if (best === undefined || seg.length > segments[best].length) by.set(seg.piece, s);
  });
  const kindOf = (piece: number) => run.pieces[piece].kind;
  // a marble in the air off a jump goes over the piece after it, so nothing is fixed over either
  const aloft = new Set<number>();
  run.pieces.forEach((p, k) => {
    if (p.kind === 'jump' || p.kind === 'funnel') {
      aloft.add(k);
      aloft.add(k + 1);
    }
  });
  const pieces = [...by.keys()].sort((a, b) => a - b);
  const out: Decoration[] = [];
  const h = spot();
  const put = (
    kind: DecorKind,
    s: number,
    along: number,
    length: number,
    side: 1 | -1,
    foot: [number, number, number],
    height: number,
  ) => {
    const { piece } = segments[s];
    at(track, s, along, h);
    out.push({
      kind,
      piece,
      segment: s,
      along,
      length,
      side,
      x: foot[0],
      y: foot[1],
      z: foot[2],
      height,
      heading: Math.atan2(h.ty, h.tx),
    });
  };
  const count = (kind: DecorKind) => out.filter((d) => d.kind === kind).length;
  /** Every `n`th of `list`, spread along it, so a long run's share is spread along it too. */
  const spread = <T>(list: T[], most: number): T[] => {
    if (list.length <= most) return list;
    return Array.from({ length: most }, (_, k) => list[Math.floor(((k + 0.5) * list.length) / most)]);
  };
  const moving = (s: number) => segments[s].obstacles.some((o) => o.motion.kind !== 'fixed');
  const plainWidth = (s: number) => segments[s].width.every((w) => Math.abs(w - HALF_WIDTH) < 1e-4);

  // hazard stripes on both walls where the field is let go, where something moves, and where the race is won
  for (const k of pieces) {
    const s = by.get(k)!;
    if (kindOf(k) !== 'start' && kindOf(k) !== 'finish' && !moving(s)) continue;
    // a stripe is swept along its own wall and reaches no further out than STRIPE.out and its thickness, under the
    // 0.3 that `check` holds any two channels at one height apart wall to wall: it cannot reach another channel in
    // a sound run, so it is not tried against them
    const seg = segments[s];
    for (const side of [1, -1] as const) {
      if (count('stripes') >= MOST.stripes) break;
      at(track, s, 0, h);
      put('stripes', s, 0, seg.length, side, off(h, side * (h.w + STRIPE.out), 0), seg.wall);
    }
  }

  // the lamps, every third piece, on alternate sides, over the channel from a pole fixed beside it
  const lamps: [number, 1 | -1][] = [];
  for (const k of pieces) {
    if (k % 3 !== 1 || aloft.has(k)) continue;
    const s = by.get(k)!;
    const side: 1 | -1 = (k / 3) % 2 < 1 ? 1 : -1;
    const along = segments[s].length / 2;
    at(track, s, along, h);
    const [x, y, z] = off(h, side * (h.w + LAMP.out), 0);
    if (inTheWay(x, y, LAMP.pole, z - 0.3, z + LAMP.height + 0.2, SKIN)) continue;
    // the arm, tried a step at a time from the pole in, as thick as it is; and the shade and the bulb hanging under
    // its end over the middle, as far down as they reach
    let clear = true;
    for (let a = h.w + LAMP.out; a >= 0 && clear; a -= 0.2) {
      const [ax, ay, az] = off(h, side * a, LAMP.height);
      if (inTheWay(ax, ay, 0.08, az - 0.08, az + 0.08, SKIN)) clear = false;
    }
    const [mx, my, mz] = off(h, 0, LAMP.height);
    if (clear && inTheWay(mx, my, LAMP.shade, mz - LAMP.hangs, mz + 0.05, SKIN)) clear = false;
    if (clear) lamps.push([s, side]);
  }
  for (const [s, side] of spread(lamps, MOST.lamp)) {
    const along = segments[s].length / 2;
    at(track, s, along, h);
    const foot = off(h, side * (h.w + LAMP.out), 0);
    put('lamp', s, along, 0, side, foot, LAMP.height);
    standing.push({ x: foot[0], y: foot[1], r: LAMP.pole, lo: foot[2], hi: foot[2] + LAMP.height });
  }

  // pipes along the outside of a wall, on every fourth piece of a chute's width, on the other side from its lamp
  for (const k of pieces) {
    if (k % 4 !== 2 || count('pipes') >= MOST.pipes) continue;
    const s = by.get(k)!;
    const seg = segments[s];
    if (!plainWidth(s) || seg.length < 3) continue;
    const side: 1 | -1 = k % 8 < 4 ? -1 : 1;
    let clear = true;
    for (let along = 0; along <= seg.length && clear; along += 0.5) {
      at(track, s, along, h);
      for (const p of PIPES) {
        const [x, y, z] = off(h, side * (h.w + p.out), p.up);
        if (inTheWay(x, y, p.radius, z - p.radius, z + p.radius, SKIN)) clear = false;
      }
    }
    if (!clear) continue;
    at(track, s, 0, h);
    put('pipes', s, 0, seg.length, side, off(h, side * (h.w + PIPES[0].out), 0), PIPES[1].up + PIPES[1].radius);
  }

  // cogs on a wall: by whatever moves, as though they drove it, and on every sixth piece besides
  const cogs = pieces.filter((k) => moving(by.get(k)!) || k % 6 === 5);
  for (const k of cogs) {
    if (count('cog') >= MOST.cog) break;
    const s = by.get(k)!;
    const seg = segments[s];
    if (!plainWidth(s) && !moving(s)) continue;
    const side: 1 | -1 = k % 2 === 0 ? 1 : -1;
    const along = Math.max(COG.big, seg.length / 2 - COG.apart / 2);
    if (along + COG.apart + COG.small > seg.length) continue;
    let clear = true;
    for (const [a, r] of [
      [along, COG.big],
      [along + COG.apart, COG.small],
    ] as const)
      for (let t = 0; t < Math.PI * 2 && clear; t += Math.PI / 8) {
        at(track, s, Math.min(seg.length, Math.max(0, a + Math.cos(t) * r)), h);
        const [x, y, z] = off(h, side * (h.w + COG.out), COG.up + Math.sin(t) * r);
        if (inTheWay(x, y, COG.thick, z - 0.05, z + 0.05, SKIN)) clear = false;
      }
    if (!clear) continue;
    at(track, s, along, h);
    put('cog', s, along, COG.apart, side, off(h, side * (h.w + COG.out), COG.up), COG.big);
  }

  // pistons stood against a wall, every fifth piece of a chute's width, pumping
  for (const k of pieces) {
    if (k % 5 !== 3 || count('piston') >= MOST.piston) continue;
    const s = by.get(k)!;
    if (!plainWidth(s)) continue;
    const side: 1 | -1 = k % 10 < 5 ? 1 : -1;
    const along = segments[s].length / 2;
    at(track, s, along, h);
    const [x, y, z] = off(h, side * (h.w + PISTON.out), 0);
    if (inTheWay(x, y, PISTON.radius, z - PISTON.below, z + PISTON.above + PISTON.stroke + 0.3, SKIN)) continue;
    put('piston', s, along, 0, side, [x, y, z - PISTON.below], PISTON.below + PISTON.above);
  }

  // girders under the pieces, a leg under each wall, standing on what is below or on the ground; as many pieces as
  // two legs each allows, spread along the run
  const held = spread(pieces, MOST.girder / 2);
  for (const k of held) {
    const s = by.get(k)!;
    const along = segments[s].length / 2;
    for (const side of [1, -1] as const) {
      at(track, s, along, h);
      const [x, y, top] = off(h, side * h.w, -0.25);
      const foot = footOf(track, x, y, top);
      if (foot === null || top - foot < 0.6) continue;
      put('girder', s, along, 0, side, [x, y, foot], top - foot);
    }
  }
  for (const d of out)
    if (d.kind === 'girder') standing.push({ x: d.x, y: d.y, r: GIRDER.half * 1.5, lo: d.z, hi: d.z + d.height });
  for (const d of out)
    if (d.kind === 'piston')
      standing.push({ x: d.x, y: d.y, r: PISTON.radius, lo: d.z, hi: d.z + d.height + PISTON.stroke });

  // chimneys and tanks stand on the ground beside the run where there is room all the way up: chimneys a third, a half
  // and four fifths of the way along it, tanks further on, each at the first piece from there that has room
  const puff: [number, number, number, number] = [0, 0, 0, 0];
  const bowls = segments.flatMap((seg) => (seg.funnel ? [seg.funnel] : []));
  const stand = (kind: 'chimney' | 'tank', at0: number, radius: number, outBy: number, height: number) => {
    if (pieces.length === 0) return;
    const from = Math.floor(at0 * pieces.length);
    for (let n = 0; n < pieces.length; n++) {
      const k = pieces[(from + n) % pieces.length];
      const s = by.get(k)!;
      for (const side of [1, -1] as const) {
        at(track, s, segments[s].length / 2, h);
        const [bx, by2] = rightOf(h);
        const flat = Math.hypot(bx, by2) || 1;
        const x = h.x + (bx / flat) * side * (h.w + outBy),
          y = h.y + (by2 / flat) * side * (h.w + outBy);
        if (x - radius < box.min[0] || x + radius > box.max[0] || y - radius < box.min[1] || y + radius > box.max[1])
          continue;
        if (inTheWay(x, y, radius, ground, ground + height, CLEAR)) continue;
        // a bowl is where a player watches the field go round, and a chimney beside it stood between the camera and
        // the field in it, so what stands on its own keeps well back from one
        if (bowls.some((b) => Math.hypot(x - b.x, y - b.y) < b.rim + radius + BOWL_ROOM)) continue;
        // a chimney needs room for its smoke too, all the way up its drift, at the size each puff has there
        if (kind === 'chimney') {
          let clear = true;
          for (let age = 0; age <= 1 && clear; age += 0.05) {
            const [px, py, pz, pr] = smokeAt(x, y, ground + height, age, puff);
            if (inTheWay(px, py, pr, pz - pr, pz + pr, SKIN)) clear = false;
          }
          if (!clear) continue;
        }
        standing.push({ x, y, r: radius, lo: ground, hi: ground + height });
        put(kind, s, segments[s].length / 2, 0, side, [x, y, ground], height);
        return;
      }
    }
  };
  for (const f of [0.3, 0.55, 0.8])
    stand('chimney', f, CHIMNEY.radius, CHIMNEY.out, Math.min(high + OVER - ground, CHIMNEY.tallest));
  for (const f of [0.65, 0.9, 0.1]) stand('tank', f, TANK.radius, TANK.out, TANK.height);
  return out;
}

/**
 * Where a girder's leg at `x`, `y` coming down from `top` stands: on the wall
 * or grid of the first piece below it, on the ground where there is none, or
 * nowhere where it would come down into an open channel or a bowl.
 */
function footOf(track: Track, x: number, y: number, top: number): number | null {
  let low = Infinity;
  for (const seg of track.segments) for (let i = 2; i < seg.points.length; i += 3) low = Math.min(low, seg.points[i]);
  let best = -Infinity,
    onIt = true;
  const h = spot();
  for (let s = 0; s < track.segments.length; s++) {
    const seg = track.segments[s];
    const b = seg.funnel;
    if (b) {
      if (Math.hypot(x - b.x, y - b.y) < b.rim + 0.5 && b.z + b.wall < top && b.z + b.wall > best) {
        best = b.z + b.wall;
        onIt = false;
      }
      continue;
    }
    for (let i = 0; i < seg.width.length; i++) {
      const o = i * 3;
      const wallTop = seg.points[o + 2] + seg.wall;
      if (wallTop + ABOVE >= top || wallTop <= best) continue;
      const d = Math.hypot(x - seg.points[o], y - seg.points[o + 1]);
      if (d >= seg.width[i] + GIRDER.half + 0.3) continue;
      at(track, s, seg.arc[i], h);
      const [bx, by, bz] = rightOf(h);
      const across = Math.abs((x - h.x) * bx + (y - h.y) * by + (top - h.z) * bz);
      const lidded = !!seg.lid && seg.arc[i] >= seg.lid.from && seg.arc[i] <= seg.lid.upto;
      best = wallTop;
      // a leg comes down on a wall where it is over the wall, or on a grid anywhere across it
      onIt = lidded || (across >= seg.width[i] - 0.1 && across <= seg.width[i] + 0.35);
    }
  }
  if (best === -Infinity) return low - GROUND;
  return onIt ? best : null;
}

/** Where a lamp's light hangs: over the channel's middle, a little under the lamp's own height. */
export function bulbOf(track: Track, d: Decoration, out: [number, number, number]): [number, number, number] {
  const h = at(track, d.segment, d.along);
  const [x, y, z] = off(h, 0, LAMP.height - 0.45);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/** How far round a cog is at `t` seconds: the big one's turn, the small one turning back the faster by their sizes. */
export function cogTurn(t: number): number {
  return t * 0.8;
}

/** How far a piston's rod is out at `t` seconds, 0 to its whole stroke, each on a phase of its own from where it stands. */
export function rodOut(d: Decoration, t: number): number {
  const phase = (d.piece * 0.37) % 1;
  return PISTON.stroke * (0.5 - 0.5 * Math.cos((t * 0.9 + phase) * Math.PI * 2));
}

/**
 * Where a puff of smoke is when it is `age` of the way through its life, from
 * a chimney topping out at `x`, `y`, `top`, and how big: it rises and swells,
 * and drifts downwind as it goes. Spaced further apart as they rise than they
 * are round, so each reads as a puff and not the lot as one lump.
 */
export function smokeAt(
  x: number,
  y: number,
  top: number,
  age: number,
  out: [number, number, number, number],
): [number, number, number, number] {
  out[0] = x + age * 5;
  out[1] = y + age * 1.8;
  out[2] = top + 0.3 + age * 15;
  out[3] = 0.55 + age * 1.25;
  return out;
}

/** Where puff `j` over a chimney is at `t` seconds, and how big: each rises and swells from the top, and is born again. */
export function puffOf(
  d: Decoration,
  j: number,
  t: number,
  out: [number, number, number, number],
): [number, number, number, number] {
  return smokeAt(d.x, d.y, d.z + d.height, (t * 0.16 + j / PUFFS + d.piece * 0.13) % 1, out);
}
