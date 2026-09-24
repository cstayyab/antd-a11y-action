import { ASTUtils, TSESTree, AST_NODE_TYPES, type TSESLint } from '@typescript-eslint/utils';
import { aliasTarget, readAliases, type AliasMap } from './aliases.js';

type Scope = TSESLint.Scope.Scope;
type JSXTagName = TSESTree.JSXTagNameExpression;

const ANTD_ROOT = 'antd';
// antd/es/date-picker, antd/lib/date-picker/index, antd/es/date-picker/index.js
const ANTD_PATH = /^antd\/(?:es|lib)\/([a-z-]+)(?:\/index(?:\.js)?)?$/;
const ICONS_SOURCE = /^@ant-design\/icons(?:\/.*)?$/;

function kebabToPascal(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function importedName(spec: TSESTree.ImportSpecifier): string {
  return spec.imported.type === AST_NODE_TYPES.Identifier
    ? spec.imported.name
    : String(spec.imported.value);
}

type Binding =
  | { kind: 'component'; name: string }
  | { kind: 'namespace' }
  | { kind: 'icon' }
  | null;

function unwrapExpression(node: TSESTree.Expression): TSESTree.Expression {
  let current = node;
  while (
    current.type === AST_NODE_TYPES.TSAsExpression ||
    current.type === AST_NODE_TYPES.TSSatisfiesExpression ||
    current.type === AST_NODE_TYPES.TSNonNullExpression
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * Resolves an identifier in scope to what it refers to in antd.
 * Only follows import bindings and `const { Item } = Form` style destructuring,
 * so anything we can't prove comes from antd resolves to null.
 */
function resolveIdentifier(scope: Scope, name: string, depth = 0): Binding {
  if (depth > 4) return null;
  const variable = ASTUtils.findVariable(scope, name);
  if (!variable || variable.defs.length !== 1) return null;
  const def = variable.defs[0];

  if (def.type === 'ImportBinding') {
    const decl = def.parent as TSESTree.ImportDeclaration;
    const source = decl.source.value;
    if (ICONS_SOURCE.test(source)) return { kind: 'icon' };
    const spec = def.node;
    if (source === ANTD_ROOT) {
      if (spec.type === AST_NODE_TYPES.ImportSpecifier) {
        return { kind: 'component', name: importedName(spec) };
      }
      return { kind: 'namespace' };
    }
    const match = ANTD_PATH.exec(source);
    if (match && spec.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
      return { kind: 'component', name: kebabToPascal(match[1]) };
    }
    return null;
  }

  if (def.type === 'Variable') {
    const declarator = def.node;
    if (
      declarator.id.type !== AST_NODE_TYPES.ObjectPattern ||
      !declarator.init ||
      declarator.parent.kind !== 'const'
    ) {
      return null;
    }
    const init = unwrapExpression(declarator.init);
    let base: Binding = null;
    if (init.type === AST_NODE_TYPES.Identifier) {
      base = resolveIdentifier(scope, init.name, depth + 1);
    } else if (init.type === AST_NODE_TYPES.MemberExpression) {
      base = resolveMember(scope, init, depth + 1);
    }
    if (!base || base.kind === 'icon') return null;
    for (const prop of declarator.id.properties) {
      if (
        prop.type === AST_NODE_TYPES.Property &&
        prop.key.type === AST_NODE_TYPES.Identifier &&
        prop.value.type === AST_NODE_TYPES.Identifier &&
        prop.value.name === name
      ) {
        return base.kind === 'namespace'
          ? { kind: 'component', name: prop.key.name }
          : { kind: 'component', name: `${base.name}.${prop.key.name}` };
      }
    }
  }
  return null;
}

function resolveMember(scope: Scope, node: TSESTree.MemberExpression, depth: number): Binding {
  if (node.computed || node.property.type !== AST_NODE_TYPES.Identifier) return null;
  let base: Binding = null;
  if (node.object.type === AST_NODE_TYPES.Identifier) {
    base = resolveIdentifier(scope, node.object.name, depth);
  } else if (node.object.type === AST_NODE_TYPES.MemberExpression) {
    base = resolveMember(scope, node.object, depth);
  }
  if (!base || base.kind === 'icon') return null;
  return base.kind === 'namespace'
    ? { kind: 'component', name: node.property.name }
    : { kind: 'component', name: `${base.name}.${node.property.name}` };
}

function resolveTag(scope: Scope, tag: JSXTagName): Binding {
  if (tag.type === AST_NODE_TYPES.JSXIdentifier) {
    // Lowercase tags are intrinsic elements, never components.
    if (/^[a-z]/.test(tag.name)) return null;
    return resolveIdentifier(scope, tag.name);
  }
  if (tag.type === AST_NODE_TYPES.JSXMemberExpression) {
    let base: Binding = null;
    if (tag.object.type === AST_NODE_TYPES.JSXIdentifier) {
      base = resolveIdentifier(scope, tag.object.name);
    } else if (tag.object.type === AST_NODE_TYPES.JSXMemberExpression) {
      base = resolveTag(scope, tag.object);
    }
    if (!base || base.kind === 'icon') return null;
    return base.kind === 'namespace'
      ? { kind: 'component', name: tag.property.name }
      : { kind: 'component', name: `${base.name}.${tag.property.name}` };
  }
  return null;
}

/** "AccessibleTooltip" or "UI.Tooltip" for a tag whose root identifier is imported, else null. */
function importedTagName(scope: Scope, tag: JSXTagName): string | null {
  const parts: string[] = [];
  let current: JSXTagName = tag;
  while (current.type === AST_NODE_TYPES.JSXMemberExpression) {
    parts.unshift(current.property.name);
    current = current.object;
  }
  if (current.type !== AST_NODE_TYPES.JSXIdentifier || /^[a-z]/.test(current.name)) return null;
  const variable = ASTUtils.findVariable(scope, current.name);
  // Only imported components: a local component that happens to share the name is something else.
  if (!variable || variable.defs.length !== 1 || variable.defs[0].type !== 'ImportBinding') return null;
  return [current.name, ...parts].join('.');
}

export interface AntdResolver {
  /** Canonical antd name such as `Button` or `Form.Item`, or null if not from antd. */
  componentName(node: TSESTree.JSXOpeningElement): string | null;
  /** True when the element is an icon component from @ant-design/icons. */
  isIcon(node: TSESTree.JSXOpeningElement): boolean;
}

export function createResolver(context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>): AntdResolver {
  const cache = new WeakMap<TSESTree.JSXOpeningElement, Binding>();
  const aliases: AliasMap = readAliases(context.settings);
  const hasAliases = Object.keys(aliases).length > 0;
  // "antd-a11y/popup-trigger-focusable" in a config, "popup-trigger-focusable" in RuleTester.
  const rule = context.id.split('/').pop() ?? context.id;
  const lookup = (node: TSESTree.JSXOpeningElement): Binding => {
    if (cache.has(node)) return cache.get(node) ?? null;
    const scope = context.sourceCode.getScope(node);
    let binding = resolveTag(scope, node.name);
    if (!binding && hasAliases) {
      const name = importedTagName(scope, node.name);
      const spec = name ? aliases[name] : undefined;
      const target = spec ? aliasTarget(spec, rule, node) : null;
      if (target) binding = { kind: 'component', name: target };
    }
    cache.set(node, binding);
    return binding;
  };
  return {
    componentName(node) {
      const binding = lookup(node);
      return binding?.kind === 'component' ? binding.name : null;
    },
    isIcon(node) {
      return lookup(node)?.kind === 'icon';
    },
  };
}
