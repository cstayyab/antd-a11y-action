// In-house wrappers around antd components (`HintTooltip` around `Tooltip`), declared in
// settings['antd-a11y'].aliases so the rules check them as the antd component they wrap.
//
//   HintTooltip: 'Tooltip'                                every rule applies
//   HintTooltip: { as: 'Tooltip',                         per rule:
//     only?: ['tooltip-no-disabled-child'],                 only these rules apply
//     except?: ['popup-trigger-focusable'],                 these rules don't
//     satisfies: { 'popup-trigger-focusable': 'asButton' } }  the rule is met when the condition holds
//
// Conditions read one prop of the wrapper element:
//   prop          present and not false/null/undefined (`asButton`, `asButton={true}`)
//   !prop         absent, or false/null/undefined
//   prop:string   a non-empty string (`label="Email"`); a JSX element or other literal is not
// A condition we can't evaluate statically (a variable, a call, a spread that may set the prop)
// counts as met: the rule stays quiet rather than guess, as the rules do elsewhere.
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { DYNAMIC, getProp, hasSpread, propValue, staticValue } from './jsx.js';

export interface AliasSpec {
  as: string;
  only?: string[];
  except?: string[];
  satisfies?: Record<string, string>;
}

export type AliasMap = Record<string, AliasSpec>;

const ALIAS_NAME = /^[A-Z][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
const CONDITION = /^(!)?([A-Za-z_$][\w$-]*)(:string)?$/;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

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
    const short = rule.replace(/^antd-a11y\//, '');
    if (!known.has(short)) errors.push(`aliases.${name}.${where}: unknown rule "${rule}" (only antd-a11y rules use aliases).`);
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
      if (!['as', 'only', 'except', 'satisfies'].includes(key)) {
        errors.push(`aliases.${name}: unknown key "${key}" (allowed: as, only, except, satisfies).`);
      }
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
          const m = typeof condition === 'string' ? CONDITION.exec(condition.trim()) : null;
          if (!m || (m[1] && m[3])) {
            errors.push(
              `aliases.${name}.satisfies.${rule}: expected "prop", "!prop" or "prop:string", got ${JSON.stringify(condition)}.`,
            );
          }
        }
      }
    }
  }
  return errors;
}

/** Aliases from settings, normalised. Invalid entries are skipped; tools can report them with aliasErrors. */
export function readAliases(settings: Readonly<Record<string, unknown>> | undefined): AliasMap {
  const raw = (settings?.['antd-a11y'] as { aliases?: unknown } | undefined)?.aliases;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const aliases: AliasMap = {};
  for (const [name, value] of Object.entries(raw)) {
    if (!ALIAS_NAME.test(name) || !validShape(value)) continue;
    const spec: AliasSpec = typeof value === 'string' ? { as: value } : (value as AliasSpec);
    const strip = (rules?: string[]) => rules?.map((r) => r.replace(/^antd-a11y\//, ''));
    aliases[name] = {
      as: spec.as,
      only: strip(spec.only),
      except: strip(spec.except),
      satisfies: spec.satisfies
        ? Object.fromEntries(Object.entries(spec.satisfies).map(([r, c]) => [r.replace(/^antd-a11y\//, ''), c.trim()]))
        : undefined,
    };
  }
  return aliases;
}

// readAliases only checks the shape: an unknown rule name in only/except/satisfies simply never matches.
function validShape(value: unknown): boolean {
  if (typeof value === 'string') return ALIAS_NAME.test(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const spec = value as Record<string, unknown>;
  if (typeof spec.as !== 'string' || !ALIAS_NAME.test(spec.as)) return false;
  if (spec.only !== undefined && !isStringArray(spec.only)) return false;
  if (spec.except !== undefined && !isStringArray(spec.except)) return false;
  if (spec.satisfies !== undefined) {
    if (!spec.satisfies || typeof spec.satisfies !== 'object' || Array.isArray(spec.satisfies)) return false;
    return Object.values(spec.satisfies).every((c) => typeof c === 'string' && CONDITION.test(c.trim()));
  }
  return true;
}

/** true / false when the condition can be read from the element, undefined when it can't. */
export function evaluateCondition(node: TSESTree.JSXOpeningElement, condition: string): boolean | undefined {
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
  const truthy = !(value === false || value === null || value === undefined);
  return negate ? !truthy : truthy;
}

/** The antd component an aliased element stands for in `rule`, or null when the alias doesn't apply there. */
export function aliasTarget(spec: AliasSpec, rule: string, node: TSESTree.JSXOpeningElement): string | null {
  if (spec.only && !spec.only.includes(rule)) return null;
  if (spec.except?.includes(rule)) return null;
  const condition = spec.satisfies?.[rule];
  if (condition !== undefined && evaluateCondition(node, condition) !== false) return null;
  return spec.as;
}
