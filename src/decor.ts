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
import {
  type Bowl,
  type Kind,
  type Run,
  type Spot,
  type Theme,
  type Track,
  HALF_WIDTH,
  at,
  boxOf,
  spot,
} from './track';
import { seeded } from './random';

/** Every kind of thing a run can be dressed with. */
export type DecorKind =
  | 'lamp'
  | 'pipes'
  | 'cog'
  | 'chimney'
  | 'girder'
  | 'tank'
  | 'piston'
  | 'stripes'
  | 'lollipop'
  | 'candyStripes'
  | 'gumdrops'
  | 'whisk'
  | 'cane'
  | 'giantLollipop'
  | 'fudgePot'
  | 'cupcake'
  | 'arch'
  | 'donut'
  | 'pretzel'
  | 'cake'
  | 'ground'
  | 'river'
  | 'mountain'
  | 'tower'
  | 'tree'
  | 'cloud';

/** What each theme dresses a run with: every kind in one theme and one only. */
export const THEME_KINDS: Record<Theme, readonly DecorKind[]> = {
  industrial: ['lamp', 'pipes', 'cog', 'chimney', 'girder', 'tank', 'piston', 'stripes'],
  sweets: [
    'lollipop',
    'candyStripes',
    'gumdrops',
    'whisk',
    'cane',
    'giantLollipop',
    'fudgePot',
    'cupcake',
    'arch',
    'donut',
    'pretzel',
    'cake',
    'ground',
    'river',
    'mountain',
    'tower',
    'tree',
    'cloud',
  ],
};
export const DECOR_KINDS: readonly DecorKind[] = [...THEME_KINDS.industrial, ...THEME_KINDS.sweets];

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
  lollipop: 12,
  candyStripes: 40,
  gumdrops: 24,
  whisk: 8,
  cane: 24,
  giantLollipop: 3,
  fudgePot: 3,
  cupcake: 3,
  arch: 8,
  donut: 6,
  pretzel: 4,
  cake: 5,
  ground: 1,
  river: 1,
  mountain: 12,
  tower: 4,
  tree: 24,
  cloud: 8,
};

/**
 * What stands far off round a run and not by it: the backdrop, kept beyond
 * the run's reach and low enough never to come between the run and a camera
 * looking down on it (`sceneryClear`). The ground and a river lie flat on the
 * ground under everything and are held only to lying there.
 */
export const SCENERY: readonly DecorKind[] = ['mountain', 'tower', 'tree', 'cloud', 'donut', 'pretzel', 'cake'];
/** What lies flat on the ground, under the run and everything by it. */
export const FLAT: readonly DecorKind[] = ['ground', 'river'];

/**
 * The world a run is in: the sky it is seen against, the ground it stands
 * over, if any, and the light. For the eye alone, as the rest of a theme is;
 * a run with no theme, or the works, is in the dark it always was.
 */
export interface World {
  sky: [number, number, number];
  /** The sky it reflects: a grey studio for the works' dark, a blue day for a candy world. */
  env: 'studio' | 'daylight';
  sunColour: [number, number, number];
  exposure: number;
  ambient: number;
}
export const WORLDS: Record<Theme | 'plain', World> = {
  plain: { sky: [0.04, 0.04, 0.05], env: 'studio', sunColour: [1, 0.96, 0.9], exposure: 1.1, ambient: 0.65 },
  industrial: { sky: [0.04, 0.04, 0.05], env: 'studio', sunColour: [1, 0.96, 0.9], exposure: 1.1, ambient: 0.65 },
  // a clear blue sky reflected in everything, and a warm light: less of the sky's own light than the works have, since
  // what it adds untinted is what washed every candy colour out to grey
  sweets: { sky: [0.45, 0.72, 0.98], env: 'daylight', sunColour: [2.6, 2.5, 2.35], exposure: 1.0, ambient: 0.3 },
};

/** The things that light the run, and the colour of their light: a works' lamps warm, a sweet factory's lollipops pink. */
export const LIGHTS: Partial<Record<DecorKind, [number, number, number]>> = {
  lamp: [1, 0.78, 0.45],
  lollipop: [1, 0.62, 0.82],
};

