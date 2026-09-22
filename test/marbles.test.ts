import { describe, expect, it } from 'vitest';
import {
  BOWL_PATIENCE,
  FINISHED,
  FLYING,
  GRAVITY,
  HEAVE,
  LOST,
  Marbles,
  RACING,
  RADIUS,
  SHOVE,
  STALLED,
  SWIRLING,
  WAITING,
  checkMarbles,
} from '../src/marbles';
import { seeded } from '../src/random';
import { FIRST, RUNS } from '../src/runs';
import {
  HALF_WIDTH,
  type Facing,
  type Placed,
  type Run,
  at,
  compile,
  exitOf,
  pose,
  pose0,
  spot,
  widthAt,
} from '../src/track';

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

  it('treats every marble alike: two swapped on the gate swap places at the finish, and nobody else moves', () => {
    for (const [run, seed] of [
      [FIRST, 3],
      [RUNS.find((r) => r.name === 'Switchback')!, 5],
      [RUNS.find((r) => r.name === 'The Tower')!, 7],
    ] as const) {
      const once = fieldOn(run, seed).marbles;
      race(once);
      const swapped = fieldOn(run, seed).marbles;
      // the same race in every way, but for which marble stands where the other did
      const a = [...Array(swapped.count).keys()].find((i) => swapped.grid[i] === 0)!;
      const b = [...Array(swapped.count).keys()].find((i) => swapped.grid[i] === 5)!;
      swapped.grid[a] = 5;
      swapped.grid[b] = 0;
      swapped.reset();
      race(swapped);
      for (let i = 0; i < once.count; i++) {
        const stood = i === a ? b : i === b ? a : i;
        expect(swapped.place[i], `${run.name}, seed ${seed}: marble ${i}`).toBe(once.place[stood]);
      }
    }
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
    }
    marbles.across[0] = -wall;
    marbles.across[1] = wall;
    for (let f = 0; f < 30; f++) marbles.step(DT);
    expect(marbles.far(0), 'the inside line gets further round for the same speed').toBeGreaterThan(marbles.far(1));
  });

  it('calls a marble that has stopped, rather than waiting on it for ever', () => {
    const { marbles, told } = field(1, 1);
    // stood still on a level bend, on a surface so rough that the run's lean cannot start it again
    marbles.friction = 1000;
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
    it('brings a marble to the same pace on its felt, whatever it came in at, and lands it on its own board', () => {
      const run = chain(['start', 'straight', 'jump', 'straight', 'finish']);
      const lips: number[] = [];
      for (const speed of [0, 3, 8, 15, 22, 30]) {
        const { marbles } = fieldOn(run, 1, 1);
        const runUp = marbles.track.segments.findIndex((s) => s.flies);
        marbles.state[0] = RACING;
        marbles.segment[0] = runUp;
        marbles.along[0] = 0;
        marbles.across[0] = 0;
        marbles.speed[0] = speed;
        marbles.drift[0] = 0;
        let lip = 0,
          came = -1;
        for (let f = 0; f < 10 * 60 && came < 0 && marbles.state[0] !== LOST; f++) {
          const was = marbles.state[0],
            going = marbles.speed[0];
          marbles.step(DT);
          if (was === RACING && marbles.state[0] === FLYING) lip = going;
          if (was === FLYING && marbles.state[0] !== FLYING) came = marbles.segment[0];
        }
        expect(came, `in at ${speed}: down on the jump's own landing`).toBe(runUp + 1);
        lips.push(lip);
      }
      expect(Math.max(...lips) - Math.min(...lips), 'off the lip at much the same pace').toBeLessThan(2);
    });

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

    it("lets the field out of the gate's pen without a push far past its own width", () => {
      // a pen a board wide, closing to the chute over the last fifth of the piece, asked the settling to shove
      // a marble twice its own width in one step to fit the field spread abreast past that short a pinch: seed
      // 19 once moved marble 6 by 1.8. Closing from the gate on, over the rest of the piece, still lets the
      // field spread out exactly as wide while it waits, and cuts the worst of it by four in ten
      const run = chain(['start', 'ramp', 'gate', 'finish']);
      const gateSeg = 2;
      let worst = 0,
        where = '';
      for (let seed = 1; seed <= 200; seed++) {
        const { marbles } = fieldOn(run, seed);
        marbles.release();
        const n = marbles.count;
        const px = new Float32Array(n),
          py = new Float32Array(n),
          pz = new Float32Array(n),
          seg0 = new Int32Array(n);
        for (let f = 0; f < 60 * 60 && !marbles.over; f++) {
          for (let i = 0; i < n; i++) {
            px[i] = marbles.x[i];
            py[i] = marbles.y[i];
            pz[i] = marbles.z[i];
            seg0[i] = marbles.segment[i];
          }
          marbles.step(DT);
          for (let i = 0; i < n; i++) {
            if (seg0[i] !== gateSeg || marbles.segment[i] !== gateSeg) continue;
            const d = Math.hypot(marbles.x[i] - px[i], marbles.y[i] - py[i], marbles.z[i] - pz[i]);
            if (d > worst) {
              worst = d;
              where = `seed ${seed}, marble ${i}`;
            }
          }
        }
      }
      // comfortably below what it was (up to 2.07 over the same seeds) and above what it is now (up to about 1.2)
      expect(worst, where).toBeLessThan(RADIUS * 3.3);
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

    it('parts a crowd it has pressed together without carrying one of them off', () => {
      // a paddle, a bar or a peg presses a field together, and the settling has to part it again. Split evenly
      // and clamped to the walls, a marble already on its wall took none of the parting across the channel, and
      // the run made up for it along its length instead: on the wheel, seed 6, one was carried 1.12 in a step,
      // further than its own width, and 11 marble-steps in 3.3 million went further still
      let worst = 0,
        where = '';
      for (const kinds of [
        ['start', 'wheel', 'finish'],
        ['start', 'gate', 'pegs', 'finish'],
      ] as const)
        for (let seed = 1; seed <= 12; seed++) {
          const { marbles } = fieldOn(chain([...kinds]), seed);
          marbles.release();
          for (let f = 0; f < 30 * 60 && !marbles.over; f++) {
            marbles.step(DT);
            for (let i = 0; i < marbles.count; i++)
              if (marbles.pushed[i] > worst) {
                worst = marbles.pushed[i];
                where = `${kinds.join(', ')}, seed ${seed}, frame ${f}, marble ${i}`;
              }
            expect(checkMarbles(marbles), `${kinds.join(', ')}, seed ${seed}, frame ${f}`).toEqual([]);
          }
        }
      expect(worst, where).toBeLessThanOrEqual(HEAVE);
    });

    it('lets a marble out from under its closing bar without throwing it back up the run', () => {
      // the bar slides across its pen at 18 a second, a third of a marble in a step. One caught between the end of
      // it and the wall was set out of it all at once and thrown 0.6 back up the run, further than it had come
      // down: the marble cannot go further across, so it went along, four hops of 0.12 in the one step
      const run = chain(['start', 'ramp', 'gate', 'straight', 'finish']);
      const bar = compile(run).segments[2].obstacles[0];
      const at = pose0();
      let worst = 0,
        where = '';
      for (let phase = 0; phase < 1; phase += 0.02)
        for (const side of [-1, 1]) {
          // a marble that cannot roll, held against one wall at the bar's own line, where the end of it sweeps by
          const { marbles } = setOn(run, 2, bar.along, side * (widthAt(compile(run), 2, bar.along) - RADIUS - 0.01), 0);
          marbles.friction = 1000;
          marbles.phase[bar.slot] = phase;
          // set down clear of the bar, as a marble always arrives, and not inside it already
          pose(bar, 0, phase, at, RADIUS);
          const pa = marbles.along[0] - at.along,
            pc = marbles.across[0] - at.across;
          const s = Math.min(Math.max(pa * Math.cos(bar.angle) + pc * Math.sin(bar.angle), -at.half), at.half);
          if (Math.hypot(pa - Math.cos(bar.angle) * s, pc - Math.sin(bar.angle) * s) < at.radius + RADIUS) continue;
          for (let f = 0; f < 3 * 60; f++) {
            marbles.step(DT);
            if (marbles.shoved[0] > worst) {
              worst = marbles.shoved[0];
              where = `phase ${phase.toFixed(2)}, ${side < 0 ? 'left' : 'right'} wall, frame ${f}`;
            }
          }
          expect(checkMarbles(marbles), where).toEqual([]);
        }
      expect(worst, where).toBeLessThanOrEqual(SHOVE);
    });

    it('comes down on a marble without shoving it more than half a marble in a step, wherever it sits under the wheel', () => {
      const run = chain(['start', 'ramp', 'wheel', 'straight', 'finish']);
      const axle = compile(run).segments[2].obstacles[0].along;
      let worst = 0,
        where = '';
      // a marble that cannot roll, anywhere from ahead of the axle to well behind where a paddle first comes down,
      // held there a whole turn of the wheel: whatever moves it, a paddle moved
      for (let behind = -0.6; behind <= 2; behind += 0.1)
        for (const across of [-1, 0, 1]) {
          const { marbles } = setOn(run, 2, axle - behind, across, 0);
          marbles.friction = 1000;
          const paddles = marbles.track.segments[2].obstacles;
          marbles.phase[paddles[0].slot] = 0;
          // set down clear of every paddle, as a marble always arrives, and not inside one already down
          const set = pose0();
          const clear = paddles.every((p) => {
            pose(p, 0, 0, set, RADIUS);
            return !set.present || Math.abs(marbles.along[0] - set.along) >= set.radius + RADIUS;
          });
          if (!clear) continue;
          for (let f = 0; f < 5 * 60; f++) {
            const was = marbles.segment[0];
            const along = marbles.along[0],
              side = marbles.across[0];
            marbles.step(DT);
            // off the wheel's own piece, where how far along means something else
            if (marbles.segment[0] !== was) break;
            const moved = Math.hypot(marbles.along[0] - along, marbles.across[0] - side);
            if (moved > worst) {
              worst = moved;
              where = `${behind.toFixed(1)} behind the axle, ${across} across, frame ${f}`;
            }
          }
        }
      expect(worst, where).toBeLessThanOrEqual(RADIUS);
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

    it('gathers a whole field between two of its paddles without pressing any into another', () => {
      // a field let out of a gate's pen together, and one crowding off the wheel into a bowl: the arm takes up
      // more of the pen than its slice at a marble's height did, and with the axle lower two paddles were down at
      // once too close together for eight marbles to fit between them
      for (const kinds of [
        ['start', 'gate', 'wheel', 'finish'],
        ['start', 'wheel', 'funnel', 'finish'],
      ] as const)
        for (let seed = 1; seed <= 24; seed++) {
          const { marbles } = fieldOn(chain([...kinds]), seed);
          marbles.release();
          for (let f = 0; f < 60 * 60 && !marbles.over; f++) {
            marbles.step(DT);
            expect(checkMarbles(marbles), `${kinds.join(', ')}, seed ${seed} frame ${f}`).toEqual([]);
          }
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
      /** The funnel is three parts: the run in to its bowl, the bowl, and the floor under its hole; then a straight. */
      const RUN_IN = 2,
        BOWL = 3,
        BELOW = 4;

      /** One marble coming into the funnel at `speed`: how long it circles, how far round it goes, and where it ends up. */
      function into(speed: number) {
        const { marbles } = setOn(FUNNEL, RUN_IN, 0, 0, speed);
        marbles.along[0] = marbles.track.segments[RUN_IN].length - 0.01;
        const bowl = marbles.track.segments[BOWL].funnel!;
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

      /** How fast a marble is going across the ground, whatever it is doing. */
      function going(marbles: Marbles, i: number): number {
        if (marbles.state[i] === RACING) return Math.hypot(marbles.speed[i], marbles.drift[i]);
        return Math.hypot(marbles.vx[i], marbles.vy[i]);
      }

      /** How fast a marble is going up or down, whatever it is doing: in a bowl, no faster than its steepest slope takes it. */
      function sinking(marbles: Marbles, i: number): number {
        if (marbles.state[i] === RACING) return Math.abs(marbles.speed[i]);
        if (marbles.state[i] === FLYING) return Math.abs(marbles.vz[i]) + GRAVITY * DT;
        return Math.hypot(marbles.vx[i], marbles.vy[i]) * 1.6;
      }

      it('drops a marble through the hole and on to the piece below, falling, without ever jumping it', () => {
        for (const speed of [4, 10, 16]) {
          const { marbles } = setOn(FUNNEL, RUN_IN, 0, 0, speed);
          marbles.step(DT);
          let fell = false,
            across = -Infinity,
            down = -Infinity,
            on = 0;
          // from its last frame in the bowl, through the hole, to a while on the piece below
          for (let f = 0; f < 30 * 60 && on < 30; f++) {
            const x = marbles.x[0],
              y = marbles.y[0],
              z = marbles.z[0],
              was = marbles.state[0],
              going0 = going(marbles, 0),
              sinking0 = sinking(marbles, 0);
            marbles.step(DT);
            if (was === RACING && marbles.state[0] === RACING) {
              if (marbles.segment[0] > BOWL) on++;
              continue;
            }
            if (marbles.state[0] === FLYING && marbles.segment[0] === BOWL) fell = true;
            across = Math.max(
              across,
              Math.hypot(marbles.x[0] - x, marbles.y[0] - y) - Math.max(going0, going(marbles, 0)) * DT,
            );
            down = Math.max(down, Math.abs(marbles.z[0] - z) - Math.max(sinking0, sinking(marbles, 0)) * DT);
          }
          expect(on, `${speed}: on the piece below in the end`).toBe(30);
          // it was taken from the hole and set down on the piece below in a single frame, as much as a marble's
          // height and a half lower and a hole's width across from where it had been
          expect(down, `${speed}: never further down in a frame than it was going`).toBeLessThan(0.01);
          expect(across, `${speed}: nor further across`).toBeLessThan(0.01);
          expect(fell, `${speed}: it fell through the hole`).toBe(true);
        }
      });

      it('drops a marble off the run in into the bowl, from over it, without ever jumping it across the ground', () => {
        for (const speed of [2, 10, 20])
          for (const across of [-0.7, 0, 0.7]) {
            const { marbles } = setOn(FUNNEL, RUN_IN, 0, across, speed);
            const bowl = marbles.track.segments[BOWL].funnel!;
            let flew = false,
              worst = -Infinity;
            marbles.step(DT);
            for (let f = 0; f < 20 * 60; f++) {
              const x = marbles.x[0],
                y = marbles.y[0],
                was = going(marbles, 0),
                rolling = marbles.state[0] === RACING;
              marbles.step(DT);
              // through the hole it goes on to the piece below, out of sight under the bowl
              if (marbles.segment[0] > BOWL) break;
              // on the chute, a marble's middle goes a little further than the floor under it over a crest, and
              // this is about the way off the chute: from its last frame on it, through the air and round the bowl
              if (rolling && marbles.state[0] === RACING) continue;
              const moved = Math.hypot(marbles.x[0] - x, marbles.y[0] - y);
              worst = Math.max(worst, moved - Math.max(was, going(marbles, 0)) * DT);
              if (marbles.state[0] !== FLYING) continue;
              flew = true;
              const r = Math.hypot(marbles.x[0] - bowl.x, marbles.y[0] - bowl.y);
              expect(r, `${speed} at ${across}: in the air over the bowl`).toBeLessThan(bowl.rim - RADIUS + 1e-3);
            }
            // ended on the rim, the run in had half its width outside the bowl, and a marble coming off it was set
            // down inside the rim, as much as a whole chute's width from where it had been the frame before
            expect(worst, `${speed} at ${across}: never further in a frame than it was going`).toBeLessThan(0.01);
            expect(flew, `${speed} at ${across}: it dropped in`).toBe(true);
          }
      });

      it('keeps the fastest marble there is inside the bowl, off the wall of its rim', () => {
        // six drops end to end bring a field to the funnel at nearly thirty, the fastest a marble gets anywhere, and
        // it comes off the lip faster still: over the bowl and down, it meets the rim's wall before the floor
        const run = chain(['start', 'drop', 'drop', 'drop', 'drop', 'drop', 'drop', 'funnel', 'straight', 'finish']);
        for (const seed of [1, 2]) {
          const { marbles } = fieldOn(run, seed);
          marbles.release();
          let fastest = 0;
          for (let f = 0; f < 60 * 60 && !marbles.over; f++) {
            marbles.step(DT);
            for (let i = 0; i < marbles.count; i++)
              if (marbles.state[i] === FLYING) fastest = Math.max(fastest, Math.hypot(marbles.vx[i], marbles.vy[i]));
            expect(checkMarbles(marbles), `seed ${seed} frame ${f}`).toEqual([]);
          }
          expect(fastest, `seed ${seed}: off the lip at the fastest`).toBeGreaterThan(25);
          expect(marbles.lost, `seed ${seed}: none over the rim`).toBe(0);
          expect(marbles.finishers, `seed ${seed}: all home`).toBe(marbles.count);
        }
      });

      it('sets a marble that got past the wall in a step back inside it, and turns it round', () => {
        // the fastest a marble meets the wall here is about 0.37 a step outward, short of the 0.45 between touching
        // the wall and being past it; faster, it would be past the wall before it was ever seen touching it
        const { marbles } = setOn(FUNNEL, RUN_IN, 0, 0, 10);
        marbles.along[0] = marbles.track.segments[RUN_IN].length - 0.01;
        for (let f = 0; f < 60 && marbles.state[0] !== FLYING; f++) marbles.step(DT);
        expect(marbles.state[0]).toBe(FLYING);
        const bowl = marbles.track.segments[BOWL].funnel!;
        marbles.x[0] = bowl.x;
        marbles.y[0] = bowl.y - bowl.rim - 0.3;
        marbles.z[0] = bowl.z + bowl.wall - RADIUS * 2;
        marbles.vx[0] = 0;
        marbles.vy[0] = -30;
        marbles.vz[0] = 0;
        marbles.step(DT);
        const r = Math.hypot(marbles.x[0] - bowl.x, marbles.y[0] - bowl.y);
        expect(r, 'inside the wall').toBeLessThanOrEqual(bowl.rim - RADIUS + 1e-3);
        expect(marbles.vy[0], 'coming off it').toBeGreaterThan(0);
        expect(marbles.lost).toBe(0);
      });

      it('says when a marble in the air off the run in is anywhere but over the bowl', () => {
        const { marbles } = setOn(FUNNEL, RUN_IN, 0, 0, 10);
        marbles.along[0] = marbles.track.segments[RUN_IN].length - 0.01;
        for (let f = 0; f < 60 && marbles.state[0] !== FLYING; f++) marbles.step(DT);
        expect(marbles.state[0]).toBe(FLYING);
        expect(checkMarbles(marbles)).toEqual([]);
        // where a marble came off the run in when it ended on the rim, half its width outside the bowl
        const bowl = marbles.track.segments[BOWL].funnel!;
        marbles.x[0] = bowl.x;
        marbles.y[0] = bowl.y - bowl.rim - 0.3;
        expect(checkMarbles(marbles).join('\n')).toMatch(/off the side of a funnel/);
      });

      /** How many times round the bowl each marble of a field goes before it drops through, fewest first. */
      function laps(run: Run, seed: number, count: number): number[] {
        const { marbles } = fieldOn(run, seed, count);
        const bowl = marbles.track.segments.find((s) => s.funnel)!.funnel!;
        const round = new Float64Array(count),
          last = new Float64Array(count).fill(NaN),
          out: number[] = [];
        marbles.release();
        for (let f = 0; f < 60 * 60 && !marbles.over; f++) {
          marbles.step(DT);
          for (let i = 0; i < count; i++) {
            if (marbles.state[i] !== SWIRLING) {
              if (!Number.isNaN(last[i])) out.push(Math.abs(round[i]) / (Math.PI * 2));
              last[i] = NaN;
              continue;
            }
            const a = Math.atan2(marbles.y[i] - bowl.y, marbles.x[i] - bowl.x);
            if (!Number.isNaN(last[i])) round[i] += Math.atan2(Math.sin(a - last[i]), Math.cos(a - last[i]));
            last[i] = a;
          }
        }
        expect(out.length, `seed ${seed}: every marble through the bowl`).toBe(count);
        return out.sort((a, b) => a - b);
      }

      it('lets a marble go round and round the bowl before it drops through, with nothing in its way', () => {
        // with the run in over the bowl and not across its rim, nothing stands in the way of a marble going round,
        // and the bowl need not take its speed off it within a lap: at the drag it had then, a lone marble went round
        // once and a field's middle marble a little more
        expect(laps(FUNNEL, 1, 1)[0], 'alone, twice round at the least').toBeGreaterThan(2);
        // in a crowd, one that comes down on top of another can lose most of its way round at once, and go straight
        // through; that is the crowd's doing and not the bowl's, so it is the middle of the field that is held to it,
        // broken up first by a peg board so that each seed is a race of its own
        for (const seed of [1, 2, 3, 4]) {
          const field = laps(chain(['start', 'pegs', 'funnel', 'straight', 'finish']), seed, 8);
          expect(field[3], `seed ${seed}: five of the eight twice round`).toBeGreaterThan(2);
        }
      });

      it('circles the bowl, drops through the hole, and goes on to the cup', () => {
        const { marbles, swirled, round } = into(10);
        expect(swirled, 'it spent time in the bowl').toBeGreaterThan(0.5);
        expect(Math.abs(round), 'at least once round').toBeGreaterThan(Math.PI * 2);
        expect(marbles.state[0]).toBe(FINISHED);
      });

      it('calls a marble that would go round a bowl for ever, rather than waiting on it', () => {
        const { marbles, told } = setOn(FUNNEL, RUN_IN, 0, 0, 12);
        marbles.along[0] = marbles.track.segments[RUN_IN].length - 0.01;
        // a bowl that takes nothing from a marble going round it: its orbit never closes
        marbles.friction = 0;
        for (let f = 0; f < (BOWL_PATIENCE + 10) * 60 && !marbles.over; f++) marbles.step(DT);
        expect(marbles.state[0]).toBe(STALLED);
        expect(marbles.over, 'and the race is over, not waiting on it').toBe(true);
        expect(told.some((l) => l.startsWith('stalled')) || marbles.stalled === 1).toBe(true);
      });

      it('stops a marble that friction stops in a bowl too, rather than rocking it for ever', () => {
        const { marbles } = setOn(FUNNEL, RUN_IN, 0, 0, 8);
        marbles.along[0] = marbles.track.segments[RUN_IN].length - 0.01;
        for (let f = 0; f < 60 && marbles.state[0] !== SWIRLING; f++) marbles.step(DT);
        expect(marbles.state[0]).toBe(SWIRLING);
        // a bowl so rough that what slows a marble outweighs everything that drives it
        marbles.friction = 1000;
        for (let f = 0; f < 2 * 60; f++) marbles.step(DT);
        expect(marbles.state[0]).toBe(SWIRLING);
        // at rest but for what the bowl's slope starts it with in one frame, a tenth or so; friction taken as a push
        // the other way would throw it back at ten times that
        expect(Math.hypot(marbles.vx[0], marbles.vy[0]), 'at rest').toBeLessThan(0.2);
      });

      /** A marble coming into the funnel, and another put on the floor under the hole as the first nears the hole, held there by a bar. */
      function waitingOn(speed: number) {
        const { marbles } = setOn(FUNNEL, RUN_IN, 0, 0, speed, 2);
        marbles.along[0] = marbles.track.segments[RUN_IN].length - 0.01;
        const bowl = marbles.track.segments[BOWL].funnel!;
        const below = marbles.track.segments[BELOW];
        below.obstacles.push({
          along: RADIUS * 2 + 0.25,
          across: 0,
          half: HALF_WIDTH,
          angle: Math.PI / 2,
          radius: 0.2,
          motion: { kind: 'fixed' },
          slot: -1,
        });
        // put there only as the first comes near the hole, or it sits still long enough to be called stopped first
        const under = () => {
          marbles.state[1] = RACING;
          marbles.segment[1] = BELOW;
          marbles.along[1] = RADIUS;
          marbles.across[1] = 0;
          marbles.speed[1] = 0;
        };
        return { marbles, bowl, below, under };
      }

      it('waits in the hole for a marble sat under it to roll clear, rather than dropping on to it', () => {
        let waited = 0;
        for (const speed of [4, 5, 6, 7, 8, 9, 10]) {
          const { marbles, bowl, below, under } = waitingOn(speed);
          let here = 0,
            put = false;
          for (let f = 0; f < 20 * 60 && (marbles.state[0] !== RACING || marbles.segment[0] <= BOWL); f++) {
            marbles.step(DT);
            if (!put && marbles.state[0] === SWIRLING && marbles.bowlRadius(0) < bowl.hole * 2) {
              under();
              put = true;
            }
            expect(checkMarbles(marbles), `speed ${speed} frame ${f}`).toEqual([]);
            if (marbles.state[0] === SWIRLING && marbles.bowlRadius(0) < bowl.hole) here++;
            // never falling while the other is still under the hole
            const beneath = Math.hypot(marbles.x[1] - bowl.x, marbles.y[1] - bowl.y) < bowl.hole + RADIUS;
            if (marbles.state[0] === FLYING && marbles.segment[0] === BOWL)
              expect(beneath, `speed ${speed} frame ${f}: fell on to the one under the hole`).toBe(false);
            // and after a while the bar is taken away, and it rolls on out of the way
            if (here === 30) below.obstacles.pop();
          }
          waited += here;
          expect(marbles.state[1], `speed ${speed}: the one under the hole rolled clear`).toBe(RACING);
          expect(marbles.segment[0], `speed ${speed}: out of the bowl in the end`).toBeGreaterThan(BOWL);
        }
        expect(waited, 'it waited in the hole at least once').toBeGreaterThan(0);
      });

      it('says when a marble falling through the hole is outside the throat, or inside another falling with it', () => {
        const { marbles } = setOn(FUNNEL, RUN_IN, 0, 0, 0, 2);
        const bowl = marbles.track.segments[BOWL].funnel!;
        const fall = (i: number, x: number, z: number) => {
          marbles.state[i] = FLYING;
          marbles.segment[i] = BOWL;
          marbles.along[i] = marbles.track.segments[BOWL].length;
          marbles.x[i] = bowl.x + x;
          marbles.y[i] = bowl.y;
          marbles.z[i] = z;
        };
        const lip = bowl.z - bowl.depth;
        fall(0, 0, lip - 0.5);
        fall(1, 0, lip - 0.5 - RADIUS * 3);
        expect(checkMarbles(marbles)).toEqual([]);
        // a marble's width from the middle of the throat, it is in the throat's wall
        fall(0, bowl.hole - RADIUS + 0.2, lip - 0.5);
        expect(checkMarbles(marbles).join('\n')).toMatch(/outside its throat/);
        // and one right on top of the other, as two let down the throat together could be
        fall(0, 0, lip - 0.5);
        fall(1, 0, lip - 0.5 - RADIUS);
        expect(checkMarbles(marbles).join('\n')).toMatch(/inside each other/);
      });

      it('lets one marble at a time down the throat, and none on to another', () => {
        let most = 0;
        for (const kinds of [
          ['start', 'ramp', 'funnel', 'straight', 'ramp', 'finish'],
          ['start', 'pegs', 'funnel', 'straight', 'finish'],
          ['start', 'wheel', 'funnel', 'finish'],
        ] as const)
          for (const seed of [1, 2, 3, 4, 5, 6]) {
            const { marbles } = fieldOn(chain([...kinds]), seed);
            const bowl = marbles.track.segments.findIndex((s) => s.funnel);
            marbles.release();
            for (let f = 0; f < 60 * 60 && !marbles.over; f++) {
              marbles.step(DT);
              let falling = 0;
              for (let i = 0; i < marbles.count; i++)
                if (marbles.state[i] === FLYING && marbles.segment[i] === bowl) falling++;
              most = Math.max(most, falling);
              expect(falling, `${kinds.join(', ')}, seed ${seed} frame ${f}: two in the throat`).toBeLessThanOrEqual(1);
            }
          }
        expect(most, 'some fell through').toBe(1);
      });

      it('waits on a marble stopped for good under the hole until the bowl calls it, and the race still ends', () => {
        const { marbles, bowl, under } = waitingOn(6);
        let put = false;
        for (let f = 0; f < (BOWL_PATIENCE + 20) * 60 && !marbles.over; f++) {
          marbles.step(DT);
          if (!put && marbles.state[0] === SWIRLING && marbles.bowlRadius(0) < bowl.hole * 2) {
            under();
            put = true;
          }
          expect(marbles.state[0] === FLYING && marbles.segment[0] === BOWL, `frame ${f}: fell on to it`).toBe(false);
        }
        // the bar is never taken away: the one under the hole sits until it is called stopped, and so, in the hole
        // over it, does the other
        expect(marbles.state[1]).toBe(STALLED);
        expect(marbles.state[0]).toBe(STALLED);
        expect(marbles.over).toBe(true);
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

  describe('at the end of the run', () => {
    it('lines the field up in the lane in the order it finished, at rest, nose to tail from the stop', () => {
      for (const seed of [1, 2, 3]) {
        const { marbles } = fieldOn(FIRST, seed);
        marbles.release();
        for (let f = 0; f < 120 * 60 && !marbles.over; f++) {
          marbles.step(DT);
          expect(checkMarbles(marbles), `seed ${seed} frame ${f}`).toEqual([]);
        }
        // and a while longer, for the last home to roll up to the back of the queue
        for (let f = 0; f < 10 * 60; f++) marbles.step(DT);
        expect(checkMarbles(marbles), `seed ${seed}, lined up`).toEqual([]);
        const end = marbles.track.segments.length - 1;
        const lane = marbles.track.segments[end];
        const inOrder = [...Array(marbles.count).keys()].sort((a, b) => marbles.place[a] - marbles.place[b]);
        inOrder.forEach((i, k) => {
          expect(marbles.state[i]).toBe(FINISHED);
          expect(marbles.segment[i], `seed ${seed}: place ${k + 1} in the lane`).toBe(end);
          expect(Math.abs(marbles.speed[i]), `seed ${seed}: place ${k + 1} at rest`).toBeLessThan(0.05);
          // the winner against the stop, and each after it against the one in front
          const should = lane.length - RADIUS - k * RADIUS * 2;
          expect(marbles.along[i], `seed ${seed}: place ${k + 1} where it should wait`).toBeCloseTo(should, 1);
        });
      }
    });

    it('places two that cross the line in the same frame by which crossed it first, not by who is asked first', () => {
      const run = chain(['start', 'straight', 'straight', 'finish']);
      const { marbles } = fieldOn(run, 1, 2);
      // the one asked first in a frame is the one on the lower slot; it is put behind
      const first = marbles.grid[0] === 0 ? 0 : 1,
        second = 1 - first;
      const before = marbles.track.segments[2];
      for (const i of [first, second]) {
        marbles.state[i] = RACING;
        marbles.segment[i] = 2;
        marbles.speed[i] = 10;
        marbles.drift[i] = 0;
      }
      marbles.along[first] = before.length - 0.1;
      marbles.along[second] = before.length - 0.05;
      marbles.across[first] = -0.6;
      marbles.across[second] = 0.6;
      marbles.step(DT);
      expect(marbles.place[second], 'the one further past the line').toBe(1);
      expect(marbles.place[first]).toBe(2);
    });
  });

  it('counts a marble pushed over the line as over it, placed and in the lane, never still racing past it', () => {
    const run = chain(['start', 'straight', 'straight', 'finish']);
    const { marbles } = fieldOn(run, 1, 2);
    const before = marbles.track.segments[2];
    // one just short of the line, and one right up inside it from behind, both still: parting them pushes the front one on
    for (const [i, along] of [
      [0, before.length - 0.05],
      [1, before.length - 0.45],
    ] as const) {
      marbles.state[i] = RACING;
      marbles.segment[i] = 2;
      marbles.along[i] = along;
      marbles.across[i] = 0;
      marbles.speed[i] = 0;
      marbles.drift[i] = 0;
    }
    marbles.step(DT);
    expect(checkMarbles(marbles)).toEqual([]);
    expect(marbles.state[0], 'over the line').toBe(FINISHED);
    expect(marbles.place[0]).toBe(1);
    expect(marbles.segment[0]).toBe(3);
  });

  describe('through a narrow section', () => {
    it('takes a whole field through in single file, none inside another and none held up for good', () => {
      for (const seed of [1, 2, 3, 4]) {
        const { marbles } = fieldOn(chain(['start', 'ramp', 'narrow', 'straight', 'finish']), seed);
        marbles.release();
        for (let f = 0; f < 60 * 60 && !marbles.over; f++) {
          marbles.step(DT);
          expect(checkMarbles(marbles), `seed ${seed} frame ${f}`).toEqual([]);
        }
        expect(marbles.over, `seed ${seed}`).toBe(true);
        expect(marbles.stalled + marbles.lost, `seed ${seed}: none stuck at the squeeze`).toBe(0);
      }
    });
  });

  describe('over a bumpy section', () => {
    const BUMPS = chain(['start', 'bumps', 'straight', 'finish']);

    it('turns a marble aside that rolls on to a mound off its middle', () => {
      const { marbles } = fieldOn(BUMPS, 1, 1);
      const seg = marbles.track.segments[1];
      const m = seg.mounds[0];
      marbles.state[0] = RACING;
      marbles.segment[0] = 1;
      marbles.along[0] = Math.max(0, m.along - m.radius - 0.5);
      marbles.across[0] = m.across + m.radius * 0.3;
      marbles.speed[0] = 3;
      marbles.drift[0] = 0;
      let furthest = 0;
      for (let f = 0; f < 3 * 60 && marbles.segment[0] === 1 && marbles.along[0] < m.along + m.radius; f++) {
        marbles.step(DT);
        furthest = Math.max(furthest, marbles.across[0] - (m.across + m.radius * 0.3));
      }
      expect(furthest, 'pushed away from the mound, to the side it was already on').toBeGreaterThan(0.2);
    });

    it('carries a marble up over a mound, and not through it', () => {
      const { marbles } = fieldOn(BUMPS, 1, 1);
      const seg = marbles.track.segments[1];
      const m = seg.mounds[0];
      marbles.state[0] = RACING;
      marbles.segment[0] = 1;
      marbles.along[0] = m.along;
      marbles.across[0] = m.across;
      marbles.speed[0] = 0;
      marbles.step(DT);
      const onTop = marbles.z[0];
      marbles.along[0] = m.along;
      marbles.across[0] = m.across + m.radius + 0.2;
      marbles.speed[0] = 0;
      marbles.step(DT);
      expect(onTop - marbles.z[0], 'higher on the mound than beside it').toBeGreaterThan(m.height * 0.7);
    });

    it('takes a whole field over the mounds and home, none held up and no rule broken', () => {
      for (const seed of [1, 2, 3]) {
        const { marbles } = fieldOn(BUMPS, seed);
        marbles.release();
        for (let f = 0; f < 60 * 60 && !marbles.over; f++) {
          marbles.step(DT);
          expect(checkMarbles(marbles), `seed ${seed} frame ${f}`).toEqual([]);
        }
        expect(marbles.over).toBe(true);
        expect(marbles.stalled + marbles.lost, `seed ${seed}`).toBe(0);
      }
    });
  });

  describe('never jumping', () => {
    /** First Drop with a gap two long at the join into its third piece, as a join laid wrong would leave. */
    function gapped(count = 1) {
      const { marbles } = field(1, count);
      const next = marbles.track.segments[2];
      for (let k = 0; k < next.points.length; k += 3) next.points[k] += 2;
      return marbles;
    }

    it('says when a marble moves further in a step than its speed and what pushed it explain', () => {
      const marbles = gapped();
      marbles.release();
      let said = '';
      for (let f = 0; f < 60 * 60 && !said && !marbles.over; f++) {
        marbles.step(DT);
        said = checkMarbles(marbles).join('\n');
      }
      // on to First Drop's third piece, where the gap is
      expect(said).toMatch(/marble 0 moved .* further in a step than .*, on to piece 2$/);
    });

    it('goes on saying so until the field is set on the gate again, however long after', () => {
      const marbles = gapped();
      marbles.release();
      for (let f = 0; f < 60 * 60 && !marbles.over; f++) marbles.step(DT);
      // the fuzzer asks after every tenth step, so a jump is held until it is asked about, not only the step it happens
      expect(checkMarbles(marbles).join('\n')).toMatch(/further in a step than/);
      marbles.reset();
      expect(checkMarbles(marbles)).toEqual([]);
    });

    it('counts what a marble was set to between steps as where it is, not as a jump', () => {
      const { marbles } = field(1, 1);
      marbles.release();
      for (let f = 0; f < 60; f++) marbles.step(DT);
      // put somewhere else by hand, as a test sets a scene or the test API's place does
      marbles.segment[0] = 3;
      marbles.along[0] = 1;
      for (let f = 0; f < 60; f++) marbles.step(DT);
      expect(checkMarbles(marbles)).toEqual([]);
    });

    it('takes pushes into account: a whole field squeezed through a gate and a wheel breaks no rule', () => {
      for (const kinds of [
        ['start', 'gate', 'finish'],
        ['start', 'wheel', 'finish'],
        ['start', 'pegs', 'sweeper', 'finish'],
      ] as const)
        for (let seed = 1; seed <= 6; seed++) {
          const { marbles } = fieldOn(chain([...kinds]), seed);
          marbles.release();
          for (let f = 0; f < 60 * 60 && !marbles.over; f++) marbles.step(DT);
          expect(checkMarbles(marbles), `${kinds.join(', ')}, seed ${seed}`).toEqual([]);
        }
    });
  });

  describe('on a splitter’s two branches', () => {
    /** A bare splitter, its two lanes starting at the same point along the run, closed by a joiner right after. */
    function forked(): Run {
      const start: Placed = { kind: 'start', x: 0, y: 0, z: 0, facing: 0 };
      const splitter: Placed = { kind: 'splitter', ...exitOf(start)! };
      const joiner: Placed = { kind: 'joiner', ...exitOf(splitter)! };
      const after: Placed = { kind: 'straight', ...exitOf(joiner)! };
      const finish: Placed = { kind: 'finish', ...exitOf(after)! };
      return { id: 'fork', name: 'fork', pieces: [start, splitter, joiner, after, finish] };
    }

    it('never jostles two marbles that only look close because the two branches overlap along the run', () => {
      const { marbles } = fieldOn(forked(), 1, 2);
      const track = marbles.track;
      const branches = [...new Set(track.segments.map((s) => s.branch))].filter((b) => b !== 0);
      expect(branches.length, 'a splitter makes two branches').toBe(2);
      const [segA, segB] = branches.map((b) => track.segments.findIndex((s) => s.branch === b));
      expect(track.segments[segA].start, "the two branches begin at the splitter's own point").toBe(
        track.segments[segB].start,
      );
      // along values close enough that `far` alone would read them as closing on each other head-on, which they
      // cannot really be doing: they are a lattice cell apart, on branches the splitter parted
      for (const [i, seg, along] of [
        [0, segA, 1],
        [1, segB, 1.3],
      ] as const) {
        marbles.state[i] = RACING;
        marbles.segment[i] = seg;
        marbles.along[i] = along;
        marbles.across[i] = 0;
        marbles.drift[i] = 0;
      }
      marbles.speed[0] = 5;
      marbles.speed[1] = -5;
      marbles.step(DT);
      expect(checkMarbles(marbles)).toEqual([]);
      // settle's speed exchange would have levelled the two out; parted branches must not be read as closing
      expect(
        marbles.speed[0],
        "the branch the marble is really on decides its speed, not the other one's",
      ).toBeGreaterThan(0);
      expect(marbles.speed[1]).toBeLessThan(0);
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
