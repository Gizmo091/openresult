import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Tests, repository tooling and command-line programs. Writing to stdout is
    // what a CLI is for.
    files: ['**/*.test.ts', 'tools/**/*.ts', '**/src/cli.ts', '**/src/reporters/*.ts'],
    rules: {
      'no-console': 'off',
      // A test owns its fixtures. A wrong assertion fails the test, which is
      // exactly what should happen — unlike in production code, where it would
      // reach a user.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);

// Note: the core package's freedom from runtime dependencies is enforced by
// `pnpm check core-deps`, which inspects the declared dependency graph. That is
// a stronger guarantee than a lint rule — it cannot be silenced with a disable
// comment.
