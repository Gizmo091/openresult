import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
