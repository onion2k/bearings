/**
 * A run dressed as a works: lamps, pipes, cogs, chimneys, girders, tanks,
 * pistons and hazard stripes, worked out from the run's own shape when it
 * names a theme. What is dressed, that it is the same every time, that it
 * keeps within its ceilings and the run's box, and above all that nothing of
 * it stands where a marble can be or changes the track a race is run on.
 */
import { describe, expect, it } from 'vitest';
import type { GameGroup } from 'artshape-render/game/renderer';
import { PIECES } from '../src/catalog';
import { DECOR_KINDS, type Decoration, LAMP, MOST, bulbOf, dress } from '../src/decor';
import { Designer, PALETTE } from '../src/designer';
import { seeded } from '../src/random';
import { RUNS } from '../src/runs';
import { Scene, boxOf } from '../src/scene';
import { type Run, type Track, bowlHeight, check, compile } from '../src/track';

const industrial = (run: Run): Run => ({ ...run, theme: 'industrial' });
const plain = (run: Run): Run => {
  const { theme, ...rest } = run;
  void theme;
  return rest;
};
const dressed = (run: Run) => {
  const track = compile(run);
  return { track, items: dress(run, track) };
};

/** Designs laid at random from `seed` and kept only where sound, each dressed. */
function designs(seed: number, count: number): Run[] {
  const random = seeded(seed);
  const out: Run[] = [];
  while (out.length < count) {
    const d = new Designer('Random');
    for (let n = 0; n < 4 + Math.floor(random() * 20); n++) {
      const kinds = PALETTE.filter((k) => !['splitter', 'joiner', 'finish'].includes(k));
      d.place(kinds[Math.floor(random() * kinds.length)]);
    }
    d.place('finish');
    if (check(d.run).length === 0) out.push(industrial({ ...d.run, id: `random-${out.length}` }));
  }
  return out;
}

/**
 * A run that turns back under itself, where a lamp over a piece would stand
 * in the channel of the piece passing over it: found by laying runs at random
 * until one did with the lamps not tried for room, since no run that comes
 * with the game does.
 */
function folded(): Run {
  const d = new Designer('Folded');
  const kinds = [
    ...(['wheel', 'shallowWide', 'shallowWide', 'curveLeft', 'curveLeft', 'curveLeft', 'curveRight'] as const),
    ...(['bumps', 'curveLeft', 'brake', 'jump', 'gate', 'shallowBroad', 'finish'] as const),
  ];
  for (const k of kinds) expect(d.place(k), k).toBe(true);
  expect(check(d.run)).toEqual([]);
  return industrial({ ...d.run, id: 'folded' });
}

describe('dressing a run', () => {
  it('leaves a plain run bare', () => {
    for (const run of RUNS) expect(dressed(plain(run)).items, run.id).toEqual([]);
  });

  it('dresses every run that comes with the game, and between them uses every kind', () => {
    const seen = new Set<string>();
    for (const run of RUNS) {
      expect(run.theme, run.id).toBe('industrial');
      const { items } = dressed(run);
      const kinds = new Set(items.map((d) => d.kind));
      for (const k of ['lamp', 'girder', 'stripes'] as const) expect(kinds.has(k), `${run.id} has a ${k}`).toBe(true);
      for (const k of kinds) seen.add(k);
    }
    expect([...seen].sort()).toEqual([...DECOR_KINDS].sort());
  });

  it('dresses the same run the same way every time', () => {
    for (const run of RUNS) expect(dressed(run).items).toEqual(dressed(run).items);
  });

  it('keeps each kind within its ceiling, however long the run', () => {
    for (const run of [...RUNS, ...designs(7, 12)]) {
      const { items } = dressed(run);
      for (const kind of DECOR_KINDS)
        expect(items.filter((d) => d.kind === kind).length, `${run.id}: ${kind}s`).toBeLessThanOrEqual(MOST[kind]);
    }
  });

  it('keeps everything inside the box the run is framed and shadowed by', () => {
    for (const run of [...RUNS, ...designs(8, 12)]) {
      const { track, items } = dressed(run);
      const box = boxOf(track);
      for (const d of items)
        for (const z of [d.z, d.z + d.height]) {
          const at = [d.x, d.y, z];
          for (let a = 0; a < 3; a++) {
            expect(at[a], `${run.id}: a ${d.kind}, axis ${a}`).toBeGreaterThanOrEqual(box.min[a]);
            expect(at[a], `${run.id}: a ${d.kind}, axis ${a}`).toBeLessThanOrEqual(box.max[a]);
          }
        }
    }
  });

  it('stands no chimney or tank close by a bowl, where it would come between the camera and the field', () => {
    let near = 0;
    for (const run of [...RUNS, ...designs(10, 16)]) {
      const { track, items } = dressed(run);
      for (const seg of track.segments) {
        const b = seg.funnel;
        if (!b) continue;
        for (const d of items)
          if ((d.kind === 'chimney' || d.kind === 'tank') && Math.hypot(d.x - b.x, d.y - b.y) < b.rim + 3) near++;
      }
    }
    expect(near).toBe(0);
  });

  it('never changes the track a race is run on', () => {
    for (const run of RUNS) expect(compile(run)).toEqual(compile(plain(run)));
  });
});

