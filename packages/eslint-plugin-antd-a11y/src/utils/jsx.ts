import { TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

type Opening = TSESTree.JSXOpeningElement;

export function hasSpread(node: Opening): boolean {
  return node.attributes.some((attr) => attr.type === AST_NODE_TYPES.JSXSpreadAttribute);
}

function attrName(attr: TSESTree.JSXAttribute): string {
  return attr.name.type === AST_NODE_TYPES.JSXIdentifier
    ? attr.name.name
    : `${attr.name.namespace.name}:${attr.name.name.name}`;
}

// Aliased wrappers that forward a prop under another name (`ariaLabel` → `aria-label`). Set by the resolver.
const forwardedProps = new WeakMap<Opening, Record<string, string>>();

export function setForwardedProps(node: Opening, props: Record<string, string>): void {
  forwardedProps.set(node, props);
}

function findProp(node: Opening, name: string): TSESTree.JSXAttribute | undefined {
  for (const attr of node.attributes) {
    if (attr.type === AST_NODE_TYPES.JSXAttribute && attrName(attr) === name) return attr;
  }
  return undefined;
}

/** The attribute `name`, or on an aliased wrapper the prop it forwards as `name`. */
export function getProp(node: Opening, name: string): TSESTree.JSXAttribute | undefined {
  const direct = findProp(node, name);
  if (direct) return direct;
  const forwarded = forwardedProps.get(node);
  if (!forwarded) return undefined;
  for (const [wrapperProp, target] of Object.entries(forwarded)) {
    if (target !== name) continue;
    const attr = findProp(node, wrapperProp);
    if (attr) return attr;
  }
  return undefined;
}

/**
 * Static value of a prop:
 *  - `undefined`  the prop is absent
 *  - `true`       bare boolean attribute (`<Button disabled>`)
 *  - string/number/boolean/null  a literal we can read
 *  - `DYNAMIC`    any other expression
 */
export const DYNAMIC = Symbol('dynamic');
export type PropValue = string | number | boolean | null | undefined | typeof DYNAMIC;

export function staticValue(expr: TSESTree.Expression): PropValue {
  switch (expr.type) {
    case AST_NODE_TYPES.Literal:
      return expr.value instanceof RegExp || typeof expr.value === 'bigint' ? DYNAMIC : expr.value;
    case AST_NODE_TYPES.TemplateLiteral:
      return expr.expressions.length === 0 ? expr.quasis.map((q) => q.value.cooked).join('') : DYNAMIC;
    case AST_NODE_TYPES.UnaryExpression: {
      if (expr.operator !== '-' && expr.operator !== '!') return DYNAMIC;
      const inner = staticValue(expr.argument);
      if (inner === DYNAMIC) return DYNAMIC;
      return expr.operator === '-' ? (typeof inner === 'number' ? -inner : DYNAMIC) : !inner;
    }
    case AST_NODE_TYPES.Identifier:
      return expr.name === 'undefined' ? undefined : DYNAMIC;
    default:
      return DYNAMIC;
  }
}

export function propValue(node: Opening, name: string): PropValue {
  const attr = getProp(node, name);
  if (!attr) return undefined;
  if (attr.value === null) return true;
  if (attr.value.type === AST_NODE_TYPES.Literal) return attr.value.value as PropValue;
  if (attr.value.type === AST_NODE_TYPES.JSXExpressionContainer) {
    if (attr.value.expression.type === AST_NODE_TYPES.JSXEmptyExpression) return undefined;
    return staticValue(attr.value.expression);
  }
  // JSXElement / JSXFragment as a prop value
  return DYNAMIC;
}

/** A prop that is present and not statically empty/false/null/undefined. */
export function hasMeaningfulProp(node: Opening, name: string): boolean {
  const value = propValue(node, name);
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/** Truthy if statically true or dynamic (may be true at runtime). */
export function mayBeTrue(node: Opening, name: string): boolean {
  const value = propValue(node, name);
  if (value === undefined || value === null || value === false) return false;
  if (value === DYNAMIC) return true;
  return Boolean(value);
}

/** Children that matter for rendering: skips whitespace-only text and empty `{}` containers. */
export function meaningfulChildren(element: TSESTree.JSXElement): TSESTree.JSXChild[] {
  return element.children.filter((child) => {
    if (child.type === AST_NODE_TYPES.JSXText) return child.value.trim().length > 0;
    if (child.type === AST_NODE_TYPES.JSXExpressionContainer) {
      return child.expression.type !== AST_NODE_TYPES.JSXEmptyExpression;
    }
    return true;
  });
}

/** Nearest enclosing JSXElement of a JSX element, crossing expression containers, callbacks and conditionals. */
export function parentElement(element: TSESTree.JSXElement): TSESTree.JSXElement | null {
  let current: TSESTree.Node | undefined = element.parent;
  while (current) {
    if (current.type === AST_NODE_TYPES.JSXElement) return current;
    // Stop at the boundary of a component declaration; a named function's JSX
    // is rendered wherever the component is used, not here.
    if (
      current.type === AST_NODE_TYPES.FunctionDeclaration ||
      current.type === AST_NODE_TYPES.ClassBody ||
      current.type === AST_NODE_TYPES.Program
    ) {
      return null;
    }
    if (
      (current.type === AST_NODE_TYPES.ArrowFunctionExpression ||
        current.type === AST_NODE_TYPES.FunctionExpression) &&
      current.parent.type === AST_NODE_TYPES.VariableDeclarator
    ) {
      return null;
    }
    current = current.parent;
  }
  return null;
}

export function isIntrinsic(node: Opening): boolean {
  return node.name.type === AST_NODE_TYPES.JSXIdentifier && /^[a-z]/.test(node.name.name);
}

export function intrinsicName(node: Opening): string | null {
  return isIntrinsic(node) ? (node.name as TSESTree.JSXIdentifier).name : null;
}
