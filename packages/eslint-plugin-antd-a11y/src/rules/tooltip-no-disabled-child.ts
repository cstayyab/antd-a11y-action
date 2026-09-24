import { createRule } from '../utils/create-rule.js';
import { createResolver } from '../utils/antd-imports.js';
import { hasNoTrigger, isDisabledButton, popupTrigger, reportNode, wrappedDisabledButton } from '../utils/popup.js';

/** Popups this rule covers. popup-trigger-focusable leaves wrapped disabled buttons in these to this rule. */
export const TOOLTIP_POPUPS = new Set(['Tooltip', 'Popover']);

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
      wrapped:
        '<{{popup}}> wraps a disabled button in a <{{wrapper}}>. The <{{wrapper}}> lets mouse users hover, but the button still cannot take focus, so keyboard and screen reader users never get the tooltip. Use aria-disabled on the button and block the click in the handler, or put the reason in visible text.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const resolver = createResolver(context);
    return {
      JSXElement(node) {
        const popup = resolver.componentName(node.openingElement);
        if (!popup || !TOOLTIP_POPUPS.has(popup)) return;
        // trigger={[]}: the popup is opened by something else, so the child never needs focus.
        if (hasNoTrigger(node.openingElement)) return;
        const trigger = popupTrigger(node, context.sourceCode);
        if (!trigger) return;
        if (isDisabledButton(trigger.openingElement, resolver)) {
          context.report({ node: reportNode(node, trigger), messageId: 'disabled', data: { popup } });
          return;
        }
        const wrapped = wrappedDisabledButton(trigger, resolver, context.sourceCode);
        if (wrapped) {
          context.report({ node: wrapped.at, messageId: 'wrapped', data: { popup, wrapper: wrapped.wrapper } });
        }
      },
    };
  },
});
