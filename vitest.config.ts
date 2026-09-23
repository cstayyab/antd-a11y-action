import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const DOM_TESTS = ['packages/*/tests/dom/**/*.test.{ts,tsx}'];

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
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['packages/*/tests/rules/**/*.test.ts', 'tests/**/*.test.ts'],
          exclude: ['tests/runtime/**'],
        },
      },
      // The runtime sub-action: guard, setup scripts, resolver and reporter.
      {
        extends: true,
        test: { name: 'runtime', include: ['tests/runtime/**/*.test.{ts,tsx}'] },
      },
      // The DOM checks run once per supported antd major. `antd` in package.json is v6;
      // v5 is installed under the npm aliases antd-v5 / @ant-design/icons-v5.
      {
        extends: true,
        resolve: {
          alias: [
            { find: /^antd$/, replacement: 'antd-v5' },
            { find: /^@ant-design\/icons$/, replacement: '@ant-design/icons-v5' },
          ],
        },
        test: { name: 'dom-antd5', include: DOM_TESTS, env: { ANTD_MAJOR: '5' } },
      },
      {
        extends: true,
        test: { name: 'dom-antd6', include: DOM_TESTS, env: { ANTD_MAJOR: '6' } },
      },
    ],
  },
});
