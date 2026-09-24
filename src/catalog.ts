/**
 * The catalog: every kind of piece there is, each named, said what it does,
 * and set on its own between a start and the end of a run, so it can be
 * looked at and raced by itself. Content, like the runs, and the same shape
 * as one: a piece's entry is a run the game puts on like any other, except
 * that nothing raced on it is counted or saved.
 *
 * It is a `Record` over the kinds, so a kind of piece with no entry here is a
 * kind the game will not compile without.
 */
import { type Facing, type Kind, type Placed, type Run, KINDS, exitOf } from './track';

export interface Entry {
  /** What a player calls it. */
  name: string;
  /** What it does, in a line. */
  about: string;
  /** The pieces it is shown among, itself included: most need only a start before and the end after. */
  among?: readonly Kind[];
  /**
   * A shelf entry laid out by hand rather than chained by `among`: what a
   * splitter and a joiner need, since neither means anything alone and a
   * plain chain of kinds cannot say where a second branch or a second entry
   * goes.
   */
  laid?: Placed[];
}

/** A piece shown on its own, between the start and the end. */
const alone = (kind: Kind): readonly Kind[] => ['start', kind, 'finish'];

/**
 * The splitter and the joiner shown together, the only way either means
 * anything: a lane parted in two, raced apart a cell either side of the
 * middle, and closed again. The fork sits a lattice cell across from the
 * lane that stayed straight, which is the splitter's own shape, not a
 * choice made here.
 */
function splitAndJoin(): Placed[] {
  const start: Placed = { kind: 'start', x: 0, y: 0, z: 0, facing: 0 };
  const splitter: Placed = { kind: 'splitter', ...exitOf(start)! };
  const mainStart = exitOf(splitter)!;
  const forkStart = { x: mainStart.x, y: mainStart.y + 1, z: mainStart.z, facing: mainStart.facing };
  const main: Placed = { kind: 'straight', ...mainStart };
  const fork: Placed = { kind: 'straight', ...forkStart };
  const joiner: Placed = { kind: 'joiner', ...exitOf(main)! };
  const after: Placed = { kind: 'straight', ...exitOf(joiner)! };
  const finish: Placed = { kind: 'finish', ...exitOf(after)! };
  return [start, splitter, main, fork, joiner, after, finish];
}

