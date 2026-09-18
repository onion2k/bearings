/**
 * The keyboard. There is nothing to steer — once they are let go the run
 * decides it — so what a player has is the gate, setting up again, and
 * choosing which run to watch.
 */
export type Intent = 'release' | 'reset' | 'next';

export class Input {
  constructor(private readonly told: (intent: Intent) => void) {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      const intent = k === ' ' ? 'release' : k === 'r' ? 'reset' : k === 'n' ? 'next' : null;
      if (!intent) return;
      e.preventDefault();
      this.told(intent);
    });
  }
}
