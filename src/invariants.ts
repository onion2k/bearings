/**
 * What must always be true of the game, however it has been played: the
 * rules that, broken, are a bug whatever the feature was.
 *
 * The run it is on is a sound one and joins up, and is one of the runs there
 * are. Every marble is a number, on a piece of the track, inside the channel,
 * not inside another marble, never further in a step than its speed and what
 * pushed it take it, and doing exactly one thing, with the tallies agreeing —
 * all of that is the race's own rules, each engine's `check`. The
 * places given out are 1, 2, 3 and so on with none repeated, and only to
 * marbles that got there. No player has two marbles, nor any marble two
 * players. The save only ever grew, and keeps no more designs than it may,
 * no two under one id. Nothing is let go down a run still being built, and
 * the next piece of one goes on one of its open ends, of which there are at
 * most two. What the run on is dressed with is nothing where it is plain,
 * only the kinds there are, no more of each than a run may have, and all of
 * it by the run that is on.
 *
 * Checked by the fuzzer after everything it does, by the test API on asking,
 * and by the unit tests. Each broken rule is a line saying what and where.
 */
import type { Game } from './game';
import { DECOR_KINDS, FLAT, MOST, SCENERY, THEME_KINDS, sceneryClear } from './decor';
import { MAX_DESIGNS } from './designer';
import { FINISHED, WAITING } from './race';
import { at, checkTrack, spot } from './track';

/** How many broken rules of one sort are reported before the rest are only counted. */
const EACH = 3;

/** How far past a channel's edge anything it is dressed with may stand: a chimney beside a chute, and its own width. */
const REACH = 5;
/** A spot to read the track into, so checking makes nothing. */
const here = spot();

