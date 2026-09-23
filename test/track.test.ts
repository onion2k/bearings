import { describe, expect, it } from 'vitest';
import { MARBLES, RADIUS } from '../src/marbles';
import { FIRST } from '../src/runs';
import { PHYSICAL } from '../src/physics';
import {
  BRAKE_SWING,
  BRAKE_WAVE,
  CELL,
  HALF_WIDTH,
  LANE,
  LEVEL,
  MAX_SAMPLES,
  MOVING_MOST,
  NARROW,
  SPIRAL_WALL,
  type Facing,
  type Placed,
  type Run,
  at,
  check,
  checkTrack,
  compile,
  exitOf,
  pose,
  pose0,
  bowlHeight,
  moundHeight,
  spot,
} from '../src/track';

/** A run of pieces laid end to end from the start, each following the one before. */
function chain(kinds: Placed['kind'][], from = { x: 0, y: 0, z: 0, facing: 0 as Facing }): Run {
  const pieces: Placed[] = [];
  let here = from;
  for (const kind of kinds) {
    const piece: Placed = { kind, ...here };
    pieces.push(piece);
    const out = exitOf(piece);
    if (out) here = out;
  }
  return { id: 'made-up', name: 'made up', pieces };
}

/** The angle between two unit vectors, for asking whether a join has a kink in it. */
function angle(a: number[], b: number[]): number {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return Math.acos(dot);
}

