import { createRule } from '../utils/create-rule.js';
import { createResolver } from '../utils/antd-imports.js';
import { getProp, hasMeaningfulProp, hasSpread } from '../utils/jsx.js';

export default createRule({
  name: 'image-has-alt',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require alt text on antd Image (alt="" marks it decorative)',
      impact: 'serious',
      wcag: ['1.1.1'],
    },
    messages: {
      missing: 'antd <Image> has no alt. Describe the image, or use alt="" if it is decorative.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const resolver = createResolver(context);
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        if (resolver.componentName(opening) !== 'Image') return;
        if (hasSpread(opening) || getProp(opening, 'alt')) return;
        if (hasMeaningfulProp(opening, 'aria-label') || hasMeaningfulProp(opening, 'aria-labelledby')) return;
        context.report({ node: opening, messageId: 'missing' });
      },
    };
  },
});
