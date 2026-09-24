// User configuration for the jsx-a11y layer and per-rule severity, shared by both actions.
// Sources, lowest to highest precedence: built-in defaults < config file (JSON) < action inputs.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import antdA11y from 'eslint-plugin-antd-a11y';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import type { Linter } from 'eslint';
import { RUNTIME_RULES } from './runtime/rules.js';

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

export interface ActionConfig {
  jsxA11y: Preset;
  rules: Map<string, RuleOverride>;
  settings: JsxA11ySettings;
  /** Repo-relative path of the config file that was applied, if any. */
  file?: string;
}

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
  if (trimmed in antdA11y.rules) return `${ANTD_PREFIX}${trimmed}`;
  return trimmed;
}

export function isKnownRule(id: string): boolean {
  if (id.startsWith(ANTD_PREFIX)) return id.slice(ANTD_PREFIX.length) in antdA11y.rules;
  if (id.startsWith(JSX_PREFIX)) return id.slice(JSX_PREFIX.length) in (jsxA11y.rules ?? {});
  if (id.startsWith('runtime/')) return id.slice('runtime/'.length) in RUNTIME_RULES;
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

export function parsePreset(value: string | undefined, where = 'jsx-a11y input'): Preset {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === '' || v === 'true' || v === 'recommended') return 'recommended';
  if (v === 'strict') return 'strict';
  if (v === 'false' || v === 'off') return false;
  throw new ConfigError(`${where}: expected recommended, strict or false, got "${value}".`);
}

interface FileShape {
  jsxA11y?: unknown;
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
  const allowed = new Set(['$schema', 'jsxA11y', 'rules', 'settings']);
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) throw new ConfigError(`${label}: unknown key "${key}" (allowed: jsxA11y, rules, settings).`);
  }
  return data as FileShape;
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
  rules?: string;
  components?: string;
  /** Path of the config file relative to the workspace; missing files are fine. */
  configFile?: string;
  workspace: string;
}

export function resolveConfig(inputs: ConfigInputs): ActionConfig {
  const configPath = inputs.configFile ? path.resolve(inputs.workspace, inputs.configFile) : undefined;
  const shape = configPath ? readConfigFile(configPath, inputs.configFile) : null;
  const fileLabel = shape && inputs.configFile ? inputs.configFile : undefined;

  let jsx: Preset = 'recommended';
  if (shape?.jsxA11y !== undefined) jsx = parsePreset(String(shape.jsxA11y), `${fileLabel}: jsxA11y`);
  if (inputs.jsxA11y && inputs.jsxA11y.trim() !== '') jsx = parsePreset(inputs.jsxA11y);

  const rules = new Map<string, RuleOverride>();
  if (shape) for (const [id, o] of fileRules(shape, fileLabel!)) rules.set(id, o);
  for (const [id, o] of parseRulesInput(inputs.rules)) {
    // An input changes severity only; keep options the file gave the rule.
    rules.set(id, { ...o, options: rules.get(id)?.options });
  }

  const fromFile = shape ? fileSettings(shape, fileLabel!) : {};
  const settings: JsxA11ySettings = {
    ...fromFile,
    components: { ...DEFAULT_COMPONENTS, ...fromFile.components, ...parseComponentsInput(inputs.components) },
  };
  return { jsxA11y: jsx, rules, settings, file: fileLabel };
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
export function eslintRules(config: ActionConfig): Linter.RulesRecord {
  const rules: Linter.RulesRecord = {
    ...(config.jsxA11y ? tunedJsxRules(config.jsxA11y) : {}),
    ...(antdA11y.configs.recommended as { rules: Linter.RulesRecord }).rules,
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
export function configWarnings(config: ActionConfig): string[] {
  const warnings: string[] = [];
  const antdRules = Object.keys(antdA11y.rules).map((r) => `${ANTD_PREFIX}${r}`);
  if (antdRules.every((id) => config.rules.get(id)?.severity === 'off')) {
    warnings.push('Every antd-a11y rule is turned off, so the static check only runs jsx-a11y.');
  }
  return warnings;
}

/** One line for reports: how many rules the configuration changed and where. */
export function overridesNote(config: ActionConfig, prefixes: string[]): string | undefined {
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
