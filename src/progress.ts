/**
 * What the player has to show for it, and where it is kept: the races run,
 * the run last put on, and the best winning time on each run, in the
 * browser's storage or, for the game run without a page, anywhere. Old saves
 * must still load: a field a save does not have takes its default, so a save
 * written before a field existed opens without complaint. A save written
 * when there was one best for the whole game has it dropped, since nobody
 * can say now which run it was set on.
 */
export interface Save {
  /** How many races have been run to the end. */
  races: number;
  /** The id of the run last put on; empty before one has been. */
  run: string;
  /** The best winning time on each run, in seconds, by the run's id. */
  bests: Record<string, number>;
}

/** What a run's id looks like, so a save cannot bring in a key the game would never write, or one that means something to JavaScript. */
const ID = /^[a-z]+(-[a-z]+)*$/;

/** Where the save is kept. */
export interface SaveStore {
  load(): string | null;
  store(json: string): void;
  clear(): void;
}

export const KEY = 'bearing-save-v1';

/** The browser's storage, and nothing at all where there is none, or it will not be written. */
export function browserStore(key = KEY): SaveStore {
  return {
    load() {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    store(json) {
      try {
        localStorage.setItem(key, json);
      } catch {
        /* fine */
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        /* nothing to remove */
      }
    },
  };
}

/** A save kept in memory, starting from `json` if given: for the game run without a page. */
export function memoryStore(json: string | null = null): SaveStore & { json: string | null } {
  return {
    json,
    load() {
      return this.json;
    },
    store(next) {
      this.json = next;
    },
    clear() {
      this.json = null;
    },
  };
}

const fresh = (): Save => ({ races: 0, run: '', bests: {} });

/** A number from a save, or the default where it is missing or not a number. */
function number(from: Record<string, unknown>, key: string, or: number): number {
  const v = from[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : or;
}

export class Progress {
  readonly save: Save;

  /** Loaded from the store; loading alone never writes. */
  constructor(private readonly saves: SaveStore = browserStore()) {
    this.save = fresh();
    const json = saves.load();
    if (json === null) return;
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return;
    }
    if (typeof raw !== 'object' || raw === null) return;
    const from = raw as Record<string, unknown>;
    const d = fresh();
    this.save.races = number(from, 'races', d.races);
    this.save.run = typeof from.run === 'string' && ID.test(from.run) ? from.run : d.run;
    const bests = from.bests;
    if (typeof bests === 'object' && bests !== null)
      for (const [id, time] of Object.entries(bests as Record<string, unknown>))
        if (ID.test(id) && typeof time === 'number' && Number.isFinite(time) && time > 0) this.save.bests[id] = time;
  }

  get races() {
    return this.save.races;
  }

  /** A race run to the end on the run `id`, won in `seconds`; 0 where nothing finished. */
  ran(id: string, seconds: number) {
    this.save.races++;
    const was = this.best(id);
    if (seconds > 0 && (was === 0 || seconds < was)) this.save.bests[id] = seconds;
  }

  /** The best winning time on a run, or 0 before it has one. */
  best(id: string): number {
    return Object.hasOwn(this.save.bests, id) ? this.save.bests[id] : 0;
  }

  /** The run put on, to be put on again next time. */
  chose(id: string) {
    this.save.run = id;
  }

  persist() {
    this.saves.store(JSON.stringify(this.save));
  }

  /** Start over: the save wiped, in memory and in the store. */
  reset() {
    Object.assign(this.save, fresh());
    this.saves.clear();
  }
}
