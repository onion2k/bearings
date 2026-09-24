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
 * The splitter and the joiner are not offered: each opens or closes a second
 * end to build from, and a builder with one open end cannot say which.
 *
 * Nothing here knows about the page or the renderer.
 */
import {
  type Facing,
  type Kind,
  type Placed,
  type Run,
  KINDS,
  MAX_PIECES,
  MAX_SAMPLES,
  MOVING_MOST,
  check,
  compile,
  exitOf,
  lidRefused,
} from './track';

/** The kinds a player can build with: every one but the start, which a design begins with, and the two that branch. */
export const PALETTE: readonly Kind[] = KINDS.filter((k) => k !== 'start' && k !== 'splitter' && k !== 'joiner');

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

  constructor(name: string) {
    this.run = { id: '', name, pieces: [{ kind: 'start', x: 0, y: 0, z: 0, facing: 0 }] };
  }

  /** Where the next piece goes: where the last one hands a marble on, or nowhere once the run has ended. */
  get open(): ReturnType<typeof exitOf> {
    return exitOf(this.run.pieces[this.run.pieces.length - 1]);
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
    const { pieces } = this.run;
    if (pieces.length >= MAX_PIECES) return `a run may have ${MAX_PIECES} pieces`;
    if (MOVING.includes(kind) && pieces.filter((p) => p.kind === kind).length >= MOVING_MOST)
      return `a run may have ${MOVING_MOST} ${kind}s`;
    if (compile({ ...this.run, pieces: [...pieces, { kind, ...at }] }).samples > MAX_SAMPLES)
      return 'the run is as long as a run may be';
    return '';
  }

  /** A piece of `kind` on where the run is open; whether it went on. */
  place(kind: Kind): boolean {
    if (this.refuses(kind)) return false;
    this.run.pieces.push({ kind, ...this.open! });
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

  /** The last piece taken away; whether there was one to take, since the start stays. */
  undo(): boolean {
    if (this.run.pieces.length <= 1) return false;
    this.run.pieces.pop();
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

/** A name as a player typed it, with the spaces tidied and cut to what the board has room for. */
export function tidy(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, NAME_LONGEST).trim();
}

/**
 * A design to keep: `pieces` copied, so building on changes nothing kept, and
 * an id one past the highest in `designs`, so it is never one a design had
 * before — a best set on one is never taken for another's.
 */
export function kept(designs: readonly Run[], name: string, pieces: readonly Placed[]): Run {
  let n = 1;
  for (const d of designs) {
    const m = DESIGN_ID.exec(d.id);
    if (m) n = Math.max(n, Number(m[1]) + 1);
  }
  return { id: `design-${n}`, name: tidy(name) || `My run ${n}`, pieces: pieces.map((p) => ({ ...p })) };
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
    const { id, name, pieces } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !DESIGN_ID.test(id) || ids.has(id)) continue;
    if (typeof name !== 'string' || !tidy(name)) continue;
    if (!Array.isArray(pieces) || pieces.length < 2 || pieces.length > MAX_PIECES) continue;
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
    const run: Run = { id, name: tidy(name), pieces: placed };
    if (check(run).length > 0 || compile(run).samples > MAX_SAMPLES) continue;
    ids.add(id);
    out.push(run);
  }
  return out;
}
