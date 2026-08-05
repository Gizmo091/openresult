import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { appConfig } from '../vite.config.base.js';

/**
 * The site is a handful of pages rather than one application.
 *
 * Each page is its own entry, so a reader who lands on the specification
 * downloads the specification and not the viewer, the validator and an editor.
 * Absolute base, because the pages link to each other by path.
 */
export default defineConfig({
  ...appConfig({ base: '/' }),
  build: {
    ...appConfig().build,
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        spec: resolve(import.meta.dirname, 'spec/index.html'),
        produce: resolve(import.meta.dirname, 'produce/index.html'),
        examples: resolve(import.meta.dirname, 'examples/index.html'),
        view: resolve(import.meta.dirname, 'view/index.html'),
        validate: resolve(import.meta.dirname, 'validate/index.html'),
        docs: resolve(import.meta.dirname, 'docs/index.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
});
