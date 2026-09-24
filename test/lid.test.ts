/**
 * A grid over a piece a run asks for: any piece but a jump, a funnel or a
 * wheel may be placed with `lid`, and is covered from end to end — met as a
 * ceiling under physics, where a ball can leave the floor, and drawn over
 * the solver's, whose marbles never do. What the designer offers for it, what
 * a save brings back, and that it holds a ball under it.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { Designer, kept, readDesigns } from '../src/designer';
import { checkInvariants } from '../src/invariants';
import { FINISHED, MARBLES, RACING, RADIUS } from '../src/race';
import { Physics, TERMINAL } from '../src/physics';
import { seeded } from '../src/random';
import { LIDLESS, type Kind, type Placed, type Run, check, compile, exitOf } from '../src/track';
import { newGame } from './helpers';

await RAPIER.init();

const DT = 1 / 60;

/** Pieces laid end to end, the ones named in `under` with a grid over them. */
function run(kinds: Kind[], under: number[] = []): Run {
  const pieces: Placed[] = [];
  let here = exitOf({ kind: 'start', x: 0, y: 0, z: 0, facing: 0 })!;
  pieces.push({ kind: 'start', x: 0, y: 0, z: 0, facing: 0 });
  kinds.forEach((kind, k) => {
    pieces.push({ kind, ...here, ...(under.includes(k + 1) ? { lid: true as const } : {}) });
    const out = exitOf({ kind, ...here });
    if (out) here = out;
  });
  return { id: 'design-1', name: 'Under a grid', pieces };
}