/** Every point where a marble can be, as a test of a point: inside a channel, between its walls and under their tops, or inside a bowl. */
function where(track: Track): (x: number, y: number, z: number) => boolean {
  // a point is inside only across a channel's width and under its wall, so only samples within this reach of it can
  // hold it: they are kept in cells of that size, and a point tries the cells round its own
  const REACH = 4;
  const cells = new Map<number, number[]>();
  const cell = (cx: number, cy: number, cz: number) => ((cx + 512) * 1024 + (cy + 512)) * 1024 + (cz + 512);
  const key = (x: number, y: number, z: number) =>
    cell(Math.floor(x / REACH), Math.floor(y / REACH), Math.floor(z / REACH));
  track.segments.forEach((seg, s) => {
    if (seg.funnel) return;
    for (let i = 0; i < seg.arc.length; i++) {
      const k = key(seg.points[i * 3], seg.points[i * 3 + 1], seg.points[i * 3 + 2]);
      let list = cells.get(k);
      if (!list) cells.set(k, (list = []));
      list.push(s, i);
    }
  });
  const bowls = track.segments.flatMap((seg) => (seg.funnel ? [seg.funnel] : []));
  // the squarest sample each segment has to the point, and how far along it the point is: reset for every point
  const bestAt = new Int32Array(track.segments.length).fill(-1);
  const bestAlong = new Float64Array(track.segments.length);
  const touched: number[] = [];
  return (x, y, z) => {
    for (const b of bowls) {
      // over the bowl's own floor and under its rim wall's top, or falling down its throat
      const r = Math.hypot(x - b.x, y - b.y);
      if (r < b.rim && z > b.z + bowlHeight(b, r) && z < b.z + b.wall) return true;
      if (r < b.hole && z > b.z - b.depth - b.throat && z <= b.z - b.depth) return true;
    }
    // each segment judges the point by the one sample it is squarest to: high over a tight bend a sample's frame
    // reaches past its neighbour's, and the first sample whose step held it would be the wrong one to measure by
    for (const s of touched) bestAt[s] = -1;
    touched.length = 0;
    const cx = Math.floor(x / REACH),
      cy = Math.floor(y / REACH),
      cz = Math.floor(z / REACH);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const list = cells.get(cell(cx + dx, cy + dy, cz + dz));
          if (!list) continue;
          for (let n = 0; n < list.length; n += 2) {
            const s = list[n],
              i = list[n + 1];
            const seg = track.segments[s];
            const o = i * 3;
            const along =
              (x - seg.points[o]) * seg.tangents[o] +
              (y - seg.points[o + 1]) * seg.tangents[o + 1] +
              (z - seg.points[o + 2]) * seg.tangents[o + 2];
            if (bestAt[s] < 0) touched.push(s);
            else if (Math.abs(along) >= Math.abs(bestAlong[s])) continue;
            bestAt[s] = i;
            bestAlong[s] = along;
          }
        }
    for (const s of touched) {
      const i = bestAt[s],
        along = bestAlong[s];
      const seg = track.segments[s];
      const o = i * 3;
      const spacing = i + 1 < seg.arc.length ? seg.arc[i + 1] - seg.arc[i] : seg.arc[i] - seg.arc[i - 1];
      if (Math.abs(along) > spacing / 2 + 1e-3) continue;
      const px = x - seg.points[o],
        py = y - seg.points[o + 1],
        pz = z - seg.points[o + 2];
      const tx = seg.tangents[o],
        ty = seg.tangents[o + 1],
        tz = seg.tangents[o + 2];
      const ux = seg.ups[o],
        uy = seg.ups[o + 1],
        uz = seg.ups[o + 2];
      const across = px * (ty * uz - tz * uy) + py * (tz * ux - tx * uz) + pz * (tx * uy - ty * ux);
      const up = px * ux + py * uy + pz * uz;
      // the channel runs straight from one sample to the next, drawn and raced, so its width is read between them
      const j = along >= 0 ? Math.min(i + 1, seg.arc.length - 1) : Math.max(i - 1, 0);
      const w = seg.width[i] + (seg.width[j] - seg.width[i]) * Math.min(1, Math.abs(along) / spacing);
      if (Math.abs(across) < w - 0.02 && up > 0.02 && up < seg.wall) return true;
    }
    return false;
  };
}

