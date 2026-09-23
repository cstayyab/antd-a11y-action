import { createRule } from '../utils/create-rule.js';
import { createResolver } from '../utils/antd-imports.js';
import { formItemContext, hasOwnName, hasTextContent } from '../utils/accessible-name.js';
import { hasMeaningfulProp } from '../utils/jsx.js';

const CONTROLS = new Set([
  'Input',
  'Input.Password',
  'Input.TextArea',
  'Input.Search',
  'InputNumber',
  'Mentions',
  'Switch',
  'Slider',
  'Checkbox',
  'Radio',
]);

// Text inputs whose `placeholder` lands on the native element, where browsers use it as a fallback name.
const PLACEHOLDER_INPUTS = new Set([
  'Input',
  'Input.Password',
  'Input.TextArea',
  'Input.Search',
  'InputNumber',
  'Mentions',
]);

// Controls that are named by the text they wrap.
const LABELLED_BY_CHILDREN = new Set(['Checkbox', 'Radio']);

// Component-specific props antd forwards as the control's name.
const EXTRA_NAME_PROPS: Record<string, string[]> = {
  Slider: ['ariaLabelForHandle', 'ariaLabelledByForHandle'],
  Switch: ['checkedChildren', 'unCheckedChildren'],
};

export default createRule({
  name: 'form-control-has-name',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require an accessible name on antd Input, InputNumber, Switch, Slider, Checkbox and Radio',
      impact: 'serious',
      impactByMessage: { placeholderOnly: 'moderate' },
      wcag: ['4.1.2', '1.3.1', '3.3.2'],
    },
    messages: {
      missing: '<{{name}}> has no accessible name. Wrap it in a labelled Form.Item or add aria-label.',
      placeholderOnly:
        '<{{name}}> is named only by its placeholder, which disappears as soon as the user types. Wrap it in a labelled Form.Item or add aria-label.',
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
        if (!name || !CONTROLS.has(name)) return;
        if (LABELLED_BY_CHILDREN.has(name) && hasTextContent(node, resolver)) return;
        if (hasOwnName(opening, { extraProps: EXTRA_NAME_PROPS[name] ?? [] })) return;
        // `children` passed as a prop names Checkbox/Radio the same way nested text does.
        if (LABELLED_BY_CHILDREN.has(name) && hasMeaningfulProp(opening, 'children')) return;
        const formItem = formItemContext(node, resolver);
        if (formItem.labeled || formItem.ownedByFormItemRule) return;
        const messageId =
          PLACEHOLDER_INPUTS.has(name) && hasMeaningfulProp(opening, 'placeholder') ? 'placeholderOnly' : 'missing';
        context.report({ node: opening, messageId, data: { name } });
      },
    };
  },
});
