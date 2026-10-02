import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils/create-rule.js';
import { createResolver } from '../utils/antd-imports.js';
import { DYNAMIC, getProp, hasMeaningfulProp, hasSpread, intrinsicName, propValue } from '../utils/jsx.js';
import { findFocusable, resolveJsx } from '../utils/popup.js';

const DIALOGS = new Set(['Modal', 'Drawer']);
// The whole label, so actions like "Close account" or "Close ticket #4" don't count.
const CLOSE_TEXT = /^(?:close(?: (?:dialog|modal|window|panel))?|×|x)$/i;

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
      control: 'The {{control}} in title adds its text to the dialog name, which antd takes from the title. Move it out of title.',
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

    /**
     * A button or link that closes the dialog: a close icon, a "Close" label, or, for a control with no
     * visible text, the same handler as onCancel. A labelled Cancel / Done action is not a second X.
     */
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
      const visible = text(element);
      if (CLOSE_TEXT.test(visible)) return true;
      if (visible || element.children.some((child) => child.type === AST_NODE_TYPES.JSXExpressionContainer)) return false;
      const onClick = propExpression(opening, 'onClick');
      return onCancel !== null && onClick !== null && sourceCode.getText(onClick) === onCancel;
    };

    const findClose = (roots: (TSESTree.Node | null)[], onCancel: string | null): TSESTree.JSXOpeningElement | null => {
      const seen = new Set<TSESTree.Node>();
      const visit = (node: TSESTree.Node | null | undefined, depth: number): TSESTree.JSXOpeningElement | null => {
        if (!node || depth > 8 || seen.has(node)) return null;
        seen.add(node);
        switch (node.type) {
          case AST_NODE_TYPES.JSXElement: {
            // A nested dialog's close button belongs to that dialog.
            const nested = resolver.componentName(node.openingElement);
            if (nested && DIALOGS.has(nested)) return null;
            if (isCloseControl(node, onCancel)) return node.openingElement;
            return first(node.children, depth + 1);
          }
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

    /**
     * True when antd renders its own close button: `closable` isn't false, and `closeIcon` isn't null or
     * false (antd's computeClosableConfig hides it for either). A dynamic `closable` can't be told, so it
     * counts as no; an object literal (`{ 'aria-label': … }`) always renders it.
     */
    const rendersCloseButton = (opening: TSESTree.JSXOpeningElement): boolean => {
      const closable = propValue(opening, 'closable');
      if (closable === false) return false;
      if (closable === DYNAMIC && propExpression(opening, 'closable')?.type !== AST_NODE_TYPES.ObjectExpression) return false;
      const closeIcon = propValue(opening, 'closeIcon');
      return !(closable === undefined && (closeIcon === null || closeIcon === false));
    };

    return {
      JSXElement(node) {
        const opening = node.openingElement;
        const name = resolver.componentName(opening);
        if (!name || !DIALOGS.has(name)) return;
        const title = propExpression(opening, 'title');
        // A Drawer with its own aria-labelledby takes its name from there, not from the title.
        const namedElsewhere = name === 'Drawer' && hasMeaningfulProp(opening, 'aria-labelledby');
        const control = title && !namedElsewhere && findFocusable(title, resolver, sourceCode);
        if (control) {
          context.report({ node: control, messageId: 'control', data: { control: `<${sourceCode.getText(control.name)}>` } });
        }
        // Only Modal for now: that is where the field data saw the second close button.
        if (name !== 'Modal' || hasSpread(opening) || !rendersCloseButton(opening)) return;
        const cancel = propExpression(opening, 'onCancel');
        const onCancel = cancel ? sourceCode.getText(cancel) : null;
        const close = findClose([title, ...node.children], onCancel);
        if (close) context.report({ node: close, messageId: 'duplicateClose' });
      },
    };
  },
});
