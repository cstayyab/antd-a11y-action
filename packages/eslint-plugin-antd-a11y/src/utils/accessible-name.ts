import { TSESTree, AST_NODE_TYPES, type TSESLint } from '@typescript-eslint/utils';
import type { AntdResolver } from './antd-imports.js';
import { wrapperNamesElement } from './aliases.js';
import { hasMeaningfulProp, hasSpread, intrinsicName, meaningfulChildren, parentElement, propValue } from './jsx.js';
import { resolveJsx } from './popup.js';

type Opening = TSESTree.JSXOpeningElement;

/** Props that give an element an accessible name without any help from context. */
const NAME_PROPS = ['aria-label', 'aria-labelledby'];

/**
 * True when the element's own props give it a name, or when we cannot tell.
 * Conservative on purpose: spreads and `id` (a `<label htmlFor>` elsewhere could
 * point at it) count as named so the rule stays quiet.
 */
export function hasOwnName(
  node: Opening,
  { extraProps = [], allowId = true }: { extraProps?: string[]; allowId?: boolean } = {},
): boolean {
  if (hasSpread(node)) return true;
  // An aliased wrapper whose `name` condition holds renders its own label.
  if (wrapperNamesElement(node)) return true;
  for (const prop of [...NAME_PROPS, ...extraProps]) {
    if (hasMeaningfulProp(node, prop)) return true;
  }
  return allowId && hasMeaningfulProp(node, 'id');
}

/**
 * True when the element renders text a screen reader would read as its name.
 * Any expression child counts (it may render text); icon components do not.
 */
export function hasTextContent(
  element: TSESTree.JSXElement,
  resolver: AntdResolver,
  isGraphic: (opening: TSESTree.JSXOpeningElement) => boolean = () => false,
): boolean {
  return meaningfulChildren(element).some((child) => {
    if (child.type === AST_NODE_TYPES.JSXElement) {
      if (resolver.isIcon(child.openingElement) || isGraphic(child.openingElement)) return false;
      if (child.openingElement.name.type === AST_NODE_TYPES.JSXIdentifier) {
        const tag = child.openingElement.name.name;
        if (tag === 'svg' || tag === 'img' || tag === 'i') {
          // <img alt="Delete"> names its parent; bare svg/i do not.
          return tag === 'img' && hasMeaningfulProp(child.openingElement, 'alt');
        }
      }
      return true;
    }
    return true;
  });
}

/**
 * True when a JSX value (a `title={…}` prop, say) can give an accessible name: it holds text, an
 * expression that may render text, or an element named with `aria-label` / `img alt`. Empty elements,
 * unnamed antd icons and bare `svg` give an empty name, or only the icon's English id. Components we
 * can't see into count as text, so the check stays quiet when it can't tell.
 */
export function jsxHasText(
  node: TSESTree.Node,
  resolver: AntdResolver,
  sourceCode: Readonly<TSESLint.SourceCode>,
  depth = 0,
): boolean {
  if (depth > 8) return true;
  const inner = (child: TSESTree.Node): boolean => jsxHasText(child, resolver, sourceCode, depth + 1);
  switch (node.type) {
    case AST_NODE_TYPES.JSXText:
      return node.value.trim().length > 0;
    case AST_NODE_TYPES.Literal:
      return typeof node.value === 'string' ? node.value.trim().length > 0 : typeof node.value === 'number';
    case AST_NODE_TYPES.JSXExpressionContainer:
      return node.expression.type !== AST_NODE_TYPES.JSXEmptyExpression && inner(node.expression);
    case AST_NODE_TYPES.JSXFragment:
      return node.children.some(inner);
    case AST_NODE_TYPES.Identifier: {
      if (node.name === 'undefined') return false;
      const element = resolveJsx(node, sourceCode);
      return element ? inner(element) : true;
    }
    case AST_NODE_TYPES.JSXElement: {
      const opening = node.openingElement;
      if (hasSpread(opening) || hasMeaningfulProp(opening, 'aria-label') || hasMeaningfulProp(opening, 'aria-labelledby')) {
        return true;
      }
      const hidden = propValue(opening, 'aria-hidden');
      if (hidden === true || hidden === 'true' || resolver.isIcon(opening)) return false;
      const tag = intrinsicName(opening);
      if (tag === 'img') return hasMeaningfulProp(opening, 'alt');
      if (tag === 'svg' || tag === 'i') return false;
      // A component that isn't antd's may render text we can't see.
      if (tag === null && !resolver.componentName(opening)) return true;
      return node.children.some(inner);
    }
    default:
      // Any other expression (a call, a member, a template with values) may render text.
      return true;
  }
}

export interface FormItemContext {
  /** An enclosing Form.Item provides a label (or we can't tell because of a spread). */
  labeled: boolean;
  /** The nearest Form.Item has `name` and no label, so `form-item-has-label` reports it. */
  ownedByFormItemRule: boolean;
}

/**
 * Walks up to the nearest Form.Item that renders a label slot (skipping `noStyle`
 * wrappers, which render none) and reports whether it labels its control.
 */
export function formItemContext(element: TSESTree.JSXElement, resolver: AntdResolver): FormItemContext {
  let current = parentElement(element);
  while (current) {
    const opening = current.openingElement;
    if (resolver.componentName(opening) === 'Form.Item') {
      if (hasSpread(opening) || hasMeaningfulProp(opening, 'label')) {
        return { labeled: true, ownedByFormItemRule: false };
      }
      if (!hasMeaningfulProp(opening, 'noStyle')) {
        return { labeled: false, ownedByFormItemRule: hasMeaningfulProp(opening, 'name') };
      }
    }
    current = parentElement(current);
  }
  return { labeled: false, ownedByFormItemRule: false };
}