describe('the track', () => {
  it('works a run out into a chain of segments, one to a piece', () => {
    const track = compile(FIRST);
    expect(track.segments.length).toBe(FIRST.pieces.length);
    for (let i = 0; i < track.segments.length - 1; i++) expect(track.segments[i].next).toBe(i + 1);
    expect(track.segments[track.segments.length - 1].next, 'the run ends at the cup').toBe(-1);
  });

  it('joins its segments without a gap or a kink', () => {
    const track = compile(FIRST);
    for (const seg of track.segments) {
      if (seg.next < 0) continue;
      const to = track.segments[seg.next];
      const last = seg.points.length - 3;
      const gap = Math.hypot(
        seg.points[last] - to.points[0],
        seg.points[last + 1] - to.points[1],
        seg.points[last + 2] - to.points[2],
      );
      expect(gap, `piece ${seg.piece} to ${to.piece}`).toBeLessThan(1e-6);
      const out = [seg.tangents[last], seg.tangents[last + 1], seg.tangents[last + 2]];
      const into = [to.tangents[0], to.tangents[1], to.tangents[2]];
      expect(angle(out, into), `piece ${seg.piece} to ${to.piece}`).toBeLessThan(1e-3);
    }
  });

  it('measures how far along each sample is, and how long the whole run is', () => {
    const track = compile(FIRST);
    let total = 0;
    for (const seg of track.segments) {
      expect(seg.arc[0]).toBe(0);
      for (let i = 1; i < seg.arc.length; i++) expect(seg.arc[i]).toBeGreaterThan(seg.arc[i - 1]);
      expect(seg.arc[seg.arc.length - 1]).toBeCloseTo(seg.length, 6);
      expect(seg.length).toBeGreaterThan(0);
      total += seg.length;
    }
    expect(track.length).toBeCloseTo(total, 6);
  });

  it('reads a spot anywhere along a segment, and its ends are its joins', () => {
    const track = compile(FIRST);
    const out = spot();
    for (const seg of track.segments) {
      at(track, track.segments.indexOf(seg), 0, out);
      expect(out.x).toBeCloseTo(seg.points[0], 6);
      expect(out.y).toBeCloseTo(seg.points[1], 6);
      expect(out.z).toBeCloseTo(seg.points[2], 6);
      at(track, track.segments.indexOf(seg), seg.length, out);
      const last = seg.points.length - 3;
      expect(out.x).toBeCloseTo(seg.points[last], 6);
      expect(out.y).toBeCloseTo(seg.points[last + 1], 6);
      expect(out.z).toBeCloseTo(seg.points[last + 2], 6);
    }
    // the middle of the first segment is a unit vector's worth of direction, and up is up
    at(track, 0, track.segments[0].length / 2, out);
    expect(Math.hypot(out.tx, out.ty, out.tz)).toBeCloseTo(1, 6);
    expect(Math.hypot(out.ux, out.uy, out.uz)).toBeCloseTo(1, 6);
  });

  it('says it is going the way its points actually go', () => {
    const track = compile(FIRST);
    for (const seg of track.segments) {
      for (let i = 0; i < seg.arc.length - 1; i++) {
        const a = i * 3,
          b = a + 3;
        const dx = seg.points[b] - seg.points[a],
          dy = seg.points[b + 1] - seg.points[a + 1],
          dz = seg.points[b + 2] - seg.points[a + 2];
        const d = Math.hypot(dx, dy, dz);
        // the two ends' directions average out to the way the line between them runs, near enough
        const mx = (seg.tangents[a] + seg.tangents[b]) / 2,
          my = (seg.tangents[a + 1] + seg.tangents[b + 1]) / 2,
          mz = (seg.tangents[a + 2] + seg.tangents[b + 2]) / 2;
        const m = Math.hypot(mx, my, mz);
        expect(angle([dx / d, dy / d, dz / d], [mx / m, my / m, mz / m]), `piece ${seg.piece} at ${i}`).toBeLessThan(
          5e-3,
        );
      }
    }
  });

  it('holds up square to the way it is going', () => {
    const track = compile(FIRST);
    for (const seg of track.segments) {
      for (let i = 0; i < seg.arc.length; i++) {
        const o = i * 3;
        const dot =
          seg.tangents[o] * seg.ups[o] + seg.tangents[o + 1] * seg.ups[o + 1] + seg.tangents[o + 2] * seg.ups[o + 2];
        expect(Math.abs(dot), `piece ${seg.piece} at ${i}`).toBeLessThan(1e-5);
      }
    }
  });

  it('finds nothing wrong with the run it comes with', () => {
    const track = compile(FIRST);
    expect(check(FIRST)).toEqual([]);
    expect(checkTrack(track)).toEqual([]);
  });

  describe('says what is wrong with a run', () => {
    it('a piece that joins nothing', () => {
      const run = chain(['start', 'ramp', 'finish']);
      run.pieces[2] = { ...run.pieces[2], x: run.pieces[2].x + 3 };
      expect(check(run).join('\n')).toMatch(/joins nothing/);
    });

    it('two pieces in the same place', () => {
      const run = chain(['start', 'straight', 'finish']);
      run.pieces.push({ kind: 'straight', x: 0, y: 0, z: 0, facing: 0 });
      expect(check(run).join('\n')).toMatch(/same place/);
    });

    it('no start', () => {
      expect(check(chain(['straight', 'finish'])).join('\n')).toMatch(/no start/);
    });

    it('no finish', () => {
      expect(check(chain(['start', 'straight'])).join('\n')).toMatch(/no finish/);
    });

    it('more moving parts of a kind than the scene has room to draw', () => {
      const run = chain(['start', ...Array<'gate'>(MOVING_MOST + 1).fill('gate'), 'finish']);
      expect(check(run).join('\n')).toMatch(new RegExp(`may have ${MOVING_MOST} gates`));
      const fits = chain(['start', ...Array<'gate'>(MOVING_MOST).fill('gate'), 'finish']);
      expect(check(fits)).toEqual([]);
    });

    it('a run that never ends', () => {
      const run = chain(['start', 'curveLeft', 'curveLeft', 'curveLeft', 'curveLeft']);
      expect(check(run).join('\n')).toMatch(/never ends/);
    });
  });

  it('works the same run out the same way twice, to the last bit', () => {
    const one = compile(FIRST),
      two = compile(FIRST);
    expect(one.length).toBe(two.length);
    expect(one.samples).toBe(two.samples);
    for (let i = 0; i < one.segments.length; i++) {
      expect([...one.segments[i].points]).toEqual([...two.segments[i].points]);
      expect([...one.segments[i].tangents]).toEqual([...two.segments[i].tangents]);
      expect([...one.segments[i].ups]).toEqual([...two.segments[i].ups]);
      expect([...one.segments[i].arc]).toEqual([...two.segments[i].arc]);
    }
  });

  describe('turns by whole numbers', () => {
    it('four turns the same way come back to where they started', () => {
      let here = { x: 0, y: 0, z: 0, facing: 0 as Facing };
      for (let i = 0; i < 4; i++) here = exitOf({ kind: 'curveLeft', ...here })!;
      expect(here).toEqual({ x: 0, y: 0, z: 0, facing: 0 });
    });

    it('a turn each way leaves a marble going the way it was', () => {
      const left = exitOf({ kind: 'curveLeft', x: 0, y: 0, z: 0, facing: 0 })!;
      const back = exitOf({ kind: 'curveRight', ...left })!;
      expect(back).toEqual({ x: 2, y: 2, z: 0, facing: 0 });
    });

    it('a ramp goes one along and one down, whichever way it faces', () => {
      expect(exitOf({ kind: 'ramp', x: 0, y: 0, z: 0, facing: 1 })).toEqual({ x: 0, y: 1, z: -1, facing: 1 });
      expect(exitOf({ kind: 'ramp', x: 0, y: 0, z: 0, facing: 2 })).toEqual({ x: -1, y: 0, z: -1, facing: 2 });
    });

    it('the cup a marble stops in has no way out', () => {
      expect(exitOf({ kind: 'finish', x: 0, y: 0, z: 0, facing: 0 })).toBe(null);
    });
  });

  describe('the pieces that fall, turn round and leap', () => {
    const run = chain(['start', 'drop', 'spiralLeft', 'spiralRight', 'jump', 'straight', 'finish']);

    it('hands a marble on where the lattice says', () => {
      expect(exitOf({ kind: 'drop', x: 0, y: 0, z: 0, facing: 1 })).toEqual({ x: 0, y: 1, z: -2, facing: 1 });
      // a spiral goes right round, so it comes out where it went in, two levels down and going the same way
      for (const kind of ['spiralLeft', 'spiralRight'] as const)
        expect(exitOf({ kind, x: 3, y: -2, z: 0, facing: 2 }), kind).toEqual({ x: 3, y: -2, z: -2, facing: 2 });
      // a jump carries its own landing: its felt and lip, a cell of air, and the board it comes down on, five
      // cells along and three levels down in all
      expect(exitOf({ kind: 'jump', x: 0, y: 0, z: 0, facing: 3 })).toEqual({ x: 0, y: -5, z: -3, facing: 3 });
    });

    it('works a run of them out clean', () => {
      expect(check(run)).toEqual([]);
      const track = compile(run);
      // one segment to a piece, but a jump's landing is a second part of it
      expect(track.segments.length).toBe(run.pieces.length + 1);
      expect(track.segments.filter((s) => s.piece === 4).length).toBe(2);
      expect(checkTrack(track)).toEqual([]);
    });

    it('joins without a gap or a kink everywhere but off the lip of a jump', () => {
      const track = compile(run);
      for (const seg of track.segments) {
        if (seg.next < 0) continue;
        const to = track.segments[seg.next];
        const last = seg.points.length - 3;
        const gap = Math.hypot(
          seg.points[last] - to.points[0],
          seg.points[last + 1] - to.points[1],
          seg.points[last + 2] - to.points[2],
        );
        if (seg.flies) {
          expect(run.pieces[seg.piece].kind).toBe('jump');
          expect(to.piece, 'and it comes down on its own landing').toBe(seg.piece);
          expect(gap, 'there is air between the lip and the landing').toBeGreaterThan(3);
          continue;
        }
        expect(seg.flies).toBe(false);
        expect(gap, `piece ${seg.piece} to ${to.piece}`).toBeLessThan(1e-6);
        const out = [seg.tangents[last], seg.tangents[last + 1], seg.tangents[last + 2]];
        const into = [to.tangents[0], to.tangents[1], to.tangents[2]];
        expect(angle(out, into), `piece ${seg.piece} to ${to.piece}`).toBeLessThan(1e-3);
      }
    });

    it('counts the air after a jump into how far along the run the landing is', () => {
      const track = compile(run);
      const jump = track.segments.findIndex((s) => s.flies);
      const landing = track.segments[track.segments[jump].next];
      expect(track.segments[jump].gap).toBeGreaterThan(0);
      expect(landing.start).toBeCloseTo(
        track.segments[jump].start + track.segments[jump].length + track.segments[jump].gap,
        4,
      );
    });

    it('turns a spiral right round, one way or the other', () => {
      const track = compile(run);
      for (const [index, side] of [
        [2, 1],
        [3, -1],
      ] as const) {
        const seg = track.segments[index];
        let turned = 0;
        for (let i = 1; i < seg.arc.length; i++) {
          const a = Math.atan2(seg.tangents[(i - 1) * 3 + 1], seg.tangents[(i - 1) * 3]);
          const b = Math.atan2(seg.tangents[i * 3 + 1], seg.tangents[i * 3]);
          turned += Math.atan2(Math.sin(b - a), Math.cos(b - a));
        }
        expect(turned, `piece ${index}`).toBeCloseTo(side * Math.PI * 2, 2);
      }
    });

    it('falls harder on a drop than on a ramp', () => {
      const steepest = (kind: 'ramp' | 'drop') => {
        const seg = compile(chain(['start', kind, 'finish'])).segments[1];
        let most = 0;
        for (let i = 0; i < seg.arc.length; i++) most = Math.max(most, -seg.tangents[i * 3 + 2]);
        return most;
      };
      expect(steepest('drop')).toBeGreaterThan(steepest('ramp') + 0.1);
    });

    it('throws a marble up off the lip of a jump', () => {
      const seg = compile(run).segments[4];
      expect(seg.tangents[seg.tangents.length - 1], 'the last of it rises').toBeGreaterThan(0.2);
    });
  });

  describe('the pieces that break a field up', () => {
    const run = chain(['start', 'pegs', 'sweeper', 'gate', 'wheel', 'funnel', 'straight', 'finish']);
    const track = compile(run);
    const MARBLE = 0.9;

    it('hands a marble on where the lattice says', () => {
      for (const kind of ['pegs', 'sweeper'] as const)
        expect(exitOf({ kind, x: 0, y: 0, z: 0, facing: 0 }), kind).toEqual({ x: 2, y: 0, z: -1, facing: 0 });
      for (const kind of ['gate', 'wheel'] as const)
        expect(exitOf({ kind, x: 0, y: 0, z: 0, facing: 1 }), kind).toEqual({ x: 0, y: 1, z: -1, facing: 1 });
      // a funnel runs in a cell and over its bowl a level down, and lets them out through the bowl's middle and down
      // the ramp under it, a cell beyond the middle and a level below, going the way they came in
      expect(exitOf({ kind: 'funnel', x: 0, y: 0, z: 0, facing: 0 })).toEqual({ x: 2, y: 1, z: -3, facing: 0 });
    });

    it("works out clean, with the chute's own width wherever it meets another piece", () => {
      expect(check(run)).toEqual([]);
      expect(checkTrack(track)).toEqual([]);
      for (const seg of track.segments) {
        expect(seg.width[0], `piece ${seg.piece} going in`).toBeCloseTo(HALF_WIDTH, 6);
        // a bowl lets a marble out through its middle, and the end of the run meets nothing at its far end
        if (!seg.funnel && seg.next !== -1)
          expect(seg.width[seg.width.length - 1], `piece ${seg.piece} going out`).toBeCloseTo(HALF_WIDTH, 6);
      }
    });

    it('widens a peg board and a sweeper into a board, and keeps a chute a chute', () => {
      const widest = (s: number) => Math.max(...track.segments[s].width);
      expect(widest(1), 'the peg board').toBeGreaterThan(HALF_WIDTH * 2.5);
      expect(widest(2), 'the sweeper').toBeGreaterThan(HALF_WIDTH * 2);
      expect(widest(0), 'the start').toBeCloseTo(HALF_WIDTH, 6);
    });

    it('puts every peg on the board, clear of its walls, with room between them for a marble', () => {
      const seg = track.segments[1];
      const pegs = seg.obstacles;
      expect(pegs.length).toBeGreaterThan(10);
      const at = pose0();
      for (const peg of pegs) {
        expect(peg.motion.kind).toBe('fixed');
        pose(peg, 0, 0, at);
        const k = Math.round((peg.along / seg.length) * (seg.width.length - 1));
        expect(Math.abs(at.across) + peg.radius + MARBLE, 'room between a peg and the wall').toBeLessThanOrEqual(
          seg.width[k],
        );
      }
      for (let a = 0; a < pegs.length; a++)
        for (let b = a + 1; b < pegs.length; b++) {
          const gap =
            Math.hypot(pegs[a].along - pegs[b].along, pegs[a].across - pegs[b].across) -
            pegs[a].radius -
            pegs[b].radius;
          expect(gap, 'room between two pegs').toBeGreaterThan(MARBLE);
        }
    });

    it('moves a sweeper across and back, a gate open and shut, and a wheel round, with time', () => {
      const out = pose0();
      const sweeper = track.segments[2].obstacles.find((o) => o.motion.kind === 'sweep')!;
      const across = [0, 0.25, 0.5, 0.75].map(
        (f) => pose(sweeper, f * (sweeper.motion as { period: number }).period, 0, out).across,
      );
      expect(Math.max(...across) - Math.min(...across), 'it sweeps a good way across').toBeGreaterThan(3);
      const gate = track.segments[3].obstacles.find((o) => o.motion.kind === 'gate')!;
      const period = (gate.motion as { period: number }).period;
      const there = Array.from({ length: 80 }, (_, k) => pose(gate, (k / 40) * period, 0, out).present);
      expect(there.includes(true) && there.includes(false), 'shut some of the time and open the rest').toBe(true);
      // open aside toward one wall on one turn, and the other on the next
      // half way through the time it stands open, when it is right out of the pen
      const shut = (gate.motion as { shut: number }).shut;
      const aside = (turn: number) => pose(gate, turn * period + (shut + period) / 2, 0, { ...out }).across;
      expect(Math.sign(aside(0))).toBe(-Math.sign(aside(1)));
      expect(Math.abs(aside(0)), 'right out of the way').toBeGreaterThan(gate.half * 1.9);
      const paddles = track.segments[4].obstacles.filter((o) => o.motion.kind === 'paddle');
      expect(paddles.length).toBeGreaterThanOrEqual(3);
      // at any moment at least one paddle is down in the chute, moving on the way the marbles go
      for (let k = 0; k < 20; k++) {
        const t = k * 0.13;
        const down = paddles.map((o) => pose(o, t, 0, { ...out })).filter((p) => p.present);
        expect(down.length, `at ${t.toFixed(2)} s`).toBeGreaterThan(0);
        for (const p of down) expect(p.va).toBeGreaterThan(0);
      }
    });

    it('is met, as it comes down, as the arm that is drawn: the rod from its axle, tip and all', () => {
      const paddle = track.segments[4].obstacles.find((o) => o.motion.kind === 'paddle')!;
      const m = paddle.motion as { period: number; axle: number; arm: number; turn: number };
      const ball = RADIUS;
      const out = pose0();
      // the arm worked out the long way round, from where it hangs: how far a marble's middle, sitting `a` along
      // the chute at the height of the middles, is from the rod between the axle and the tip
      const away = (theta: number, a: number) => {
        const tip = [Math.sin(theta) * m.arm, m.axle - Math.cos(theta) * m.arm];
        const along = tip[0],
          up = tip[1] - m.axle;
        const len = Math.hypot(along, up);
        const s = Math.min(Math.max(((a - 0) * along + (0 - m.axle) * up) / (len * len), 0), 1);
        return Math.hypot(a - s * along, 0 - (m.axle + s * up));
      };
      let seen = 0;
      for (let k = 0; k < 60; k++) {
        const t = (k / 60) * m.period;
        pose(paddle, t, 0, out, ball);
        const theta = Math.PI * 2 * ((((t / m.period + m.turn) % 1) + 1) % 1) - Math.PI;
        // where the arm is solid at a marble's height, as the pose has it, against where a marble really touches it
        for (let n = -40; n <= 40; n++) {
          const a = paddle.along + n * 0.05;
          const touches = away(theta, a - paddle.along) < paddle.radius + ball;
          const inPose = out.present && Math.abs(a - out.along) < out.radius + ball;
          expect(inPose, `at ${t.toFixed(2)} s, ${(a - paddle.along).toFixed(2)} from the axle`).toBe(touches);
          if (touches) seen++;
        }
      }
      expect(seen, 'and it is down some of the time, or this proves nothing').toBeGreaterThan(100);
    });

    it('keeps time for each moving piece apart, so a race can start them anywhere in their turn', () => {
      const out = pose0();
      const sweeper = track.segments[2].obstacles.find((o) => o.motion.kind === 'sweep')!;
      expect(sweeper.slot).toBeGreaterThanOrEqual(0);
      expect(pose(sweeper, 0, 0, out).across).not.toBeCloseTo(pose(sweeper, 0, 0.25, { ...out }).across, 2);
      const pegs = track.segments[1].obstacles;
      for (const peg of pegs) expect(peg.slot, 'a peg keeps no time').toBe(-1);
      const paddles = track.segments[4].obstacles.filter((o) => o.motion.kind === 'paddle');
      expect(new Set(paddles.map((o) => o.slot)).size, 'a wheel turns as one').toBe(1);
      expect(track.slots).toBeGreaterThanOrEqual(3);
    });

    it('gives a funnel a bowl a level below where it is entered, a run in that ends over it, and the way out below', () => {
      const seg = track.segments.find((s) => s.funnel)!;
      const bowl = seg.funnel!;
      const runIn = track.segments[track.segments.indexOf(seg) - 1];
      expect(runIn.piece, 'the run in is the funnel too').toBe(seg.piece);
      expect(bowl.z, 'a level below where the piece is entered').toBeCloseTo(runIn.points[2] - LEVEL, 4);
      expect(bowl).toBeTruthy();
      expect(bowl.hole).toBeGreaterThan(MARBLE / 2);
      expect(bowl.rim).toBeGreaterThan(bowl.hole * 3);
      // the run in ends at a lip over the bowl, wall to wall inside its rim and clear of its hole, so that whatever
      // comes off it drops into the bowl: ended on the rim, half of it was outside the bowl
      expect(runIn.flies, 'the run in ends at a lip').toBe(true);
      const lip = runIn.points.length - 3;
      const r = Math.hypot(runIn.points[lip] - bowl.x, runIn.points[lip + 1] - bowl.y);
      expect(r + HALF_WIDTH, 'the lip is inside the rim').toBeLessThan(bowl.rim);
      expect(r - HALF_WIDTH, 'and outside the hole').toBeGreaterThan(bowl.hole);
      // under the hole, the funnel's own way out: from behind the hole, under it, and down a level to hand on a cell
      // beyond it. The piece after alone, begun under the hole's middle, left the back half of the hole over nothing;
      // and a floor that had to be level there to meet it left each marble that fell creeping off it
      const out = track.segments[seg.next];
      expect(out.piece, 'the way out is the funnel too').toBe(seg.piece);
      expect(Math.hypot(out.points[0] - bowl.x, out.points[1] - bowl.y), 'it begins behind the hole').toBeGreaterThan(
        bowl.hole,
      );
      const end = out.points.length - 3;
      expect(Math.hypot(out.points[end] - bowl.x, out.points[end + 1] - bowl.y), 'a cell beyond it').toBeCloseTo(
        CELL,
        4,
      );
      expect(out.points[end + 2], 'and a level down').toBeCloseTo(out.points[2] - LEVEL, 4);
      let under = 0;
      for (let k = 0; k < out.arc.length; k++) {
        const o = k * 3;
        if (Math.hypot(out.points[o] - bowl.x, out.points[o + 1] - bowl.y) > bowl.hole) continue;
        under++;
        // below the throat by more than a marble anywhere under the hole, so a marble rolls out from under it
        expect(bowl.z - bowl.depth - bowl.throat - out.points[o + 2], `sample ${k}`).toBeGreaterThan(RADIUS * 2);
        // and falling away, so one come down is carried off clear of the next to fall
        expect(out.tangents[o + 2], `sample ${k}`).toBeLessThan(-0.05);
      }
      expect(under, 'some of it is under the hole').toBeGreaterThan(2);
      // how far down the bowl is at its rim and at its hole, and that it only ever goes down toward the middle
      expect(bowlHeight(bowl, bowl.rim)).toBeCloseTo(0, 6);
      expect(bowlHeight(bowl, bowl.hole)).toBeCloseTo(-bowl.depth, 6);
      for (let r = bowl.hole; r < bowl.rim; r += 0.25)
        expect(bowlHeight(bowl, r + 0.25)).toBeGreaterThan(bowlHeight(bowl, r));
    });

    it('stands the run in to a funnel clear above anything going round the bowl under it', () => {
      const seg = track.segments.find((s) => s.funnel)!;
      const bowl = seg.funnel!;
      const runIn = track.segments[track.segments.indexOf(seg) - 1];
      // a marble going round under the run in, and the run in's own floor under where it rolls, with room to spare:
      // the rim's wall is lower than a marble, so a run in clear of a marble at the rim is clear of the wall too
      const room = RADIUS * 2 + 0.3;
      let over = 0;
      for (let k = 0; k < runIn.arc.length; k++) {
        const o = k * 3;
        // across the run in, wall to wall and a skin beyond, to the right of the way it goes
        const tx = runIn.tangents[o],
          ty = runIn.tangents[o + 1];
        const tl = Math.hypot(tx, ty);
        for (let c = -1; c <= 1; c += 0.25) {
          const across = c * (HALF_WIDTH + 0.2);
          const x = runIn.points[o] + (ty / tl) * across,
            y = runIn.points[o + 1] - (tx / tl) * across;
          const r = Math.hypot(x - bowl.x, y - bowl.y);
          if (r > bowl.rim + 0.2) continue;
          over++;
          const under = bowl.z + bowlHeight(bowl, Math.min(r, bowl.rim));
          expect(runIn.points[o + 2] - under, `sample ${k}, ${across.toFixed(2)} across`).toBeGreaterThan(room);
        }
      }
      expect(over, 'some of the run in is over the bowl').toBeGreaterThan(0);
    });
  });

  describe('the pieces for going gently, squeezing and jostling, and the end', () => {
    const run = chain(['start', 'shallow', 'shallowWide', 'shallowBroad', 'narrow', 'bumps', 'finish']);
    const track = compile(run);
    const widest = (s: number) => Math.max(...track.segments[s].width);
    const narrowest = (s: number) => Math.min(...track.segments[s].width);

    it('hands a marble on where the lattice says: two cells along and a level down', () => {
      for (const kind of ['shallow', 'shallowWide', 'shallowBroad', 'narrow', 'bumps'] as const)
        expect(exitOf({ kind, x: 0, y: 0, z: 0, facing: 0 }), kind).toEqual({ x: 2, y: 0, z: -1, facing: 0 });
      expect(exitOf({ kind: 'finish', x: 0, y: 0, z: 0, facing: 0 }), 'the end goes nowhere').toBeNull();
    });

    it("works out clean, at a chute's width wherever one piece meets another", () => {
      expect(check(run)).toEqual([]);
      expect(checkTrack(track)).toEqual([]);
      for (const seg of track.segments) expect(seg.width[0], `piece ${seg.piece} going in`).toBeCloseTo(HALF_WIDTH, 6);
    });

    it('comes in three widths of shallow straight: a chute, twice a chute and three times', () => {
      expect(widest(1)).toBeCloseTo(HALF_WIDTH, 6);
      expect(widest(2)).toBeCloseTo(HALF_WIDTH * 2, 6);
      expect(widest(3)).toBeCloseTo(HALF_WIDTH * 3, 6);
      for (const s of [1, 2, 3]) expect(narrowest(s), 'and never narrower than a chute').toBeCloseTo(HALF_WIDTH, 6);
    });

    it('squeezes a narrow section down to single file, where two cannot pass', () => {
      expect(narrowest(4)).toBeCloseTo(NARROW, 6);
      expect((NARROW - RADIUS) * 2, 'room across for a marble to be beside another').toBeLessThan(RADIUS * 2);
      expect(NARROW, 'and still room for one').toBeGreaterThan(RADIUS);
    });

    it('scatters mounds over a bumpy section, on the floor and clear of its walls', () => {
      const seg = track.segments[5];
      expect(seg.mounds.length).toBeGreaterThan(5);
      for (const m of seg.mounds) {
        const k = Math.round((m.along / seg.length) * (seg.width.length - 1));
        expect(Math.abs(m.across) + m.radius, 'inside the walls').toBeLessThanOrEqual(seg.width[k] + 1e-6);
        expect(m.height, 'low enough to roll over').toBeLessThan(RADIUS);
      }
      for (const other of track.segments) if (other !== seg) expect(other.mounds.length).toBe(0);
    });

    it('rises over a mound and nowhere else: its height at its middle, and nothing beyond it', () => {
      const seg = track.segments[5];
      const m = seg.mounds[0];
      expect(moundHeight(seg, m.along, m.across)).toBeCloseTo(m.height, 6);
      expect(moundHeight(seg, m.along, m.across + m.radius + 0.01)).toBe(0);
      expect(moundHeight(track.segments[1], 1, 0)).toBe(0);
    });

    it('ends in a lane one marble wide, long enough for the whole field to wait in nose to tail', () => {
      const end = track.segments[6];
      expect(end.next).toBe(-1);
      expect(end.width[end.width.length - 1]).toBeCloseTo(LANE, 6);
      expect((LANE - RADIUS) * 2, 'single file').toBeLessThan(RADIUS * 2);
      const lane = end.arc.filter((_, k) => end.width[k] <= LANE + 1e-6);
      expect(lane[lane.length - 1] - lane[0], 'room for eight').toBeGreaterThan(RADIUS * 2 * MARBLES);
    });

    it('says two parts of a run that run through each other are wrong with it', () => {
      // a funnel after a left turn once had its bowl lying on the turn's own arc; a level down, it is clear
      expect(check(chain(['start', 'curveLeft', 'funnel', 'straight', 'finish']))).toEqual([]);
      // three turns to the left after a peg board bring the end of the run back round across the board
      const crossing = chain(['start', 'straight', 'pegs', 'curveLeft', 'curveLeft', 'curveLeft', 'finish']);
      expect(check(crossing).join('\n')).toMatch(/run through each other/);
    });

    it('says a piece narrower than single file is wrong with a run', () => {
      const bad = compile(run);
      bad.segments[4].width[10] = RADIUS * 0.9;
      expect(checkTrack(bad).join('\n')).toMatch(/narrower than single file/);
    });
  });

  it('keeps what it makes within its ceiling', () => {
    const track = compile(FIRST);
    expect(track.samples).toBeGreaterThan(0);
    expect(track.samples).toBeLessThan(MAX_SAMPLES);
    let counted = 0;
    for (const seg of track.segments) counted += seg.arc.length;
    expect(counted).toBe(track.samples);
  });

  describe('the brake, and what physics asks of a shape', () => {
    it('the brake hands on two cells along and a level down, at a chute’s width the whole way, snaking between', () => {
      expect(exitOf({ kind: 'brake', x: 0, y: 0, z: 0, facing: 0 })).toEqual({ x: 2, y: 0, z: -1, facing: 0 });
      const run = chain(['start', 'brake', 'straight', 'finish']);
      expect(check(run)).toEqual([]);
      const track = compile(run);
      expect(checkTrack(track)).toEqual([]);
      const seg = track.segments[1];
      let swung = 0;
      for (let i = 0; i < seg.arc.length; i++) {
        expect(seg.width[i]).toBeCloseTo(HALF_WIDTH, 6);
        swung = Math.max(swung, Math.abs(seg.points[i * 3 + 1]));
      }
      expect(swung, 'it swings as far as it says').toBeGreaterThan(BRAKE_SWING * 0.9);
      expect(swung).toBeLessThanOrEqual(BRAKE_SWING + 1e-6);
      // and its inner wall never folds back through itself: the swing's own radius of turn stays well past the
      // half width, or the wall on the inside of a swing would have less than no room
      const radius = 1 / (BRAKE_SWING * ((Math.PI * 2) / BRAKE_WAVE) ** 2);
      expect(radius).toBeGreaterThan(HALF_WIDTH * 2);
    });

    it('compiled for physics, the drop is under a lid the whole way, a spiral is walled higher, and the narrow is a groove', () => {
      const run = chain(['start', 'drop', 'spiralLeft', 'narrow', 'straight', 'finish']);
      const physics = compile(run, PHYSICAL);
      const plain = compile(run);
      const drop = physics.segments[1];
      expect(drop.lid).toEqual({ from: 0, upto: drop.length });
      expect(physics.segments[2].wall).toBe(SPIRAL_WALL);
      expect(physics.segments[3].trough).toBe(true);
      for (const w of physics.segments[3].width) expect(w).toBeCloseTo(HALF_WIDTH, 6);
      for (const s of [0, 1, 3, 4, 5]) expect(physics.segments[s].wall, `segment ${s}`).toBe(physics.wall);
      // and none of it for the solver, whose marbles stay on the floor by rule and squeeze through the narrow
      for (const seg of plain.segments) {
        expect(seg.lid).toBeNull();
        expect(seg.wall).toBe(plain.wall);
      }
      expect(plain.segments[3].trough).toBe(false);
      expect(Math.min(...plain.segments[3].width)).toBeCloseTo(NARROW, 6);
    });

    it('a lid over part of a piece covers that share of its length', () => {
      const track = compile(chain(['start', 'straight', 'finish']), {
        shapes: { straight: { lid: { from: 0.25, upto: 0.5 } } },
      });
      const seg = track.segments[1];
      expect(seg.lid).toEqual({ from: seg.length * 0.25, upto: seg.length * 0.5 });
    });
  });

  describe('a splitter and a joiner', () => {
    /** A bare splitter, its two lanes starting at the same point, closed by a joiner right after. */
    function forked(): Run {
      const start: Placed = { kind: 'start', x: 0, y: 0, z: 0, facing: 0 };
      const splitter: Placed = { kind: 'splitter', ...exitOf(start)! };
      const joiner: Placed = { kind: 'joiner', ...exitOf(splitter)! };
      const after: Placed = { kind: 'straight', ...exitOf(joiner)! };
      const finish: Placed = { kind: 'finish', ...exitOf(after)! };
      return { id: 'fork', name: 'fork', pieces: [start, splitter, joiner, after, finish] };
    }

    it('keeps both lanes at a chute width the whole way, the same as every other kind', () => {
      const track = compile(forked());
      const branches = [...new Set(track.segments.map((s) => s.branch))].filter((b) => b !== 0);
      expect(branches.length).toBe(2);
      for (const br of branches) {
        const seg = track.segments.find((s) => s.branch === br)!;
        for (const w of seg.width) expect(w).toBeCloseTo(HALF_WIDTH, 5);
      }
      expect(checkTrack(track)).toEqual([]);
    });
  });
});
