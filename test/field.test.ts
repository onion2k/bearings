/** What a quarter of the split screen says about the marble it follows. */
import { describe, expect, it } from 'vitest';
import { FIELD, captionOf, nameOf, swatchOf } from '../src/field';

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
