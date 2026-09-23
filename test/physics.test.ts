/**
 * The race as physics: Rapier behind the same `Race` the solver stands
 * behind, with nothing acting on a marble after the gate opens but gravity,
 * the air and what it touches. Each kind of piece crosses over once it
 * races alone under physics as well as it does under the solver, on the
 * runs test's own measures; these are the first four.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { PHYSICAL, Physics, PHYSICS_WALL, TERMINAL } from '../src/physics';
import { FINISHED, GRAVITY, LEAN, MARBLES, RADIUS, ROLLING } from '../src/marbles';
import { seeded } from '../src/random';
import { type Facing, type Kind, type Placed, type Run, compile, exitOf } from '../src/track';
import { newGame } from './helpers';

await RAPIER.init();

const DT = 1 / 60;
const CROSSED: Kind[] = ['straight', 'curveLeft', 'curveRight', 'ramp'];

function chain(kinds: Kind[]): Run {
  const pieces: Placed[] = [];
  let here = { x: 0, y: 0, z: 0, facing: 0 as Facing };
  for (const kind of kinds) {
    pieces.push({ kind, ...here });
    const out = exitOf({ kind, ...here });
    if (out) here = out;
  }
  return { id: 'made-up', name: 'made up', pieces };
}

/** A field on a run of the test's own, under physics, with a note of what happens. */
function fieldOn(run: Run, seed = 1) {
  const told: string[] = [];
  const track = compile(run, PHYSICAL);
  const race = new Physics(
    RAPIER,
    track,
    {
      released: (n) => told.push(`released ${n}`),
      finished: (m, place, s) => told.push(`finished ${m} ${place} ${s.toFixed(2)}`),
      stalled: (m) => told.push(`stalled ${m}`),
      lost: (m) => told.push(`lost ${m}`),
    },
    { random: seeded(seed) },
  );
  return { race, track, told };
}

function raced(race: Physics, cap = 60) {
  race.release();
  let f = 0;
  for (; f < cap * 60 && !race.over; f++) race.step(DT);
  return f;
}

describe('the race as physics', () => {
  it('has the track it races on leaning as the solver leans, and walls as high as physics needs', () => {
    const plain = compile(chain(['start', 'straight', 'finish']));
    const track = compile(chain(['start', 'straight', 'finish']), PHYSICAL);
    expect(track.wall).toBe(PHYSICS_WALL);
    expect(plain.wall).toBeLessThan(PHYSICS_WALL);
    // every sample is lower by a twentieth of how far along the run it is, and the tangents lean with it
    const seg = track.segments[1];
    const last = seg.arc.length - 1;
    expect(seg.points[last * 3 + 2] - plain.segments[1].points[last * 3 + 2]).toBeCloseTo(
      -LEAN * (seg.start + seg.arc[last]),
      4,
    );
    expect(seg.tangents[2], 'a level straight now points a little down').toBeLessThan(-0.04);
    expect(Math.hypot(seg.tangents[0], seg.tangents[1], seg.tangents[2])).toBeCloseTo(1, 5);
  });

  for (const kind of CROSSED)
    it(`races every marble home over a ${kind} on its own, on 24 seeds, none lost and none stopped`, () => {
      for (let seed = 1; seed <= 24; seed++) {
        const { race, told } = fieldOn(chain(['start', kind, 'finish']), seed);
        raced(race);
        expect(race.over, `seed ${seed}: the race ended`).toBe(true);
        expect(race.finishers, `seed ${seed}: every marble home`).toBe(MARBLES);
        expect(
          race.lost + race.stalled,
          `seed ${seed}: ${told.filter((l) => !l.startsWith('finished')).join(', ')}`,
        ).toBe(0);
        expect(race.check(), `seed ${seed}`).toEqual([]);
      }
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
    for (let f = 0; f < 60 * 5; f++) race.step(DT);
    for (let i = 0; i < MARBLES; i++) {
      expect(race.segment[i], `ball ${i} in the lane`).toBe(race.track.segments.length - 1);
      expect(race.speed[i], `ball ${i} at rest`).toBeLessThan(0.05);
    }
    expect(race.check()).toEqual([]);
  });

  it('places two over the line in one step by which crossed first', () => {
    const { race, track } = fieldOn(chain(['start', 'straight', 'finish']));
    // two set still a unit short of the line, side by side, one a hair ahead: let go, they roll over it in the
    // same step, and the hair decides
    const line = track.segments[1].length;
    // the one ahead is the higher numbered, so that taking them in order would place it wrong
    expect(race.put(5, 1, line - 1, -0.5)).toBe(true);
    expect(race.put(3, 1, line - 1.005, 0.5)).toBe(true);
    race.release();
    for (let f = 0; f < 300 && !(race.place[3] && race.place[5]); f++) race.step(DT);
    expect(race.took[3], 'over the line in the same step, or this proves nothing').toBe(race.took[5]);
    expect(race.place[5], 'the one that was ahead').toBe(1);
    expect(race.place[3]).toBe(2);
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
    // the gate is a level down, then two ramps: three levels; a rolling ball keeps two sevenths as spin
    const allowed = Math.sqrt(2 * GRAVITY * 12 * ROLLING);
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

  it('knows which kinds it can race yet, and refuses the rest', () => {
    for (const kind of CROSSED) expect(Physics.supports(compile(chain(['start', kind, 'finish']))), kind).toBe(true);
    for (const kind of ['pegs', 'jump', 'funnel', 'sweeper', 'gate', 'wheel', 'splitter'] as const)
      expect(
        Physics.supports(
          compile(
            chain(
              kind === 'splitter'
                ? ['start', 'splitter', 'straight', 'straight', 'joiner', 'finish']
                : ['start', kind, 'finish'],
            ),
          ),
        ),
        kind,
      ).toBe(false);
  });

  it('is what the game races on when it is given physics, and the solver where physics cannot go yet', () => {
    const { game } = newGame(1, null, { physics: RAPIER });
    // First Drop has a peg board, which physics cannot race yet
    expect(game.engine).toBe('solver');
    game.browse('pieces');
    game.pick(game.list.findIndex((r) => r.id === 'piece-ramp'));
    expect(game.engine).toBe('physics');
    expect(game.track.wall).toBe(PHYSICS_WALL);
    game.release();
    for (let f = 0; f < 60 * 30 && !game.over; f++) game.step(DT);
    expect(game.marbles.finishers).toBe(MARBLES);
    // and back to the solver for a piece physics has not got to
    game.pick(game.list.findIndex((r) => r.id === 'piece-pegs'));
    expect(game.engine).toBe('solver');
    expect(game.track.wall).toBeLessThan(PHYSICS_WALL);
  });

  it('lets go of a world when another run is put on, and never has more than one', () => {
    // the tests above leave their own worlds behind, which is theirs to do; what counts is what the game adds
    const before = Physics.alive;
    const { game } = newGame(1, null, { physics: RAPIER });
    const pieces = ['piece-ramp', 'piece-straight', 'piece-curve-left', 'piece-pegs', 'piece-curve-right'];
    let most = 0;
    for (const id of pieces) {
      game.browse('pieces');
      game.pick(game.list.findIndex((r) => r.id === id));
      most = Math.max(most, Physics.alive - before);
    }
    expect(most, 'one world, for the run that is on').toBeLessThanOrEqual(1);
  });

  it('keeps a marble a marble: half a unit across, as the solver has it', () => {
    expect(RADIUS).toBe(0.45);
  });
});
