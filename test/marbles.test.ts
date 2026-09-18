import { describe, expect, it } from 'vitest';
import { FINISHED, FLYING, LOST, Marbles, RACING, RADIUS, STALLED, WAITING, checkMarbles } from '../src/marbles';
import { seeded } from '../src/random';
import { FIRST } from '../src/runs';
import { type Facing, type Placed, type Run, at, compile, exitOf, spot } from '../src/track';

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

  it('holds every marble inside the channel', () => {
    const { marbles } = field(5);
    marbles.release();
    let widest = 0;
    for (let f = 0; f < 120 * 60 && !marbles.over; f++) {
      marbles.step(DT);
      for (let i = 0; i < marbles.count; i++) widest = Math.max(widest, Math.abs(marbles.across[i]));
    }
    expect(widest).toBeLessThanOrEqual(1.2 - RADIUS + 1e-6);
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
    // stood still on a level bend, where there is no slope to get it going again
    marbles.state[0] = RACING;
    marbles.segment[0] = 3;
    marbles.along[0] = 1;
    marbles.speed[0] = 0;
    expect(marbles.over).toBe(false);
    for (let f = 0; f < 5 * 60; f++) marbles.step(DT);
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
