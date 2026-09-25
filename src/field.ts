/**
 * The marbles themselves: what each is called and what it looks like.
 * Content, not logic — the race does not care which is which, and nothing
 * about a marble but its look and its name sets it apart, but a player who
 * picked one has to be able to tell it from the other seven at a glance,
 * across a whole run, at speed.
 *
 * Colour and roughness are all there is to tell them apart with: the
 * renderer has no textures. So the eight are spread round the wheel and set
 * at different roughnesses, which reads as a different substance — a dull
 * chalky one next to a near-mirror one is unmistakable even where the hues
 * are close.
 */

export interface Look {
  name: string;
  /** Linear RGB, as the renderer takes it. */
  colour: [number, number, number];
  /** 0 is a mirror and 1 is chalk. */
  roughness: number;
  /**
   * What is drawn over the colour, so that eight marbles are told apart by
   * more than it: 1 a swirl, 2 bands, 3 marbling, 4 speckle, in a second
   * colour, turned by a seed so two of a kind are not the same ball.
   */
  pattern: { kind: 1 | 2 | 3 | 4; second: [number, number, number]; seed: number };
}

export const FIELD: readonly Look[] = [
  {
    name: 'Ember',
    colour: [0.72, 0.09, 0.05],
    roughness: 0.35,
    pattern: { kind: 1, second: [0.95, 0.62, 0.12], seed: 0.1 },
  },
  {
    name: 'Brass',
    colour: [0.66, 0.44, 0.09],
    roughness: 0.18,
    pattern: { kind: 2, second: [0.04, 0.02, 0.01], seed: 0.3 },
  },
  {
    name: 'Sulphur',
    colour: [0.78, 0.68, 0.08],
    roughness: 0.75,
    pattern: { kind: 4, second: [0.06, 0.05, 0.03], seed: 0.5 },
  },
  {
    name: 'Verdigris',
    colour: [0.09, 0.45, 0.32],
    roughness: 0.55,
    pattern: { kind: 3, second: [0.72, 0.86, 0.74], seed: 0.7 },
  },
  {
    name: 'Cobalt',
    colour: [0.06, 0.22, 0.68],
    roughness: 0.25,
    pattern: { kind: 1, second: [0.86, 0.88, 0.94], seed: 0.9 },
  },
  {
    name: 'Amethyst',
    colour: [0.38, 0.13, 0.6],
    roughness: 0.4,
    pattern: { kind: 3, second: [0.86, 0.5, 0.76], seed: 0.2 },
  },
  {
    name: 'Bone',
    colour: [0.82, 0.79, 0.72],
    roughness: 0.9,
    pattern: { kind: 4, second: [0.36, 0.1, 0.06], seed: 0.4 },
  },
  {
    name: 'Pitch',
    colour: [0.06, 0.06, 0.08],
    roughness: 0.12,
    pattern: { kind: 2, second: [0.85, 0.4, 0.06], seed: 0.6 },
  },
];

/** What a marble is called, whichever one it is. */
export function nameOf(marble: number): string {
  return FIELD[marble % FIELD.length].name;
}

/** What a camera on `marble` says of it: its name, and the player who picked it first where somebody did; nothing for none. */
export function captionOf(marble: number, player: number): string {
  if (marble < 0) return '';
  return player > 0 ? `P${player} · ${nameOf(marble)}` : nameOf(marble);
}

/** The marble's colour for a page to draw with: the renderer's is linear, and a screen wants it lightened. */
export function swatchOf(marble: number): string {
  if (marble < 0) return 'transparent';
  const [r, g, b] = FIELD[marble % FIELD.length].colour.map((c) => Math.round(255 * c ** (1 / 2.2)));
  return `rgb(${r}, ${g}, ${b})`;
}
