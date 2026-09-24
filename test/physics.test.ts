/**
 * The race as physics: Rapier behind the same `Race` the solver stands
 * behind, with nothing acting on a marble after the gate opens but gravity,
 * the air and what it touches. This is the engine itself: the track it is
 * handed, the finish, the rules, the seed, and the game choosing it. What
 * each kind of piece does under it is `physics-pieces.test.ts`.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { Physics, TERMINAL } from '../src/physics';
import { FINISHED, GRAVITY, MARBLES, RADIUS } from '../src/race';
import { LEAN, WALL, compile } from '../src/track';
import { RUNS } from '../src/runs';
import { newGame } from './helpers';
import { chain, fieldOn, raced } from './physics-helpers';

await RAPIER.init();

const DT = 1 / 60;

describe('the race as physics', () => {
  it('has the track it races on leaning down the run, and walled as high as a real ball needs', () => {
    const track = compile(chain(['start', 'straight', 'finish']));
    expect(track.wall).toBe(WALL);
    expect(track.lean).toBe(LEAN);
    // a straight falls by a twentieth of its own length from one end to the other, and its tangents lean with it
    const seg = track.segments[1];
    const last = seg.arc.length - 1;
    expect(seg.points[last * 3 + 2] - seg.points[2]).toBeCloseTo(-LEAN * seg.arc[last], 4);
    expect(seg.tangents[2], 'a level straight points a little down').toBeLessThan(-0.04);
    expect(Math.hypot(seg.tangents[0], seg.tangents[1], seg.tangents[2])).toBeCloseTo(1, 5);
  });

  it('places the field in the order it came home, each with the time it took', () => {
    const { race, told } = fieldOn(chain(['start', 'ramp', 'straight', 'finish']));
    raced(race);
    const places = [...race.place].sort((a, b) => a - b);
    expect(places).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (let i = 0; i < MARBLES; i++) expect(race.state[i]).toBe(FINISHED);
    const finished = told.filter((l) => l.startsWith('finished'));
    expect(finished.length).toBe(MARBLES);
    // told in the order they came, and the first told is the one placed first
    expect(finished[0]).toMatch(new RegExp(`^finished ${race.place.indexOf(1)} 1 `));
    // and gathered in the lane at its stop, every one at rest, none inside another: not always in single file, since
    // a pair arriving abreast can sit on the trough's sides together, and a neck that would sort them arches
    // a queue in the cup takes seven to nine seconds to come to rest, balls that do not grip each other shedding
    // what they have left only to their knocks
    for (let f = 0; f < 60 * 12; f++) race.step(DT);
    for (let i = 0; i < MARBLES; i++) {
      expect(race.segment[i], `ball ${i} in the lane`).toBe(race.track.segments.length - 1);
      expect(race.speed[i], `ball ${i} at rest`).toBeLessThan(0.05);
    }
    expect(race.check()).toEqual([]);
  });

  it('places two over the line in one step by which crossed first', () => {
    // two set still a unit short of the line, side by side, one a hair ahead — the higher numbered, so that taking
    // them in order would place it wrong — and let go, to roll over it together. Whether a step's boundary falls
    // between the two crossings depends on the hair, so hairs are tried until one has them cross in the same step
    let crossedTogether = false;
    for (const hair of [0.005, 0.01, 0.015, 0.02, 0.003]) {
      const { race, track } = fieldOn(chain(['start', 'straight', 'finish']));
      const line = track.segments[1].length;
      expect(race.put(5, 1, line - 1, -0.5)).toBe(true);
      expect(race.put(3, 1, line - 1 - hair, 0.5)).toBe(true);
      race.release();
      for (let f = 0; f < 300 && !(race.place[3] && race.place[5]); f++) race.step(DT);
      if (race.took[3] !== race.took[5]) continue;
      crossedTogether = true;
      expect(race.place[5], 'the one that was ahead').toBe(1);
      expect(race.place[3]).toBe(2);
      break;
    }
    expect(crossedTogether, 'some hair had them over the line in the same step, or this proves nothing').toBe(true);
  });

  it('gives the same race twice from the same seed, to the bit', () => {
    const a = fieldOn(chain(['start', 'ramp', 'curveLeft', 'straight', 'finish']), 5).race;
    const b = fieldOn(chain(['start', 'ramp', 'curveLeft', 'straight', 'finish']), 5).race;
    a.release();
    b.release();
    for (let f = 0; f < 400; f++) {
      a.step(DT);
      b.step(DT);
    }
    expect([...a.x, ...a.y, ...a.z]).toEqual([...b.x, ...b.y, ...b.z]);
    expect([...a.place]).toEqual([...b.place]);
  });

  it('rolls: down two ramps a marble is as fast as the height it lost allows, and no faster', () => {
    const { race } = fieldOn(chain(['start', 'ramp', 'ramp', 'straight', 'straight', 'finish']));
    race.release();
    let fastest = 0;
    for (let f = 0; f < 600 && !race.over; f++) {
      race.step(DT);
      for (let i = 0; i < MARBLES; i++) fastest = Math.max(fastest, race.speed[i]);
    }
    // the gate is a level down, then two ramps: three levels; a solid ball rolling keeps two sevenths of what it
    // falls as spin, and has five sevenths to go with
    const allowed = Math.sqrt(2 * GRAVITY * 12 * (5 / 7));
    expect(fastest).toBeLessThanOrEqual(allowed);
    // the air takes some, and the floor and walls a little: it came to four fifths, and is held to three quarters
    expect(fastest, 'the air takes a little, and the walls, but not much').toBeGreaterThan(allowed * 0.75);
  });

  it('rules on a marble faster than the air allows, and two inside each other', () => {
    const { race } = fieldOn(chain(['start', 'straight', 'finish']));
    race.release();
    for (let f = 0; f < 30; f++) race.step(DT);
    expect(race.check()).toEqual([]);
    race.meddle(0, { speed: TERMINAL * 2 });
    expect(race.check().join('\n')).toMatch(/faster than/);
    race.meddle(0, { speed: 0 });
    race.meddle(1, { at: 0 });
    expect(race.check().join('\n')).toMatch(/inside each other/);
  });

  it('lets nothing put a marble anywhere once they are away', () => {
    const { race } = fieldOn(chain(['start', 'straight', 'finish']));
    expect(race.put(0, 1, 2, 0)).toBe(true);
    race.release();
    expect(race.put(0, 1, 2, 0)).toBe(false);
  });

  it('turns everything it stands on the track by a true rotation, and never a mirror', () => {
    // a frame built as along, along-by-up and up is a mirror, whose quaternion is not of unit length, and Rapier met
    // the end of the lane and the back of a funnel's way out as blocks that were not the ones placed
    for (const run of RUNS) {
      const { race } = fieldOn(run);
      let colliders = 0;
      (race as unknown as { world: RAPIER.World }).world.forEachCollider((c) => {
        const q = c.rotation();
        expect(Math.hypot(q.x, q.y, q.z, q.w), `${run.name}, collider ${colliders}`).toBeCloseTo(1, 5);
        colliders++;
      });
      expect(colliders).toBeGreaterThan(10);
      race.dispose();
    }
  });

  it('is what the game races every run on, a branch and all, compiled the way physics wants it', () => {
    const { game } = newGame(1);
    game.browse('pieces');
    for (const id of ['piece-pegs', 'piece-splitter']) {
      game.pick(game.list.findIndex((r) => r.id === id));
      expect(game.marbles, id).toBeInstanceOf(Physics);
      expect(game.track.wall, id).toBe(WALL);
      game.release();
      for (let f = 0; f < 60 * 30 && !game.over; f++) game.step(DT);
      expect(game.marbles.finishers, id).toBe(MARBLES);
    }
  });

  it('lets go of a world when another run is put on, and never has more than one', () => {
    // the tests above leave their own worlds behind, which is theirs to do; what counts is what the game adds
    const before = Physics.alive;
    const { game } = newGame(1);
    const pieces = ['piece-ramp', 'piece-pegs', 'piece-bumps', 'piece-funnel', 'piece-curve-left'];
    let most = 0;
    for (const id of pieces) {
      game.browse('pieces');
      game.pick(game.list.findIndex((r) => r.id === id));
      most = Math.max(most, Physics.alive - before);
    }
    expect(most, 'one world, for the run that is on').toBeLessThanOrEqual(1);
  });

  it('reads a ball rolled over a join as on the piece it has gone on to, not clamped to the end of the one it left', () => {
    // one ball, rolled from just short of the end of a straight on to the lane: past the straight's last sample and
    // nearer to it than to the lane's second, it was read as still on the straight, at its very end, and measured
    // against the straight's floor carried on past the join, which the lane's cup falls away below
    const track = compile(chain(['start', 'straight', 'finish']));
    const race = new Physics(RAPIER, track, {}, { count: 1 });
    const seg = track.segments[1];
    const k = (seg.arc.length - 1) * 3;
    expect(race.put(0, 1, seg.length - 1, 0)).toBe(true);
    race.release();
    let past = 0,
      misread = 0;
    for (let f = 0; f < 60 * 3; f++) {
      race.step(DT);
      const beyond =
        (race.x[0] - seg.points[k]) * seg.tangents[k] +
        (race.y[0] - seg.points[k + 1]) * seg.tangents[k + 1] +
        (race.z[0] - seg.points[k + 2]) * seg.tangents[k + 2];
      if (beyond > 0.02) {
        past++;
        if (race.segment[0] === 1) misread++;
      }
    }
    expect(past, 'it went over the join').toBeGreaterThan(0);
    expect(misread, 'frames it was past the join and still read on the straight').toBe(0);
    race.dispose();
  });

  it('keeps a marble a marble: half a unit across, as the solver has it', () => {
    expect(RADIUS).toBe(0.45);
  });
});
