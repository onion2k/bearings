/**
 * Every run that comes with the game, judged under physics over 60 races:
 * every marble home in every one, none lost, none stopped and no rule broken
 * through any; a race and not a procession, the grid telling little of who
 * wins; and nothing in its way that the field goes by unchanged. Each run has
 * a file of its own, `physics-judged-N.test.ts`, so that the runs race on
 * several workers at once, and they are raced in the full check rather than
 * the hook: the Stress Test alone takes four minutes.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { Physics } from '../src/physics';
import { FINISHED } from '../src/race';
import { seeded } from '../src/random';
import { RUNS } from '../src/runs';
import { compile } from '../src/track';
import { breathe, tau } from './physics-helpers';

const DT = 1 / 60;
/** How many races a run is judged over: enough that one odd race moves a figure by little. */
export const JUDGED = 60;
/** How long a race may take before it is read as never finishing. The Stress Test's hundred pieces take about 150 s. */
const RACE_FRAMES = 240 * 60;

export function judgesRun(k: number): void {
  const run = RUNS[k];
  describe(`${run.name}, judged under physics over ${JUDGED} races`, () => {
    const track = compile(run);
    // the pieces with something in the way, mounds included, and for each how far the order the field left it in followed the
    // order it came on to it in, on average; how far the finishing order followed the grid, summed; how often the
    // back half of the grid won; and what went wrong in any race
    const inTheWay = track.segments.flatMap((s, i) =>
      s.obstacles.length > 0 || s.funnel || s.mounds.length > 0 ? [i] : [],
    );
    const kept = new Map(inTheWay.map((s) => [s, 0]));
    let follows = 0,
      fromTheBack = 0;
    const wrong: string[] = [];

    beforeAll(async () => {
      await RAPIER.init();
      for (let seed = 1; seed <= JUDGED; seed++) {
        await breathe();
        const race = new Physics(RAPIER, track, {}, { random: seeded(seed) });
        // when each marble came on to each piece, and when it left it for one further on
        const on = track.segments.map(() => new Float64Array(race.count).fill(-1));
        const off = track.segments.map(() => new Float64Array(race.count).fill(-1));
        const last = new Int32Array(race.count);
        race.release();
        for (let f = 0; f < RACE_FRAMES && !race.over; f++) {
          race.step(DT);
          if (f % 10 === 0) for (const p of race.check()) wrong.push(`seed ${seed} frame ${f}: ${p}`);
          for (let i = 0; i < race.count; i++) {
            const s = race.segment[i];
            if (on[s][i] < 0) on[s][i] = race.t;
            for (; last[i] < s; last[i]++) off[last[i]][i] = race.t;
          }
        }
        if (!race.over) wrong.push(`seed ${seed}: not over in ${RACE_FRAMES / 60} s`);
        if (race.lost) wrong.push(`seed ${seed}: ${race.lost} lost`);
        if (race.stalled) wrong.push(`seed ${seed}: ${race.stalled} stopped`);
        const all = [...Array(race.count).keys()];
        if (all.some((i) => race.state[i] !== FINISHED)) wrong.push(`seed ${seed}: not every marble home`);
        follows += tau(
          all.map((i) => race.grid[i]),
          all.map((i) => race.place[i]),
        );
        const winner = all.find((i) => race.place[i] === 1);
        if (winner !== undefined && race.grid[winner] >= race.count / 2) fromTheBack++;
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
        race.dispose();
      }
    }, 600000);

    it('brings every marble home in every race, none lost, none stopped, and no rule broken', () => {
      expect(wrong.slice(0, 10)).toEqual([]);
    });

    it('is a race and not a procession: the grid tells little of who wins', () => {
      // held to within 0.4 of no relation at all either way, and the back half of the grid winning at least one
      // race in five and at most four
      expect(Math.abs(follows / JUDGED), 'how far the finishing order follows the grid').toBeLessThanOrEqual(0.4);
      expect(fromTheBack / JUDGED, 'how often the back half of the grid wins').toBeGreaterThanOrEqual(0.2);
      expect(fromTheBack / JUDGED).toBeLessThanOrEqual(0.8);
    });

    it('has nothing in its way that the field goes by unchanged', () => {
      // a plain chute, curve or spiral hands a field on in the order it came; every piece with something in the
      // way is there to change that, and one the field can go by keeps it
      for (const [s, order] of kept)
        expect(
          order,
          `the ${run.pieces[track.segments[s].piece].kind}, piece ${track.segments[s].piece}`,
        ).toBeLessThanOrEqual(0.85);
    });
  });
}
