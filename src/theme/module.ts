// The opt-in `theme-config` input: a module that exports the theme, for themes built with functions
// or imports that discovery can't read statically. It runs the repository's code, so it is evaluated
// in a separate Node process with only PATH in its environment (no token) and a time limit: the same
// trust as the runtime action, which runs the app.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ThemeConfiguration } from './audit.js';
import { ALGORITHMS, type AlgorithmName, type ThemeInput } from './tokens.js';

const TIMEOUT_MS = 30_000;

// Runs in the child: imports the module and prints its theme export as JSON, with antd's algorithm
// functions replaced by their names.
const RUNNER = `
import { createRequire } from 'node:module';
const [file, exportName, antdFrom] = process.argv.slice(2);
const mod = await import(file);
const req = createRequire(antdFrom);
let algorithms = {};
try {
  const { theme } = req('antd');
  algorithms = { defaultAlgorithm: theme.defaultAlgorithm, darkAlgorithm: theme.darkAlgorithm, compactAlgorithm: theme.compactAlgorithm };
} catch {}
const value = exportName ? mod[exportName] : (mod.default ?? mod.theme);
const json = JSON.stringify(value === undefined ? null : value, (key, v) => {
  if (typeof v !== 'function') return v;
  const name = Object.keys(algorithms).find((n) => algorithms[n] === v);
  return name ? { $algorithm: name } : { $function: v.name || 'anonymous' };
});
process.stdout.write(json ?? 'null');
`;

export class ThemeModuleError extends Error {}

function run(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      args,
      { cwd, timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024, env: { PATH: process.env.PATH ?? '' } },
      (error, stdout, stderr) => {
        if (error) reject(new ThemeModuleError(`${(stderr || error.message).trim().split('\n').slice(0, 6).join('\n')}`));
        else resolve(stdout);
      },
    );
  });
}

/**
 * Bundles the module with the repository's own esbuild when it has one, so TSX and extensionless
 * imports work. The bundle sits next to the source so its package imports (antd) resolve as they do there.
 */
async function bundleIfPossible(file: string, workspace: string): Promise<string> {
  let esbuild: typeof import('esbuild') | undefined;
  try {
    esbuild = createRequire(path.join(workspace, 'package.json'))('esbuild') as typeof import('esbuild');
  } catch {
    return file; // Node loads it directly; TypeScript types are stripped natively.
  }
  const out = path.join(path.dirname(file), `.antd-a11y-theme-${process.pid}-${Date.now()}.mjs`);
  await esbuild.build({
    entryPoints: [file],
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    jsx: 'automatic',
    logLevel: 'silent',
    absWorkingDir: workspace,
  });
  return out;
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function toInput(value: Json, where: string): ThemeInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ThemeModuleError(`${where} is not a theme object.`);
  const algo = (v: Json): AlgorithmName => {
    const name = v && typeof v === 'object' && !Array.isArray(v) ? v.$algorithm : undefined;
    if (typeof name === 'string' && (ALGORITHMS as readonly string[]).includes(name)) return name as AlgorithmName;
    const fn = v && typeof v === 'object' && !Array.isArray(v) ? v.$function : undefined;
    throw new ThemeModuleError(`${where}: algorithm ${fn ? `"${fn}"` : JSON.stringify(v)} is not one of antd's (a custom algorithm can't be audited).`);
  };
  const input: ThemeInput = {};
  if (value.algorithm !== undefined && value.algorithm !== null) {
    const list = Array.isArray(value.algorithm) ? value.algorithm.map(algo) : [algo(value.algorithm)];
    if (list.length) input.algorithm = list.length === 1 ? list[0] : list;
  }
  if (value.token && typeof value.token === 'object' && !Array.isArray(value.token)) input.token = value.token;
  if (value.components && typeof value.components === 'object' && !Array.isArray(value.components)) {
    input.components = {};
    for (const [name, tokens] of Object.entries(value.components)) {
      if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) continue;
      const { algorithm, ...rest } = tokens;
      const entry: NonNullable<ThemeInput['components']>[string] = { ...rest };
      if (typeof algorithm === 'boolean') entry.algorithm = algorithm;
      else if (algorithm !== undefined && algorithm !== null) {
        const list = Array.isArray(algorithm) ? algorithm.map(algo) : [algo(algorithm)];
        entry.algorithm = list.length === 1 ? list[0] : list;
      }
      input.components[name] = entry;
    }
  }
  return input;
}

const looksLikeTheme = (v: Json) => !!v && typeof v === 'object' && !Array.isArray(v) && ['token', 'components', 'algorithm'].some((k) => k in v);

/**
 * `spec` is "path" (default export, else `theme`) or "path#exportName". The export can be one theme,
 * an array of themes, or an object of named themes ({ light, dark }).
 */
export async function loadThemeModule(spec: string, workspace: string): Promise<ThemeConfiguration[]> {
  const [rel, exportName] = spec.split('#');
  const file = path.resolve(workspace, rel);
  if (!file.startsWith(path.resolve(workspace) + path.sep)) throw new ThemeModuleError(`theme-config "${spec}" must be inside the repository.`);
  if (!existsSync(file)) throw new ThemeModuleError(`theme-config "${rel}" does not exist.`);
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'antd-a11y-theme-'));
  let entry = file;
  try {
    entry = await bundleIfPossible(file, workspace);
    const runner = path.join(tmp, 'runner.mjs');
    await writeFile(runner, RUNNER);
    const stdout = await run([runner, pathToFileURL(entry).href, exportName ?? '', path.join(path.dirname(file), 'package.json')], workspace);
    const value = JSON.parse(stdout) as Json;
    const label = exportName ? `${rel}#${exportName}` : rel;
    if (value === null) throw new ThemeModuleError(`${label} exports no theme (expected a default export, a "theme" export, or name one with ${rel}#exportName).`);
    const base = { file: rel, line: 1 };
    if (looksLikeTheme(value)) return [{ name: label, input: toInput(value, label), ...base }];
    const entries: [string, Json][] = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value as Record<string, Json>);
    const themes = entries.filter(([, v]) => looksLikeTheme(v));
    if (!themes.length) throw new ThemeModuleError(`${label} is not a theme config, an array of them, or an object of named ones.`);
    return themes.map(([key, v]) => ({ name: `${label} (${key})`, input: toInput(v, `${label}.${key}`), ...base }));
  } finally {
    await rm(tmp, { recursive: true, force: true });
    if (entry !== file) await rm(entry, { force: true });
  }
}
