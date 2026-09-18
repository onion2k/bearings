/**
 * Every run that comes with the game, held to what a run has to be: sound,
 * named once, a race and not a procession, with nothing in its way that the
 * field goes by unchanged, and raced to the end without a marble lost,
 * stopped, or going so fast that it could step clean through another in one
 * frame.
 */
import { describe, expect, it } from 'vitest';
import { FINISHED, Marbles, RADIUS, checkMarbles } from '../src/marbles';
import { seeded } from '../src/random';
import { RUNS } from '../src/runs';
import { type Run, check, checkTrack, compile } from '../src/track';

const DT = 1 / 60;
/** How fast a marble may go and still not cover its own width in a frame, which is when one could pass through another. */
const SPEED_LIMIT = (RADIUS * 2) / DT;
const SEEDS = 24;
/** How many races a run's randomness is judged over: enough that one odd race moves a figure by little. */
const JUDGED = 60;

/** Kendall's tau between two orders of the same marbles: 1 the same order, 0 no relation, -1 the other way round. */
function tau(a: number[], b: number[]): number {
  let same = 0,
    other = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) {
      const s = Math.sign(a[i] - a[j]) * Math.sign(b[i] - b[j]);
      if (s > 0) same++;
      else if (s < 0) other++;
    }
  return (same - other) / (same + other);
}

/**
 * A run raced `JUDGED` times: how far the finishing order followed the grid, summed over the races; how often
 * the back half of the grid won; and for each piece with something in the way, how far the order the marbles
 * left it followed the order they came on to it, on average. Raced once for every test that asks.
 */
interface Judged {
  follows: number;
  fromTheBack: number;
  kept: Map<number, number>;
}
const judged = new Map<string, Judged>();
function judge(run: Run): Judged {
  const done = judged.get(run.id);
  if (done) return done;
  const track = compile(run);
  const inTheWay = track.segments.flatMap((s, i) => (s.obstacles.length > 0 || s.funnel ? [i] : []));
  const kept = new Map(inTheWay.map((s) => [s, 0]));
  let follows = 0,
    fromTheBack = 0;
  for (let seed = 1; seed <= JUDGED; seed++) {
    const marbles = new Marbles(track, {}, { random: seeded(seed) });
    // when each marble came on to each piece, and when it left it for one further on
    const on = track.segments.map(() => new Float64Array(marbles.count).fill(-1));
    const off = track.segments.map(() => new Float64Array(marbles.count).fill(-1));
    const last = new Int32Array(marbles.count);
    marbles.release();
    for (let f = 0; f < 120 * 60 && !marbles.over; f++) {
      marbles.step(DT);
      for (let i = 0; i < marbles.count; i++) {
        const s = marbles.segment[i];
        if (on[s][i] < 0) on[s][i] = marbles.t;
        for (; last[i] < s; last[i]++) off[last[i]][i] = marbles.t;
      }
    }
    const all = [...Array(marbles.count).keys()];
    follows += tau(
      all.map((i) => marbles.grid[i]),
      all.map((i) => marbles.place[i]),
    );
    const winner = all.find((i) => marbles.place[i] === 1)!;
    if (marbles.grid[winner] >= marbles.count / 2) fromTheBack++;
    for (const s of inTheWay) {
      const through = all.filter((i) => on[s][i] >= 0 && off[s][i] >= 0);
      kept.set(
        s,
        kept.get(s)! +
          tau(
            through.map((i) => on[s][i]),
            through.map((i) => off[s][i]),
          ) /
            JUDGED,
      );
    }
  }
  const out = { follows, fromTheBack, kept };
  judged.set(run.id, out);
  return out;
}

describe('the runs that come with the game', () => {
  it('are several, each with a name and an id of its own', () => {
    expect(RUNS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(RUNS.map((r) => r.id)).size, 'ids are not shared').toBe(RUNS.length);
    expect(new Set(RUNS.map((r) => r.name)).size, 'names are not shared').toBe(RUNS.length);
    for (const run of RUNS)
      expect(run.id, `${run.name}'s id is plain lower-case words and numbers`).toMatch(/^[a-z]+(-[a-z0-9]+)*$/);
  });

  for (const run of RUNS) {
    describe(run.name, () => {
      it('is sound, and works out to a sound track', () => {
        expect(check(run)).toEqual([]);
        expect(checkTrack(compile(run))).toEqual([]);
      });

      it('works out the same way twice, to the last bit', () => {
        const one = compile(run),
          two = compile(run);
        for (let i = 0; i < one.segments.length; i++) {
          expect([...one.segments[i].points]).toEqual([...two.segments[i].points]);
          expect([...one.segments[i].tangents]).toEqual([...two.segments[i].tangents]);
          expect(one.segments[i].gap).toBe(two.segments[i].gap);
        }
      });

      it(`is a race and not a procession: the grid tells little of who wins, over ${JUDGED} races`, () => {
        const { follows, fromTheBack } = judge(run);
        // on the chutes alone the finishing order followed the grid by 0.70 to 0.88, and no marble ever won from
        // the back half; held to within 0.4 of no relation at all either way, and the back half winning at least
        // one race in five and at most four
        expect(Math.abs(follows / JUDGED), 'how far the finishing order follows the grid').toBeLessThanOrEqual(0.4);
        expect(fromTheBack / JUDGED, 'how often the back half of the grid wins').toBeGreaterThanOrEqual(0.2);
        expect(fromTheBack / JUDGED).toBeLessThanOrEqual(0.8);
      });

      it(`has nothing in its way that the field goes by unchanged, over ${JUDGED} races`, () => {
        // a plain chute, curve or spiral hands the field on in the order it came, 0.91 to 1.00; every piece with
        // something in the way is there to change that, and one the field can go by keeps it too. Switchback's
        // wheel, over the half of its pen the field never came down after the bend before it, kept it at 1.00
        const track = compile(run);
        for (const [s, kept] of judge(run).kept)
          expect(
            kept,
            `the ${run.pieces[track.segments[s].piece].kind}, piece ${track.segments[s].piece}`,
          ).toBeLessThanOrEqual(0.85);
      });

      it(`is raced to the end on ${SEEDS} seeds with every marble home and no rule broken`, () => {
        const track = compile(run);
        let fastest = 0;
        for (let seed = 1; seed <= SEEDS; seed++) {
          const marbles = new Marbles(track, {}, { random: seeded(seed) });
          marbles.release();
          for (let f = 0; f < 120 * 60 && !marbles.over; f++) {
            marbles.step(DT);
            for (let i = 0; i < marbles.count; i++)
              fastest = Math.max(
                fastest,
                Math.abs(marbles.speed[i]),
                Math.hypot(marbles.vx[i], marbles.vy[i], marbles.vz[i]),
              );
            if (f % 10 === 0) expect(checkMarbles(marbles), `seed ${seed} frame ${f}`).toEqual([]);
          }
          expect(marbles.over, `seed ${seed} finished`).toBe(true);
          expect(marbles.lost, `seed ${seed} lost none`).toBe(0);
          expect(marbles.stalled, `seed ${seed} stopped none`).toBe(0);
          for (let i = 0; i < marbles.count; i++) expect(marbles.state[i]).toBe(FINISHED);
        }
        expect(fastest, 'never fast enough to step through another marble').toBeLessThan(SPEED_LIMIT);
      });
    });
  }
});