/** The puffs of smoke over each chimney, rising and swelling in turn. */
export const PUFFS = 10;
/**
 * How much of a puff's sprite is thick enough to see: it is thickest in its
 * middle and thins to nothing at its edge, and a test of where smoke may be
 * takes each puff as a ball this share of its size across.
 */
export const SMOKE_THICK = 0.8;

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

/** A lollipop lamp: a stick up beside the wall and over the channel, the lollipop glowing at its end, as a lamp's shade. */
export const LOLLIPOP = { out: 0.32, height: 4.2, pole: 0.08, shade: 0.45, hangs: 0.85, disc: 0.35 } as const;
/** Gumdrops along the outside of a wall: how far out, how high their middles, how round, and how far apart. */
export const GUMDROPS = { out: 0.5, up: 0.3, radius: 0.26, every: 0.7 } as const;
/** A whisk turning on a wall: how far its wires reach, how far out and high its middle, how thick. */
export const WHISK = { reach: 0.7, out: 0.45, up: 0.55, thick: 0.2 } as const;
/**
 * A candy cane's post: this far from its middle to its side, drawn in pieces
 * this long, and its stripes' `twist`, the renderer's swirl scale on a tube
 * one round: a red and a white stripe every pi times `half` over twice it
 * up the post, about half a unit.
 */
export const CANE = { half: 0.22, piece: 2, twist: 0.7 } as const;
/** A giant lollipop: its stick, its sweet's reach, how far out from the channel's edge, and no taller than `tallest`. */
export const GIANT = { out: 2.6, radius: 1.3, stick: 0.16, tallest: 15 } as const;
/** A pot of fudge on the ground, bubbling steam. */
export const POT = { out: 2.4, radius: 0.95, height: 1.5 } as const;
/** A cupcake on the ground: its paper case's reach and height, then its frosting and a cherry. */
export const CUPCAKE = { out: 2.4, radius: 0.85, height: 2 } as const;

/** A candy-cane arch over the channel: its posts this far out from its edge and this thick, and this high before they bend over. */
export const ARCH = { out: 0.55, thick: 0.26, rise: 2.8 } as const;
/** A donut lying on the ground, and a pretzel: how far round, how thick. */
export const DONUT = { radius: 1.4, tube: 0.5 } as const;
export const PRETZEL = { radius: 1.4, tube: 0.24 } as const;
/** A layered cake on the ground. */
export const CAKE = { radius: 1.2, height: 1.8 } as const;
/**
 * How the backdrop keeps out of the way: nothing nearer the run's middle
 * than its reach and `beyond`, and no top higher over the run's lowest point
 * than `slope` of how far past its reach it stands. The camera that frames a
 * run looks down on it at about 0.73; under a gentler line than that, nothing
 * can stand between it and the run, however far back it is.
 */
export const BACKDROP = { beyond: 6, slope: 0.6 } as const;

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

/** What a lamp is, to be placed: its pole, its height over the floor, and what hangs at the end of its arm. */
interface LampShape {
  out: number;
  height: number;
  pole: number;
  shade: number;
  hangs: number;
}

/** One ring of what runs along the outside of a wall: how far out from the channel's edge, how high, how thick. */
interface Band {
  out: number;
  up: number;
  radius: number;
}

/**
 * A run being dressed: its track, what has been put by it so far and what
 * stands on its own, and the rules every theme places by. A theme says what
 * goes where; the site says whether it fits, and keeps it. Without it each
 * theme would carry its own copy of the room checks, and the first to drift
 * would put something where a marble goes.
 */
class Site {
  readonly out: Decoration[] = [];
  /** What stands on its own, which the next thing on its own keeps clear of. */
  private readonly standing: Column[] = [];
  /** The one segment each piece is stood by: its longest a thing can be fixed to. */
  readonly by = new Map<number, number>();
  /** The pieces that have one, in order. */
  readonly pieces: number[];
  /** The pieces a marble may fly over, off a jump or over a funnel's lip, which nothing is hung over. */
  readonly aloft = new Set<number>();
  readonly box: ReturnType<typeof boxOf>;
  readonly ground: number;
  readonly high: number;
  private readonly bowls: Bowl[];
  private readonly h = spot();
  private readonly puff: [number, number, number, number] = [0, 0, 0, 0];