/**
 * Every point over every triangle of `group`'s mesh at every live placement, no two more than `step` apart along
 * an edge, handed to `visit` one at a time without making anything; how many there were, and how many `visit` said
 * yes to, with the first of those.
 */
function surface(group: GameGroup, visit: (x: number, y: number, z: number) => boolean, step = 0.35) {
  const { positions, indices } = group.mesh;
  const count = group.count ?? group.matrices.length / 16;
  const m = group.matrices;
  const a = [0, 0, 0],
    b = [0, 0, 0],
    c = [0, 0, 0];
  const put = (o: number, v: number, into: number[]) => {
    const x = positions[v * 3],
      y = positions[v * 3 + 1],
      z = positions[v * 3 + 2];
    into[0] = m[o] * x + m[o + 4] * y + m[o + 8] * z + m[o + 12];
    into[1] = m[o + 1] * x + m[o + 5] * y + m[o + 9] * z + m[o + 13];
    into[2] = m[o + 2] * x + m[o + 6] * y + m[o + 10] * z + m[o + 14];
  };
  let points = 0,
    hits = 0,
    first = '';
  for (let p = 0; p < count; p++) {
    const o = p * 16;
    for (let t = 0; t < indices.length; t += 3) {
      // turned so that a to b is its longest side, which it is stepped along, and c the corner across from it
      const ab = [indices[t], indices[t + 1], indices[t + 2]];
      put(o, ab[0], a);
      put(o, ab[1], b);
      put(o, ab[2], c);
      const lab = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
        lbc = Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]),
        lca = Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
      if (lbc > lab && lbc >= lca) {
        put(o, ab[1], a);
        put(o, ab[2], b);
        put(o, ab[0], c);
      } else if (lca > lab && lca > lbc) {
        put(o, ab[2], a);
        put(o, ab[0], b);
        put(o, ab[1], c);
      }
      // stepped along its side from a to b, and across it toward c by as far as c stands off that side: a long thin
      // face is a line of points, not a square of them, whichever way round its corners come
      const ux = b[0] - a[0],
        uy = b[1] - a[1],
        uz = b[2] - a[2];
      const vx = c[0] - a[0],
        vy = c[1] - a[1],
        vz = c[2] - a[2];
      const side = Math.hypot(ux, uy, uz);
      const cross = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      const nu = Math.max(
        1,
        Math.ceil(Math.max(side, Math.hypot(vx, vy, vz), Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2])) / step),
      );
      const nv = Math.max(1, Math.ceil((side > 0 ? cross / side : 0) / step));
      for (let j = 0; j <= nv; j++)
        for (let i = 0; i <= nu; i++) {
          // from a toward c by the share j of the way across, and along toward b's side by the share i of what is left
          const v = j / nv,
            u = (i / nu) * (1 - v);
          const x = a[0] + ux * u + vx * v,
            y = a[1] + uy * u + vy * v,
            z = a[2] + uz * u + vz * v;
          points++;
          if (visit(x, y, z)) {
            if (!hits) first = `${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`;
            hits++;
          }
        }
    }
  }
  return { points, hits, first };
}

