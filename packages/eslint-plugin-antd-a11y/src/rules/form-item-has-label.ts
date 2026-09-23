import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule } from '../utils/create-rule.js';
import { createResolver } from '../utils/antd-imports.js';
import { formItemContext, hasOwnName, hasTextContent } from '../utils/accessible-name.js';
import {
  getProp,
  hasMeaningfulProp,
  hasSpread,
  intrinsicName,
  meaningfulChildren,
  propValue,
} from '../utils/jsx.js';

// Children we know render a form control that needs the Form.Item's label.
// Anything else (custom components, render props) may label itself, so we stay quiet.
const ANTD_CONTROLS = new Set([
  'Input',
  'Input.Password',
  'Input.TextArea',
  'Input.Search',
  'InputNumber',
  'Mentions',
  'Select',
  'DatePicker',
  'DatePicker.RangePicker',
  'TimePicker',
  'TimePicker.RangePicker',
  'Cascader',
  'TreeSelect',
  'AutoComplete',
  'Switch',
  'Slider',
  'Checkbox',
  'Radio',
  'Radio.Group',
  'Checkbox.Group',
  'Rate',
  'ColorPicker',
]);
const INTRINSIC_CONTROLS = new Set(['input', 'select', 'textarea']);

export default createRule({
  name: 'form-item-has-label',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a label on antd Form.Item fields whose control has no other name',
      impact: 'serious',
      wcag: ['1.3.1', '3.3.2', '4.1.2'],
    },
    messages: {
      missing:
        'Form.Item "{{field}}" has no label and its control has no accessible name. Add label="…" (or aria-label on the control).',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const resolver = createResolver(context);
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        if (resolver.componentName(opening) !== 'Form.Item') return;
        if (hasSpread(opening)) return;
        if (!hasMeaningfulProp(opening, 'name')) return;
        if (hasMeaningfulProp(opening, 'label')) return;
        if (hasMeaningfulProp(opening, 'noStyle') || hasMeaningfulProp(opening, 'hidden')) return;
        if (formItemContext(node, resolver).labeled) return;

        const children = meaningfulChildren(node);
        if (children.length !== 1 || children[0].type !== AST_NODE_TYPES.JSXElement) return;
        const child = children[0];
        const childName = resolver.componentName(child.openingElement);
        const tag = intrinsicName(child.openingElement);
        const isControl =
          (childName !== null && ANTD_CONTROLS.has(childName)) || (tag !== null && INTRINSIC_CONTROLS.has(tag));
        if (!isControl) return;
        if (hasOwnName(child.openingElement, { extraProps: ['ariaLabelForHandle', 'ariaLabelledByForHandle'] })) return;
        if (hasTextContent(child, resolver)) return;

        const field = propValue(opening, 'name');
        context.report({
          node: opening,
          messageId: 'missing',
          data: { field: typeof field === 'string' ? field : context.sourceCode.getText(getProp(opening, 'name')!.value!) },
        });
      },
    };
  },
});