  constructor(
    readonly run: Run,
    readonly track: Track,
  ) {
    const { segments } = track;
    let low = Infinity,
      high = -Infinity;
    for (const seg of segments)
      for (let i = 2; i < seg.points.length; i += 3) {
        low = Math.min(low, seg.points[i]);
        high = Math.max(high, seg.points[i]);
      }
    this.high = high;
    this.ground = low - GROUND;
    // the box the run is framed and its shadow fitted by, which nothing standing on its own may reach out of
    this.box = boxOf(track);
    this.bowls = segments.flatMap((seg) => (seg.funnel ? [seg.funnel] : []));
    // each piece stood by through one of its segments: the longest of those a thing can be fixed to, which is to say
    // not a funnel's bowl, not a jump's air, not a wall left open to a lane beside it, and not of changing width
    segments.forEach((seg, s) => {
      if (seg.funnel || seg.flies || seg.open) return;
      const best = this.by.get(seg.piece);
      if (best === undefined || seg.length > segments[best].length) this.by.set(seg.piece, s);
    });
    // a marble in the air off a jump goes over the piece after it, so nothing is fixed over either
    run.pieces.forEach((p, k) => {
      if (p.kind === 'jump' || p.kind === 'funnel') {
        this.aloft.add(k);
        this.aloft.add(k + 1);
      }
    });
    this.pieces = [...this.by.keys()].sort((a, b) => a - b);
  }

