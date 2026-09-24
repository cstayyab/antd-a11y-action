// The ESLint config the action lints with, and the one `antdA11y.config()` gives an app, built by the
// same function so a local ESLint run and the PR check see the same rules, settings and filters.
import type { Linter } from 'eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import { plugin, VERSION } from '../plugin.js';
import type { Impact } from '../utils/create-rule.js';
import { eslintRules, resolveConfig, type A11yConfig, type FileShape } from './config.js';
import { evaluateMessages } from './findings.js';
import { wrapPlugin } from './jsx-a11y-filters.js';

export const SOURCE_EXTENSIONS = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts'];
export const DEFAULT_CONFIG_FILE = '.github/antd-a11y.json';
export const DEFAULT_FAIL_ON: Impact = 'serious';

// jsx-a11y rules run through filters for patterns they can't see through (spreads, conditional
// roles, keyboard-handling roles), whatever options they are given.
const wrappedJsxA11y = wrapPlugin(jsxA11y);

export interface BuildOptions {
  files?: string[];
  parser?: Linter.Parser;
  processor?: Linter.Processor;
  linterOptions?: Linter.Config['linterOptions'];
}

export function buildFlatConfig(config: A11yConfig, options: BuildOptions = {}): Linter.Config[] {
  const { components, polymorphicPropName, attributes } = config.settings;
  return [
    {
      name: 'antd-a11y',
      files: options.files ?? [`**/*.{${SOURCE_EXTENSIONS.join(',')}}`],
      languageOptions: {
        ...(options.parser ? { parser: options.parser } : {}),
        ecmaVersion: 'latest',
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      ...(options.linterOptions ? { linterOptions: options.linterOptions } : {}),
      // Registered even with the preset off, so a rule turned on individually still resolves.
      plugins: { 'antd-a11y': plugin, 'jsx-a11y': wrappedJsxA11y } as unknown as Linter.Config['plugins'],
      settings: {
        'antd-a11y': { aliases: config.aliases },
        'jsx-a11y': {
          components,
          ...(polymorphicPropName ? { polymorphicPropName } : {}),
          ...(attributes ? { attributes } : {}),
        },
      },
      rules: eslintRules(config),
      ...(options.processor ? { processor: options.processor } : {}),
    },
  ];
}

/**
 * Applies what ESLint's rule model can't express, after linting: drops the jsx-a11y duplicate of an
 * antd finding, applies a11y-ignore comments, and sets each finding's severity from whether it would
 * block the PR check (error) or not (warning). Other plugins' messages pass through untouched.
 */
export function createProcessor(config: A11yConfig, failOn: Impact | 'none'): Linter.Processor {
  const sources = new Map<string, string>();
  return {
    meta: { name: 'antd-a11y/findings', version: VERSION },
    supportsAutofix: true,
    preprocess(text: string, filename: string) {
      sources.set(filename, text);
      return [text];
    },
    postprocess(messageLists: Linter.LintMessage[][], filename: string) {
      const code = sources.get(filename) ?? '';
      sources.delete(filename);
      const evaluation = evaluateMessages(messageLists.flat(), code, { config, failOn });
      const findings = evaluation.findings.map(({ message, blocking }) => ({
        ...message,
        severity: blocking ? (2 as const) : (1 as const),
      }));
      return [...evaluation.other, ...findings].sort((a, b) => a.line - b.line || a.column - b.column);
    },
  };
}

export interface PluginConfigOptions extends FileShape {
  /** The config file the action reads, relative to `cwd`. `false` skips it. Default `.github/antd-a11y.json`. */
  configFile?: string | false;
  /** Directory the config file path is relative to. Default: the current working directory. */
  cwd?: string;
  /** Files the config applies to. Default: every JS/TS source extension. */
  files?: string[];
  /** Parser for the files, e.g. typescript-eslint's; usually set by the app's own TypeScript config. */
  parser?: Linter.Parser;
  /** Deduplicate, apply a11y-ignore and map blocking to error / warning. Default true. */
  processor?: boolean;
}

/**
 * Flat config that checks like the static action: same rules, config file, filters, suppressions and
 * blocking threshold. `eslint` exits non-zero exactly when the PR check would fail.
 */
export function config(options: PluginConfigOptions = {}): Linter.Config[] {
  const { configFile = DEFAULT_CONFIG_FILE, cwd = process.cwd(), files, parser, processor = true, ...overrides } = options;
  const resolved = resolveConfig({ workspace: cwd, configFile: configFile || undefined, overrides });
  const failOn = resolved.failOn ?? DEFAULT_FAIL_ON;
  return buildFlatConfig(resolved, {
    files,
    parser,
    processor: processor ? createProcessor(resolved, failOn) : undefined,
  });
}
