import { describe, expect, it } from 'vitest';
import {
  FINISHED,
  FLYING,
  LOST,
  Marbles,
  RACING,
  RADIUS,
  STALLED,
  SWIRLING,
  WAITING,
  checkMarbles,
} from '../src/marbles';
import { seeded } from '../src/random';
import { FIRST, RUNS } from '../src/runs';
import { type Facing, type Placed, type Run, at, compile, exitOf, pose, pose0, spot, widthAt } from '../src/track';

const DT = 1 / 60;

function field(seed = 1, count = 8) {
  const told: string[] = [];
  const marbles = new Marbles(
    compile(FIRST),
    {
      released: (n) => told.push(`released ${n}`),
      finished: (m, place, s) => told.push(`finished ${m} ${place} ${s.toFixed(2)}`),
      stalled: (m, s) => told.push(`stalled ${m} ${s.toFixed(2)}`),
    },
    { count, random: seeded(seed) },
  );
  return { marbles, told };
}

/** A run of pieces laid end to end from the start, each following the one before. */
function chain(kinds: Placed['kind'][]): Run {
  const pieces: Placed[] = [];
  let here = { x: 0, y: 0, z: 0, facing: 0 as Facing };
  for (const kind of kinds) {
    pieces.push({ kind, ...here });
    const out = exitOf({ kind, ...here });
    if (out) here = out;
  }
  return { id: 'made-up', name: 'made up', pieces };
}

/** A field on a run of the test's own, told of what happens. */
function fieldOn(run: Run, seed = 1, count = 8) {
  const told: string[] = [];
  const marbles = new Marbles(
    compile(run),
    {
      finished: (m, place) => told.push(`finished ${m} ${place}`),
      lost: (m) => told.push(`lost ${m}`),
    },
    { count, random: seeded(seed) },
  );
  return { marbles, told };
}

/** Over a gentle lip onto a long landing, which every marble should make. */
const LEAP = chain(['start', 'ramp', 'jump', 'straight', 'ramp', 'straight', 'finish']);

/** Play until every marble is in the cup, or give up after `cap` seconds of race. */
function race(marbles: Marbles, cap = 120): boolean {
  marbles.release();
  for (let f = 0; f < cap * 60 && !marbles.over; f++) marbles.step(DT);
  return marbles.over;
}

