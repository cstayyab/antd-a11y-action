// Configuration shared by the ESLint plugin and the GitHub Action: the jsx-a11y layer, per-rule
// severity, aliases and the blocking threshold. Sources, lowest to highest precedence:
// built-in defaults < config file (JSON) < plugin options < action inputs.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import type { Linter } from 'eslint';
import { configs as antdConfigs, rules as antdRules } from '../plugin.js';
import { aliasErrors, aliasWarnings, type AliasMap } from '../utils/aliases.js';
import type { Impact } from '../utils/create-rule.js';
import { IMPACTS } from './impact.js';

export type Preset = 'recommended' | 'strict' | false;

/**
 * off: the rule doesn't run (static) or its findings are dropped (runtime).
 * warn: findings are reported but never block. error: findings always block.
 * No override: the finding blocks when its impact reaches `fail-on`.
 */
export type Severity = 'off' | 'warn' | 'error';

export interface RuleOverride {
  severity: Severity;
  /** ESLint rule options, passed through unchanged (static rules only). */
  options?: unknown[];
  source: 'file' | 'input';
}

export interface JsxA11ySettings {
  components: Record<string, string>;
  polymorphicPropName?: string;
  attributes?: Record<string, string[]>;
}

export interface A11yConfig {
  jsxA11y: Preset;
  rules: Map<string, RuleOverride>;
  settings: JsxA11ySettings;
  /** In-house wrappers the antd rules check as the antd component they wrap. */
  aliases: AliasMap;
  /** Lowest impact that blocks, from the config file or options; the action's fail-on input overrides it. */
  failOn?: Impact | 'none';
  /** Repo-relative path of the config file that was applied, if any. */
  file?: string;
}

/** The action's name for it. */
export type ActionConfig = A11yConfig;

/** FontAwesome's React component renders an aria-hidden <svg>, so as a button's only child it names nothing. */
export const DEFAULT_COMPONENTS: Record<string, string> = { FontAwesomeIcon: 'svg' };

const ANTD_PREFIX = 'antd-a11y/';
const JSX_PREFIX = 'jsx-a11y/';
const SEVERITIES: Severity[] = ['off', 'warn', 'error'];

export class ConfigError extends Error {}

function severityOf(value: unknown, where: string): Severity {
  const v = typeof value === 'number' ? (['off', 'warn', 'error'] as const)[value] : String(value).toLowerCase();
  if (!SEVERITIES.includes(v as Severity)) {
    throw new ConfigError(`${where}: severity must be off, warn or error, got ${JSON.stringify(value)}.`);
  }
  return v as Severity;
}

/** Full rule id; bare names of our own rules may omit the "antd-a11y/" prefix. */
export function normalizeRuleId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.includes('/')) return trimmed;
  if (trimmed in antdRules) return `${ANTD_PREFIX}${trimmed}`;
  return trimmed;
}

/** Checks runtime/* ids, which only the runtime action knows; without one, any runtime/<name> is accepted. */
export type RuntimeRuleCheck = (name: string) => boolean;
let runtimeRuleCheck: RuntimeRuleCheck = (name) => /^[a-z][a-z0-9-]*$/.test(name);

/** The action registers its runtime rule list, so a typo in a runtime/* id fails there as well. */
export function setRuntimeRuleCheck(check: RuntimeRuleCheck): void {
  runtimeRuleCheck = check;
}

export function isKnownRule(id: string): boolean {
  if (id.startsWith(ANTD_PREFIX)) return id.slice(ANTD_PREFIX.length) in antdRules;
  if (id.startsWith(JSX_PREFIX)) return id.slice(JSX_PREFIX.length) in (jsxA11y.rules ?? {});
  if (id.startsWith('runtime/')) return runtimeRuleCheck(id.slice('runtime/'.length));
  return id.startsWith('axe/') && id.length > 'axe/'.length; // axe has too many rules to list; any id is accepted
}

function checkKnown(id: string, where: string): void {
  if (!isKnownRule(id)) {
    throw new ConfigError(
      `${where}: unknown rule "${id}". Use antd-a11y/<rule>, jsx-a11y/<rule>, runtime/<rule> or axe/<rule-id>.`,
    );
  }
}

function lines(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);
}

