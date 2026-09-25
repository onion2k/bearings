/**
 * The designer: a run of the player's own, built a piece at a time, and the
 * designs they keep. Without it the only runs are the ones that ship.
 *
 * A piece goes on where the one before it hands a marble on, facing the way
 * the marble is going then, so every piece joins by construction and the
 * turning is done by the pieces that turn. Taking a piece away takes the last
 * one, so the pieces themselves are the whole of the undo, and it can never
 * hold more than a run may have. What is wrong with the run as it stands is
 * `check`'s to say, the same rules every run that ships is held to; a run is
 * only kept once it has nothing wrong with it, so a design on the shelf is
 * always one that races.
 *
 * A splitter opens a second end, a lane a cell to the left of the one going
 * straight on, and the player chooses which of the two the next piece goes
 * on; a joiner closes the two into one again, once they end side by side,
 * whatever way each took to get there and however long it is. One split at a
 * time, so there are never more than two ends to choose between, and the end
 * of the run only once the lanes are joined. Taking a piece away still takes
 * the last one laid, and chooses the lane it came off.
 *
 * Nothing here knows about the page or the renderer.
 */
import {
  type Facing,
  type Kind,
  type Placed,
  type Run,
  type Theme,
  KINDS,
  MAX_PIECES,
  MAX_SAMPLES,
  MOVING_MOST,
  THEMES,
  check,
  compile,
  exitOf,
  leftOf,
  lidRefused,
} from './track';

/** The kinds a player can build with: every one but the start, which a design begins with. */
export const PALETTE: readonly Kind[] = KINDS.filter((k) => k !== 'start');

/** Where a piece can go on: a cell, a level, and the way the field is going there. */
export type End = NonNullable<ReturnType<typeof exitOf>>;

/** Which of a split's two lanes: the one going straight on, or the one a cell to its left. */
export type Lane = 'left' | 'right';

/** Where a run being built can go on: one end, or a split's two lanes and which of them is chosen; none once it has ended. */
interface Open {
  ends: { right: End; left: End } | End | null;
  lane: Lane;
}

/**
 * The most designs a save keeps. A design of a hundred pieces is about six
 * kilobytes in the save, so twenty of them is well inside what a browser
 * keeps for a page, and more than a player builds before wanting to clear
 * some out.
 */
export const MAX_DESIGNS = 20;

/** How long a design's name may be: as much as the board's title has room for. */
export const NAME_LONGEST = 32;

/** What a design's id looks like: `design-` and a number, never used twice in one save. */
export const DESIGN_ID = /^design-([1-9][0-9]*)$/;

const MOVING: readonly Kind[] = ['sweeper', 'gate', 'wheel'];

export class Designer {
  readonly run: Run;
  /** Where the run can go on now, and where it could before each piece after the start was laid: the undo's own. */
  private now: Open;
  private readonly before: Open[] = [];

  constructor(name: string) {
    this.run = { id: '', name, pieces: [{ kind: 'start', x: 0, y: 0, z: 0, facing: 0 }] };
    this.now = { ends: exitOf(this.run.pieces[0]), lane: 'right' };
  }

  /** Every end the run can go on from: one, a split's two, the right lane's first, or none once it has ended. */
  get ends(): End[] {
    const { ends } = this.now;
    if (!ends) return [];
    return 'right' in ends ? [ends.right, ends.left] : [ends];
  }

  /** Which lane the next piece goes on while a split is open, and nothing while there is one end or none. */
  get lane(): Lane | null {
    return this.now.ends && 'right' in this.now.ends ? this.now.lane : null;
  }

  /** Where the next piece goes: the one end, the chosen lane's, or nowhere once the run has ended. */
  get open(): End | null {
    const { ends, lane } = this.now;
    if (!ends) return null;
    return 'right' in ends ? ends[lane] : ends;
  }

  /** The next piece on `lane`; whether there was a split to choose a lane of. */
  choose(lane: Lane): boolean {
    if (this.lane === null) return false;
    this.now = { ...this.now, lane };
    return true;
  }

