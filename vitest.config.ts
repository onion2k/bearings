import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // a test that races a field over 24 seeds takes three to six seconds on its own, and more with every other
    // file racing beside it on the same cores; Vitest's own five seconds failed them at random under that load,
    // which says nothing about the game. A test that hangs still fails, at thirty
    testTimeout: 30000,
  },
});