  /** Whether a round column `r` wide from `lo` to `hi` comes within `keep` of any channel, bowl or thing already standing. */
  inTheWay(x: number, y: number, r: number, lo: number, hi: number, keep: number): boolean {
    for (const seg of this.track.segments) {
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
    for (const c of this.standing)
      if (hi > c.lo && lo < c.hi && Math.hypot(x - c.x, y - c.y) < c.r + r + ROOM) return true;
    return false;
  }

  /** A thing of `kind` by segment `s`, its foot where it stands and as tall as `height`. */
  put(kind: DecorKind, s: number, along: number, length: number, side: 1 | -1, foot: Point, height: number) {
    const { piece } = this.track.segments[s];
    const h = at(this.track, s, along, this.h);
    this.out.push({
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
  }

  /** A column that what stands on its own from now on keeps clear of. */
  stands(x: number, y: number, r: number, lo: number, hi: number) {
    this.standing.push({ x, y, r, lo, hi });
  }

  count(kind: DecorKind): number {
    return this.out.filter((d) => d.kind === kind).length;
  }

  kindOf(piece: number): Kind {
    return this.run.pieces[piece].kind;
  }

  /** Whether something on segment `s` moves: a sweeper, a gate or a wheel. */
  moving(s: number): boolean {
    return this.track.segments[s].obstacles.some((o) => o.motion.kind !== 'fixed');
  }

  /** Whether segment `s` is a chute's width all along, which is what runs along a wall is fitted to. */
  plainWidth(s: number): boolean {
    return this.track.segments[s].width.every((w) => Math.abs(w - HALF_WIDTH) < 1e-4);
  }

  /** The spot `along` segment `s`, read into the site's own, so reading one makes nothing. */
  spot(s: number, along: number): Spot {
    return at(this.track, s, along, this.h);
  }

  /**
   * Stripes on both walls where the field is let go, where something moves,
   * and where the race is won. A stripe is swept along its own wall and
   * reaches no further out than STRIPE.out and its thickness, under the 0.3
   * that `check` holds any two channels at one height apart wall to wall: it
   * cannot reach another channel in a sound run, so it is not tried against
   * them.
   */
  stripes(kind: DecorKind) {
    for (const k of this.pieces) {
      const s = this.by.get(k)!;
      if (this.kindOf(k) !== 'start' && this.kindOf(k) !== 'finish' && !this.moving(s)) continue;
      const seg = this.track.segments[s];
      for (const side of [1, -1] as const) {
        if (this.count(kind) >= MOST[kind]) break;
        const h = this.spot(s, 0);
        this.put(kind, s, 0, seg.length, side, off(h, side * (h.w + STRIPE.out), 0), seg.wall);
      }
    }
  }

  /** Lamps of `kind`, every third piece, on alternate sides, over the channel from a pole fixed beside it. */
  lamps(kind: DecorKind, shape: LampShape) {
    const { segments } = this.track;
    const found: [number, 1 | -1][] = [];
    for (const k of this.pieces) {
      if (k % 3 !== 1 || this.aloft.has(k)) continue;
      const s = this.by.get(k)!;
      const side: 1 | -1 = (k / 3) % 2 < 1 ? 1 : -1;
      const h = this.spot(s, segments[s].length / 2);
      const [x, y, z] = off(h, side * (h.w + shape.out), 0);
      if (this.inTheWay(x, y, shape.pole, z - 0.3, z + shape.height + 0.2, SKIN)) continue;
      // the arm, tried a step at a time from the pole in, as thick as it is; and what hangs under its end over the
      // middle, as far down as it reaches
      let clear = true;
      for (let a = h.w + shape.out; a >= 0 && clear; a -= 0.2) {
        const [ax, ay, az] = off(h, side * a, shape.height);
        if (this.inTheWay(ax, ay, 0.08, az - 0.08, az + 0.08, SKIN)) clear = false;
      }
      const [mx, my, mz] = off(h, 0, shape.height);
      if (clear && this.inTheWay(mx, my, shape.shade, mz - shape.hangs, mz + 0.05, SKIN)) clear = false;
      if (clear) found.push([s, side]);
    }
    for (const [s, side] of spread(found, MOST[kind])) {
      const along = segments[s].length / 2;
      const h = this.spot(s, along);
      const foot = off(h, side * (h.w + shape.out), 0);
      this.put(kind, s, along, 0, side, foot, shape.height);
      this.stands(foot[0], foot[1], shape.pole, foot[2], foot[2] + shape.height);
    }
  }

  /** What runs along the outside of a wall, every `every`th piece of a chute's width, as the rings of `bands` are. */
  alongWall(kind: DecorKind, bands: readonly Band[], every = 4) {
    const { segments } = this.track;
    for (const k of this.pieces) {
      if (k % every !== 2 % every || this.count(kind) >= MOST[kind]) continue;
      const s = this.by.get(k)!;
      const seg = segments[s];
      if (!this.plainWidth(s) || seg.length < 3) continue;
      const side: 1 | -1 = k % 8 < 4 ? -1 : 1;
      let clear = true;
      for (let along = 0; along <= seg.length && clear; along += 0.5) {
        const h = this.spot(s, along);
        for (const p of bands) {
          const [x, y, z] = off(h, side * (h.w + p.out), p.up);
          if (this.inTheWay(x, y, p.radius, z - p.radius, z + p.radius, SKIN)) clear = false;
        }
      }
      if (!clear) continue;
      const h = this.spot(s, 0);
      const top = bands[bands.length - 1];
      this.put(kind, s, 0, seg.length, side, off(h, side * (h.w + bands[0].out), 0), top.up + top.radius);
    }
  }

  /**
   * What turns on a wall, by whatever moves, as though it drove it, and on
   * every sixth piece besides: discs `out` from the channel's edge and `up`
   * over its floor, each at its offset along from the first and its reach.
   */
  onWall(kind: DecorKind, discs: readonly (readonly [number, number])[], out: number, up: number, thick: number) {
    const { segments } = this.track;
    const first = discs[0][1];
    const [lastOff, lastR] = discs[discs.length - 1];
    for (const k of this.pieces.filter((k) => this.moving(this.by.get(k)!) || k % 6 === 5)) {
      if (this.count(kind) >= MOST[kind]) break;
      const s = this.by.get(k)!;
      const seg = segments[s];
      if (!this.plainWidth(s) && !this.moving(s)) continue;
      const side: 1 | -1 = k % 2 === 0 ? 1 : -1;
      const along = Math.max(first, seg.length / 2 - lastOff / 2);
      if (along + lastOff + lastR > seg.length) continue;
      let clear = true;
      for (const [o, r] of discs)
        for (let t = 0; t < Math.PI * 2 && clear; t += Math.PI / 8) {
          const h = this.spot(s, Math.min(seg.length, Math.max(0, along + o + Math.cos(t) * r)));
          const [x, y, z] = off(h, side * (h.w + out), up + Math.sin(t) * r);
          if (this.inTheWay(x, y, thick, z - 0.05, z + 0.05, SKIN)) clear = false;
        }
      if (!clear) continue;
      const h = this.spot(s, along);
      this.put(kind, s, along, lastOff, side, off(h, side * (h.w + out), up), first);
    }
  }

  /**
   * What is stood against a wall, every fifth piece of a chute's width,
   * reaching `below` under its floor and `above` over it, and with room for
   * what it pushes out `reach` further up.
   */
  againstWall(kind: DecorKind, out: number, radius: number, below: number, above: number, reach: number) {
    const { segments } = this.track;
    for (const k of this.pieces) {
      if (k % 5 !== 3 || this.count(kind) >= MOST[kind]) continue;
      const s = this.by.get(k)!;
      if (!this.plainWidth(s)) continue;
      const side: 1 | -1 = k % 10 < 5 ? 1 : -1;
      const along = segments[s].length / 2;
      const h = this.spot(s, along);
      const [x, y, z] = off(h, side * (h.w + out), 0);
      if (this.inTheWay(x, y, radius, z - below, z + above + reach + 0.3, SKIN)) continue;
      this.put(kind, s, along, 0, side, [x, y, z - below], below + above);
    }
  }

  /**
   * Legs under the pieces, one under each wall, standing on what is below or
   * on the ground; as many pieces as two legs each allows, spread along the
   * run. Each then stands, `half` from its middle to its side.
   */
  legs(kind: DecorKind, half: number) {
    const { segments } = this.track;
    const before = this.out.length;
    for (const k of spread(this.pieces, MOST[kind] / 2)) {
      const s = this.by.get(k)!;
      const along = segments[s].length / 2;
      for (const side of [1, -1] as const) {
        const h = this.spot(s, along);
        const [x, y, top] = off(h, side * h.w, -0.25);
        const foot = footOf(this.track, x, y, top);
        if (foot === null || top - foot < 0.6) continue;
        this.put(kind, s, along, 0, side, [x, y, foot], top - foot);
      }
    }
    for (const d of this.out.slice(before)) this.stands(d.x, d.y, half * 1.5, d.z, d.z + d.height);
  }

  /**
   * One thing of `kind` standing on the ground beside the run where there is
   * room all the way up, at the first piece from `at0` of the way along it
   * that has room, and room for its smoke where `smoke` gives how it rises.
   */
  stand(kind: DecorKind, at0: number, radius: number, outBy: number, height: number, smoke?: Smoke) {
    const { pieces, box, ground } = this;
    const { segments } = this.track;
    if (pieces.length === 0) return;
    const from = Math.floor(at0 * pieces.length);
    for (let n = 0; n < pieces.length; n++) {
      const k = pieces[(from + n) % pieces.length];
      const s = this.by.get(k)!;
      for (const side of [1, -1] as const) {
        const h = this.spot(s, segments[s].length / 2);
        const [bx, by] = rightOf(h);
        const flat = Math.hypot(bx, by) || 1;
        const x = h.x + (bx / flat) * side * (h.w + outBy),
          y = h.y + (by / flat) * side * (h.w + outBy);
        if (x - radius < box.min[0] || x + radius > box.max[0] || y - radius < box.min[1] || y + radius > box.max[1])
          continue;
        if (this.inTheWay(x, y, radius, ground, ground + height, CLEAR)) continue;
        // a bowl is where a player watches the field go round, and a thing beside it stood between the camera and
        // the field in it, so what stands on its own keeps well back from one
        if (this.bowls.some((b) => Math.hypot(x - b.x, y - b.y) < b.rim + radius + BOWL_ROOM)) continue;
        // room for its smoke too, all the way up its drift, at the size each puff has there
        if (smoke) {
          let clear = true;
          for (let age = 0; age <= 1 && clear; age += 0.05) {
            const [px, py, pz, pr] = smokeAt(x, y, ground + height, age, this.puff, smoke);
            if (this.inTheWay(px, py, pr, pz - pr, pz + pr, SKIN)) clear = false;
          }
          if (!clear) continue;
        }
        this.stands(x, y, radius, ground, ground + height);
        this.put(kind, s, segments[s].length / 2, 0, side, [x, y, ground], height);
        return;
      }
    }
  }

  /**
   * Arches over the channel, every third piece where the lamps are not: a
   * post up beside each wall and a half round over the middle between them,
   * each tried for room a step at a time, as a lamp's arm is.
   */
  arches(kind: DecorKind) {
    const { segments } = this.track;
    for (const k of this.pieces) {
      if (k % 3 !== 2 || this.aloft.has(k) || this.count(kind) >= MOST[kind]) continue;
      const s = this.by.get(k)!;
      if (!this.plainWidth(s)) continue;
      const along = segments[s].length / 2;
      const h = this.spot(s, along);
      const span = h.w + ARCH.out;
      let clear = true;
      for (const side of [1, -1] as const) {
        const [x, y, z] = off(h, side * span, 0);
        if (this.inTheWay(x, y, ARCH.thick, z - 0.3, z + ARCH.rise, SKIN)) clear = false;
      }
      for (let t = 0; t <= Math.PI && clear; t += Math.PI / 16) {
        const [x, y, z] = off(h, Math.cos(t) * span, ARCH.rise + Math.sin(t) * span);
        if (this.inTheWay(x, y, ARCH.thick, z - ARCH.thick, z + ARCH.thick, SKIN)) clear = false;
      }
      if (!clear) continue;
      this.put(kind, s, along, 0, 1, off(h, span, 0), ARCH.rise + span);
      for (const side of [1, -1] as const) {
        const [x, y, z] = off(h, side * span, 0);
        this.stands(x, y, ARCH.thick, z, z + ARCH.rise + span);
      }
    }
  }

  /**
   * The backdrop round the run: the ground under it all and a river across
   * it, then mountains far off, castle towers, chocolate trees and clouds, all
   * placed by a chance drawn from the run's own shape, so one run always has
   * the same backdrop. Each is beyond the run's reach and under the line
   * `sceneryClear` holds it to, and shrinks to fit under it where it must.
   */
  backdrop() {
    const { box, ground, track } = this;
    const cx = (box.min[0] + box.max[0]) / 2,
      cy = (box.min[1] + box.max[1]) / 2;
    const reach = reachOf(box);
    const low = ground + GROUND;
    const segment = this.pieces.length ? this.by.get(this.pieces[0])! : 0;
    // chance from the run's shape: its size and its length, the same for the same run every time
    const random = seeded(Math.round(track.length * 1000) + Math.round((box.max[0] - box.min[0]) * 7919));
    const far = reach + 180;
    const place = (kind: DecorKind, dist: number, angle: number, height: number, lift = 0) => {
      const x = cx + Math.cos(angle) * dist,
        y = cy + Math.sin(angle) * dist;
      // no higher than the line a camera looking down on the run would have to look under
      const most = low + BACKDROP.slope * (dist - reach) - (ground + lift);
      const tall = Math.min(height, most);
      // shrunk to fit where it must, but not to a stub: a mountain allowed less than a unit is left out, and a pretzel
      // lying flat is never more than half of one
      if (tall < Math.min(1, height)) return;
      this.put(kind, segment, 0, 0, 1, [x, y, ground + lift], tall);
    };
    this.put('ground', segment, 0, far, 1, [cx, cy, ground], 0);
    this.put('river', segment, 0, far, 1, [cx, cy + (random() - 0.5) * reach, ground], 0);
    // a river runs whichever way the chance says, not the way the track does where it was put down
    this.out[this.out.length - 1].heading = random() * Math.PI;
    for (let k = 0; k < MOST.mountain; k++) {
      const angle = (k / MOST.mountain) * Math.PI * 2 + random() * 0.4;
      place('mountain', reach + 90 + random() * 70, angle, 30 + random() * 25);
    }
    for (let k = 0; k < MOST.tower; k++) {
      const angle = (k / MOST.tower) * Math.PI * 2 + 0.7 + random() * 0.8;
      place('tower', reach + 30 + random() * 25, angle, 12 + random() * 6);
    }
    // sweets strewn on the ground just past the run, big enough to be seen from where the whole run is framed: in
    // proportion to its reach, as scenery is and furniture by the run is not
    const big = Math.max(1, reach / 25);
    for (const [kind, spread] of [
      ['donut', 26],
      ['pretzel', 26],
      ['cake', 20],
    ] as const)
      for (let k = 0; k < MOST[kind]; k++) {
        const turn = random() * Math.PI * 2;
        const height = (kind === 'donut' ? DONUT.tube * 2 : kind === 'pretzel' ? PRETZEL.tube * 2 : CAKE.height) * big;
        place(kind, reach + BACKDROP.beyond + 3 * big + random() * spread * big, random() * Math.PI * 2, height);
        this.out[this.out.length - 1].heading = turn;
      }
    for (let k = 0; k < MOST.tree; k++)
      place('tree', reach + BACKDROP.beyond + 2 + random() * 45, random() * Math.PI * 2, (3 + random() * 3) * big);
    // clouds up in the sky far off, beyond the mountains, where the line a camera looks under is high above them
    for (let k = 0; k < MOST.cloud; k++) {
      const dist = reach + 220 + random() * 80;
      const up = 45 + random() * 25;
      place('cloud', dist, random() * Math.PI * 2, 14 + random() * 8, up);
    }
  }
}

type Point = [number, number, number];

/** Every `n`th of `list`, spread along it, so a long run's share is spread along it too. */
function spread<T>(list: T[], most: number): T[] {
  if (list.length <= most) return list;
  return Array.from({ length: most }, (_, k) => list[Math.floor(((k + 0.5) * list.length) / most)]);
}

/** The works: iron, copper and brick, stripes where it matters, and smoke from its chimneys. */
function industrial(site: Site) {
  site.stripes('stripes');
  site.lamps('lamp', LAMP);
  site.alongWall('pipes', PIPES);
  site.onWall(
    'cog',
    [
      [0, COG.big],
      [COG.apart, COG.small],
    ],
    COG.out,
    COG.up,
    COG.thick,
  );
  site.againstWall('piston', PISTON.out, PISTON.radius, PISTON.below, PISTON.above, PISTON.stroke);
  site.legs('girder', GIRDER.half);
  for (const d of site.out)
    if (d.kind === 'piston') site.stands(d.x, d.y, PISTON.radius, d.z, d.z + d.height + PISTON.stroke);
  // chimneys and tanks stand on the ground beside the run: chimneys a third, a half and four fifths of the way along
  // it, tanks further on
  for (const f of [0.3, 0.55, 0.8])
    site.stand(
      'chimney',
      f,
      CHIMNEY.radius,
      CHIMNEY.out,
      Math.min(site.high + OVER - site.ground, CHIMNEY.tallest),
      CHIMNEY_SMOKE,
    );
  for (const f of [0.65, 0.9, 0.1]) site.stand('tank', f, TANK.radius, TANK.out, TANK.height);
}

/**
 * The sweet factory: candy-cane posts, lollipops lighting the run pink, gumdrops along the walls, whisks turning,
 * candy stripes where it matters, and giant lollipops, cupcakes and pots of fudge steaming on the ground. Each is
 * placed by the rule its counterpart in the works is, so the room it is given is the room that has been tested.
 */
function sweets(site: Site) {
  site.stripes('candyStripes');
  site.lamps('lollipop', LOLLIPOP);
  // small, and many of them: every other piece, where the works' pipes go on every fourth
  site.alongWall('gumdrops', [GUMDROPS], 2);
  site.onWall('whisk', [[0, WHISK.reach]], WHISK.out, WHISK.up, WHISK.thick);
  site.legs('cane', CANE.half);
  for (const f of [0.3, 0.55, 0.8])
    site.stand('giantLollipop', f, GIANT.radius, GIANT.out, Math.min(site.high + OVER - site.ground, GIANT.tallest));
  for (const f of [0.45, 0.7, 0.95]) site.stand('fudgePot', f, POT.radius, POT.out, POT.height, POT_STEAM);
  for (const f of [0.65, 0.9, 0.1]) site.stand('cupcake', f, CUPCAKE.radius, CUPCAKE.out, CUPCAKE.height);
  site.arches('arch');
  site.backdrop();
}

/** How far a run reaches from its middle across the ground: the half of its box's diagonal, walls and all. */
export function reachOf(box: { min: number[]; max: number[] }): number {
  return Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1]) / 2;
}

/**
 * Why a thing of the backdrop stands in the way, or nothing where it does
 * not: nearer the run's middle than its reach and `beyond`, or its top over
 * the line rising `slope` from the run's lowest point past its reach, where a
 * camera looking down on the run could see it between. Flat things lie on the
 * ground and need only lie there.
 */
export function sceneryClear(track: Track, d: Decoration): string {
  const box = boxOf(track);
  const low = box.min[2] + HALF_WIDTH + 4;
  const ground = low - GROUND;
  if (FLAT.includes(d.kind)) return Math.abs(d.z - ground) < 1e-6 && d.height === 0 ? '' : `a ${d.kind} off the ground`;
  if (!SCENERY.includes(d.kind)) return '';
  const reach = reachOf(box);
  const dist = Math.hypot(d.x - (box.min[0] + box.max[0]) / 2, d.y - (box.min[1] + box.max[1]) / 2);
  if (dist < reach + BACKDROP.beyond) return `a ${d.kind} ${(dist - reach).toFixed(1)} past the run's reach`;
  const line = low + BACKDROP.slope * (dist - reach);
  if (d.z + d.height > line + 1e-6)
    return `a ${d.kind} ${(d.z + d.height - line).toFixed(1)} over the line a camera looks under`;
  return '';
}

/** How each theme dresses a run: one for every theme there is, which the compiler holds it to. */
const DRESSERS: Record<Theme, (site: Site) => void> = { industrial, sweets };

/** What `run` is dressed with, on `track`, its own working out: nothing, unless it names a theme. */
export function dress(run: Run, track: Track): Decoration[] {
  if (!run.theme || track.segments.length === 0) return [];
  const site = new Site(run, track);
  DRESSERS[run.theme](site);
  return site.out;
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
  // a lamp's bulb under its shade; a lollipop's light just under the sweet, since a light inside it lights nothing
  const [x, y, z] = off(h, 0, d.kind === 'lollipop' ? LOLLIPOP.height - LOLLIPOP.hangs - 0.1 : LAMP.height - 0.45);
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

/** How a thing's smoke rises: how far up over its life, how far downwind, and how big a puff is born and grows. */
export interface Smoke {
  rise: number;
  drift: [number, number];
  size: number;
  grows: number;
}

/** A chimney's smoke. Spaced further apart as it rises than it is round, and drifting downwind as it goes. */
export const CHIMNEY_SMOKE: Smoke = { rise: 15, drift: [5, 1.8], size: 0.9, grows: 2 };
/** A fudge pot's steam: lower, smaller and gentler than a chimney's smoke, and gone sooner. */
export const POT_STEAM: Smoke = { rise: 6, drift: [1.4, 0.5], size: 0.45, grows: 1.1 };
/** What smokes, and how. */
export const SMOKES: Partial<Record<DecorKind, Smoke>> = { chimney: CHIMNEY_SMOKE, fudgePot: POT_STEAM };

/**
 * Where a puff of smoke is when it is `age` of the way through its life, from
 * a thing topping out at `x`, `y`, `top`, and how big: it rises and swells,
 * and drifts downwind as it goes, as `smoke` says.
 */
export function smokeAt(
  x: number,
  y: number,
  top: number,
  age: number,
  out: [number, number, number, number],
  smoke: Smoke = CHIMNEY_SMOKE,
): [number, number, number, number] {
  out[0] = x + age * smoke.drift[0];
  out[1] = y + age * smoke.drift[1];
  out[2] = top + 0.3 + age * smoke.rise;
  out[3] = smoke.size + age * smoke.grows;
  return out;
}

/** A puff of smoke: where, how big, and how thick, 0 to 1. */
export type Puff = [number, number, number, number, number];

/** How thick a puff is at its thickest, 0 to 1: enough to read as smoke, and never enough to hide what is behind it. */
const SMOKE_ALPHA = 0.6;

/**
 * Where puff `j` over a chimney is at `t` seconds, how big, and how thick:
 * each rises and swells from the top, thickening as it leaves the chimney and
 * thinning to nothing as it rises, and is born again.
 */
export function puffOf(d: Decoration, j: number, t: number, out: Puff): Puff {
  const age = (t * 0.16 + j / PUFFS + d.piece * 0.13) % 1;
  const [x, y, z, size] = smokeAt(d.x, d.y, d.z + d.height, age, place, SMOKES[d.kind]);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = size;
  // thick before the next is born, so that above the lowest each puff is thinner than the one under it
  out[4] = SMOKE_ALPHA * Math.min(1, age * PUFFS * 1.25) * (1 - age) ** 1.5;
  return out;
}
const place: [number, number, number, number] = [0, 0, 0, 0];
