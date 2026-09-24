// In-house wrappers around antd components (`HintTooltip` around `Tooltip`), declared in
// settings['antd-a11y'].aliases so the rules check them as the antd component they wrap.
//
//   HintTooltip: 'Tooltip'                                   every rule applies
//   TextField: {
//     as: 'Input',
//     name: ['label:string', 'ariaLabel'],                   the wrapper names its control when any holds
//     props: { ariaLabel: 'aria-label' },                    wrapper props forwarded under another name
//   }
//   HintTooltip: {
//     as: 'Tooltip',
//     satisfies: { 'popup-trigger-focusable': 'asButton' },  this rule is met when the condition holds
//     only?: [...] | except?: [...],                         limit which rules apply at all
//   }
//
// Conditions read one prop of the wrapper element:
//   prop          present and not false/null/undefined/"" (`asButton`, `asButton={true}`)
//   !prop         absent, or false/null/undefined/""
//   prop:string   a non-empty string (`label="Email"`); a JSX element or other literal is not
// A list of conditions holds when any one does. A condition we can't evaluate statically (a variable,
// a call, a spread that may set the prop) counts as met: the rule stays quiet rather than guess.
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { DYNAMIC, getProp, hasSpread, propValue, setForwardedProps, staticValue } from './jsx.js';

type Opening = TSESTree.JSXOpeningElement;
type Conditions = string | string[];

/** An alias as written in settings. */
export interface AliasSpec {
  as: string;
  only?: string[];
  except?: string[];
  satisfies?: Record<string, Conditions>;
  name?: Conditions;
  props?: Record<string, string>;
}

export type AliasMap = Record<string, AliasSpec | string>;

/** An alias after readAliases: rule names without the plugin prefix, conditions as lists. */
export interface Alias {
  as: string;
  only?: string[];
  except?: string[];
  satisfies?: Record<string, string[]>;
  name?: string[];
  props?: Record<string, string>;
}

