// Loads the parts of antd the theme audit needs: the theme API, and every component's token
// derivation. Component token functions are internal API spread over ~60 style modules, so instead
// of listing them, the loader wraps antd's own style-hook factory and records each component that
// registers with it while its style modules load. A new antd release is then covered automatically.
//
// The same code runs against the repository's installed antd (loaded with its own require) and
// against the copies bundled into dist/ (see scripts/build.mjs), so `load` takes a path relative to
// the antd package root, or a bare dependency name.

export type Algorithm = (token: Record<string, unknown>, mapToken?: Record<string, unknown>) => Record<string, unknown>;
export type ComponentDefaults = (token: Record<string, unknown>) => Record<string, unknown>;

export interface AntdRuntime {
  version: string;
  major: number;
  theme: {
    getDesignToken: (config?: object) => Record<string, unknown>;
    defaultAlgorithm: Algorithm;
    darkAlgorithm: Algorithm;
    compactAlgorithm: Algorithm;
    defaultSeed: Record<string, unknown>;
  };
  /** antd's own getComputedToken from theme/useToken, which also derives `components.*`. */
  getComputedToken: (origin: object, override: object, theme: unknown) => Record<string, unknown>;
  createTheme: (algorithm: Algorithm | Algorithm[]) => unknown;
  defaultTheme: unknown;
  /** Component name (as used in `theme.components`) → its default-token functions or objects. */
  components: Map<string, (ComponentDefaults | Record<string, unknown>)[]>;
}

type Load = (id: string) => Record<string, unknown>;

const HOOK_FACTORIES = ['genStyleHooks', 'genComponentStyleHook', 'genSubStyleComponent'] as const;

/** `styleFiles`: every style module, relative to the package root, e.g. "lib/button/style/index.js". */
export function collectAntd(load: Load, styleFiles: readonly string[], version: string): AntdRuntime {
  const components = new Map<string, (ComponentDefaults | Record<string, unknown>)[]>();
  const factories = load('lib/theme/util/genStyleUtils.js');
  const originals = HOOK_FACTORIES.map((name) => [name, factories[name]] as const);
  for (const [name, original] of originals) {
    if (typeof original !== 'function') throw new Error(`antd ${version}: theme/util/genStyleUtils has no ${name}.`);
    factories[name] = (component: string | string[], styleFn: unknown, getDefaultToken: unknown, ...rest: unknown[]) => {
      const key = Array.isArray(component) ? component[0] : component;
      const list = components.get(key) ?? [];
      if (getDefaultToken && !list.includes(getDefaultToken as ComponentDefaults)) list.push(getDefaultToken as ComponentDefaults);
      components.set(key, list);
      return (original as (...args: unknown[]) => unknown)(component, styleFn, getDefaultToken, ...rest);
    };
  }
  // Menu and Tooltip create their hook inside a function, so it never runs at load; their exported
  // prepareComponentToken is picked up instead, named after the component's directory.
  const exported: [dir: string, fn: ComponentDefaults][] = [];
  try {
    for (const file of styleFiles) {
      const mod = load(file);
      if (typeof mod.prepareComponentToken === 'function') {
        exported.push([file.split('/')[1], mod.prepareComponentToken as ComponentDefaults]);
      }
    }
  } finally {
    for (const [name, original] of originals) factories[name] = original;
  }
  const registered = new Set([...components.values()].flat());
  for (const [dir, fn] of exported) {
    if (registered.has(fn)) continue;
    const name = dir.replace(/(^|-)([a-z])/g, (_, _dash: string, c: string) => c.toUpperCase());
    components.set(name, [...(components.get(name) ?? []), fn]);
    registered.add(fn);
  }

  const theme = (load('lib/theme/index.js').default ?? load('lib/theme/index.js')) as AntdRuntime['theme'];
  const { getComputedToken } = load('lib/theme/useToken.js') as unknown as Pick<AntdRuntime, 'getComputedToken'>;
  const { defaultTheme } = load('lib/theme/context.js');
  const { createTheme } = load('@ant-design/cssinjs') as unknown as Pick<AntdRuntime, 'createTheme'>;
  return { version, major: Number(version.split('.')[0]), theme, getComputedToken, createTheme, defaultTheme, components };
}

/** Matches the style modules collectAntd loads, given paths relative to the package root. */
export function isStyleFile(relative: string): boolean {
  return /^lib\/.+\/style(\/[^/]+)?\.js$/.test(relative.replace(/\\/g, '/'));
}
