import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Sans plafond, un worker par cœur est lancé et chacun charge son propre
    // environnement : de quoi saturer la RAM d'une machine 16 Go.
    maxWorkers: 2,
    include: ['**/test/**/*.test.ts', '**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['sdk/js/packages/*/src/**', 'viewer/src/**', 'validator/*/src/**'],
      reporter: ['text', 'lcov'],
    },
    projects: [
      {
        test: {
          name: 'node',
          include: [
            'sdk/js/packages/**/*.test.ts',
            'validator/**/*.test.ts',
            'tools/**/*.test.ts',
            'site/test/**/*.test.ts',
          ],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'browser',
          include: ['viewer/**/*.test.ts', 'playground/**/*.test.ts'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
