import { createRule } from '../utils/create-rule.js';
import { createResolver } from '../utils/antd-imports.js';
import { formItemContext, hasOwnName } from '../utils/accessible-name.js';

// Date/time pickers render a native <input> that always has a placeholder
// ("Select date" by default), which browsers use as a fallback name.
const PLACEHOLDER_NAMED = new Set([
  'DatePicker',
  'DatePicker.RangePicker',
  'TimePicker',
  'TimePicker.RangePicker',
]);

const PICKERS = new Set([
  'Select',
  'DatePicker',
  'DatePicker.RangePicker',
  'TimePicker',
  'TimePicker.RangePicker',
  'Cascader',
  'TreeSelect',
  'AutoComplete',
]);

export default createRule({
  name: 'picker-has-name',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require an accessible name on antd Select, pickers, Cascader, TreeSelect and AutoComplete',
      impact: 'serious',
      impactByMessage: { placeholderOnly: 'moderate' },
      wcag: ['4.1.2', '1.3.1', '3.3.2'],
    },
    messages: {
      missing:
        '<{{name}}> has no accessible name. Wrap it in a labelled Form.Item or add aria-label (its placeholder is not exposed as a name).',
      placeholderOnly:
        '<{{name}}> is named only by its placeholder, which disappears once a value is chosen. Wrap it in a labelled Form.Item or add aria-label.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const resolver = createResolver(context);
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        const name = resolver.componentName(opening);
        if (!name || !PICKERS.has(name)) return;
        if (hasOwnName(opening)) return;
        const formItem = formItemContext(node, resolver);
        if (formItem.labeled || formItem.ownedByFormItemRule) return;
        const messageId = PLACEHOLDER_NAMED.has(name) ? 'placeholderOnly' : 'missing';
        context.report({ node: opening, messageId, data: { name } });
      },
    };
  },
});
