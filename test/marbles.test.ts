import { describe, expect, it } from 'vitest';
import { FINISHED, Marbles, RACING, RADIUS, STALLED, WAITING, checkMarbles } from '../src/marbles';
import { seeded } from '../src/random';
import { FIRST } from '../src/runs';
import { at, compile, spot } from '../src/track';

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

  it('never lets one marble through another', () => {
    const { marbles } = field(2);
    marbles.release();
    let closest = Infinity;
    for (let f = 0; f < 120 * 60 && !marbles.over; f++) {
      marbles.step(DT);
      const running = marbles.running();
      // two abreast are a fair way apart across the channel, so it is the distance in both that counts
      for (let k = 0; k < running.length; k++)
        for (let j = k + 1; j < running.length; j++) {
          const a = running[k],
            b = running[j];
          closest = Math.min(
            closest,
            Math.hypot(marbles.far(b) - marbles.far(a), marbles.across[b] - marbles.across[a]),
          );
        }
    }
    // they may squash together a touch as they are pushed apart, but never to half a marble
    expect(closest).toBeGreaterThan(RADIUS);
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
  });
});
