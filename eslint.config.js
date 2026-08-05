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
    // The core package must stay dependency-free and side-effect-free.
    // See docs/decisions — dependency-free core.
    files: ['sdk/js/packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*'],
              message:
                'The core package must not import anything outside itself: it is dependency-free by contract.',
            },
            { group: ['./*', '../*'], message: '', allowTypeImports: true },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', 'tools/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