const ALIAS_NAME = /^[A-Z][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
const CONDITION = /^(!)?([A-Za-z_$][\w$-]*)(:string)?$/;
const PROP_NAME = /^[A-Za-z_$][\w$]*$/;
const ATTRIBUTE_NAME = /^[A-Za-z][\w-]*$/;
const KEYS = ['as', 'only', 'except', 'satisfies', 'name', 'props'];

// Rules that ask whether a control has an accessible name; `name` answers all of them at once.
export const NAMING_RULES = ['form-control-has-name', 'picker-has-name', 'form-item-has-label', 'icon-button-has-name'];
const PICKERS = new Set(['Select', 'DatePicker', 'DatePicker.RangePicker', 'TimePicker', 'Cascader', 'TreeSelect', 'AutoComplete']);

const shortRule = (rule: string) => rule.replace(/^antd-a11y\//, '');

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function conditionList(value: unknown): string[] | null {
  const list = typeof value === 'string' ? [value] : isStringArray(value) && value.length > 0 ? value : null;
  if (!list) return null;
  const trimmed = list.map((c) => c.trim());
  return trimmed.every((c) => {
    const m = CONDITION.exec(c);
    return m !== null && !(m[1] && m[3]);
  })
    ? trimmed
    : null;
}

const CONDITION_HINT = 'expected "prop", "!prop", "prop:string" or a list of them';

/**
 * Problems with raw alias settings, for tools that want to fail loudly on a bad config.
 * `ruleNames` are the plugin's rule names without the "antd-a11y/" prefix.
 */
export function aliasErrors(raw: unknown, ruleNames: readonly string[]): string[] {
  if (raw === undefined) return [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['aliases must be an object keyed by component name.'];
  const errors: string[] = [];
  const known = new Set(ruleNames);
  const checkRule = (name: string, rule: string, where: string) => {
    if (!known.has(shortRule(rule))) errors.push(`aliases.${name}.${where}: unknown rule "${rule}" (only antd-a11y rules use aliases).`);
  };
  for (const [name, value] of Object.entries(raw)) {
    if (!ALIAS_NAME.test(name)) errors.push(`aliases: "${name}" is not a component name (e.g. HintTooltip or UI.Tooltip).`);
    if (typeof value === 'string') {
      if (!ALIAS_NAME.test(value)) errors.push(`aliases.${name}: "${value}" is not an antd component name (e.g. Tooltip or Form.Item).`);
      continue;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`aliases.${name}: expected a component name or an object with "as".`);
      continue;
    }
    const spec = value as Record<string, unknown>;
    for (const key of Object.keys(spec)) {
      if (!KEYS.includes(key)) errors.push(`aliases.${name}: unknown key "${key}" (allowed: ${KEYS.join(', ')}).`);
    }
    if (typeof spec.as !== 'string' || !ALIAS_NAME.test(spec.as)) {
      errors.push(`aliases.${name}.as: expected an antd component name (e.g. Tooltip or Form.Item).`);
    }
    for (const key of ['only', 'except'] as const) {
      if (spec[key] === undefined) continue;
      if (!isStringArray(spec[key])) errors.push(`aliases.${name}.${key}: expected a list of rule names.`);
      else for (const rule of spec[key]) checkRule(name, rule, key);
    }
    if (spec.only !== undefined && spec.except !== undefined) {
      errors.push(`aliases.${name}: use "only" or "except", not both.`);
    }
    if (spec.satisfies !== undefined) {
      if (!spec.satisfies || typeof spec.satisfies !== 'object' || Array.isArray(spec.satisfies)) {
        errors.push(`aliases.${name}.satisfies: expected an object of rule name to condition.`);
      } else {
        for (const [rule, condition] of Object.entries(spec.satisfies)) {
          checkRule(name, rule, 'satisfies');
          if (!conditionList(condition)) {
            errors.push(`aliases.${name}.satisfies.${rule}: ${CONDITION_HINT}, got ${JSON.stringify(condition)}.`);
          }
        }
      }
    }
    if (spec.name !== undefined && !conditionList(spec.name)) {
      errors.push(`aliases.${name}.name: ${CONDITION_HINT}, got ${JSON.stringify(spec.name)}.`);
    }
    if (spec.props !== undefined) {
      if (!spec.props || typeof spec.props !== 'object' || Array.isArray(spec.props)) {
        errors.push(`aliases.${name}.props: expected an object of wrapper prop to forwarded prop, e.g. {"ariaLabel": "aria-label"}.`);
      } else {
        for (const [from, to] of Object.entries(spec.props)) {
          if (!PROP_NAME.test(from) || typeof to !== 'string' || !ATTRIBUTE_NAME.test(to)) {
            errors.push(`aliases.${name}.props: "${from}" → ${JSON.stringify(to)} is not a prop mapping like "ariaLabel": "aria-label".`);
          }
        }
      }
    }
  }
  return errors;
}

/**
 * Advice about valid aliases that are likely to misfire: a naming condition given to one naming
 * rule under `satisfies` but not to the others the component is checked by. Use `name` instead.
 */
export function aliasWarnings(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const warnings: string[] = [];
  for (const [name, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const spec = value as AliasSpec;
    if (spec.name !== undefined || !spec.satisfies) continue;
    const declared = Object.keys(spec.satisfies).map(shortRule).filter((r) => NAMING_RULES.includes(r));
    if (declared.length === 0) continue;
    const relevant =
      spec.as === 'Button'
        ? ['icon-button-has-name']
        : PICKERS.has(spec.as)
          ? ['picker-has-name', 'form-item-has-label']
          : ['form-control-has-name', 'form-item-has-label'];
    const missing = relevant.filter((r) => !declared.includes(r));
    if (missing.length === 0) continue;
    warnings.push(
      `Alias "${name}" names its control for ${declared.join(', ')} but not ${missing.join(', ')}, which still checks it as unnamed. ` +
        `Use "name" instead of "satisfies" to cover every naming rule at once.`,
    );
  }
  return warnings;
}

/** Aliases from settings, normalised. Invalid entries are skipped; tools can report them with aliasErrors. */
export function readAliases(settings: Readonly<Record<string, unknown>> | undefined): Record<string, Alias> {
  const raw = (settings?.['antd-a11y'] as { aliases?: unknown } | undefined)?.aliases;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const aliases: Record<string, Alias> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (!ALIAS_NAME.test(name)) continue;
    const alias = normalise(value);
    if (alias) aliases[name] = alias;
  }
  return aliases;
}

// Only checks the shape: an unknown rule name in only/except/satisfies simply never matches.
function normalise(value: unknown): Alias | null {
  if (typeof value === 'string') return ALIAS_NAME.test(value) ? { as: value } : null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const spec = value as Record<string, unknown>;
  if (typeof spec.as !== 'string' || !ALIAS_NAME.test(spec.as)) return null;
  const alias: Alias = { as: spec.as };
  for (const key of ['only', 'except'] as const) {
    if (spec[key] === undefined) continue;
    if (!isStringArray(spec[key])) return null;
    alias[key] = spec[key].map(shortRule);
  }
  if (spec.satisfies !== undefined) {
    if (!spec.satisfies || typeof spec.satisfies !== 'object' || Array.isArray(spec.satisfies)) return null;
    alias.satisfies = {};
    for (const [rule, condition] of Object.entries(spec.satisfies)) {
      const list = conditionList(condition);
      if (!list) return null;
      alias.satisfies[shortRule(rule)] = list;
    }
  }
  if (spec.name !== undefined) {
    const list = conditionList(spec.name);
    if (!list) return null;
    alias.name = list;
  }
  if (spec.props !== undefined) {
    if (!spec.props || typeof spec.props !== 'object' || Array.isArray(spec.props)) return null;
    const entries = Object.entries(spec.props);
    if (!entries.every(([from, to]) => PROP_NAME.test(from) && typeof to === 'string' && ATTRIBUTE_NAME.test(to))) return null;
    alias.props = Object.fromEntries(entries) as Record<string, string>;
  }
  return alias;
}

/** true / false when the condition can be read from the element, undefined when it can't. */
export function evaluateCondition(node: Opening, condition: string): boolean | undefined {
  const m = CONDITION.exec(condition);
  if (!m) return undefined;
  const [, negate, prop, asString] = m;
  const attr = getProp(node, prop);
  if (!attr) return hasSpread(node) ? undefined : Boolean(negate);

  if (asString) {
    if (attr.value === null) return false; // bare attribute is `true`
    if (attr.value.type === AST_NODE_TYPES.Literal) return typeof attr.value.value === 'string' && attr.value.value.trim() !== '';
    if (attr.value.type !== AST_NODE_TYPES.JSXExpressionContainer) return false; // <label={<b/>}> is not valid JSX anyway
    const expr = attr.value.expression;
    if (expr.type === AST_NODE_TYPES.JSXEmptyExpression) return false;
    if (expr.type === AST_NODE_TYPES.JSXElement || expr.type === AST_NODE_TYPES.JSXFragment) return false;
    const value = staticValue(expr);
    if (value === DYNAMIC) return undefined;
    return typeof value === 'string' && value.trim() !== '';
  }

  const value = propValue(node, prop);
  if (value === DYNAMIC) return undefined;
  // An empty string names nothing and switches nothing on, as with aria-label="" elsewhere.
  const truthy = typeof value === 'string' ? value.trim() !== '' : !(value === false || value === null || value === undefined);
  return negate ? !truthy : truthy;
}

/** Any of the conditions: true if one holds, false if none can, undefined when it depends on runtime values. */
function anyCondition(node: Opening, conditions: string[]): boolean | undefined {
  let unknown = false;
  for (const condition of conditions) {
    const result = evaluateCondition(node, condition);
    if (result === true) return true;
    if (result === undefined) unknown = true;
  }
  return unknown ? undefined : false;
}

/** The antd component an aliased element stands for in `rule`, or null when the alias doesn't apply there. */
export function aliasTarget(alias: Alias, rule: string, node: Opening): string | null {
  if (alias.only && !alias.only.includes(rule)) return null;
  if (alias.except?.includes(rule)) return null;
  const conditions = alias.satisfies?.[rule];
  if (conditions && anyCondition(node, conditions) !== false) return null;
  return alias.as;
}

// Elements the resolver matched to an alias, so prop and name helpers can see through the wrapper.
const aliasedElements = new WeakMap<Opening, Alias>();

export function registerAliased(node: Opening, alias: Alias): void {
  if (aliasedElements.has(node)) return;
  aliasedElements.set(node, alias);
  if (alias.props) setForwardedProps(node, alias.props);
}

/** True when an aliased wrapper supplies an accessible name here, or may at runtime. */
export function wrapperNamesElement(node: Opening): boolean {
  const conditions = aliasedElements.get(node)?.name;
  return conditions !== undefined && anyCondition(node, conditions) !== false;
}