export function checkInvariants(game: Game): string[] {
  const out: string[] = [];
  const { marbles, track, progress } = game;
  const report = (sort: string, found: string[]) => {
    if (!found.length) return;
    out.push(...found.slice(0, EACH).map((f) => `${sort}: ${f}`));
    if (found.length > EACH) out.push(`${sort}: and ${found.length - EACH} more`);
  };

  report('the track', checkTrack(track));
  report('a marble', marbles.check());

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

  // each marble is nobody's or one player's, and no player has two
  const seated = new Map<number, number>();
  const players: string[] = [];
  game.players.forEach((player, marble) => {
    if (player === 0) return;
    if (player < 1 || player > game.players.length) players.push(`marble ${marble} is had by player ${player}`);
    const other = seated.get(player);
    if (other !== undefined) players.push(`player ${player} has marbles ${other} and ${marble}`);
    seated.set(player, marble);
  });
  report('the players', players);

  // each camera follows a marble there is, no two the same one, and none at all while the screen is whole
  const seen = new Set<number>();
  const cameras: string[] = [];
  game.cameras.marble.forEach((m, slot) => {
    if (m === -1) return;
    if (game.views === 0) cameras.push(`camera ${slot} follows marble ${m} on a screen that is whole`);
    else if (slot >= game.views)
      cameras.push(`camera ${slot} follows marble ${m}, and the screen has ${game.views} views`);
    else if (!Number.isInteger(m) || m < 0 || m >= marbles.count) cameras.push(`camera ${slot} follows marble ${m}`);
    else if (seen.has(m)) cameras.push(`two cameras follow marble ${m}`);
    seen.add(m);
  });
  report('the cameras', cameras);

  // the run on is one of the runs on its shelf, and it is the one the save says, or the save says none yet; a run
  // being built is the builder's own, and nothing goes down it until it is kept
  const { list } = game;
  if (game.designer) {
    if (track.name !== game.designer.run.name)
      out.push(`${game.designer.run.name} is being built, and ${track.name} is on`);
    // the next piece goes on one of the ends the run is open at, and there are never more than a split's two
    const { ends, open, lane } = game.designer;
    if (ends.length > 2) out.push(`the run being built is open at ${ends.length} ends`);
    if (open && !ends.includes(open)) out.push('the next piece would go on where the run is not open');
    if ((lane !== null) !== (ends.length === 2)) out.push(`a lane is chosen with ${ends.length} ends open`);
    for (let i = 0; i < marbles.count; i++)
      if (marbles.state[i] !== WAITING) {
        out.push(`marble ${i} was let go down a run still being built`);
        break;
      }
  } else if (!Number.isInteger(game.run) || game.run < 0 || game.run >= list.length)
    out.push(`run ${game.run} is on, of ${list.length} ${game.shelf}`);
  else if (track.name !== list[game.run].name) out.push(`run ${game.run} is on, and the track is ${track.name}`);
  else if (game.shelf !== 'pieces' && progress.save.run !== '' && progress.save.run !== list[game.run].id)
    out.push(`the save says ${progress.save.run} is on, and ${list[game.run].id} is`);

  // what the run on is dressed with: nothing where it is plain, only what there is to dress with and no more of each
  // than a run may have, and every thing by a piece and a segment of the run that is on, not one left over from the
  // run before
  // (a run on that is not one of the runs is said above, and there is nothing of it to dress)
  const on = game.designer?.run ?? (game.run >= 0 && game.run < list.length ? list[game.run] : null);
  if (on) {
    const { decor } = game;
    if (!on.theme && decor.length > 0) out.push(`${on.name} is plain, and dressed with ${decor.length} things`);
    for (const kind of DECOR_KINDS) {
      const n = decor.filter((d) => d.kind === kind).length;
      if (n > MOST[kind]) out.push(`${on.name} has ${n} ${kind}s, past the ${MOST[kind]} a run may`);
    }
    for (const d of decor) {
      if (!DECOR_KINDS.includes(d.kind)) out.push(`${on.name} is dressed with a ${d.kind}, which is nothing a run has`);
      else if (on.theme && !THEME_KINDS[on.theme].includes(d.kind))
        out.push(`${on.name} is dressed as ${on.theme}, and has a ${d.kind}, which is another theme's`);
      else if (
        d.segment >= track.segments.length ||
        d.piece >= on.pieces.length ||
        track.segments[d.segment].piece !== d.piece
      )
        out.push(`a ${d.kind} stands by piece ${d.piece}, segment ${d.segment}, which ${on.name} has not got`);
      else if (SCENERY.includes(d.kind) || FLAT.includes(d.kind)) {
        // the backdrop stands far off on purpose, and is held to keeping out of the way instead
        const wrong = sceneryClear(track, d);
        if (wrong) out.push(`${on.name}: ${wrong}`);
      } else {
        // nothing is dressed further from the segment it stands by than a chimney beside a chute: a dressing worked out
        // for another run whose numbers happen to fit this one stands wherever that run was
        const h = at(track, d.segment, Math.min(d.along, track.segments[d.segment].length), here);
        const off = Math.hypot(d.x - h.x, d.y - h.y);
        if (off > h.w + REACH) out.push(`a ${d.kind} by segment ${d.segment} stands ${off.toFixed(1)} from it`);
      }
    }
  }

  // the designs are as many as a save keeps at most, each under an id of its own
  const { designs } = progress.save;
  if (designs.length > MAX_DESIGNS) out.push(`${designs.length} designs are kept, of ${MAX_DESIGNS} at most`);
  const ids = new Set<string>();
  for (const d of designs) {
    if (ids.has(d.id)) out.push(`two designs are ${d.id}`);
    ids.add(d.id);
  }

  const { races, bests } = progress.save;
  if (!Number.isInteger(races) || races < 0) out.push(`${races} races have been run`);
  for (const [id, time] of Object.entries(bests))
    if (!Number.isFinite(time) || time <= 0) out.push(`the best time on ${id} is ${time}`);
  if (!Number.isFinite(game.t) || game.t < 0) out.push(`the game is ${game.t} seconds old`);
  return out;
}
