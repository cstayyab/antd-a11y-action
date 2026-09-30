// Finds antd (the repository's own install, else a bundled copy of the same major) and derives every
// token a theme config produces: the global seed/map/alias set, and each component's tokens as its
// styles see them, the way ConfigProvider computes them.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { collectAntd, isStyleFile, type Algorithm, type AntdRuntime } from './antd-loader.js';

export type { AntdRuntime } from './antd-loader.js';

/** antd majors the audit supports; each one's component token derivation is tested in CI. */
export const SUPPORTED_MAJORS = [5, 6] as const;
export type AlgorithmName = 'defaultAlgorithm' | 'darkAlgorithm' | 'compactAlgorithm';
export const ALGORITHMS: readonly AlgorithmName[] = ['defaultAlgorithm', 'darkAlgorithm', 'compactAlgorithm'];

/** A theme config with algorithms named rather than as functions, as the discovery step reads them. */
export interface ThemeInput {
  token?: Record<string, unknown>;
  algorithm?: AlgorithmName | AlgorithmName[];
  components?: Record<string, Record<string, unknown> & { algorithm?: boolean | AlgorithmName | AlgorithmName[] }>;
  /** Nested ConfigProvider: false starts from the default theme instead of the parent's. */
  inherit?: boolean;
}

export interface LoadedAntd extends AntdRuntime {
  /** Where antd came from: the repository's node_modules, or the copy bundled with the action. */
  source: 'repository' | 'bundled';
  /** Why the bundled copy was used, and which major it picked. */
  note?: string;
}

// Set by scripts/build.mjs: the bundled copies sit next to dist/index.mjs as antd<major>.mjs.
declare const __ANTD_BUNDLED__: boolean | undefined;

const cache = new Map<string, LoadedAntd>();

function styleFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (isStyleFile(path.relative(root, full))) files.push(path.relative(root, full).replace(/\\/g, '/'));
    }
  };
  walk(path.join(root, 'lib'));
  return files.sort();
}

/** Loads antd from its package directory with that install's own require, so its dependencies match. */
export function loadAntdFrom(packageJson: string, source: LoadedAntd['source'] = 'repository'): LoadedAntd {
  const cached = cache.get(packageJson);
  if (cached) return cached;
  const root = path.dirname(packageJson);
  const require = createRequire(packageJson);
  const { version } = JSON.parse(readFileSync(packageJson, 'utf8')) as { version: string };
  const runtime = collectAntd(
    (id) => require(id.startsWith('lib/') ? path.join(root, id) : id) as Record<string, unknown>,
    styleFiles(root),
    version,
  );
  const loaded = { ...runtime, source };
  cache.set(packageJson, loaded);
  return loaded;
}

/** The repository's antd, looked up from each directory in turn (e.g. working-directory, then the root). */
export function findRepositoryAntd(dirs: readonly string[]): string | undefined {
  for (const dir of dirs) {
    try {
      return createRequire(path.join(dir, 'package.json')).resolve('antd/package.json');
    } catch {
      // not installed here
    }
  }
  return undefined;
}

/** The antd major a repository declares in package.json, when antd itself isn't installed. */
export function declaredMajor(dirs: readonly string[]): number | undefined {
  for (const dir of dirs) {
    const file = path.join(dir, 'package.json');
    if (!existsSync(file)) continue;
    try {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, string> | undefined>;
      const range = pkg.dependencies?.antd ?? pkg.devDependencies?.antd ?? pkg.peerDependencies?.antd;
      const major = range && /(\d+)/.exec(range.replace(/^npm:antd@/, ''))?.[1];
      if (major) return Number(major);
    } catch {
      // unreadable package.json; try the next directory
    }
  }
  return undefined;
}

async function loadBundled(major: number): Promise<LoadedAntd> {
  const key = `bundled:${major}`;
  const cached = cache.get(key);
  if (cached) return cached;
  let loaded: LoadedAntd;
  if (typeof __ANTD_BUNDLED__ !== 'undefined' && __ANTD_BUNDLED__) {
    const url = new URL(`./antd${major}.mjs`, import.meta.url);
    const runtime = (await import(url.href)).default as AntdRuntime;
    loaded = { ...runtime, source: 'bundled' };
  } else {
    // Running from source (tests): the action's own dev dependencies stand in for the bundle.
    const pkg = major === 5 ? 'antd-v5' : 'antd';
    const here = createRequire(import.meta.url);
    loaded = { ...loadAntdFrom(here.resolve(`${pkg}/package.json`), 'bundled') };
  }
  cache.set(key, loaded);
  return loaded;
}

