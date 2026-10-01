import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils/create-rule.js';
import { createResolver } from '../utils/antd-imports.js';
import { hasOwnName, jsxHasText } from '../utils/accessible-name.js';
import { wrapperNamesElement } from '../utils/aliases.js';
import { DYNAMIC, getProp, hasMeaningfulProp, hasSpread, propValue } from '../utils/jsx.js';
import { modalApiCall } from '../utils/modal-api.js';

const DIALOGS = new Set(['Modal', 'Drawer']);

export default createRule({
  name: 'modal-has-title',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a title with text on antd Modal and Drawer, and on Modal.confirm() and the hook APIs, so the dialog has a name',
      impact: 'serious',
      wcag: ['4.1.2', '2.4.6'],
    },
    messages: {
      missing: '<{{name}}> renders an unnamed dialog. {{fix}}',
      dropped:
        '<Modal> drops aria-label and aria-labelledby: antd does not pass them to role="dialog". Put the dialog heading in title. To hide it, use visually hidden text in title.',
      emptyTitle: '<{{name}}> has a title with no text, so the dialog name is empty. Put the dialog heading text in title.',
      imperative: '{{callee}}() without a title opens an unnamed dialog. Pass the heading text as title, not inside content.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const resolver = createResolver(context);
    const { sourceCode } = context;

    /** 'text' when `title` can name the dialog, 'empty' for JSX with no text, 'none' when absent or blank. */
    const titleState = (opening: TSESTree.JSXOpeningElement): 'text' | 'empty' | 'none' => {
      const attr = getProp(opening, 'title');
      if (!attr) return 'none';
      if (propValue(opening, 'title') === DYNAMIC && attr.value) {
        const value = attr.value.type === AST_NODE_TYPES.JSXExpressionContainer ? attr.value.expression : attr.value;
        return jsxHasText(value, resolver, sourceCode) ? 'text' : 'empty';
      }
      return hasMeaningfulProp(opening, 'title') ? 'text' : 'none';
    };

    return {
      JSXElement(node) {
        const opening = node.openingElement;
        const name = resolver.componentName(opening);
        if (!name || !DIALOGS.has(name)) return;
        if (name === 'Drawer') {
          // rc-drawer passes aria-* through to role="dialog", so they name a Drawer.
          if (hasOwnName(opening, { allowId: false })) return;
        } else if (hasSpread(opening) || wrapperNamesElement(opening)) {
          return;
        }
        const title = titleState(opening);
        if (title === 'text') return;
        if (title === 'empty') {
          context.report({ node: opening, messageId: 'emptyTitle', data: { name } });
        } else if (name === 'Modal' && (hasMeaningfulProp(opening, 'aria-label') || hasMeaningfulProp(opening, 'aria-labelledby'))) {
          context.report({ node: opening, messageId: 'dropped' });
        } else {
          const fix =
            name === 'Modal'
              ? 'Add a title (visually hidden text in title works when the design shows no heading).'
              : 'Add a title, or aria-labelledby pointing at a visible heading.';
          context.report({ node: opening, messageId: 'missing', data: { name, fix } });
        }
      },
      CallExpression(node) {
        const callee = modalApiCall(node, resolver, sourceCode);
        if (!callee) return;
        const [arg] = node.arguments;
        if (arg && arg.type !== AST_NODE_TYPES.ObjectExpression) return;
        if (arg?.properties.some((prop) => prop.type === AST_NODE_TYPES.SpreadElement)) return;
        const title = arg?.properties.find(
          (prop): prop is TSESTree.Property =>
            prop.type === AST_NODE_TYPES.Property &&
            !prop.computed &&
            ((prop.key.type === AST_NODE_TYPES.Identifier && prop.key.name === 'title') ||
              (prop.key.type === AST_NODE_TYPES.Literal && prop.key.value === 'title')),
        );
        if (title && jsxHasText(title.value, resolver, sourceCode)) return;
        context.report({ node: title ?? node, messageId: 'imperative', data: { callee } });
      },
    };
  },
});
