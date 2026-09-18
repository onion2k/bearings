/**
 * The marbles themselves: what each is called and what it looks like.
 * Content, not logic — the race does not care which is which, but a player
 * backing one has to be able to tell it from the other seven at a glance,
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
}

export const FIELD: readonly Look[] = [
  { name: 'Ember', colour: [0.72, 0.09, 0.05], roughness: 0.35 },
  { name: 'Brass', colour: [0.66, 0.44, 0.09], roughness: 0.18 },
  { name: 'Sulphur', colour: [0.78, 0.68, 0.08], roughness: 0.75 },
  { name: 'Verdigris', colour: [0.09, 0.45, 0.32], roughness: 0.55 },
  { name: 'Cobalt', colour: [0.06, 0.22, 0.68], roughness: 0.25 },
  { name: 'Amethyst', colour: [0.38, 0.13, 0.6], roughness: 0.4 },
  { name: 'Bone', colour: [0.82, 0.79, 0.72], roughness: 0.9 },
  { name: 'Pitch', colour: [0.06, 0.06, 0.08], roughness: 0.12 },
];

/** What a marble is called, whichever one it is. */
export function nameOf(marble: number): string {
  return FIELD[marble % FIELD.length].name;
}
