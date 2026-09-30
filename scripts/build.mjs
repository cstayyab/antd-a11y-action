// Bundles the action into dist/index.mjs, which GitHub runs directly (no npm install on the runner).
import { readdirSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
await rm(`${root}/dist`, { recursive: true, force: true });

// CommonJS dependencies use require(), __filename and __dirname; give the ESM bundle real ones.
const banner = {
  js: [
    "import { createRequire as __createRequire } from 'node:module';",
    "import { fileURLToPath as __fileURLToPath } from 'node:url';",
    "import { dirname as __pathDirname } from 'node:path';",
    'const require = __createRequire(import.meta.url);',
    'const __filename = __fileURLToPath(import.meta.url);',
    'const __dirname = __pathDirname(__filename);',
  ].join(' '),
};

const common = {
  outdir: `${root}/dist`,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  minify: true,
  keepNames: true,
  sourcemap: false,
  // The theme audit loads the bundled antd copies below (dist/antd<major>.mjs) when the repository has none.
  define: { __ANTD_BUNDLED__: 'true' },
  banner,
  // Optional ESLint dependency for TypeScript config files; the action never loads a config file.
  external: ['jiti', 'jiti/package.json'],
  legalComments: 'linked',
  metafile: true,
  logLevel: 'warning',
};
const plugin = `${root}/packages/eslint-plugin-antd-a11y/src/index.ts`;

// index.mjs: the static action. runtime-report.mjs: the runtime sub-action's reporter, which never
// parses source (baseline fingerprints are for static findings), so it gets a stub parser.
const builds = await Promise.all([
  build({ ...common, entryPoints: { index: `${root}/src/index.ts` }, alias: { 'eslint-plugin-antd-a11y': plugin } }),
  build({
    ...common,
    entryPoints: { 'runtime-report': `${root}/src/runtime/index.ts` },
    alias: { 'eslint-plugin-antd-a11y': plugin, '@typescript-eslint/typescript-estree': `${root}/scripts/stubs/typescript-estree.mjs` },
  }),
]);

for (const result of builds) {
  for (const [file, output] of Object.entries(result.metafile.outputs)) {
    if (file.endsWith('.mjs')) console.log(`${file.replace(`${root}/`, '')} built (${(output.bytes / 1024 / 1024).toFixed(2)} MB)`);
  }
}

// antd copies for the theme audit, one per supported major: the theme API and every style module,
// collected the same way as from a repository's own antd (src/theme/antd-loader.ts).
for (const [major, pkg] of [[5, 'antd-v5'], [6, 'antd']]) {
  const antdRoot = path.dirname(require.resolve(`${pkg}/package.json`));
  const { version } = JSON.parse(readFileSync(path.join(antdRoot, 'package.json'), 'utf8'));
  const styleFiles = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(antdRoot, full).split(path.sep).join('/');
      if (entry.isDirectory()) visit(full);
      else if (/^lib\/.+\/style(\/[^/]+)?\.js$/.test(rel)) styleFiles.push(rel);
    }
  };
  visit(path.join(antdRoot, 'lib'));
  styleFiles.sort();
  const ids = ['lib/theme/util/genStyleUtils.js', 'lib/theme/index.js', 'lib/theme/useToken.js', 'lib/theme/context.js', ...styleFiles];
  const cssinjs = require.resolve('@ant-design/cssinjs', { paths: [antdRoot] });
  const modules = [
    ...ids.map((id) => `${JSON.stringify(id)}: () => require(${JSON.stringify(path.join(antdRoot, id))})`),
    `'@ant-design/cssinjs': () => require(${JSON.stringify(cssinjs)})`,
  ];
  const contents = [
    `import { collectAntd } from ${JSON.stringify(`${root}/src/theme/antd-loader.ts`)};`,
    `const modules = {${modules.join(',\n')}};`,
    `export default collectAntd((id) => modules[id](), ${JSON.stringify(styleFiles)}, ${JSON.stringify(version)});`,
  ].join('\n');
  const out = await build({
    stdin: { contents, resolveDir: antdRoot, sourcefile: `antd${major}-entry.js`, loader: 'js' },
    outfile: `${root}/dist/antd${major}.mjs`,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    banner,
    legalComments: 'linked',
    metafile: true,
    logLevel: 'warning',
  });
  const bytes = Object.values(out.metafile.outputs).reduce((n, o) => n + o.bytes, 0);
  console.log(`dist/antd${major}.mjs built (antd ${version}, ${(bytes / 1024 / 1024).toFixed(2)} MB)`);
}
