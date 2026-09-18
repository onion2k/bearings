/**
 * What must always be true of the game, however it has been played: the
 * rules that, broken, are a bug whatever the feature was.
 *
 * The run it is on is a sound one and joins up. Every marble is a number, on
 * a piece of the track, inside the channel, and not inside another marble.
 * Every marble is doing exactly one thing, and the places given out are
 * 1, 2, 3 and so on with none repeated. The save only ever grew.
 *
 * Checked by the fuzzer after everything it does, by the test API on asking,
 * and by the unit tests. Each broken rule is a line saying what and where.
 */
import type { Game } from './game';
import { FINISHED, RACING, STALLED, WAITING, checkMarbles } from './marbles';
import { checkTrack } from './track';

/** How many broken rules of one sort are reported before the rest are only counted. */
const EACH = 3;

export function checkInvariants(game: Game): string[] {
  const out: string[] = [];
  const { marbles, track, progress } = game;
  const report = (sort: string, found: string[]) => {
    if (!found.length) return;
    out.push(...found.slice(0, EACH).map((f) => `${sort}: ${f}`));
    if (found.length > EACH) out.push(`${sort}: and ${found.length - EACH} more`);
  };

  report('the track', checkTrack(track));
  report('a marble', checkMarbles(marbles));

  // every marble is doing one of the things there are to do, and the tally agrees with them
  const doing = [0, 0, 0, 0];
  for (let i = 0; i < marbles.count; i++) {
    const state = marbles.state[i];
    if (state !== WAITING && state !== RACING && state !== FINISHED && state !== STALLED) {
      out.push(`marble ${i} is doing ${state}, which is nothing a marble does`);
      continue;
    }
    doing[state]++;
  }
  if (doing[FINISHED] !== marbles.finishers)
    out.push(`${doing[FINISHED]} marbles in the cup, and ${marbles.finishers} counted`);
  if (doing[STALLED] !== marbles.stalled)
    out.push(`${doing[STALLED]} marbles stopped short, and ${marbles.stalled} counted`);

  // the places are handed out once each, in order, and only to marbles that got there
  const places = new Map<number, number>();
  const wrong: string[] = [];
  for (let i = 0; i < marbles.count; i++) {
    const place = marbles.place[i];
    if (place === 0) {
      if (marbles.state[i] === FINISHED) wrong.push(`marble ${i} is in the cup with no place`);
      continue;
    }
    if (marbles.state[i] !== FINISHED) wrong.push(`marble ${i} has place ${place} without finishing`);
    if (place < 1 || place > marbles.count) wrong.push(`marble ${i} came ${place} of ${marbles.count}`);
    const already = places.get(place);
    if (already !== undefined) wrong.push(`marbles ${already} and ${i} both came ${place}`);
    places.set(place, i);
  }
  report('the places', wrong);

  const { races, best } = progress.save;
  if (!Number.isInteger(races) || races < 0) out.push(`${races} races have been run`);
  if (!Number.isFinite(best) || best < 0) out.push(`the best time is ${best}`);
  if (!Number.isFinite(game.t) || game.t < 0) out.push(`the game is ${game.t} seconds old`);
  return out;
}
