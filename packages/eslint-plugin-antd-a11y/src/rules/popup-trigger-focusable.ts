import { createRule } from '../utils/create-rule.js';
import { createResolver } from '../utils/antd-imports.js';
import { hasFocusableDescendant, hasNoTrigger, popupTrigger, reportNode, wrappedDisabledButton } from '../utils/popup.js';
import { TOOLTIP_POPUPS } from './tooltip-no-disabled-child.js';
import {
  getProp,
  hasMeaningfulProp,
  hasSpread,
  intrinsicName,
  mayBeTrue,
  propValue,
} from '../utils/jsx.js';

const POPUPS = new Set(['Tooltip', 'Popover', 'Dropdown', 'Popconfirm']);

const NON_FOCUSABLE_TAGS = new Set([
  'div', 'span', 'p', 'i', 'b', 'em', 'strong', 'small', 'img', 'svg', 'label',
  'li', 'section', 'article', 'header', 'footer', 'td', 'th',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);

// antd components that render a non-focusable element and forward tabIndex.
const NON_FOCUSABLE_ANTD = new Set([
  'Avatar', 'Tag', 'Badge', 'Image', 'Typography.Text', 'Typography.Title', 'Typography.Paragraph',
]);

export default createRule({
  name: 'popup-trigger-focusable',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require that Tooltip, Popover, Dropdown and Popconfirm triggers can take keyboard focus',
      impact: 'serious',
      wcag: ['2.1.1', '4.1.2'],
    },
    messages: {
      notFocusable:
        '<{{popup}}> is triggered by {{trigger}}, which cannot take keyboard focus. Use a Button (type="text" or "link"), or add tabIndex={0} and a role.',
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
        // trigger={[]}: antd binds nothing to the child; it only positions a popup opened elsewhere.
        if (hasNoTrigger(node.openingElement)) return;
        const triggerElement = popupTrigger(node, context.sourceCode);
        if (!triggerElement) return;
        const child = triggerElement.openingElement;
        if (hasSpread(child) || hasMeaningfulProp(child, 'role')) return;
        if (getProp(child, 'tabIndex') && propValue(child, 'tabIndex') !== -1) return;
        if (mayBeTrue(child, 'contentEditable')) return;
        // <Tooltip><span><Button disabled /></span></Tooltip>: tooltip-no-disabled-child names the real problem.
        if (TOOLTIP_POPUPS.has(popup) && wrappedDisabledButton(triggerElement, resolver, context.sourceCode)) return;
        // <span><Button>Add</Button></span>: the Button takes focus and its events bubble to the span.
        if (hasFocusableDescendant(triggerElement, resolver, context.sourceCode)) return;

        const tag = intrinsicName(child);
        let trigger: string | null = null;
        if (tag !== null) {
          if (NON_FOCUSABLE_TAGS.has(tag) || (tag === 'a' && !getProp(child, 'href'))) trigger = `<${tag}>`;
        } else if (resolver.isIcon(child)) {
          trigger = 'an icon';
        } else {
          const name = resolver.componentName(child);
          if (name && NON_FOCUSABLE_ANTD.has(name)) trigger = `<${name}>`;
        }
        if (!trigger) return;
        context.report({ node: reportNode(node, triggerElement), messageId: 'notFocusable', data: { popup, trigger } });
      },
    };
  },
});
