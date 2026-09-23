// Bundles the action into dist/index.mjs, which GitHub runs directly (no npm install on the runner).
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
await rm(`${root}/dist`, { recursive: true, force: true });

const result = await build({
  // index.mjs: the static action. runtime-report.mjs: the runtime sub-action's reporter.
  entryPoints: { index: `${root}/src/index.ts`, 'runtime-report': `${root}/src/runtime/index.ts` },
  outdir: `${root}/dist`,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  minify: true,
  keepNames: true,
  sourcemap: false,
  alias: { 'eslint-plugin-antd-a11y': `${root}/packages/eslint-plugin-antd-a11y/src/index.ts` },
  // CommonJS dependencies use require(), __filename and __dirname; give the ESM bundle real ones.
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      "import { dirname as __pathDirname } from 'node:path';",
      'const require = __createRequire(import.meta.url);',
      'const __filename = __fileURLToPath(import.meta.url);',
      'const __dirname = __pathDirname(__filename);',
    ].join(' '),
  },
  // Optional ESLint dependency for TypeScript config files; the action never loads a config file.
  external: ['jiti', 'jiti/package.json'],
  legalComments: 'linked',
  metafile: true,
  logLevel: 'warning',
});

for (const [file, output] of Object.entries(result.metafile.outputs)) {
  if (file.endsWith('.mjs')) console.log(`${file.replace(`${root}/`, '')} built (${(output.bytes / 1024 / 1024).toFixed(2)} MB)`);
}
