import { TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { AntdResolver } from './antd-imports.js';
import { hasMeaningfulProp, hasSpread, meaningfulChildren, parentElement } from './jsx.js';

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
  for (const prop of [...NAME_PROPS, ...extraProps]) {
    if (hasMeaningfulProp(node, prop)) return true;
  }
  return allowId && hasMeaningfulProp(node, 'id');
}

/**
 * True when the element renders text a screen reader would read as its name.
 * Any expression child counts (it may render text); icon components do not.
 */
export function hasTextContent(element: TSESTree.JSXElement, resolver: AntdResolver): boolean {
  return meaningfulChildren(element).some((child) => {
    if (child.type === AST_NODE_TYPES.JSXElement) {
      if (resolver.isIcon(child.openingElement)) return false;
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
