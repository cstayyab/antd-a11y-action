import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils/create-rule.js';
import { createResolver } from '../utils/antd-imports.js';
import { getProp, hasSpread, intrinsicName, propValue } from '../utils/jsx.js';
import { findFocusable, resolveJsx } from '../utils/popup.js';

const DIALOGS = new Set(['Modal', 'Drawer']);
const CLOSE_TEXT = /^close\b/i;

export default createRule({
  name: 'modal-title-no-control',
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep controls out of a Modal or Drawer title, and avoid a second close button next to antd\'s own',
      impact: 'moderate',
      wcag: ['4.1.2', '3.2.4'],
    },
    messages: {
      control: 'The {{control}} in title adds its text to the dialog name (aria-labelledby points at the title). Move it out of title.',
      duplicateClose: 'antd already renders a close button on this Modal. Set closable={false}, or remove the custom close control.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const resolver = createResolver(context);
    const { sourceCode } = context;

    const propExpression = (opening: TSESTree.JSXOpeningElement, name: string): TSESTree.Node | null => {
      const attr = getProp(opening, name);
      if (!attr?.value) return null;
      if (attr.value.type === AST_NODE_TYPES.JSXExpressionContainer) {
        return attr.value.expression.type === AST_NODE_TYPES.JSXEmptyExpression ? null : attr.value.expression;
      }
      return attr.value;
    };

    const isCloseIcon = (node: TSESTree.Node | null): boolean => {
      const element = node && resolveJsx(node, sourceCode);
      return !!element && resolver.isIcon(element.openingElement) && sourceCode.getText(element.openingElement.name) === 'CloseOutlined';
    };

    const text = (element: TSESTree.JSXElement): string =>
      element.children
        .map((child) => (child.type === AST_NODE_TYPES.JSXText ? child.value : ''))
        .join('')
        .trim();

    /** A button or link that closes the dialog: a close icon, a "Close" label, or the same handler as onCancel. */
    const isCloseControl = (element: TSESTree.JSXElement, onCancel: string | null): boolean => {
      const opening = element.openingElement;
      if (hasSpread(opening)) return false;
      const tag = intrinsicName(opening);
      const isControl = resolver.componentName(opening) === 'Button' || tag === 'button' || (tag === 'a' && !!getProp(opening, 'href'));
      if (!isControl) return false;
      if (isCloseIcon(propExpression(opening, 'icon'))) return true;
      if (element.children.some((child) => isCloseIcon(child.type === AST_NODE_TYPES.JSXExpressionContainer ? child.expression : child))) {
        return true;
      }
      const label = propValue(opening, 'aria-label');
      if (typeof label === 'string' && CLOSE_TEXT.test(label.trim())) return true;
      if (CLOSE_TEXT.test(text(element))) return true;
      const onClick = propExpression(opening, 'onClick');
      return onCancel !== null && onClick !== null && sourceCode.getText(onClick) === onCancel;
    };

    const findClose = (roots: (TSESTree.Node | null)[], onCancel: string | null): TSESTree.JSXOpeningElement | null => {
      const seen = new Set<TSESTree.Node>();
      const visit = (node: TSESTree.Node | null | undefined, depth: number): TSESTree.JSXOpeningElement | null => {
        if (!node || depth > 8 || seen.has(node)) return null;
        seen.add(node);
        switch (node.type) {
          case AST_NODE_TYPES.JSXElement:
            if (isCloseControl(node, onCancel)) return node.openingElement;
            return first(node.children, depth + 1);
          case AST_NODE_TYPES.JSXFragment:
            return first(node.children, depth + 1);
          case AST_NODE_TYPES.JSXExpressionContainer:
            return node.expression.type === AST_NODE_TYPES.JSXEmptyExpression ? null : visit(node.expression, depth);
          case AST_NODE_TYPES.LogicalExpression:
            return visit(node.right, depth);
          case AST_NODE_TYPES.ConditionalExpression:
            return visit(node.consequent, depth) ?? visit(node.alternate, depth);
          case AST_NODE_TYPES.Identifier:
            return visit(resolveJsx(node, sourceCode), depth);
          default:
            return null;
        }
      };
      const first = (nodes: TSESTree.Node[], depth: number): TSESTree.JSXOpeningElement | null => {
        for (const child of nodes) {
          const found = visit(child, depth);
          if (found) return found;
        }
        return null;
      };
      return first(roots.filter((root): root is TSESTree.Node => root !== null), 0);
    };

    return {
      JSXElement(node) {
        const opening = node.openingElement;
        const name = resolver.componentName(opening);
        if (!name || !DIALOGS.has(name)) return;
        const title = propExpression(opening, 'title');
        const control = title && findFocusable(title, resolver, sourceCode);
        if (control) {
          context.report({ node: control, messageId: 'control', data: { control: `<${sourceCode.getText(control.name)}>` } });
        }
        // Only Modal for now: that is where the field data saw the second close button.
        if (name !== 'Modal' || hasSpread(opening) || propValue(opening, 'closable') === false) return;
        const cancel = propExpression(opening, 'onCancel');
        const onCancel = cancel ? sourceCode.getText(cancel) : null;
        const close = findClose([title, ...node.children], onCancel);
        if (close) context.report({ node: close, messageId: 'duplicateClose' });
      },
    };
  },
});
