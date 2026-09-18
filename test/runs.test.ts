/**
 * Every run that comes with the game, held to what a run has to be: sound,
 * named once, and raced to the end without a marble lost, stopped, or going
 * so fast that it could step clean through another in one frame.
 */
import { describe, expect, it } from 'vitest';
import { FINISHED, Marbles, RADIUS, checkMarbles } from '../src/marbles';
import { seeded } from '../src/random';
import { RUNS } from '../src/runs';
import { check, checkTrack, compile } from '../src/track';

const DT = 1 / 60;
/** How fast a marble may go and still not cover its own width in a frame, which is when one could pass through another. */
const SPEED_LIMIT = (RADIUS * 2) / DT;
const SEEDS = 24;

describe('the runs that come with the game', () => {
  it('are several, each with a name and an id of its own', () => {
    expect(RUNS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(RUNS.map((r) => r.id)).size, 'ids are not shared').toBe(RUNS.length);
    expect(new Set(RUNS.map((r) => r.name)).size, 'names are not shared').toBe(RUNS.length);
    for (const run of RUNS)
      expect(run.id, `${run.name}'s id is a plain lower-case word or words`).toMatch(/^[a-z]+(-[a-z]+)*$/);
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