  /**
   * Why a piece of `kind` cannot go on now, or nothing where it can. What is
   * refused is what the game could not draw or race at all — past the pieces,
   * the moving parts or the samples a run may have — and not what is merely
   * wrong with the run yet, which a builder has in front of them most of the
   * time and puts right by building on.
   */
  refuses(kind: Kind): string {
    if (!PALETTE.includes(kind)) return `a ${kind} is not one a design can use`;
    const at = this.open;
    if (!at) return 'the run has ended: take the end away to build on';
    const split = this.lane !== null;
    if (kind === 'splitter' && split) return 'one split at a time: join the lanes first';
    if (kind === 'finish' && split) return 'join the lanes before the run ends';
    if (kind === 'joiner') {
      const apart = this.apart();
      if (apart) return apart;
    }
    const { pieces } = this.run;
    if (pieces.length >= MAX_PIECES) return `a run may have ${MAX_PIECES} pieces`;
    if (MOVING.includes(kind) && pieces.filter((p) => p.kind === kind).length >= MOVING_MOST)
      return `a run may have ${MOVING_MOST} ${kind}s`;
    if (compile({ ...this.run, pieces: [...pieces, { kind, ...this.where(kind) }] }).samples > MAX_SAMPLES)
      return 'the run is as long as a run may be';
    return '';
  }

  /**
   * Why a joiner cannot close the lanes, or nothing where it can: they have
   * to end side by side, one a cell to the left of the other, level with it
   * and going the same way, since that is where a joiner's two entries are.
   * Said in the player's terms, from the right lane's end.
   */
  private apart(): string {
    const { ends } = this.now;
    if (!ends || !('right' in ends)) return 'there are no lanes to join: lay a splitter first';
    const { right, left } = ends;
    if (same(left, leftOf(right)) || same(right, leftOf(left))) return '';
    if (left.facing !== right.facing) return 'the lanes end going different ways';
    if (left.z !== right.z) {
      const levels = Math.abs(left.z - right.z);
      return `the lanes end ${levels === 1 ? 'a level' : `${levels} levels`} apart`;
    }
    // how far the left lane's end is from the right's, along the way they go and across it
    const along = [0, 0];
    const [dx, dy] = [left.x - right.x, left.y - right.y];
    const f = right.facing;
    along[0] = f === 0 ? dx : f === 1 ? dy : f === 2 ? -dx : -dy;
    along[1] = f === 0 ? dy : f === 1 ? -dx : f === 2 ? -dy : dx;
    if (along[0] !== 0)
      return `the ${along[0] > 0 ? 'left' : 'right'} lane ends ${Math.abs(along[0]) === 1 ? 'a cell' : `${Math.abs(along[0])} cells`} further along`;
    return `the lanes end ${Math.abs(along[1])} cells apart, and a joiner closes two a cell apart`;
  }

  /** Where a piece of `kind` goes on: a joiner on whichever lane has the other on its left, anything else on the chosen end. */
  private where(kind: Kind): End {
    const { ends } = this.now;
    if (kind === 'joiner' && ends && 'right' in ends && same(ends.left, leftOf(ends.right))) return ends.right;
    if (kind === 'joiner' && ends && 'right' in ends) return ends.left;
    return this.open!;
  }

  /** A piece of `kind` on where the run is open; whether it went on. */
  place(kind: Kind): boolean {
    if (this.refuses(kind)) return false;
    const at = this.where(kind);
    const piece: Placed = { kind, ...at };
    this.run.pieces.push(piece);
    this.before.push(this.now);
    const out = exitOf(piece);
    const { ends, lane } = this.now;
    if (kind === 'splitter' && out) this.now = { ends: { right: out, left: leftOf(out) }, lane: 'right' };
    else if (kind === 'joiner' || !ends || !('right' in ends)) this.now = { ends: out, lane: 'right' };
    else this.now = { ends: { ...ends, [lane]: out }, lane };
    return true;
  }

  /** Why the last piece cannot have a grid put over it, or taken off it, now; nothing where it can. */
  refusesLid(): string {
    const { pieces } = this.run;
    if (pieces.length <= 1) return 'lay a piece to put a grid over it';
    return lidRefused(pieces[pieces.length - 1].kind);
  }