export const CATALOG: Record<Kind, Entry> = {
  start: {
    name: 'The start gate',
    about: 'Where the field waits two abreast; where each marble stands is drawn as it opens.',
    among: ['start', 'finish'],
  },
  straight: {
    name: 'Straight',
    about: 'A cell of chute that only leans, just enough that a queue on it always drains.',
    among: alone('straight'),
  },
  ramp: {
    name: 'Ramp',
    about: 'Down a level in a cell under a grid, eased in and out: the steady slope most runs are made of.',
    among: alone('ramp'),
  },
  curveLeft: {
    name: 'Left turn',
    about: 'A quarter turn to the left, which throws the field out against its right-hand wall.',
    among: alone('curveLeft'),
  },
  curveRight: {
    name: 'Right turn',
    about: 'A quarter turn to the right, which throws the field out against its left-hand wall.',
    among: alone('curveRight'),
  },
  drop: {
    name: 'Drop',
    about: 'Down two levels in a cell under a grid: twice as steep as a ramp, and the quickest way to speed.',
    among: alone('drop'),
  },
  spiralLeft: {
    name: 'Left spiral',
    about: 'Once round to the left and two levels down, coming out underneath where it went in.',
    among: alone('spiralLeft'),
  },
  spiralRight: {
    name: 'Right spiral',
    about: 'Once round to the right and two levels down, coming out underneath where it went in.',
    among: alone('spiralRight'),
  },
  jump: {
    name: 'Jump',
    about: 'A run-up under a grid, a lip over a cell of air, and a board beyond it to land on.',
    among: alone('jump'),
  },
  pegs: {
    name: 'Peg board',
    about: 'A wide board under a grid, with staggered rows of pegs that knock a marble off its line.',
    among: alone('pegs'),
  },
  sweeper: {
    name: 'Sweeper',
    about: 'A paddle swinging from wall to wall across a board, sending aside whatever is in its way.',
    among: alone('sweeper'),
  },
  gate: {
    name: 'Gate',
    about: 'A pen with a bar across it, which holds the field and then slides open from one wall.',
    among: alone('gate'),
  },
  wheel: {
    name: 'Paddle wheel',
    about: 'A wheel turning over its pen, holding every marble behind a paddle until it lifts out.',
    among: alone('wheel'),
  },
  funnel: {
    name: 'Funnel',
    about: 'Off a lip into a bowl the field goes round, each until it is slow enough to drop through.',
    among: alone('funnel'),
  },
  splitter: {
    name: 'Splitter',
    about: 'Parts the field in two by which side of the middle it is on, each way its own lane from here.',
    laid: splitAndJoin(),
  },
  joiner: {
    name: 'Joiner',
    about: 'Brings two lanes back into one, in whatever order the two of them hand the field on.',
    laid: splitAndJoin(),
  },
  shallow: {
    name: 'Shallow straight',
    about: 'Two cells along and a level down: half as steep as a ramp, at a chute’s width.',
    among: alone('shallow'),
  },
  shallowWide: {
    name: 'Shallow and wide',
    about: 'The shallow straight, opening to twice a chute’s width in its middle for the field to spread.',
    among: alone('shallowWide'),
  },
  shallowBroad: {
    name: 'Shallow and broad',
    about: 'The shallow straight, opening to three times a chute’s width: room for four abreast.',
    among: alone('shallowBroad'),
  },
  narrow: {
    name: 'Narrow',
    about: 'A groove in its middle that sorts the field toward single file, flat again where it ends.',
    among: alone('narrow'),
  },
  brake: {
    name: 'Brake',
    about:
      'The channel snaking from wall to wall down a shallow fall: a fast field is thrown about and comes out slow.',
    among: alone('brake'),
  },
  bumps: {
    name: 'Bumps',
    about: 'A board under a grid with mounds in its floor, which a marble rolls up over and is turned aside by.',
    among: alone('bumps'),
  },
  finish: {
    name: 'The end',
    about: 'Over the line and into a cup under a grid, where the field comes to rest.',
    among: ['start', 'finish'],
  },
};

/** Pieces laid end to end from the lattice's origin, each where the one before hands a marble on. */
function lay(kinds: readonly Kind[]): Placed[] {
  const pieces: Placed[] = [];
  let here = { x: 0, y: 0, z: 0, facing: 0 as Facing };
  for (const kind of kinds) {
    pieces.push({ kind, ...here });
    const out = exitOf({ kind, ...here });
    if (out) here = out;
  }
  return pieces;
}

/**
 * A grid over a piece, shown on the shelf after the kinds: not a kind of its
 * own but something a run can ask for over any piece but a jump, a funnel or
 * a wheel, here over the broadest of the boards.
 */
const GRID: { run: Run; about: string } = {
  run: {
    id: 'piece-grid',
    name: 'A grid over it',
    pieces: lay(['start', 'shallowBroad', 'finish']).map((p) => (p.kind === 'shallowBroad' ? { ...p, lid: true } : p)),
  },
  about:
    'Any piece but a jump, a funnel or a wheel can have a grid over it, which keeps in a marble it would throw out.',
};

/** Every piece as a run of its own, in the order the kinds are listed, and the grid: what the catalog's shelf puts on. */
export const PIECES: readonly Run[] = [
  ...KINDS.map((kind) => ({
    id: `piece-${kind.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
    name: CATALOG[kind].name,
    pieces: CATALOG[kind].laid ?? lay(CATALOG[kind].among!),
  })),
  GRID.run,
];

/** What each piece on the shelf does, in the same order: for the board, in place of a run's best time. */
export const ABOUT: readonly string[] = [...KINDS.map((kind) => CATALOG[kind].about), GRID.about];