/**
 * The repository's antd when it's installed (the static job doesn't need `npm ci`, so it may not be);
 * otherwise the bundled copy of the major package.json declares, or the newest supported one.
 */
export async function loadAntd(dirs: readonly string[]): Promise<LoadedAntd> {
  const installed = findRepositoryAntd(dirs);
  if (installed) {
    const loaded = loadAntdFrom(installed);
    if (SUPPORTED_MAJORS.includes(loaded.major as 5 | 6)) return loaded;
    const fallback = await loadBundled(SUPPORTED_MAJORS.at(-1)!);
    return { ...fallback, note: `antd ${loaded.version} is not supported by the theme audit (antd ${SUPPORTED_MAJORS.join(' and ')} are); used the bundled antd ${fallback.version}` };
  }
  const declared = declaredMajor(dirs);
  const major = declared && SUPPORTED_MAJORS.includes(declared as 5 | 6) ? declared : SUPPORTED_MAJORS.at(-1)!;
  const loaded = await loadBundled(major);
  const why = declared
    ? `antd isn't installed (run npm ci before this step to audit your exact version), so the bundled antd ${loaded.version} was used`
    : `no antd dependency found, so the bundled antd ${loaded.version} was used`;
  return { ...loaded, note: why };
}

export type TokenMap = Record<string, unknown>;

export interface DerivedTheme {
  /** Seed, map and alias tokens. */
  global: TokenMap;
  /** Every token a component's styles see: global tokens, its `components.*` overrides, and its own tokens. */
  component(name: string): TokenMap;
  /** Only the component's own tokens (defaults merged with overrides). */
  componentOwn(name: string): TokenMap;
}

function algorithms(antd: AntdRuntime, names: AlgorithmName | AlgorithmName[] | undefined): Algorithm[] {
  const list = names === undefined ? [] : Array.isArray(names) ? names : [names];
  return list.map((name) => {
    const fn = antd.theme[name];
    if (typeof fn !== 'function') throw new Error(`Unknown antd algorithm "${name}".`);
    return fn;
  });
}

/** Replicates ConfigProvider's theme handling (config-provider/index.js "Dynamic theme") and each style hook's token merge. */
export function deriveTheme(antd: AntdRuntime, input: ThemeInput): DerivedTheme {
  const algos = algorithms(antd, input.algorithm);
  const themeObj = algos.length ? antd.createTheme(algos) : antd.defaultTheme;
  const parsedComponents: Record<string, Record<string, unknown>> = {};
  for (const [name, value] of Object.entries(input.components ?? {})) {
    const { algorithm, ...tokens } = value;
    const parsed: Record<string, unknown> = { ...tokens };
    if (algorithm === true) parsed.theme = themeObj;
    else if (algorithm) parsed.theme = antd.createTheme(algorithms(antd, algorithm));
    parsedComponents[name] = parsed;
  }
  const mergedToken = { ...antd.theme.defaultSeed, ...input.token };
  const global = antd.getComputedToken(mergedToken, { override: mergedToken, ...parsedComponents }, themeObj);

  const own = new Map<string, TokenMap>();
  const componentOwn = (name: string): TokenMap => {
    let tokens = own.get(name);
    if (!tokens) {
      const custom = (global[name] as TokenMap | undefined) ?? {};
      const real = { ...global, ...custom };
      const defaults: TokenMap = {};
      for (const fn of antd.components.get(name) ?? []) Object.assign(defaults, typeof fn === 'function' ? fn(real) : fn);
      tokens = { ...defaults, ...custom };
      own.set(name, tokens);
    }
    return tokens;
  };
  return {
    global,
    componentOwn,
    component: (name) => ({ ...global, ...((global[name] as TokenMap | undefined) ?? {}), ...componentOwn(name) }),
  };
}

/** Component names antd registers style hooks for, sorted. */
export function componentNames(antd: AntdRuntime): string[] {
  return [...antd.components.keys()].sort();
}
