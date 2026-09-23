import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'packages/*/dist/', 'fixtures/', 'node_modules/', 'coverage/', 'runtime/node_modules/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // The injected guard runs in the browser.
  {
    files: ['runtime/guard/**/*.js'],
    languageOptions: { globals: { ...globals.browser, process: 'readonly' } },
  },
);