  /**
   * A grid over the last piece laid, or taken off it where it has one; whether
   * either happened. The last piece, since that is the one the undo takes and
   * the one the player is looking at: to cover one further back, take the
   * pieces after it off and lay them again.
   */
  lid(): boolean {
    if (this.refusesLid()) return false;
    const last = this.run.pieces[this.run.pieces.length - 1];
    if (last.lid) delete last.lid;
    else last.lid = true;
    return true;
  }

  /**
   * The run dressed as `theme`, or made plain: for the eye alone, so it may be
   * changed at any time and nothing about the run's pieces changes with it.
   * Plain is written as nothing at all, the shape every design before themes
   * was kept in. Whether it was a theme the game has.
   */
  dress(theme: Theme | 'plain'): boolean {
    if (theme === 'plain') delete this.run.theme;
    else if (THEMES.includes(theme)) this.run.theme = theme;
    else return false;
    return true;
  }

  /** The last piece taken away, and the lane it was laid on chosen; whether there was one to take, since the start stays. */
  undo(): boolean {
    if (this.run.pieces.length <= 1) return false;
    this.run.pieces.pop();
    this.now = this.before.pop()!;
    return true;
  }

  /** What is wrong with the run as it stands, in the player's terms, a line each. */
  problems(): string[] {
    return check(this.run);
  }

  /** Whether it could be kept now. */
  get sound(): boolean {
    return this.problems().length === 0;
  }
}

/** Whether two ends are the same place, going the same way. */
function same(a: End, b: End): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z && a.facing === b.facing;
}

/** A name as a player typed it, with the spaces tidied and cut to what the board has room for. */
export function tidy(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, NAME_LONGEST).trim();
}

/**
 * A design to keep: `pieces` copied, so building on changes nothing kept, and
 * an id one past the highest in `designs`, so it is never one a design had
 * before — a best set on one is never taken for another's.
 */
export function kept(designs: readonly Run[], name: string, pieces: readonly Placed[], theme?: Theme): Run {
  let n = 1;
  for (const d of designs) {
    const m = DESIGN_ID.exec(d.id);
    if (m) n = Math.max(n, Number(m[1]) + 1);
  }
  return {
    id: `design-${n}`,
    name: tidy(name) || `My run ${n}`,
    pieces: pieces.map((p) => ({ ...p })),
    ...(theme ? { theme } : {}),
  };
}

/**
 * The designs in a save, as read back, less anything that is not one: the
 * wrong shape, a kind the game has not got, a run with something wrong with
 * it, an id seen already, or one past the most a save keeps. A save is the
 * player's own storage and anyone can write into it, so nothing it says is put
 * on without being checked as every run is.
 */
export function readDesigns(raw: unknown): Run[] {
  if (!Array.isArray(raw)) return [];
  const out: Run[] = [];
  const ids = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_DESIGNS) break;
    if (typeof item !== 'object' || item === null) continue;
    const { id, name, pieces, theme } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !DESIGN_ID.test(id) || ids.has(id)) continue;
    if (typeof name !== 'string' || !tidy(name)) continue;
    if (!Array.isArray(pieces) || pieces.length < 2 || pieces.length > MAX_PIECES) continue;
    // a theme is one the game has, or not there at all, which is plain
    if (theme !== undefined && !THEMES.includes(theme as Theme)) continue;
    const placed: Placed[] = [];
    for (const p of pieces as unknown[]) {
      if (typeof p !== 'object' || p === null) break;
      const { kind, x, y, z, facing, lid } = p as Record<string, unknown>;
      if (!KINDS.includes(kind as Kind)) break;
      if (![x, y, z].every(Number.isInteger) || ![0, 1, 2, 3].includes(facing as number)) break;
      // a grid is asked for with `true` and nothing else, and is otherwise not there at all
      if (lid !== undefined && lid !== true) break;
      placed.push({
        kind: kind as Kind,
        x: x as number,
        y: y as number,
        z: z as number,
        facing: facing as Facing,
        ...(lid ? { lid: true as const } : {}),
      });
    }
    if (placed.length !== pieces.length) continue;
    const run: Run = { id, name: tidy(name), pieces: placed, ...(theme ? { theme: theme as Theme } : {}) };
    if (check(run).length > 0 || compile(run).samples > MAX_SAMPLES) continue;
    ids.add(id);
    out.push(run);
  }
  return out;
}