describe('the marbles', () => {
  it('waits on the start until it is let go', () => {
    const { marbles, told } = field();
    for (let i = 0; i < marbles.count; i++) expect(marbles.state[i]).toBe(WAITING);
    for (let f = 0; f < 120; f++) marbles.step(DT);
    expect(marbles.far(0), 'nothing moves before the off').toBeCloseTo(marbles.far(0), 6);
    for (let i = 0; i < marbles.count; i++) expect(marbles.state[i]).toBe(WAITING);
    marbles.release();
    expect(told).toContain('released 8');
    for (let i = 0; i < marbles.count; i++) expect(marbles.state[i]).toBe(RACING);
  });

  it('sends every marble down the run and into the cup', () => {
    const { marbles, told } = field();
    expect(race(marbles), 'the race finished').toBe(true);
    for (let i = 0; i < marbles.count; i++) {
      expect(marbles.state[i]).toBe(FINISHED);
      expect(marbles.took[i]).toBeGreaterThan(0);
      expect(marbles.place[i]).toBeGreaterThan(0);
    }
    expect(told.filter((t) => t.startsWith('finished')).length).toBe(8);
    expect(checkMarbles(marbles)).toEqual([]);
  });

  it('gives out each place once, in the order they came', () => {
    const { marbles } = field(4);
    race(marbles);
    const byPlace = [...Array(marbles.count).keys()].sort((a, b) => marbles.place[a] - marbles.place[b]);
    expect(byPlace.map((i) => marbles.place[i])).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (let k = 1; k < byPlace.length; k++)
      expect(marbles.took[byPlace[k]], 'a later place took no less time').toBeGreaterThanOrEqual(
        marbles.took[byPlace[k - 1]],
      );
  });

  it('keeps every rule while it races', () => {
    const { marbles } = field(7);
    marbles.release();
    for (let f = 0; f < 120 * 60 && !marbles.over; f++) {
      marbles.step(DT);
      if (f % 10 === 0) expect(checkMarbles(marbles), `frame ${f}`).toEqual([]);
    }
    expect(marbles.over).toBe(true);
  });

  it('never lets one marble into another, race after race, by more than the rules allow', () => {
    // held to the same slack as the invariant, over enough races to meet a clump pinned on a wall, which
    // is where one pass of pushing apart was not enough: the wall took the push and gave none of it back
    let closest = Infinity,
      where = '';
    for (let seed = 1; seed <= 60; seed++) {
      const { marbles } = field(seed);
      marbles.release();
      for (let f = 0; f < 120 * 60 && !marbles.over; f++) {
        marbles.step(DT);
        for (let a = 0; a < marbles.count; a++)
          for (let b = a + 1; b < marbles.count; b++) {
            if (marbles.state[a] !== RACING || marbles.state[b] !== RACING) continue;
            const d = Math.hypot(marbles.far(b) - marbles.far(a), marbles.across[b] - marbles.across[a]);
            if (d < closest) {
              closest = d;
              where = `seed ${seed}, frame ${f}, marbles ${a} and ${b}`;
            }
          }
      }
    }
    expect(closest, where).toBeGreaterThanOrEqual(RADIUS * 2 - 0.05);
  });

  it('holds every marble inside the channel, however wide it is where the marble is', () => {
    const { marbles } = field(5);
    marbles.release();
    let over = 0;
    for (let f = 0; f < 120 * 60 && !marbles.over; f++) {
      marbles.step(DT);
      for (let i = 0; i < marbles.count; i++) {
        if (marbles.state[i] !== RACING) continue;
        const wall = widthAt(marbles.track, marbles.segment[i], marbles.along[i]) - RADIUS;
        over = Math.max(over, Math.abs(marbles.across[i]) - wall);
      }
    }
    expect(over).toBeLessThanOrEqual(1e-6);
  });

  it('speeds up going down and does not run away with itself', () => {
    const { marbles } = field(1, 1);
    marbles.release();
    let fastest = 0;
    for (let f = 0; f < 120 * 60 && !marbles.over; f++) {
      marbles.step(DT);
      fastest = Math.max(fastest, marbles.speed[0]);
    }
    expect(fastest, 'it gets going').toBeGreaterThan(5);
    expect(fastest, 'and it does not run away').toBeLessThan(60);
  });

  it('races the same way twice from a seed', () => {
    const one = field(9).marbles,
      two = field(9).marbles;
    race(one);
    race(two);
    for (let i = 0; i < one.count; i++) {
      expect(one.place[i]).toBe(two.place[i]);
      expect(one.took[i]).toBe(two.took[i]);
      expect(one.x[i]).toBe(two.x[i]);
    }
  });

  it('races differently from one seed to another', () => {
    const a = field(11).marbles,
      b = field(12).marbles;
    race(a);
    race(b);
    const places = (m: Marbles) => [...Array(m.count).keys()].map((i) => m.place[i]).join(',');
    const times = (m: Marbles) => [...Array(m.count).keys()].map((i) => m.took[i].toFixed(3)).join(',');
    expect(places(a) !== places(b) || times(a) !== times(b), 'the seed tells on the race').toBe(true);
  });

  it('puts them back on the start when it is run again', () => {
    const { marbles } = field(3);
    race(marbles);
    marbles.reset();
    expect(marbles.t).toBe(0);
    expect(marbles.finishers).toBe(0);
    for (let i = 0; i < marbles.count; i++) {
      expect(marbles.state[i]).toBe(WAITING);
      expect(marbles.place[i]).toBe(0);
      expect(marbles.took[i]).toBe(-1);
      expect(marbles.segment[i]).toBe(0);
    }
    expect(checkMarbles(marbles)).toEqual([]);
  });

  it('sits a marble on the channel and not in it', () => {
    const { marbles } = field(1, 1);
    const w = at(marbles.track, marbles.segment[0], marbles.along[0], spot());
    const dx = marbles.x[0] - w.x,
      dy = marbles.y[0] - w.y,
      dz = marbles.z[0] - w.z;
    // it rides a radius up out of the channel, and as far across it as it has drifted: no more, no less
    expect(dx * w.ux + dy * w.uy + dz * w.uz, 'a radius up').toBeCloseTo(RADIUS, 4);
    const bx = w.ty * w.uz - w.tz * w.uy,
      by = w.tz * w.ux - w.tx * w.uz,
      bz = w.tx * w.uy - w.ty * w.ux;
    expect(dx * bx + dy * by + dz * bz, 'and as far across as it sits').toBeCloseTo(marbles.across[0], 4);
    expect(dx * w.tx + dy * w.ty + dz * w.tz, 'and square to the track').toBeCloseTo(0, 5);
  });

  it('throws a marble to the outside of a bend, not the inside', () => {
    const { marbles } = field(1, 1);
    // straight onto the first left-hand turn, which is the fourth piece
    marbles.release();
    let onTheBend = 0;
    for (let f = 0; f < 120 * 60 && !marbles.over; f++) {
      marbles.step(DT);
      if (marbles.segment[0] === 3) onTheBend = marbles.across[0];
    }
    // across is measured to the right of travel, and a left turn throws a marble right
    expect(onTheBend).toBeGreaterThan(0.1);
  });

  it('is a race: the marble on pole does not always win it', () => {
    let poleWins = 0;
    const seeds = 24;
    for (let seed = 1; seed <= seeds; seed++) {
      const { marbles } = field(seed);
      const pole = [...Array(marbles.count).keys()].find((i) => marbles.grid[i] === 0)!;
      race(marbles);
      if (marbles.place[pole] === 1) poleWins++;
    }
    // it is a real advantage and should be, but backing the front of the grid must not be a certainty
    expect(poleWins).toBeGreaterThan(0);
    expect(poleWins).toBeLessThan(seeds);
  });

  it('makes the wide line round a bend the longer way', () => {
    const { marbles } = field(1, 2);
    const wall = 1.2 - RADIUS;
    // both on the first left-hand turn, level with each other, one hugging the inside and one out wide
    for (const i of [0, 1]) {
      marbles.state[i] = RACING;
      marbles.segment[i] = 3;
      marbles.along[i] = 0;
      marbles.speed[i] = 9;
      marbles.drift[i] = 0;
      marbles.form[i] = 1;
    }
    marbles.across[0] = -wall;
    marbles.across[1] = wall;
    for (let f = 0; f < 30; f++) marbles.step(DT);
    expect(marbles.far(0), 'the inside line gets further round for the same speed').toBeGreaterThan(marbles.far(1));
  });

  it('calls a marble that has stopped, rather than waiting on it for ever', () => {
    const { marbles, told } = field(1, 1);
    // stood still on a level bend, and a marble so poor a roller that the run's lean cannot start it again
    marbles.form[0] = 0.001;
    marbles.state[0] = RACING;
    marbles.segment[0] = 3;
    marbles.along[0] = 1;
    marbles.speed[0] = 0;
    expect(marbles.over).toBe(false);
    for (let f = 0; f < 9 * 60; f++) marbles.step(DT);
    expect(marbles.state[0]).toBe(STALLED);
    expect(marbles.stalled).toBe(1);
    expect(marbles.over, 'a race nobody can finish is still over').toBe(true);
    expect(told.some((l) => l.startsWith('stalled'))).toBe(true);
    // a stalled marble is a race ending, not a rule broken
    expect(checkMarbles(marbles)).toEqual([]);
  });

  it('names the leader without making anything, and agrees with the running order', () => {
    const { marbles } = field(6);
    expect(marbles.leader(), 'nobody leads before the off').toBe(-1);
    marbles.release();
    for (let f = 0; f < 120 * 60 && !marbles.over; f++) {
      marbles.step(DT);
      const running = marbles.running();
      expect(marbles.leader(), `frame ${f}`).toBe(running.length > 0 ? running[0] : -1);
    }
    expect(marbles.leader(), 'nor once they are all home').toBe(-1);
  });

  describe('off the lip of a jump', () => {
    it('flies, comes down on the piece beyond, and carries on to the cup', () => {
      const { marbles } = fieldOn(LEAP, 1, 1);
      marbles.release();
      let flew = false,
        landedOn = -1;
      for (let f = 0; f < 60 * 60 && !marbles.over; f++) {
        const was = marbles.state[0];
        marbles.step(DT);
        if (marbles.state[0] === FLYING) flew = true;
        if (was === FLYING && marbles.state[0] === RACING) landedOn = marbles.segment[0];
      }
      expect(flew, 'it left the track').toBe(true);
      expect(landedOn, 'and came down past the jump').toBeGreaterThan(2);
      expect(marbles.state[0]).toBe(FINISHED);
    });

    it('falls under the whole of gravity in the air, and keeps its way across the ground', () => {
      const { marbles } = fieldOn(LEAP, 1, 1);
      marbles.release();
      for (let f = 0; f < 60 * 60 && marbles.state[0] !== FLYING; f++) marbles.step(DT);
      expect(marbles.state[0], 'it reached the lip and took off').toBe(FLYING);
      const vx = marbles.vx[0],
        vz = marbles.vz[0];
      expect(vz, 'the lip throws it up').toBeGreaterThan(0);
      marbles.step(DT);
      if (marbles.state[0] === FLYING) {
        expect(marbles.vx[0]).toBeCloseTo(vx, 6);
        expect(marbles.vz[0]).toBeCloseTo(vz - 30 * DT, 4);
      }
    });

    it('never has two marbles in the same place through a whole field going over', () => {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const { marbles } = fieldOn(LEAP, seed);
        marbles.release();
        for (let f = 0; f < 60 * 60 && !marbles.over; f++) {
          marbles.step(DT);
          if (f % 5 === 0) expect(checkMarbles(marbles), `seed ${seed} frame ${f}`).toEqual([]);
        }
        expect(marbles.over).toBe(true);
        expect(marbles.lost, `seed ${seed}`).toBe(0);
      }
    });

    it('loses a marble that overshoots everything, says so, and still ends the race', () => {
      const { marbles, told } = fieldOn(LEAP, 1, 1);
      // on the lip, going far too fast for anything beyond it to catch
      marbles.state[0] = RACING;
      marbles.segment[0] = 2;
      marbles.along[0] = marbles.track.segments[2].length - 0.01;
      marbles.speed[0] = 90;
      for (let f = 0; f < 20 * 60 && !marbles.over; f++) marbles.step(DT);
      expect(marbles.state[0]).toBe(LOST);
      expect(marbles.lost).toBe(1);
      expect(marbles.place[0], 'no place for a marble that did not get there').toBe(0);
      expect(told).toContain('lost 0');
      expect(marbles.over, 'a race with a marble lost is still over').toBe(true);
      expect(checkMarbles(marbles)).toEqual([]);
    });

    it('never pushes a marble back over a gap onto the lip it flew from, nor on over one without flying', () => {
      const { marbles } = fieldOn(LEAP, 1, 2);
      const jump = 2,
        landing = 3;
      // two just down on the landing, one inside the other: parting them pushes the back one backwards
      for (const i of [0, 1]) {
        marbles.state[i] = RACING;
        marbles.segment[i] = landing;
        marbles.speed[i] = 0;
        marbles.across[i] = 0;
      }
      marbles.along[0] = 0.05;
      marbles.along[1] = 0.4;
      marbles.step(DT);
      expect(marbles.segment[0], 'still on the landing, not back on the jump').toBe(landing);
      expect(marbles.along[0]).toBeGreaterThanOrEqual(0);
      // and two on the lip, the front one pushed on: it goes over the lip and flies, it does not skip the gap
      for (const i of [0, 1]) {
        marbles.state[i] = RACING;
        marbles.segment[i] = jump;
        marbles.speed[i] = 0;
        marbles.across[i] = 0;
      }
      const lip = marbles.track.segments[jump].length;
      marbles.along[0] = lip - 0.4;
      marbles.along[1] = lip - 0.05;
      marbles.step(DT);
      expect(marbles.segment[1] === jump || marbles.state[1] === FLYING, 'not across the gap on the ground').toBe(true);
    });

    /** A marble in the air over the middle of the landing, `wide` of its centre line and `up` above its floor, going `vz`. */
    function over(wide: number, up: number, vz: number) {
      const { marbles } = fieldOn(LEAP, 1, 1);
      const landing = 3;
      const seg = marbles.track.segments[landing];
      const w = at(marbles.track, landing, seg.length / 2, spot());
      const bx = w.ty * w.uz - w.tz * w.uy,
        by = w.tz * w.ux - w.tx * w.uz,
        bz = w.tx * w.uy - w.ty * w.ux;
      marbles.state[0] = FLYING;
      marbles.segment[0] = 2;
      marbles.along[0] = marbles.track.segments[2].length;
      marbles.x[0] = w.x + bx * wide + w.ux * up;
      marbles.y[0] = w.y + by * wide + w.uy * up;
      marbles.z[0] = w.z + bz * wide + w.uz * up;
      marbles.vx[0] = marbles.vy[0] = 0;
      marbles.vz[0] = vz;
      return marbles;
    }

    it('comes down in the channel, and not on the ground beside it', () => {
      const inside = over(0, 1, -2);
      for (let f = 0; f < 60 && inside.state[0] === FLYING; f++) inside.step(DT);
      expect(inside.state[0], 'dropped into the middle of the channel').toBe(RACING);
      expect(inside.segment[0]).toBe(3);
      const wide = over(2.5, 1, -2);
      for (let f = 0; f < 5 * 60 && wide.state[0] === FLYING; f++) wide.step(DT);
      expect(wide.state[0], 'dropped past the side of the channel, it falls on by and is lost').toBe(LOST);
    });

    it('only lands coming down, not on its way up through a piece', () => {
      const rising = over(0, 0.2, 6);
      rising.step(DT);
      expect(rising.state[0], 'rising, it passes up through the height it would rest at').toBe(FLYING);
      for (let f = 0; f < 3 * 60 && rising.state[0] === FLYING; f++) rising.step(DT);
      expect(rising.state[0], 'and lands when it falls back').toBe(RACING);
    });

    it('counts a marble in the air as in the race, for who is leading', () => {
      const { marbles } = fieldOn(LEAP, 1, 1);
      marbles.release();
      for (let f = 0; f < 60 * 60 && marbles.state[0] !== FLYING; f++) marbles.step(DT);
      expect(marbles.state[0], 'it reached the lip and took off').toBe(FLYING);
      expect(marbles.leader()).toBe(0);
      const before = marbles.far(0);
      marbles.step(DT);
      if (marbles.state[0] === FLYING)
        expect(marbles.far(0), 'and it gets further on in the air').toBeGreaterThan(before);
    });
  });

  describe('on the pieces that break a field up', () => {
    /** One marble set down on a piece, still, `along` it and `across` it, going `speed`. */
    function setOn(run: Run, segment: number, along: number, across: number, speed: number, count = 1) {
      const { marbles, told } = fieldOn(run, 1, count);
      marbles.state[0] = RACING;
      marbles.segment[0] = segment;
      marbles.along[0] = along;
      marbles.across[0] = across;
      marbles.speed[0] = speed;
      marbles.drift[0] = 0;
      return { marbles, told };
    }

    const BOARD = chain(['start', 'pegs', 'straight', 'finish']);

    it('knocks a marble off its line on a peg, and gets one hit dead on past it', () => {
      const { marbles } = setOn(BOARD, 1, 0.5, 0.8, 6);
      const seg = marbles.track.segments[1];
      const peg = seg.obstacles.find((o) => o.across === 0.8)!;
      let furthest = 0;
      for (let f = 0; f < 10 * 60 && marbles.segment[0] === 1 && marbles.state[0] === RACING; f++) {
        marbles.step(DT);
        if (marbles.along[0] < peg.along + 1.5) furthest = Math.max(furthest, Math.abs(marbles.across[0] - 0.8));
      }
      expect(furthest, 'it went round the peg, not through it').toBeGreaterThan(0.3);
      expect(marbles.segment[0], 'and on down the board').toBeGreaterThan(1);
    });

    it('never lets a marble balance on a peg, however square it arrives', () => {
      // at rest just above a peg in line with it: the slope rolls it straight on to the peg's crown
      const { marbles } = setOn(BOARD, 1, 0, 0, 0);
      const peg = marbles.track.segments[1].obstacles.find((o) => o.across === 0.8)!;
      marbles.along[0] = peg.along - 1.2;
      marbles.across[0] = 0.8;
      for (let f = 0; f < 10 * 60 && marbles.segment[0] === 1; f++) marbles.step(DT);
      expect(marbles.state[0], 'not stopped on it').not.toBe(STALLED);
      expect(marbles.segment[0], 'but off the board and on').toBeGreaterThan(1);
    });

    it('keeps a whole field off the pegs and inside the board, all the way down', () => {
      for (const seed of [1, 2, 3]) {
        const { marbles } = fieldOn(chain(['start', 'ramp', 'pegs', 'pegs', 'straight', 'finish']), seed);
        marbles.release();
        for (let f = 0; f < 60 * 60 && !marbles.over; f++) {
          marbles.step(DT);
          expect(checkMarbles(marbles), `seed ${seed} frame ${f}`).toEqual([]);
        }
        expect(marbles.over).toBe(true);
        expect(marbles.stalled, `seed ${seed}: none stuck on the pegs`).toBe(0);
      }
    });

    it('knocks aside a marble in the way of a sweeper', () => {
      const run = chain(['start', 'sweeper', 'straight', 'finish']);
      const { marbles } = setOn(run, 1, 0, 1.0, 0);
      const paddle = marbles.track.segments[1].obstacles[0];
      marbles.along[0] = paddle.along;
      // the paddle starts in the middle of the board, swinging toward the marble
      marbles.phase[paddle.slot] = 0;
      for (let f = 0; f < 12; f++) marbles.step(DT);
      expect(marbles.across[0], 'swept on across the board').toBeGreaterThan(1.6);
    });

    it("strikes a marble in the way of its swing at the swing's own speed", () => {
      const run = chain(['start', 'sweeper', 'straight', 'finish']);
      const { marbles } = setOn(run, 1, 0, 0, 0);
      const paddle = marbles.track.segments[1].obstacles[0];
      // at rest just clear of the paddle's end where it stands, in the way of its swing toward that wall
      marbles.along[0] = paddle.along + Math.cos(paddle.angle) * paddle.half;
      marbles.across[0] = paddle.across + Math.sin(paddle.angle) * paddle.half + paddle.radius + RADIUS + 0.3;
      marbles.phase[paddle.slot] = 0;
      let hardest = 0;
      for (let f = 0; f < 30; f++) {
        marbles.step(DT);
        hardest = Math.max(hardest, marbles.drift[0]);
      }
      expect(hardest, 'sent across by the swing').toBeGreaterThan(1.5);
    });

    it('lets a marble out along the board when a sweeper would crush it against the wall', () => {
      // The Chute on seed 33: a paddle swung to the wall with a marble there, which was once left inside it
      const run = RUNS.find((r) => r.name === 'The Chute')!;
      const { marbles } = fieldOn(run, 33);
      marbles.release();
      for (let f = 0; f < 4 * 60; f++) {
        marbles.step(DT);
        expect(checkMarbles(marbles), `frame ${f}`).toEqual([]);
      }
    });

    it('holds a marble at a gate while it is shut, and lets it through when it opens', () => {
      const run = chain(['start', 'gate', 'straight', 'finish']);
      const { marbles } = setOn(run, 1, 0.5, 0, 5);
      const gate = marbles.track.segments[1].obstacles[0];
      marbles.phase[gate.slot] = 0;
      const out = pose0();
      let held = 0;
      for (let f = 0; f < 4 * 60 && marbles.segment[0] === 1; f++) {
        marbles.step(DT);
        // shut is the gate right across the pen, where it rests; sliding aside it lets through what is on the open side
        pose(gate, marbles.t, 0, out);
        if (out.present && out.across === gate.across) {
          expect(marbles.along[0], `frame ${f}, shut`).toBeLessThan(gate.along);
          held++;
        }
      }
      expect(held, 'it was held for a while').toBeGreaterThan(20);
      expect(marbles.segment[0], 'and let through').toBeGreaterThan(1);
    });

    it("never lets a marble through a wheel's paddle, whenever it arrives", () => {
      const run = chain(['start', 'ramp', 'wheel', 'straight', 'finish']);
      for (const phase of [0, 0.1, 0.2, 0.3]) {
        // under the wheel, so it cannot help but meet its paddles
        const { marbles } = setOn(run, 2, 0.2, -1.2, 14);
        const paddles = marbles.track.segments[2].obstacles;
        marbles.phase[paddles[0].slot] = phase;
        const out = pose0();
        const was = new Map<number, number>();
        for (let f = 0; f < 5 * 60; f++) {
          marbles.step(DT);
          // off the wheel's piece and on to the next, where the paddles' places mean nothing
          if (marbles.segment[0] !== 2) break;
          paddles.forEach((p, k) => {
            pose(p, marbles.t, phase, out);
            if (!out.present) {
              was.delete(k);
              return;
            }
            const side = Math.sign(marbles.along[0] - out.along);
            const before = was.get(k);
            if (before !== undefined)
              expect(side, `phase ${phase} frame ${f}: through paddle ${k}`).toBe(before === 0 ? side : before);
            was.set(k, side);
          });
        }
        expect(marbles.segment[0], `phase ${phase}: through the wheel in the end`).toBeGreaterThan(2);
      }
    });

    it('holds back every marble that comes under the wheel, whichever side of the chute it comes in on', () => {
      /** How long a marble let go into the piece `across` its chute takes to cross it, the wheel's turn begun at `phase`. */
      const crossing = (kind: 'wheel' | 'ramp', across: number, phase: number) => {
        const run = chain(['start', 'ramp', kind, 'straight', 'finish']);
        const { marbles } = setOn(run, 2, 0.2, across, 5);
        const paddles = marbles.track.segments[2].obstacles;
        if (paddles.length) marbles.phase[paddles[0].slot] = phase;
        let f = 0;
        for (; f < 10 * 60 && marbles.segment[0] === 2; f++) marbles.step(DT);
        return f * DT;
      };
      // either edge of a chute's stream, as a field comes down the outside of a bend one way or the other: a wheel
      // over one half of its pen let one side go by untouched
      for (const across of [-0.7, 0.7]) {
        const ramp = crossing('ramp', across, 0);
        const wheel = Array.from({ length: 20 }, (_, k) => crossing('wheel', across, k / 20));
        expect(Math.min(...wheel) - ramp, `${across} across: held, whenever it comes`).toBeGreaterThan(0.3);
        expect(
          Math.max(...wheel) - Math.min(...wheel),
          `${across} across: longer at one moment than another`,
        ).toBeGreaterThan(0.4);
      }
    });

    it('starts the moving pieces somewhere in their turn chosen by the seed, the same for the same seed', () => {
      const run = chain(['start', 'sweeper', 'gate', 'wheel', 'finish']);
      const a = fieldOn(run, 3).marbles,
        b = fieldOn(run, 3).marbles,
        c = fieldOn(run, 4).marbles;
      expect([...a.phase]).toEqual([...b.phase]);
      expect([...a.phase]).not.toEqual([...c.phase]);
      expect(a.phase.length).toBe(3);
    });

    describe('in a funnel', () => {
      const FUNNEL = chain(['start', 'ramp', 'funnel', 'straight', 'ramp', 'finish']);

      /** One marble coming into the funnel at `speed`: how long it circles, how far round it goes, and where it ends up. */
      function into(speed: number) {
        const { marbles } = setOn(FUNNEL, 1, 0, 0, speed);
        marbles.along[0] = marbles.track.segments[1].length - 0.01;
        const bowl = marbles.track.segments[2].funnel!;
        let swirled = 0,
          round = 0,
          last: number | null = null;
        for (let f = 0; f < 20 * 60 && !marbles.over; f++) {
          marbles.step(DT);
          if (marbles.state[0] !== SWIRLING) continue;
          swirled += DT;
          const a = Math.atan2(marbles.y[0] - bowl.y, marbles.x[0] - bowl.x);
          if (last !== null) round += Math.atan2(Math.sin(a - last), Math.cos(a - last));
          last = a;
        }
        return { marbles, swirled, round };
      }

      it('circles the bowl, drops through the hole, and goes on to the cup', () => {
        const { marbles, swirled, round } = into(10);
        expect(swirled, 'it spent time in the bowl').toBeGreaterThan(0.5);
        expect(Math.abs(round), 'at least once round').toBeGreaterThan(Math.PI * 2);
        expect(marbles.state[0]).toBe(FINISHED);
      });

      it('calls a marble that would go round a bowl for ever, rather than waiting on it', () => {
        const { marbles, told } = setOn(FUNNEL, 1, 0, 0, 12);
        marbles.along[0] = marbles.track.segments[1].length - 0.01;
        // a marble that loses nothing to anything: its orbit never closes
        marbles.form[0] = 1e9;
        for (let f = 0; f < 30 * 60 && !marbles.over; f++) marbles.step(DT);
        expect(marbles.state[0]).toBe(STALLED);
        expect(marbles.over, 'and the race is over, not waiting on it').toBe(true);
        expect(told.some((l) => l.startsWith('stalled')) || marbles.stalled === 1).toBe(true);
      });

      it('stops a marble that friction stops in a bowl too, rather than rocking it for ever', () => {
        const { marbles } = setOn(FUNNEL, 1, 0, 0, 8);
        marbles.along[0] = marbles.track.segments[1].length - 0.01;
        for (let f = 0; f < 60 && marbles.state[0] !== SWIRLING; f++) marbles.step(DT);
        expect(marbles.state[0]).toBe(SWIRLING);
        // a marble so rough that what slows it outweighs everything that drives it
        marbles.form[0] = 0.001;
        for (let f = 0; f < 2 * 60; f++) marbles.step(DT);
        expect(marbles.state[0]).toBe(SWIRLING);
        expect(Math.hypot(marbles.vx[0], marbles.vy[0]), 'at rest').toBeLessThan(0.05);
      });

      it('waits in the hole for a marble sat under it to roll clear, rather than dropping on to it', () => {
        let waited = 0;
        for (const speed of [4, 5, 6, 7, 8, 9, 10]) {
          const { marbles } = setOn(FUNNEL, 1, 0, 0, speed, 2);
          marbles.along[0] = marbles.track.segments[1].length - 0.01;
          const bowl = marbles.track.segments[2].funnel!;
          // the other sits still right under the hole, and nothing moves it until the test does
          marbles.state[1] = RACING;
          marbles.segment[1] = 3;
          marbles.along[1] = RADIUS;
          marbles.across[1] = 0;
          marbles.speed[1] = 0;
          marbles.form[1] = 1e-9;
          let here = 0;
          for (let f = 0; f < 14 * 60 && marbles.segment[0] !== 3; f++) {
            marbles.step(DT);
            expect(checkMarbles(marbles), `speed ${speed} frame ${f}`).toEqual([]);
            if (marbles.state[0] === SWIRLING && marbles.bowlRadius(0) < bowl.hole) here++;
            // and after a while it is moved on out of the way
            if (here === 30) marbles.along[1] = 4;
          }
          waited += here;
          expect(marbles.segment[0], `speed ${speed}: out of the bowl in the end`).toBe(3);
        }
        expect(waited, 'it waited in the hole at least once').toBeGreaterThan(0);
      });

      it('keeps a marble that came in fast longer than one that came in slow', () => {
        expect(into(14).swirled).toBeGreaterThan(into(6).swirled + 0.3);
      });

      it('never has two marbles inside each other in the bowl, nor one outside it, and lets them all out', () => {
        for (const seed of [1, 2, 3, 4]) {
          const { marbles } = fieldOn(FUNNEL, seed);
          marbles.release();
          let most = 0;
          for (let f = 0; f < 60 * 60 && !marbles.over; f++) {
            marbles.step(DT);
            let n = 0;
            for (let i = 0; i < marbles.count; i++) if (marbles.state[i] === SWIRLING) n++;
            most = Math.max(most, n);
            expect(checkMarbles(marbles), `seed ${seed} frame ${f}`).toEqual([]);
          }
          expect(most, `seed ${seed}: several in the bowl at once`).toBeGreaterThan(2);
          expect(marbles.over).toBe(true);
          expect(marbles.stalled + marbles.lost, `seed ${seed}`).toBe(0);
        }
      });
    });
  });

  it('says when a marble has gone somewhere it may not', () => {
    const { marbles } = field(1);
    marbles.along[0] = -99;
    expect(checkMarbles(marbles).join('\n')).toMatch(/along a segment/);
    marbles.along[0] = 0;
    marbles.across[0] = 99;
    expect(checkMarbles(marbles).join('\n')).toMatch(/across a channel/);
    marbles.across[0] = 0;
    marbles.speed[0] = NaN;
    expect(checkMarbles(marbles).join('\n')).toMatch(/not a number/);
    marbles.speed[0] = 0;
    // in the air off a piece with no lip to have flown from
    marbles.state[0] = FLYING;
    marbles.segment[0] = 0;
    expect(checkMarbles(marbles).join('\n')).toMatch(/in the air off a piece with no lip/);
  });
});
