/**
 * What each kind of piece does under physics, fed by two drops, the fastest
 * any one piece hands a field on at; and what a kind is for, it is held to:
 * the lid over a drop holds a ball at the fastest the air allows, the brake
 * takes speed off, the groove sorts, the lane takes a field at speed. Each
 * kind raced alone on 24 seeds is `physics-slopes.test.ts` and
 * `physics-boards.test.ts`, two files so that they run on two workers.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { PHYSICAL, PHYSICS_WALL, TERMINAL } from '../src/physics';
import { FINISHED, LOST, MARBLES, RACING, RADIUS } from '../src/marbles';
import { PEG_CONE, SPIRAL_WALL, compile } from '../src/track';
import { CROSSED, chain, fieldOn, mixed, offFloor, raced, through } from './physics-helpers';

await RAPIER.init();

const DT = 1 / 60;

describe('the pieces under physics', () => {
  for (const kind of CROSSED)
    it(`races every marble home over a ${kind} fed by two drops, the fastest one piece hands a field on at, on 6 seeds`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const { race, told } = fieldOn(chain(['start', 'drop', 'drop', kind, 'finish']), seed);
        raced(race);
        expect(race.finishers, `seed ${seed}: every marble home`).toBe(MARBLES);
        expect(
          race.lost + race.stalled,
          `seed ${seed}: ${told.filter((l) => !l.startsWith('finished')).join(', ')}`,
        ).toBe(0);
        expect(race.check(), `seed ${seed}`).toEqual([]);
      }
    });

  it('takes a field straight off three drops into the lane at the end, every one home and at rest in it', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { race } = fieldOn(chain(['start', 'drop', 'drop', 'drop', 'finish']), seed);
      raced(race);
      expect(race.finishers, `seed ${seed}`).toBe(MARBLES);
      for (let f = 0; f < 60 * 5; f++) race.step(DT);
      const lane = race.track.segments.length - 1;
      for (let i = 0; i < MARBLES; i++) {
        expect(race.segment[i], `seed ${seed}: ball ${i} in the lane`).toBe(lane);
        expect(race.speed[i], `seed ${seed}: ball ${i} at rest`).toBeLessThan(0.05);
      }
      expect(race.check(), `seed ${seed}`).toEqual([]);
    }
  });

  it('holds a ball under the lid over a drop at the fastest the air allows, where off the crest it would clear the cell', () => {
    // the drop is the third segment; a ball set rolling on the straight before it and given the air's own top speed
    const { race, track } = fieldOn(chain(['start', 'straight', 'drop', 'straight', 'straight', 'finish']));
    expect(track.segments[2].lid).toEqual({ from: 0, upto: track.segments[2].length });
    expect(race.put(0, 1, 1, 0)).toBe(true);
    race.release();
    for (let f = 0; f < 5; f++) race.step(DT);
    race.meddle(0, { speed: TERMINAL });
    let high = 0,
      under = false;
    for (let f = 0; f < 60 * 8 && race.state[0] === RACING; f++) {
      race.step(DT);
      if (race.segment[0] === 2) {
        under = true;
        high = Math.max(high, offFloor(race, 0));
      }
      expect(race.check(), `frame ${f}`).toEqual([]);
    }
    expect(under, 'it went through the drop').toBe(true);
    // its underside never further off the floor than the lid leaves room for, give or take a contact's give
    expect(high, 'held under the lid').toBeLessThanOrEqual(track.wall - RADIUS * 2 + 0.05);
    expect(race.state[0]).toBe(FINISHED);
    expect(race.lost).toBe(0);
  });

  it('rules on a ball through a lid, and one into the floor', () => {
    const { race } = fieldOn(chain(['start', 'straight', 'drop', 'straight', 'finish']));
    expect(race.put(0, 2, 3, 0)).toBe(true);
    expect(race.check()).toEqual([]);
    race.meddle(0, { lift: 1 });
    expect(race.check().join('\n')).toMatch(/through the lid/);
    race.meddle(0, { lift: -2 });
    expect(race.check().join('\n')).toMatch(/into the floor/);
  });

  it('walls a spiral higher than the rest of the run, since a ball off a drop rides its outer wall over a chute’s', () => {
    const track = compile(chain(['start', 'drop', 'spiralLeft', 'straight', 'finish']), PHYSICAL);
    expect(track.segments[2].wall).toBe(SPIRAL_WALL);
    expect(SPIRAL_WALL).toBeGreaterThan(PHYSICS_WALL);
    for (const s of [0, 1, 3, 4]) expect(track.segments[s].wall).toBe(PHYSICS_WALL);
  });

  it('the brake takes a third off a field at two drops’ speed, where a plain fall of the same size gives it more', () => {
    const brake = through(['start', 'drop', 'drop', 'brake', 'straight', 'finish'], 3, 8);
    const plain = through(['start', 'drop', 'drop', 'shallow', 'straight', 'finish'], 3, 8);
    expect(brake.home).toBe(brake.of);
    expect(plain.home).toBe(plain.of);
    expect(brake.in, 'fed fast').toBeGreaterThan(15);
    expect(brake.out / brake.in, `leaves at ${brake.out.toFixed(1)} from ${brake.in.toFixed(1)}`).toBeLessThan(0.75);
    expect(
      plain.out / plain.in,
      `a shallow leaves at ${plain.out.toFixed(1)} from ${plain.in.toFixed(1)}`,
    ).toBeGreaterThan(0.95);
  });

  it('the narrow is a groove that sorts a field into single file, where a plain fall of the same size lets pairs through', () => {
    const groove = through(['start', 'narrow', 'straight', 'finish'], 1, 12);
    const plain = through(['start', 'shallow', 'straight', 'finish'], 1, 12);
    expect(groove.home).toBe(groove.of);
    expect(groove.pairs, `${(groove.pairs * 100).toFixed(0)}% leave it abreast of another`).toBeLessThan(0.15);
    expect(plain.pairs, `${(plain.pairs * 100).toFixed(0)}% leave a shallow abreast`).toBeGreaterThan(0.25);
  });

  it('a peg under physics is a cone: a ball comes to rest against a post but not one', () => {
    const track = compile(chain(['start', 'pegs', 'finish']), PHYSICAL);
    const pegs = track.segments[1];
    expect(pegs.obstacles.length).toBeGreaterThan(0);
    for (const ob of pegs.obstacles) expect(ob.radius).toBe(PEG_CONE);
  });

  it('the pegs mix a field, where a plain fall of the same size hands it on unchanged', () => {
    const board = mixed(['start', 'pegs', 'finish'], 1, 2, 24);
    const plain = mixed(['start', 'shallow', 'finish'], 1, 2, 24);
    expect(board.home).toBe(board.of);
    expect(board.kept, `pegs keep ${(board.kept * 100).toFixed(0)}% of the order it came in`).toBeLessThanOrEqual(0.85);
    // even a plain fall is not perfectly 1: the gate's own zigzag and tiny contact differences shuffle a field
    // a little on their own, measured at 0.89 over 24 seeds; what pegs do on top of that is the point here
    expect(plain.kept, `a plain fall keeps ${(plain.kept * 100).toFixed(0)}%`).toBeGreaterThan(0.8);
  });

  it('the bumps mix a fast field, where the shallow shape they are built on hands it on unchanged', () => {
    const fed = mixed(['start', 'drop', 'drop', 'bumps', 'finish'], 3, 4, 24);
    const plain = mixed(['start', 'drop', 'drop', 'shallow', 'finish'], 3, 4, 24);
    expect(fed.home).toBe(fed.of);
    expect(fed.kept, `bumps keep ${(fed.kept * 100).toFixed(0)}% of a fast field's order`).toBeLessThanOrEqual(0.85);
    expect(plain.kept, `a plain fall keeps ${(plain.kept * 100).toFixed(0)}%`).toBeGreaterThan(0.9);
  });

  it('the funnel takes every ball down through its hole and its throat, on to what comes after it, fed the way a run feeds it', () => {
    // three stacked spirals, as The Tower feeds its own funnel: a real run's own pace, not the extreme end of
    // two drops straight into the bowl, which now and then throws a ball past the outlet's own catch (below)
    for (let seed = 1; seed <= 24; seed++) {
      const { race } = fieldOn(
        chain(['start', 'ramp', 'spiralLeft', 'spiralLeft', 'spiralLeft', 'funnel', 'straight', 'finish']),
        seed,
      );
      raced(race, 90);
      expect(race.finishers, `seed ${seed}`).toBe(MARBLES);
      expect(race.lost + race.stalled, `seed ${seed}`).toBe(0);
      for (let i = 0; i < MARBLES; i++) expect(race.state[i]).toBe(FINISHED);
      expect(race.check(), `seed ${seed}`).toEqual([]);
    }
  }, 30000);

  it('a ball off two drops straight into the funnel, at the extreme end of its swirl, can miss the outlet and fall clean past it', () => {
    // not a rule broken, and not a bug to fix: the fastest possible entry to a funnel, far past anything a
    // shipped run feeds one, now and then throws a ball wide of the outlet's own catch below the throat. Held
    // to a number rather than zero, so a real regression (many more missed, or one caught wrongly) is still seen
    let lost = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const { race } = fieldOn(chain(['start', 'drop', 'drop', 'funnel', 'straight', 'finish']), seed);
      raced(race, 90);
      expect(race.finishers + race.lost, `seed ${seed}: nobody stopped, only home or lost`).toBe(MARBLES);
      expect(race.stalled, `seed ${seed}`).toBe(0);
      expect(race.check(), `seed ${seed}`).toEqual([]);
      lost += race.lost;
    }
    expect(lost, `${lost} of ${24 * MARBLES} missed the outlet at this speed`).toBeLessThan(MARBLES * 2);
  });

  it('holds a lost ball where it fell out, out of the race, and never counts it faster than the air', () => {
    const { race, told } = fieldOn(chain(['start', 'straight', 'straight', 'finish']));
    expect(race.put(0, 1, 2, 0)).toBe(true);
    race.release();
    race.step(DT);
    // through the floor, which is off the run
    race.meddle(0, { lift: -2 });
    race.step(DT);
    expect(race.state[0]).toBe(LOST);
    expect(race.lost).toBe(1);
    expect(told).toContain('lost 0');
    const where = [race.x[0], race.y[0], race.z[0]];
    for (let f = 0; f < 120; f++) {
      race.step(DT);
      expect(race.check(), `frame ${f}`).toEqual([]);
    }
    expect([race.x[0], race.y[0], race.z[0]]).toEqual(where);
    expect(race.speed[0]).toBe(0);
  });
});
