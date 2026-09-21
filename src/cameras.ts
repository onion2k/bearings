/**
 * Four cameras, each following a marble: which four, and where each looks
 * from. It is the split screen without the screen — nothing here draws — so
 * the choice of who is followed is stepped headless in a test and a script,
 * and the page only turns four targets into four quarters.
 *
 * The picked marbles come first, in player order, since they are what a
 * player is watching; the rest of the four are the marbles furthest on that
 * nobody is following yet. A camera keeps its marble for as long as it is
 * racing, so a pass in the field does not send four views swapping places,
 * and hands over only when its marble is home, stopped or lost. With nobody
 * left to hand over to it stays where it is, on the marble that finished.
 */
import { FINISHED, LOST, STALLED, type Marbles } from './marbles';

/** How many cameras there are, and so how many marbles are followed at once. */
export const SLOTS = 4;

/** Where a camera looks from, round the marble it follows: the same angles as the single view, much closer in. */
export const SPLIT_VIEW = { azimuth: 0.9, polar: 0.95, radius: 16 };

export class Cameras {
  /** The marble each camera follows, or -1 for none. */
  readonly marble = new Int32Array(SLOTS).fill(-1);
  /** Where each camera looks, three numbers a slot, eased toward its marble. */
  readonly target = new Float64Array(SLOTS * 3);
  /** Whether a camera's target has been put on something yet, so the first look is not a flight from the origin. */
  private readonly placed = new Uint8Array(SLOTS);

  /** Every camera let go of its marble, to be given one again. */
  reset() {
    this.marble.fill(-1);
    this.placed.fill(0);
  }

  /**
   * Who is followed, from how the race stands: the cameras whose marble is
   * done with let it go, and every camera without one takes the next
   * candidate that no camera has.
   */
  assign(marbles: Marbles, players: ArrayLike<number>, standing: readonly number[]) {
    const done = (m: number) => {
      const state = marbles.state[m];
      return state === FINISHED || state === LOST || state === STALLED;
    };
    const picked: number[] = [];
    for (let m = 0; m < players.length; m++) if (players[m] > 0) picked.push(m);
    picked.sort((a, b) => players[a] - players[b]);
    const candidates = [...picked, ...standing].filter((m) => m < marbles.count && !done(m));
    const taken = (m: number) => this.marble.includes(m);
    for (let s = 0; s < SLOTS; s++) {
      const now = this.marble[s];
      // a camera on a marble still going keeps it; one on a marble that is done with hands over if anyone is left
      if (now >= 0 && !done(now)) continue;
      const next = candidates.find((m) => !taken(m));
      if (next === undefined) continue;
      this.marble[s] = next;
    }
  }

  /**
   * Every target moved a share `chase` of the way to its marble, or to
   * `home` with none; put on it outright the first time, so a view starts on
   * its marble rather than arriving from wherever the last run left it.
   */
  ease(marbles: Marbles, home: readonly number[], chase: number) {
    for (let s = 0; s < SLOTS; s++) {
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
