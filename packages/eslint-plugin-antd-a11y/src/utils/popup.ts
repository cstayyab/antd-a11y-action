import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { AntdResolver } from './antd-imports.js';
import { getProp, hasMeaningfulProp, hasSpread, intrinsicName, mayBeTrue, meaningfulChildren, propValue } from './jsx.js';

type Opening = TSESTree.JSXOpeningElement;

// Wrappers people add so a disabled button still gets hover events. They can't take focus themselves.
const WRAPPER_TAGS = new Set(['span', 'div']);

/** The only child element of a popup, or null when there are several children or a non-element child. */
export function popupTrigger(popup: TSESTree.JSXElement): TSESTree.JSXElement | null {
  const children = meaningfulChildren(popup);
  return children.length === 1 && children[0].type === AST_NODE_TYPES.JSXElement ? children[0] : null;
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
): { wrapper: string; button: Opening } | null {
  const wrapper = trigger.openingElement;
  const tag = intrinsicName(wrapper);
  if (!tag || !WRAPPER_TAGS.has(tag)) return null;
  if (hasSpread(wrapper) || hasMeaningfulProp(wrapper, 'role')) return null;
  if (getProp(wrapper, 'tabIndex') && propValue(wrapper, 'tabIndex') !== -1) return null;
  const inner = popupTrigger(trigger);
  if (!inner || !isDisabledButton(inner.openingElement, resolver)) return null;
  return { wrapper: tag, button: inner.openingElement };
}
