import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      // The assembled deployment: a copy of things already linted at source.
      'site/release/**',
      'site/public/examples/**',
      'site/public/schema/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      // Rendered from the repository's own Markdown at build time.
      'site/src/generated/**',
      // Machine-written from the schema. Linting generated code reports
      // thousands of complaints about a file nobody edits.
      '**/*.generated.js',
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
    // Node programs that are not built by TypeScript: the site's server, and
    // anything else run directly by node. Their globals are Node's, which the
    // browser-oriented default does not know about.
    files: ['site/server/**/*.mjs'],
    languageOptions: {
      globals: {
        AbortController: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      // It is a server: its startup line and its error log are how an operator
      // knows what happened.
      'no-console': 'off',
    },
  },
  {
    // Tests, repository tooling and command-line programs. Writing to stdout is
    // what a CLI is for.
    files: [
      '**/*.test.ts',
      'tools/**/*.ts',
      '**/src/cli.ts',
      '**/src/reporters/*.ts',
      // Build-time generators. Their output line is how you know what they did.
      'site/generate/**/*.ts',
    ],
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
