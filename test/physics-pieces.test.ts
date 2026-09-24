/**
 * What each kind of piece is for under physics, it is held to:
 * the lid over a drop holds a ball at the fastest the air allows, the brake
 * takes speed off, the groove sorts, the lane takes a field at speed. Each
 * kind raced alone on 24 seeds is `physics-slopes.test.ts` and
 * `physics-boards.test.ts`, two files so that they run on two workers.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { TERMINAL } from '../src/physics';
import { FINISHED, LOST, MARBLES, RACING, RADIUS } from '../src/race';
import { PEG_CONE, SPIRAL_WALL, WALL, compile } from '../src/track';
import { chain, fieldOn, mixed, offFloor, raced, through } from './physics-helpers';

await RAPIER.init();

const DT = 1 / 60;

describe('the pieces under physics', () => {
  it('takes a field straight off three drops into the lane at the end, every one home and at rest in it', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { race } = fieldOn(chain(['start', 'drop', 'drop', 'drop', 'finish']), seed);
      raced(race);
      expect(race.finishers, `seed ${seed}`).toBe(MARBLES);
      // balls that do not grip each other lose what they have left only to their knocks, and rolling costs nothing,
      // so a queue in the cup takes seven to nine seconds to come to rest where it once took under five
      for (let f = 0; f < 60 * 12; f++) race.step(DT);
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
    const track = compile(chain(['start', 'drop', 'spiralLeft', 'straight', 'finish']));
    expect(track.segments[2].wall).toBe(SPIRAL_WALL);
    expect(SPIRAL_WALL).toBeGreaterThan(WALL);
    for (const s of [0, 1, 3, 4]) expect(track.segments[s].wall).toBe(WALL);
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
    const track = compile(chain(['start', 'pegs', 'finish']));
    const pegs = track.segments[1];
    expect(pegs.obstacles.length).toBeGreaterThan(0);
    for (const ob of pegs.obstacles) expect(ob.radius).toBe(PEG_CONE);
  });

  it('the pegs mix a field, where a plain fall of the same size hands it on unchanged', () => {
    const board = mixed(['start', 'pegs', 'finish'], 1, 2, 24);
    const plain = mixed(['start', 'shallow', 'finish'], 1, 2, 24);
    expect(board.home).toBe(board.of);
    // even a plain fall is not 1: the gate's own zigzag, and balls that do not grip each other, shuffle a field
    // on their own, 0.78 over 24 seeds; what pegs do on top of that is the point here, 0.43
    expect(
      board.kept,
      `pegs keep ${(board.kept * 100).toFixed(0)}% of the order, a plain fall ${(plain.kept * 100).toFixed(0)}%`,
    ).toBeLessThan(plain.kept - 0.08);
  });

  it('the bumps mix a fast field, where the shallow shape they are built on hands it on unchanged', () => {
    // a comparison and not a bar: how well each piece mixes a field is for tuning later, and what is held here is
    // that the mounds do something at all. A plain fall of the same size kept 0.94 of a fast field's order over
    // 24 seeds, balls that barely grip each other shuffling a little on their own, and the bumps 0.80
    const fed = mixed(['start', 'drop', 'drop', 'bumps', 'finish'], 3, 4, 24);
    const plain = mixed(['start', 'drop', 'drop', 'shallow', 'finish'], 3, 4, 24);
    expect(fed.home).toBe(fed.of);
    expect(plain.kept, `a plain fall keeps ${(plain.kept * 100).toFixed(0)}%`).toBeGreaterThan(0.9);
    expect(
      fed.kept,
      `bumps keep ${(fed.kept * 100).toFixed(0)}% of a fast field's order, a plain fall ${(plain.kept * 100).toFixed(0)}%`,
    ).toBeLessThan(plain.kept - 0.1);
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
