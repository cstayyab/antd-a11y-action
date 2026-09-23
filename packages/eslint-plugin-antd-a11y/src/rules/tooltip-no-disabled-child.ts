import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule } from '../utils/create-rule.js';
import { createResolver } from '../utils/antd-imports.js';
import { intrinsicName, mayBeTrue, meaningfulChildren } from '../utils/jsx.js';

const POPUPS = new Set(['Tooltip', 'Popover']);

export default createRule({
  name: 'tooltip-no-disabled-child',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow a Tooltip or Popover whose trigger is a disabled Button, which keyboard users cannot reach',
      impact: 'serious',
      wcag: ['2.1.1', '1.3.1'],
    },
    messages: {
      disabled:
        '<{{popup}}> wraps a disabled button, which cannot take focus, so keyboard and screen reader users never get the tooltip. Put the reason in visible text, or use aria-disabled and block the click in the handler instead.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const resolver = createResolver(context);
    return {
      JSXElement(node) {
        const popup = resolver.componentName(node.openingElement);
        if (!popup || !POPUPS.has(popup)) return;
        const children = meaningfulChildren(node);
        if (children.length !== 1 || children[0].type !== AST_NODE_TYPES.JSXElement) return;
        const child = children[0].openingElement;
        const isButton = resolver.componentName(child) === 'Button' || intrinsicName(child) === 'button';
        if (!isButton || !mayBeTrue(child, 'disabled')) return;
        context.report({ node: child, messageId: 'disabled', data: { popup } });
      },
    };
  },
});
