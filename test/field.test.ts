/** What a quarter of the split screen says about the marble it follows. */
import { describe, expect, it } from 'vitest';
import { PATTERN_STRIDE } from 'artshape-render/game/renderer';
import { FIELD, captionOf, nameOf, swatchOf } from '../src/field';
import { MARBLES, RADIUS } from '../src/race';
import { Scene } from '../src/scene';

describe('the caption of a followed marble', () => {
  it('is its name, and the player who picked it first where somebody did', () => {
    expect(captionOf(4, 0)).toBe('Cobalt');
    expect(captionOf(4, 2)).toBe('P2 · Cobalt');
    for (let m = 0; m < FIELD.length; m++) expect(captionOf(m, 0)).toBe(nameOf(m));
  });

  it('is nothing for a camera on no marble', () => {
    expect(captionOf(-1, 0)).toBe('');
    expect(captionOf(-1, 3)).toBe('');
  });

  it('gives a colour to draw beside it that is the marble’s own, as a screen has it', () => {
    for (let m = 0; m < FIELD.length; m++) expect(swatchOf(m)).toMatch(/^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/);
    // Ember is the red one and Cobalt the blue one, and a linear colour is lightened for a screen
    const rgb = (m: number) => swatchOf(m).match(/\d+/g)!.map(Number);
    expect(rgb(0)[0]).toBeGreaterThan(rgb(0)[2]);
    expect(rgb(4)[2]).toBeGreaterThan(rgb(4)[0]);
    expect(rgb(0)[0]).toBeGreaterThan(Math.round(FIELD[0].colour[0] * 255));
    expect(swatchOf(-1)).toBe('transparent');
  });
});

describe('what is drawn over each marble', () => {
  it('gives every marble a pattern of its own: four kinds, two marbles each, no two alike', () => {
    const kinds = FIELD.map((l) => l.pattern.kind);
    for (const k of [1, 2, 3, 4])
      expect(
        kinds.filter((n) => n === k),
        `pattern ${k}`,
      ).toHaveLength(2);
    const alike = new Set(FIELD.map((l) => `${l.pattern.kind} ${l.pattern.second.join(' ')}`));
    expect(alike.size).toBe(FIELD.length);
  });

  it('puts a second colour on each that stands out from its first', () => {
    // how far apart the two are, in plain RGB: far enough to see on a marble a few pixels across
    for (const l of FIELD) {
      const apart = Math.hypot(...l.colour.map((c, i) => c - l.pattern.second[i]));
      expect(apart, l.name).toBeGreaterThan(0.35);
    }
  });

  it('hands every marble its pattern to draw, sized to the marble', () => {
    const scene = new Scene();
    const marbles = scene.dynamic()[0];
    expect(marbles.patterns).toBeDefined();
    for (let m = 0; m < MARBLES; m++) {
      const look = FIELD[m % FIELD.length];
      const o = m * PATTERN_STRIDE;
      expect(marbles.patterns![o], look.name).toBe(look.pattern.kind);
      expect(marbles.patterns![o + 1], 'the scale makes a marble one across its pattern').toBeCloseTo(1 / RADIUS);
      expect(Array.from(marbles.patterns!.subarray(o + 4, o + 7))).toEqual(look.pattern.second.map(Math.fround));
    }
  });
});