/** `rules` input: one "rule-id: off|warn|error" per line. */
export function parseRulesInput(value: string | undefined): Map<string, RuleOverride> {
  const rules = new Map<string, RuleOverride>();
  for (const line of lines(value)) {
    const m = /^([^:\s]+)\s*:\s*(\S+)$/.exec(line);
    if (!m) throw new ConfigError(`rules input: expected "rule-id: off|warn|error", got "${line}".`);
    const id = normalizeRuleId(m[1]);
    checkKnown(id, 'rules input');
    rules.set(id, { severity: severityOf(m[2], `rules input (${id})`), source: 'input' });
  }
  return rules;
}

/** `components` input: one "ComponentName: tag" per line. */
export function parseComponentsInput(value: string | undefined): Record<string, string> {
  const components: Record<string, string> = {};
  for (const line of lines(value)) {
    const m = /^([A-Za-z_$][\w$.]*)\s*:\s*([a-z][a-z0-9-]*)$/.exec(line);
    if (!m) throw new ConfigError(`components input: expected "ComponentName: tag", got "${line}".`);
    components[m[1]] = m[2];
  }
  return components;
}

/** `aliases` input: one "WrapperName: AntdComponent" per line. The per-rule form needs the config file. */
export function parseAliasesInput(value: string | undefined): AliasMap {
  const aliases: AliasMap = {};
  for (const line of lines(value)) {
    const m = /^([^:\s]+)\s*:\s*(\S+)$/.exec(line);
    if (!m) throw new ConfigError(`aliases input: expected "WrapperName: AntdComponent", got "${line}".`);
    checkAliases({ [m[1]]: m[2] }, 'aliases input');
    aliases[m[1]] = { as: m[2] };
  }
  return aliases;
}

function checkAliases(raw: unknown, where: string): void {
  const errors = aliasErrors(raw, Object.keys(antdRules));
  if (errors.length) throw new ConfigError(`${where}: ${errors.join(' ')}`);
}

function fileAliases(shape: FileShape, file: string): AliasMap {
  if (shape.aliases === undefined) return {};
  checkAliases(shape.aliases, file);
  return Object.fromEntries(
    Object.entries(shape.aliases as Record<string, unknown>).map(([name, value]) => [
      name,
      typeof value === 'string' ? { as: value } : (value as AliasMap[string]),
    ]),
  );
}

export function parsePreset(value: string | undefined, where = 'jsx-a11y input'): Preset {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === '' || v === 'true' || v === 'recommended') return 'recommended';
  if (v === 'strict') return 'strict';
  if (v === 'false' || v === 'off') return false;
  throw new ConfigError(`${where}: expected recommended, strict or false, got "${value}".`);
}

export function parseFailOn(value: unknown, where: string): Impact | 'none' {
  const v = String(value).trim().toLowerCase();
  if (v === 'none' || (IMPACTS as readonly string[]).includes(v)) return v as Impact | 'none';
  throw new ConfigError(`${where}: expected ${IMPACTS.join(', ')} or none, got ${JSON.stringify(value)}.`);
}

/** The config file's shape, also accepted as plugin options. */
export interface FileShape {
  jsxA11y?: unknown;
  failOn?: unknown;
  aliases?: unknown;
  rules?: Record<string, unknown>;
  settings?: { components?: unknown; polymorphicPropName?: unknown; attributes?: unknown };
}

