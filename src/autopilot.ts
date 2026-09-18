/**
 * The game played by itself: races put on, let go, and put on again.
 *
 * It is a measuring instrument first. The pace gate, the leak check, the
 * determinism check and one of the bench scenarios all drive through it, so
 * what it does has to be steady, has to be only what a player could do, and
 * has to keep going for as long as it is asked. It never touches a marble;
 * there is nothing to touch, which is the point of the game.
 *
 * It stays on the run it is given rather than picking another, because a
 * pace figure that wandered between runs would be measuring the choice and
 * not the game.
 */
import type { Game } from './game';

/** How long it waits at the line before letting them go, and after a race before setting up again. */
export const AT_THE_LINE = 0.5;
export const AFTER = 1;

export class Autopilot {
  /** How many races it has seen through. */
  races = 0;
  private waited = 0;

  constructor(readonly game: Game) {}

  /** One frame: the race moved on, and the next one set up when this one is done. */
  step(dt: number) {
    const { game } = this;
    if (game.over) {
      this.waited += dt;
      if (this.waited >= AFTER) {
        this.races++;
        this.waited = 0;
        game.reset();
      }
      game.step(dt);
      return;
    }
    // nothing has been let go yet: a moment at the line, as a player would take
    if (game.marbles.finishers + game.marbles.stalled === 0 && this.notYetOff()) {
      this.waited += dt;
      if (this.waited >= AT_THE_LINE) {
        this.waited = 0;
        game.release();
      }
    }
    game.step(dt);
  }

  private notYetOff(): boolean {
    const { marbles } = this.game;
    for (let i = 0; i < marbles.count; i++) if (marbles.state[i] !== 0) return false;
    return true;
  }
}