/** What of `items` moves, drawn where the clock has it at `t`: the cogs where the standing dressing last put them. */
function moving(scene: Scene, items: Decoration[], t: number): GameGroup[] {
  const counts = scene.animate(items, t);
  return scene
    .dynamic()
    .slice(5)
    .map((g, k) => ({ ...g, count: counts[k] }));
}

describe('what a run is dressed with, drawn', () => {
  it('puts nothing where a marble can be, on every run, every piece of the catalog and designs laid at random', () => {
    const scene = new Scene();
    let tried = 0;
    for (const run of [...RUNS, ...PIECES.map(industrial), folded(), ...designs(9, 16)]) {
      const { track, items } = dressed(run);
      const inside = where(track);
      const still = scene.decor(track, items);
      for (const [t, groups] of [
        [0, still],
        ...[0, 1.3, 2.7].map((t) => [t, moving(scene, items, t)] as const),
      ] as const)
        for (const group of groups) {
          const { points, hits, first } = surface(group, inside);
          tried += points;
          expect(
            hits,
            `${run.id} at ${t} s: a group coloured ${group.albedo?.join(' ')} stands in the run at ${first}`,
          ).toBe(0);
        }
    }
    // a sampler that visited nothing would find nothing in the way: this many points are tried, over every run
    process.stderr.write(`${tried} points tried\n`);
    expect(tried).toBeGreaterThan(1_000_000);
  }, 120_000);

  it("keeps a lamp's arm a hand's width off every channel, its own included, and not only out of where a marble goes", () => {
    let arms = 0;
    for (const run of [...RUNS, folded(), ...designs(9, 16)]) {
      const { track, items } = dressed(run);
      for (const lamp of items.filter((d) => d.kind === 'lamp')) {
        const bulb = bulbOf(track, lamp, [0, 0, 0]);
        arms++;
        // the arm from the pole's top in over the middle, and the shade and bulb hanging under its end
        for (let a = 0; a <= 1.001; a += 0.05) {
          const x = lamp.x + (bulb[0] - lamp.x) * a,
            y = lamp.y + (bulb[1] - lamp.y) * a,
            z = lamp.z + LAMP.height - (a > 0.9 ? 0.6 : 0);
          for (const seg of track.segments) {
            if (seg.funnel) continue;
            for (let i = 0; i < seg.arc.length; i++) {
              const o = i * 3;
              const floor = seg.points[o + 2];
              if (z < floor - 0.4 || z > floor + seg.wall + 0.4) continue;
              const apart = Math.hypot(x - seg.points[o], y - seg.points[o + 1]) - seg.width[i];
              expect(
                apart,
                `${run.id}: the lamp by piece ${lamp.piece} over a channel ${(z - floor).toFixed(2)} up`,
              ).toBeGreaterThan(0.25 + 0.18);
            }
          }
        }
      }
    }
    expect(arms).toBeGreaterThan(20);
  });

  it('draws something for every kind', () => {
    const scene = new Scene();
    const { track, items } = dressed(RUNS.find((r) => r.id.startsWith('stress'))!);
    const still = scene.decor(track, items);
    const counts = scene.animate(items, 0);
    expect(still.length).toBeGreaterThan(0);
    expect(
      counts.every((n) => n > 0),
      `cogs, rods and puffs: ${counts.join(', ')}`,
    ).toBe(true);
  });

  it('moves with the clock and stands still without it', () => {
    const scene = new Scene();
    const { track, items } = dressed(RUNS.find((r) => r.id.startsWith('stress'))!);
    // the cogs turn where the standing dressing last put them
    scene.decor(track, items);
    const at = (t: number) => {
      scene.animate(items, t);
      return scene
        .dynamic()
        .slice(5)
        .map((g) => Array.from(g.matrices));
    };
    const first = at(2);
    expect(at(2)).toEqual(first);
    const later = at(2.5);
    later.forEach((m, k) => expect(m, `group ${k} moved`).not.toEqual(first[k]));
  });
});
