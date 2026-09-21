/**
 * The keyboard. There is nothing to steer — once they are let go the run
 * decides it — so what the players have is picking their marbles, the gate,
 * setting up again, choosing which run to watch, C for the catalog of
 * pieces and back, and S for the screen split in four, each on a marble.
 */
export type Intent = 'release' | 'reset' | 'next' | 'shelf' | 'split' | { pick: number };

export class Input {
  constructor(private readonly told: (intent: Intent) => void) {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      // 1 to 8 pick the marble in that row of the board, which before the off lists the field in its own order
      const row = k.length === 1 && k >= '1' && k <= '8' ? Number(k) - 1 : -1;
      const intent: Intent | null =
        row >= 0
          ? { pick: row }
          : k === ' '
            ? 'release'
            : k === 'r'
              ? 'reset'
              : k === 'n'
                ? 'next'
                : k === 'c'
                  ? 'shelf'
                  : k === 's'
                    ? 'split'
                    : null;
      if (!intent) return;
      e.preventDefault();
      this.told(intent);
    });
  }
}
