import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils/create-rule.js';
import { createResolver, type AntdResolver } from '../utils/antd-imports.js';
import { getProp, intrinsicName, parentElement, propValue } from '../utils/jsx.js';

const AUTH_NAME = /e-?mail|passw(or)?d|\bpwd\b|user_?name|userName|login/i;
const AUTH_TYPES = new Set(['password', 'email']);
const DISABLED_AUTOCOMPLETE = new Set(['off', 'false', 'nope', 'none']);

function propText(context: { sourceCode: { getText(node: TSESTree.Node): string } }, attr: TSESTree.JSXAttribute | undefined): string {
  if (!attr?.value) return '';
  return context.sourceCode.getText(attr.value);
}

function enclosingFormItemName(
  element: TSESTree.JSXElement,
  resolver: AntdResolver,
  context: { sourceCode: { getText(node: TSESTree.Node): string } },
): string {
  let current = parentElement(element);
  while (current) {
    if (resolver.componentName(current.openingElement) === 'Form.Item') {
      const name = propText(context, getProp(current.openingElement, 'name'));
      if (name) return name;
    }
    current = parentElement(current);
  }
  return '';
}

function blocksPaste(attr: TSESTree.JSXAttribute | undefined): boolean {
  if (!attr?.value || attr.value.type !== AST_NODE_TYPES.JSXExpressionContainer) return false;
  const expr = attr.value.expression;
  if (expr.type !== AST_NODE_TYPES.ArrowFunctionExpression && expr.type !== AST_NODE_TYPES.FunctionExpression) {
    return false;
  }
  let found = false;
  const visit = (node: TSESTree.Node): void => {
    if (found) return;
    if (
      node.type === AST_NODE_TYPES.CallExpression &&
      node.callee.type === AST_NODE_TYPES.MemberExpression &&
      node.callee.property.type === AST_NODE_TYPES.Identifier &&
      node.callee.property.name === 'preventDefault'
    ) {
      found = true;
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent') continue;
      if (Array.isArray(value)) {
        for (const item of value) if (item && typeof item.type === 'string') visit(item);
      } else if (value && typeof value === 'object' && typeof (value as TSESTree.Node).type === 'string') {
        visit(value as TSESTree.Node);
      }
    }
  };
  visit(expr.body);
  return found;
}

export default createRule({
  name: 'auth-input-autocomplete',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow turning off autocomplete or blocking paste on login fields, which breaks password managers (WCAG 3.3.8)',
      impact: 'serious',
      wcag: ['3.3.8', '1.3.5'],
    },
    messages: {
      autocompleteOff:
        'autoComplete="{{value}}" on a {{kind}} field stops password managers from filling it. Use a token such as "username", "email", "current-password" or "new-password".',
      pasteBlocked:
        'onPaste calls preventDefault on a {{kind}} field, so users cannot paste from a password manager.',
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
        const tag = intrinsicName(opening);
        if (name !== 'Input' && name !== 'Input.Password' && tag !== 'input') return;

        const type = propValue(opening, 'type');
        let kind: string | null = null;
        if (name === 'Input.Password' || type === 'password') kind = 'password';
        else if (type === 'email') kind = 'email';
        else {
          const hint = [
            propText(context, getProp(opening, 'name')),
            propText(context, getProp(opening, 'id')),
            enclosingFormItemName(node, resolver, context),
          ].join(' ');
          if (AUTH_NAME.test(hint)) kind = /passw|pwd/i.test(hint) ? 'password' : 'login';
        }
        if (typeof type === 'string' && !AUTH_TYPES.has(type) && type !== 'text') kind = null;
        if (!kind) return;

        const autoComplete = propValue(opening, 'autoComplete');
        if (typeof autoComplete === 'string' && DISABLED_AUTOCOMPLETE.has(autoComplete.trim().toLowerCase())) {
          context.report({
            node: getProp(opening, 'autoComplete')!,
            messageId: 'autocompleteOff',
            data: { value: autoComplete, kind },
          });
        }
        const onPaste = getProp(opening, 'onPaste');
        if (blocksPaste(onPaste)) {
          context.report({ node: onPaste!, messageId: 'pasteBlocked', data: { kind } });
        }
      },
    };
  },
});
