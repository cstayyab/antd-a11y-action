import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'eslint-plugin-antd-a11y': fileURLToPath(
        new URL('./packages/eslint-plugin-antd-a11y/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    include: ['packages/*/tests/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
  },
});
