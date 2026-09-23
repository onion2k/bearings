import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Where the renderer actually is: inside node_modules when installed, and a
 * checkout elsewhere on the disk when linked for working on both at once. The
 * dev server has to be allowed to serve from there, and its watcher told not
 * to ignore it. A package named here that is not installed stops the dev
 * server starting at all, so this list is the dependencies and no more.
 */
const at = (pkg: string) => dirname(createRequire(import.meta.url).resolve(`${pkg}/package.json`));
const packages = ['artshape-render'];

export default defineConfig({
  server: {
    port: 5198,
    strictPort: true,
    watch: { ignored: packages.map((p) => `!**/node_modules/${p}/**`) },
    fs: { allow: ['.', ...packages.map(at)] },
  },
  optimizeDeps: { exclude: packages },
  // Rapier is a megabyte of WASM in one chunk, fetched only when the race is physics: the perf gate holds the
  // download to its budget, so the bundler's own warning at half that is noise
  build: { chunkSizeWarningLimit: 1200 },
});
