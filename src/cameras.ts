/**
 * The cameras of the split screen: one to every picked marble, and where
 * each looks from. It is the split screen without the screen — nothing here
 * draws — so the choice of who is followed is stepped headless in a test
 * and a script, and the page only turns each target into a view.
 *
 * A camera is not a marble but a player's pick: the first camera is always
 * whichever marble player 1 has, the second whichever player 2 has, and so
 * on, so a player's own view stays theirs even if the marbles pass each
 * other. A pick can only change before the off, so once the field is away a
 * camera's marble is fixed for the race, whatever becomes of it.
 */
import type { Race } from './race';

/** The most cameras there are: one to every marble of a full field. */
export const MAX_SLOTS = 8;

/** Where a camera looks from, round the marble it follows: the same angles as the single view, much closer in. */
export const SPLIT_VIEW = { azimuth: 0.9, polar: 0.95, radius: 16 };

export class Cameras {
  /** The marble each camera follows, or -1 for none: the first `count` of these are in use. */
  readonly marble = new Int32Array(MAX_SLOTS).fill(-1);
  /** Where each camera looks, three numbers a slot, eased toward its marble. */
  readonly target = new Float64Array(MAX_SLOTS * 3);
  /** Whether a camera's target has been put on something yet, so the first look is not a flight from the origin. */
  private readonly placed = new Uint8Array(MAX_SLOTS);

  /** How many cameras are in use: as many as are picked, at most `MAX_SLOTS`. */
  constructor(public count = 0) {}

  /** Every camera let go of its marble, to be given one again. */
  reset() {
    this.marble.fill(-1);
    this.placed.fill(0);
  }

  /**
   * Who is followed: the marble each player picked, in player order. A
   * camera whose marble has not changed is left alone, easing stays smooth;
   * one given a different marble — only possible before the off — is put on
   * it outright the next `ease`, as if it had never followed anything.
   */
  assign(players: ArrayLike<number>) {
    const picked: number[] = [];
    for (let m = 0; m < players.length; m++) if (players[m] > 0) picked.push(m);
    picked.sort((a, b) => players[a] - players[b]);
    for (let s = 0; s < this.count; s++) {
      const next = picked[s] ?? -1;
      if (this.marble[s] === next) continue;
      this.marble[s] = next;
      this.placed[s] = 0;
    }
  }

  /**
   * Every target moved a share `chase` of the way to its marble, or to
   * `home` with none; put on it outright the first time, so a view starts on
   * its marble rather than arriving from wherever the last run left it.
   */
  ease(marbles: Race, home: readonly number[], chase: number) {
    for (let s = 0; s < this.count; s++) {
      const m = this.marble[s];
      const at = s * 3;
      const x = m >= 0 ? marbles.x[m] : home[0],
        y = m >= 0 ? marbles.y[m] : home[1],
        z = m >= 0 ? marbles.z[m] : home[2];
      const share = this.placed[s] ? chase : 1;
      this.target[at] += (x - this.target[at]) * share;
      this.target[at + 1] += (y - this.target[at + 1]) * share;
      this.target[at + 2] += (z - this.target[at + 2]) * share;
      this.placed[s] = 1;
    }
  }

  /** Where camera `slot` looks from, into `out`: `SPLIT_VIEW` round its target. */
  eye(slot: number, out: number[]) {
    const at = slot * 3;
    const { azimuth, polar, radius } = SPLIT_VIEW;
    const flat = radius * Math.sin(polar);
    out[0] = this.target[at] + flat * Math.cos(azimuth);
    out[1] = this.target[at + 1] + flat * Math.sin(azimuth);
    out[2] = this.target[at + 2] + radius * Math.cos(polar);
  }
}
