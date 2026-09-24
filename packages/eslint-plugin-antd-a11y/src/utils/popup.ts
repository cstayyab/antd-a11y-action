import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import type { AntdResolver } from './antd-imports.js';
import { getProp, hasMeaningfulProp, hasSpread, intrinsicName, mayBeTrue, meaningfulChildren, propValue } from './jsx.js';

type Opening = TSESTree.JSXOpeningElement;
type SourceCode = Readonly<TSESLint.SourceCode>;

// Wrappers people add so a disabled button still gets hover events. They can't take focus themselves.
const WRAPPER_TAGS = new Set(['span', 'div']);

function unwrap(expr: TSESTree.Expression): TSESTree.Expression {
  let current = expr;
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
 * The JSX element an expression stands for: the element itself, or a `const` in scope initialised
 * with one (`const tabButton = <Button disabled />; … {tabButton}`). Anything more dynamic is null.
 */
export function resolveJsx(expr: TSESTree.Node, sourceCode: SourceCode): TSESTree.JSXElement | null {
  if (expr.type === AST_NODE_TYPES.JSXElement) return expr;
  if (expr.type === AST_NODE_TYPES.JSXExpressionContainer) {
    return expr.expression.type === AST_NODE_TYPES.JSXEmptyExpression ? null : resolveJsx(expr.expression, sourceCode);
  }
  const inner = unwrap(expr as TSESTree.Expression);
  if (inner.type === AST_NODE_TYPES.JSXElement) return inner;
  if (inner.type !== AST_NODE_TYPES.Identifier) return null;
  const variable = ASTUtils.findVariable(sourceCode.getScope(inner), inner.name);
  if (!variable || variable.defs.length !== 1 || variable.defs[0].type !== 'Variable') return null;
  const declarator = variable.defs[0].node;
  if (declarator.parent.kind !== 'const' || !declarator.init) return null;
  const init = unwrap(declarator.init);
  return init.type === AST_NODE_TYPES.JSXElement ? init : null;
}

/** The only child element of a popup (or of a wrapper), or null when there are several or it isn't JSX. */
export function popupTrigger(popup: TSESTree.JSXElement, sourceCode: SourceCode): TSESTree.JSXElement | null {
  const children = meaningfulChildren(popup);
  return children.length === 1 ? resolveJsx(children[0], sourceCode) : null;
}

/**
 * Where to report on a popup's (or wrapper's) only child: the element itself, or the `{variable}` that
 * holds it, so a finding points at the place it is wrapped rather than where the variable is declared.
 */
export function reportNode(parent: TSESTree.JSXElement, element: TSESTree.JSXElement): TSESTree.Node {
  const children = meaningfulChildren(parent);
  return children.length === 1 && children[0].type === AST_NODE_TYPES.JSXExpressionContainer ? children[0] : element.openingElement;
}

/** `trigger={[]}`: antd binds no events to the child, which is only a positioning anchor. */
export function hasNoTrigger(popup: Opening): boolean {
  const attr = getProp(popup, 'trigger');
  if (attr?.value?.type !== AST_NODE_TYPES.JSXExpressionContainer) return false;
  const expr = attr.value.expression;
  return expr.type === AST_NODE_TYPES.ArrayExpression && expr.elements.length === 0;
}

export function isDisabledButton(node: Opening, resolver: AntdResolver): boolean {
  const isButton = resolver.componentName(node) === 'Button' || intrinsicName(node) === 'button';
  return isButton && mayBeTrue(node, 'disabled');
}

/**
 * `<span><Button disabled /></span>` as a popup trigger: the wrapper restores hover (disabled buttons get
 * no pointer events), but it can't take focus either, so keyboard users still can't reach the popup.
 * Returns the wrapper and the button, or null when the wrapper could be focusable or holds anything else.
 */
export function wrappedDisabledButton(
  trigger: TSESTree.JSXElement,
  resolver: AntdResolver,
  sourceCode: SourceCode,
): { wrapper: string; button: Opening; at: TSESTree.Node } | null {
  const wrapper = trigger.openingElement;
  const tag = intrinsicName(wrapper);
  if (!tag || !WRAPPER_TAGS.has(tag)) return null;
  if (hasSpread(wrapper) || hasMeaningfulProp(wrapper, 'role')) return null;
  if (getProp(wrapper, 'tabIndex') && propValue(wrapper, 'tabIndex') !== -1) return null;
  const inner = popupTrigger(trigger, sourceCode);
  if (!inner || !isDisabledButton(inner.openingElement, resolver)) return null;
  return { wrapper: tag, button: inner.openingElement, at: reportNode(trigger, inner) };
}

// antd components that render a focusable control.
const FOCUSABLE_ANTD = new Set([
  'Button', 'Input', 'Input.Search', 'Input.Password', 'Input.TextArea', 'InputNumber', 'Select', 'AutoComplete',
  'Cascader', 'TreeSelect', 'DatePicker', 'DatePicker.RangePicker', 'TimePicker', 'Checkbox', 'Radio', 'Switch',
  'Slider', 'Rate', 'Typography.Link',
]);
const FOCUSABLE_TAGS = new Set(['button', 'input', 'select', 'textarea', 'summary']);

function isFocusableElement(node: Opening, resolver: AntdResolver): boolean {
  if (mayBeTrue(node, 'disabled')) return false;
  const tabIndex = propValue(node, 'tabIndex');
  if (typeof tabIndex === 'number') return tabIndex >= 0;
  const tag = intrinsicName(node);
  if (tag !== null) {
    if (tag === 'a') return getProp(node, 'href') !== undefined;
    if (tag === 'input' && propValue(node, 'type') === 'hidden') return false;
    return FOCUSABLE_TAGS.has(tag) || mayBeTrue(node, 'contentEditable');
  }
  const name = resolver.componentName(node);
  return name !== null && FOCUSABLE_ANTD.has(name);
}

/**
 * True when a focusable, enabled control sits somewhere inside the element: `<span><Button>Add</Button></span>`.
 * Focus and click events bubble from it to the wrapper antd listens on, so the popup is keyboard-reachable
 * (checked in the DOM tests). Follows children, conditional branches and `const` JSX variables; an unknown
 * component counts only through the children it is given.
 */
export function hasFocusableDescendant(element: TSESTree.JSXElement, resolver: AntdResolver, sourceCode: SourceCode): boolean {
  const seen = new Set<TSESTree.Node>();
  const visit = (node: TSESTree.Node | null | undefined, depth: number): boolean => {
    if (!node || depth > 8 || seen.has(node)) return false;
    seen.add(node);
    switch (node.type) {
      case AST_NODE_TYPES.JSXElement:
        if (depth > 0 && isFocusableElement(node.openingElement, resolver)) return true;
        return node.children.some((child) => visit(child, depth + 1));
      case AST_NODE_TYPES.JSXFragment:
        return node.children.some((child) => visit(child, depth + 1));
      case AST_NODE_TYPES.JSXExpressionContainer:
        return node.expression.type !== AST_NODE_TYPES.JSXEmptyExpression && visit(node.expression, depth);
      case AST_NODE_TYPES.LogicalExpression:
        return visit(node.right, depth);
      case AST_NODE_TYPES.ConditionalExpression:
        return visit(node.consequent, depth) || visit(node.alternate, depth);
      case AST_NODE_TYPES.Identifier:
        return visit(resolveJsx(node, sourceCode), depth);
      default:
        return false;
    }
  };
  return visit(element, 0);
}
