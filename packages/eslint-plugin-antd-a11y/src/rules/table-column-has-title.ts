import { ASTUtils, AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils/create-rule.js';
import { createResolver } from '../utils/antd-imports.js';
import { getProp, hasMeaningfulProp, hasSpread, staticValue, DYNAMIC } from '../utils/jsx.js';

function unwrap(node: TSESTree.Expression): TSESTree.Expression {
  let current = node;
  while (
    current.type === AST_NODE_TYPES.TSAsExpression ||
    current.type === AST_NODE_TYPES.TSSatisfiesExpression ||
    current.type === AST_NODE_TYPES.TSNonNullExpression
  ) {
    current = current.expression;
  }
  return current;
}

function findProperty(obj: TSESTree.ObjectExpression, key: string): TSESTree.Property | undefined {
  for (const prop of obj.properties) {
    if (prop.type !== AST_NODE_TYPES.Property || prop.computed) continue;
    const name =
      prop.key.type === AST_NODE_TYPES.Identifier
        ? prop.key.name
        : prop.key.type === AST_NODE_TYPES.Literal
          ? String(prop.key.value)
          : null;
    if (name === key) return prop;
  }
  return undefined;
}

function isEmptyTitle(value: TSESTree.Node): boolean {
  if (value.type === AST_NODE_TYPES.AssignmentPattern) return false;
  const v = staticValue(value as TSESTree.Expression);
  if (v === DYNAMIC) return false;
  return v === undefined || v === null || v === false || (typeof v === 'string' && v.trim() === '');
}

export default createRule({
  name: 'table-column-has-title',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a non-empty title on antd Table columns so every header cell has a name',
      impact: 'moderate',
      wcag: ['1.3.1'],
    },
    messages: {
      missing:
        'Table column has no title, so its header cell is empty. Add a title (for an actions column, use visible text or a visually hidden label).',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const resolver = createResolver(context);
    const checked = new WeakSet<TSESTree.ArrayExpression>();

    function checkColumns(array: TSESTree.ArrayExpression): void {
      if (checked.has(array)) return;
      checked.add(array);
      for (const element of array.elements) {
        if (!element || element.type !== AST_NODE_TYPES.ObjectExpression) continue;
        if (element.properties.some((p) => p.type === AST_NODE_TYPES.SpreadElement)) continue;
        const hidden = findProperty(element, 'hidden');
        if (hidden && staticValue(hidden.value as TSESTree.Expression) === true) continue;
        const title = findProperty(element, 'title');
        if (!title || isEmptyTitle(title.value)) {
          context.report({ node: title ?? element, messageId: 'missing' });
        }
        const children = findProperty(element, 'children');
        if (children && children.value.type === AST_NODE_TYPES.ArrayExpression) {
          checkColumns(children.value);
        }
      }
    }

    function resolveArray(expr: TSESTree.Expression, scopeNode: TSESTree.Node): TSESTree.ArrayExpression | null {
      const node = unwrap(expr);
      if (node.type === AST_NODE_TYPES.ArrayExpression) return node;
      if (node.type !== AST_NODE_TYPES.Identifier) return null;
      const variable = ASTUtils.findVariable(context.sourceCode.getScope(scopeNode), node.name);
      if (!variable || variable.defs.length !== 1) return null;
      const def = variable.defs[0];
      if (def.type !== 'Variable' || def.node.id.type !== AST_NODE_TYPES.Identifier) return null;
      if (def.parent.kind !== 'const' || !def.node.init) return null;
      const init = unwrap(def.node.init);
      return init.type === AST_NODE_TYPES.ArrayExpression ? init : null;
    }

    return {
      JSXElement(node) {
        const opening = node.openingElement;
        const name = resolver.componentName(opening);
        if (name === 'Table') {
          const attr = getProp(opening, 'columns');
          if (!attr?.value || attr.value.type !== AST_NODE_TYPES.JSXExpressionContainer) return;
          if (attr.value.expression.type === AST_NODE_TYPES.JSXEmptyExpression) return;
          const array = resolveArray(attr.value.expression, opening);
          if (array) checkColumns(array);
          return;
        }
        if (name === 'Table.Column' || name === 'Table.ColumnGroup') {
          if (hasSpread(opening) || hasMeaningfulProp(opening, 'title')) return;
          if (hasMeaningfulProp(opening, 'hidden')) return;
          context.report({ node: opening, messageId: 'missing' });
        }
      },
    };
  },
});
