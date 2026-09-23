import { createRule } from '../utils/create-rule.js';
import { createResolver } from '../utils/antd-imports.js';
import { hasOwnName } from '../utils/accessible-name.js';

const DIALOGS = new Set(['Modal', 'Drawer']);

export default createRule({
  name: 'modal-has-title',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a title (or aria-labelledby) on antd Modal and Drawer so the dialog has a name',
      impact: 'serious',
      wcag: ['4.1.2', '2.4.6'],
    },
    messages: {
      missing: '<{{name}}> renders an unnamed dialog. Add a title, or aria-labelledby pointing at a visible heading.',
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
        if (!name || !DIALOGS.has(name)) return;
        if (hasOwnName(opening, { extraProps: ['title'], allowId: false })) return;
        context.report({ node: opening, messageId: 'missing', data: { name } });
      },
    };
  },
});