describe('a grid a run asks for', () => {
  it('covers every part of the piece from end to end, compiled for either engine', () => {
    const r = run(['shallowBroad', 'curveLeft', 'straight', 'finish'], [1, 2]);
    for (const track of [compile(r), compile(r)]) {
      const [, board, turn, straight] = track.segments;
      expect(board.lid).toEqual({ from: 0, upto: board.length });
      expect(turn.lid).toEqual({ from: 0, upto: turn.length });
      expect(straight.lid, 'a piece not asked for has none').toBeNull();
    }
  });

  it('is refused over a jump, a funnel or a wheel, and said why, and allowed over anything else', () => {
    expect(LIDLESS).toEqual(['jump', 'funnel', 'wheel']);
    for (const kind of LIDLESS) {
      const problems = check(run([kind, 'finish'], [1]));
      expect(problems.join('\n'), kind).toMatch(new RegExp(`a ${kind} cannot have a grid over it`));
    }
    for (const kind of ['straight', 'ramp', 'drop', 'pegs', 'sweeper', 'gate', 'bumps', 'brake'] as const)
      expect(check(run([kind, 'finish'], [1])), kind).toEqual([]);
  });

  it("races a field home under a grid over whatever a funnel hands on to, the pace a funnel's way out gives it", () => {
    // a funnel once seemed to throw its field out at 22 a second, over the walls and on to a grid after it, 165
    // of 192 lost: it was balls falling straight through a bowl whose floor faced down, and a grid there is as
    // sound as anywhere
    // a turn, whose walls a ball thrown out high would go over first
    for (const next of ['curveRight'] as const) {
      const track = compile(run(['funnel', next, 'straight', 'finish'], [2]));
      for (let seed = 1; seed <= 24; seed++) {
        const race = new Physics(RAPIER, track, {}, { random: seeded(seed) });
        race.release();
        for (let f = 0; f < 90 * 60 && !race.over; f++) race.step(DT);
        expect(race.finishers, `${next}, seed ${seed}: ${race.lost} lost`).toBe(MARBLES);
        expect(race.check(), `${next}, seed ${seed}`).toEqual([]);
      }
    }
  });

  it('is put over the last piece in the designer and taken off again, never over the start or where it is refused', () => {
    const d = new Designer('Mine');
    expect(d.refusesLid(), 'nothing laid yet').toMatch(/lay a piece/);
    expect(d.lid()).toBe(false);
    d.place('ramp');
    expect(d.refusesLid()).toBe('');
    expect(d.lid()).toBe(true);
    expect(d.run.pieces[1].lid).toBe(true);
    expect(d.lid(), 'and off again').toBe(true);
    expect(d.run.pieces[1].lid).toBeUndefined();
    d.place('jump');
    expect(d.refusesLid()).toMatch(/a jump cannot have a grid over it/);
    expect(d.lid()).toBe(false);
    d.undo();
    d.lid();
    // a design kept carries its grid, and building on after changes nothing kept
    d.place('finish');
    const k = kept([], 'Mine', d.run.pieces);
    expect(k.pieces[1].lid).toBe(true);
    d.undo();
    d.lid();
    expect(k.pieces[1].lid).toBe(true);
  });

  it('is brought back from a save, and a save that asks for one where none may go loses the design', () => {
    const good = run(['ramp', 'straight', 'finish'], [2]);
    const bad = { ...run(['jump', 'finish'], [1]), id: 'design-2' };
    const odd = { ...run(['ramp', 'finish']), id: 'design-3' };
    (odd.pieces[1] as unknown as Record<string, unknown>).lid = 'yes';
    const back = readDesigns(JSON.parse(JSON.stringify([good, bad, odd])));
    expect(back.map((d) => d.id)).toEqual(['design-1']);
    expect(back[0].pieces[2].lid).toBe(true);
    expect(back[0].pieces[1].lid, 'none where none was asked for').toBeUndefined();
  });

  it('holds a ball under it under physics, over a piece that has none of its own', () => {
    // a shallow's crest throws a ball at speed clear of its floor, holding one only below 10; given the fastest
    // the air allows, under a grid it stays within the walls' height, and without one it goes over them
    const high = (lidded: boolean) => {
      const track = compile(run(['straight', 'shallow', 'straight', 'straight', 'finish'], lidded ? [2] : []));
      const race = new Physics(RAPIER, track, {}, { count: 1 });
      race.put(0, 1, 1, 0);
      race.release();
      for (let f = 0; f < 3; f++) race.step(DT);
      race.meddle(0, { speed: TERMINAL });
      let most = 0;
      const seg = track.segments[2];
      for (let f = 0; f < 60 * 5 && race.state[0] === RACING; f++) {
        race.step(DT);
        if (race.segment[0] !== 2) continue;
        const k = Math.round((race.along[0] / seg.length) * (seg.arc.length - 1)) * 3;
        most = Math.max(
          most,
          seg.ups[k] * (race.x[0] - seg.points[k]) +
            seg.ups[k + 1] * (race.y[0] - seg.points[k + 1]) +
            seg.ups[k + 2] * (race.z[0] - seg.points[k + 2]),
        );
        if (lidded) expect(race.check(), `frame ${f}`).toEqual([]);
      }
      const state = race.state[0];
      race.dispose();
      return { most, state, wall: seg.wall };
    };
    const open = high(false),
      under = high(true);
    expect(open.most, 'off the crest, over the walls').toBeGreaterThan(open.wall);
    expect(under.most, 'held under the grid').toBeLessThanOrEqual(under.wall - RADIUS + 0.05);
    expect(under.state).toBe(FINISHED);
  });

  it('is put on through the game, kept, and raced home, with every rule held', () => {
    const { game } = newGame(1);
    game.browse('designs');
    for (const k of ['ramp', 'shallowBroad'] as const) expect(game.lay(k)).toBe(true);
    expect(game.lid()).toBe(true);
    expect(game.track.segments[2].lid).not.toBeNull();
    expect(game.lay('finish')).toBe(true);
    expect(game.keep('Grid')).toEqual([]);
    expect(game.progress.save.designs[0].pieces[2].lid).toBe(true);
    expect(checkInvariants(game)).toEqual([]);
    game.release();
    for (let f = 0; f < 60 * 60 && !game.over; f++) game.step(DT);
    expect(game.marbles.finishers).toBe(8);
    expect(checkInvariants(game)).toEqual([]);
  });
});
