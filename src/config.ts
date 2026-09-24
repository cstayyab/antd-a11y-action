// The configuration engine lives in the ESLint plugin, so a local ESLint run and the action read
// `.github/antd-a11y.json` the same way. The action adds its runtime rule list, so a typo in a
// runtime/* id fails here too.
import { engine } from 'eslint-plugin-antd-a11y';
import { RUNTIME_RULES } from './runtime/rules.js';

engine.setRuntimeRuleCheck((name) => name in RUNTIME_RULES);

export const {
  ConfigError,
  DEFAULT_COMPONENTS,
  configWarnings,
  eslintRules,
  isKnownRule,
  normalizeRuleId,
  overridesNote,
  parseAliasesInput,
  parseComponentsInput,
  parsePreset,
  parseRulesInput,
  readConfigFile,
  resolveConfig,
} = engine;

export type ActionConfig = engine.A11yConfig;
export type ConfigInputs = engine.ConfigInputs;
export type Preset = engine.Preset;
export type RuleOverride = engine.RuleOverride;
export type Severity = engine.Severity;