/** Reads the JSON config file. Returns null when the file doesn't exist. */
export function readConfigFile(file: string, label = file): FileShape | null {
  if (!existsSync(file)) return null;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new ConfigError(`${label}: not valid JSON (${(error as Error).message}).`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ConfigError(`${label}: expected a JSON object.`);
  checkShape(data, label);
  return data as FileShape;
}

const FILE_KEYS = ['jsxA11y', 'failOn', 'rules', 'settings', 'aliases'];

function checkShape(data: object, label: string): void {
  for (const key of Object.keys(data)) {
    if (key !== '$schema' && !FILE_KEYS.includes(key)) {
      throw new ConfigError(`${label}: unknown key "${key}" (allowed: ${FILE_KEYS.join(', ')}).`);
    }
  }
}

function fileRules(shape: FileShape, file: string): Map<string, RuleOverride> {
  const rules = new Map<string, RuleOverride>();
  for (const [rawId, value] of Object.entries(shape.rules ?? {})) {
    const id = normalizeRuleId(rawId);
    checkKnown(id, file);
    if (Array.isArray(value)) {
      if (value.length === 0) throw new ConfigError(`${file}: rule "${id}" has an empty array.`);
      const options = value.slice(1);
      if (options.length && !id.startsWith(ANTD_PREFIX) && !id.startsWith(JSX_PREFIX)) {
        throw new ConfigError(`${file}: rule "${id}" takes no options (only antd-a11y and jsx-a11y rules do).`);
      }
      rules.set(id, { severity: severityOf(value[0], `${file} (${id})`), options: options.length ? options : undefined, source: 'file' });
    } else {
      rules.set(id, { severity: severityOf(value, `${file} (${id})`), source: 'file' });
    }
  }
  return rules;
}

function fileSettings(shape: FileShape, file: string): Partial<JsxA11ySettings> {
  const s = shape.settings ?? {};
  const out: Partial<JsxA11ySettings> = {};
  if (s.components !== undefined) {
    if (!s.components || typeof s.components !== 'object' || Array.isArray(s.components)) {
      throw new ConfigError(`${file}: settings.components must be an object like {"Icon": "svg"}.`);
    }
    out.components = Object.fromEntries(Object.entries(s.components).map(([k, v]) => [k, String(v)]));
  }
  if (s.polymorphicPropName !== undefined) out.polymorphicPropName = String(s.polymorphicPropName);
  if (s.attributes !== undefined) out.attributes = s.attributes as Record<string, string[]>;
  return out;
}

export interface ConfigInputs {
  /** Raw `jsx-a11y` input; empty means "not set", so the file (or the default) decides. */
  jsxA11y?: string;
  /** Raw `fail-on` input; empty means "not set". */
  failOn?: string;
  rules?: string;
  components?: string;
  aliases?: string;
  /** Path of the config file relative to the workspace; missing files are fine. */
  configFile?: string;
  workspace: string;
  /** Plugin options, in the config file's shape; they override the file. */
  overrides?: FileShape;
}

export function resolveConfig(inputs: ConfigInputs): A11yConfig {
  const configPath = inputs.configFile ? path.resolve(inputs.workspace, inputs.configFile) : undefined;
  const shape = configPath ? readConfigFile(configPath, inputs.configFile) : null;
  const fileLabel = shape && inputs.configFile ? inputs.configFile : undefined;
  const options = inputs.overrides;
  if (options) checkShape(options, 'antd-a11y options');

  let jsx: Preset = 'recommended';
  if (shape?.jsxA11y !== undefined) jsx = parsePreset(String(shape.jsxA11y), `${fileLabel}: jsxA11y`);
  if (options?.jsxA11y !== undefined) jsx = parsePreset(String(options.jsxA11y), 'antd-a11y options: jsxA11y');
  if (inputs.jsxA11y && inputs.jsxA11y.trim() !== '') jsx = parsePreset(inputs.jsxA11y);

  let failOn: Impact | 'none' | undefined;
  if (shape?.failOn !== undefined) failOn = parseFailOn(shape.failOn, `${fileLabel}: failOn`);
  if (options?.failOn !== undefined) failOn = parseFailOn(options.failOn, 'antd-a11y options: failOn');
  if (inputs.failOn && inputs.failOn.trim() !== '') failOn = parseFailOn(inputs.failOn, 'fail-on input');

  const rules = new Map<string, RuleOverride>();
  if (shape) for (const [id, o] of fileRules(shape, fileLabel!)) rules.set(id, o);
  if (options) for (const [id, o] of fileRules(options, 'antd-a11y options')) rules.set(id, { ...o, source: 'input' });
  for (const [id, o] of parseRulesInput(inputs.rules)) {
    // An input changes severity only; keep options the file gave the rule.
    rules.set(id, { ...o, options: rules.get(id)?.options });
  }

  const fromFile = shape ? fileSettings(shape, fileLabel!) : {};
  const fromOptions = options ? fileSettings(options, 'antd-a11y options') : {};
  const settings: JsxA11ySettings = {
    ...fromFile,
    ...fromOptions,
    components: {
      ...DEFAULT_COMPONENTS,
      ...fromFile.components,
      ...fromOptions.components,
      ...parseComponentsInput(inputs.components),
    },
  };
  // A later source replaces an earlier source's entry for that wrapper, per-rule settings included.
  const aliases: AliasMap = {
    ...(shape ? fileAliases(shape, fileLabel!) : {}),
    ...(options ? fileAliases(options, 'antd-a11y options') : {}),
    ...parseAliasesInput(inputs.aliases),
  };
  return { jsxA11y: jsx, rules, settings, aliases, failOn, file: fileLabel };
}

/** Our tuning of jsx-a11y's presets, from beta feedback (see README "Precision"). */
function tunedJsxRules(preset: Exclude<Preset, false>): Linter.RulesRecord {
  const base = (preset === 'strict' ? jsxA11y.flatConfigs.strict.rules : jsxA11y.flatConfigs.recommended.rules) as Linter.RulesRecord;
  const rules: Linter.RulesRecord = { ...base };
  // The rule that finds missing names on native controls; off in both upstream presets.
  const label = base['jsx-a11y/control-has-associated-label'];
  rules['jsx-a11y/control-has-associated-label'] = ['error', ...(Array.isArray(label) ? label.slice(1) : [])];
  // Legitimate uses (sole field on an auth page, focus restore, antd Dropdown menu focus) dominate.
  rules['jsx-a11y/no-autofocus'] = 'off';
  // role="list" on ul/ol restores list semantics Safari/VoiceOver drop under list-style: none.
  rules['jsx-a11y/no-redundant-roles'] = ['error', { ul: ['list'], ol: ['list'] }];
  return rules;
}

/** ESLint rules for the static action: our antd rules, the jsx-a11y preset, then overrides. */
export function eslintRules(config: A11yConfig): Linter.RulesRecord {
  const rules: Linter.RulesRecord = {
    ...(config.jsxA11y ? tunedJsxRules(config.jsxA11y) : {}),
    ...(antdConfigs.recommended.rules as Linter.RulesRecord),
  };
  for (const [id, override] of config.rules) {
    if (!id.startsWith(ANTD_PREFIX) && !id.startsWith(JSX_PREFIX)) continue; // runtime/axe ids belong to the runtime action
    if (override.severity === 'off') {
      rules[id] = 'off';
      continue;
    }
    // ESLint only needs the rule on; warn/error are applied to findings after linting.
    const existing = rules[id];
    const existingOptions = Array.isArray(existing) ? existing.slice(1) : [];
    const baseOptions = existingOptions.length ? existingOptions : defaultOptions(id);
    rules[id] = ['error', ...(override.options ?? baseOptions)];
  }
  return rules;
}

/** Recommended options for a jsx-a11y rule that a preset left out, so enabling it gets sane defaults. */
function defaultOptions(id: string): unknown[] {
  const rec = (jsxA11y.flatConfigs.recommended.rules as Linter.RulesRecord)[id];
  return Array.isArray(rec) ? rec.slice(1) : [];
}

/** Warnings about configuration that weakens the check. */
export function configWarnings(config: A11yConfig): string[] {
  const warnings: string[] = [];
  const antdRuleIds = Object.keys(antdRules).map((r) => `${ANTD_PREFIX}${r}`);
  if (antdRuleIds.every((id) => config.rules.get(id)?.severity === 'off')) {
    warnings.push('Every antd-a11y rule is turned off, so the static check only runs jsx-a11y.');
  }
  warnings.push(...aliasWarnings(config.aliases));
  return warnings;
}

/** One line for reports: how many rules the configuration changed and where. */
export function overridesNote(config: A11yConfig, prefixes: string[]): string | undefined {
  const relevant = [...config.rules.entries()].filter(([id]) => prefixes.some((p) => id.startsWith(p)));
  if (relevant.length === 0) return undefined;
  const counts = SEVERITIES.map((s) => [s, relevant.filter(([, o]) => o.severity === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
    .join(', ');
  const sources = new Set(relevant.map(([, o]) => o.source));
  const from = [sources.has('file') ? `\`${config.file}\`` : '', sources.has('input') ? 'inputs' : ''];
  const where = ` (${from.filter(Boolean).join(' and ')})`;
  return `${relevant.length} ${relevant.length === 1 ? 'rule' : 'rules'} overridden${where}: ${counts}`;
}
