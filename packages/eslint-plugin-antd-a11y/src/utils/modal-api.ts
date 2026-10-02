import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import type { AntdResolver } from './antd-imports.js';

// Methods that open a confirm dialog through antd's Modal API.
const METHODS = new Set(['confirm', 'info', 'success', 'error', 'warning', 'warn']);

function unwrap(expr: TSESTree.Expression): TSESTree.Expression {
  let current = expr;
  while (
    current.type === AST_NODE_TYPES.TSAsExpression ||
    current.type === AST_NODE_TYPES.TSNonNullExpression ||
    current.type === AST_NODE_TYPES.ChainExpression
  ) {
    current = current.expression as TSESTree.Expression;
  }
  return current;
}

const isCallTo = (expr: TSESTree.Expression | null, name: string, resolver: AntdResolver): expr is TSESTree.CallExpression =>
  !!expr && expr.type === AST_NODE_TYPES.CallExpression && resolver.memberName(expr.callee as TSESTree.Expression) === name;

/** `app` in `const app = App.useApp()`. */
function isUseAppResult(expr: TSESTree.Expression, resolver: AntdResolver, sourceCode: Readonly<TSESLint.SourceCode>): boolean {
  if (expr.type !== AST_NODE_TYPES.Identifier) return false;
  const variable = ASTUtils.findVariable(sourceCode.getScope(expr), expr.name);
  if (!variable || variable.defs.length !== 1 || variable.defs[0].type !== 'Variable') return false;
  const declarator = variable.defs[0].node;
  return (
    declarator.parent.kind === 'const' &&
    declarator.id.type === AST_NODE_TYPES.Identifier &&
    !!declarator.init &&
    isCallTo(unwrap(declarator.init), 'App.useApp', resolver)
  );
}

/**
 * True for the object a hook hands out to open dialogs: `App.useApp().modal`, `app.modal` from
 * `const app = App.useApp()`, `modal` from `const { modal } = App.useApp()`, or `modal` from `const [modal, holder] = Modal.useModal()`.
 */
function isModalApi(expr: TSESTree.Expression, resolver: AntdResolver, sourceCode: Readonly<TSESLint.SourceCode>): boolean {
  if (
    expr.type === AST_NODE_TYPES.MemberExpression &&
    !expr.computed &&
    expr.property.type === AST_NODE_TYPES.Identifier &&
    expr.property.name === 'modal'
  ) {
    const object = unwrap(expr.object);
    return isCallTo(object, 'App.useApp', resolver) || isUseAppResult(object, resolver, sourceCode);
  }
  if (expr.type !== AST_NODE_TYPES.Identifier) return false;
  const variable = ASTUtils.findVariable(sourceCode.getScope(expr), expr.name);
  if (!variable || variable.defs.length !== 1 || variable.defs[0].type !== 'Variable') return false;
  const declarator = variable.defs[0].node;
  if (declarator.parent.kind !== 'const' || !declarator.init) return false;
  const init = unwrap(declarator.init);
  if (declarator.id.type === AST_NODE_TYPES.ObjectPattern) {
    if (!isCallTo(init, 'App.useApp', resolver)) return false;
    return declarator.id.properties.some(
      (prop) =>
        prop.type === AST_NODE_TYPES.Property &&
        !prop.computed &&
        prop.key.type === AST_NODE_TYPES.Identifier &&
        prop.key.name === 'modal' &&
        prop.value.type === AST_NODE_TYPES.Identifier &&
        prop.value.name === expr.name,
    );
  }
  if (declarator.id.type === AST_NODE_TYPES.ArrayPattern) {
    const first = declarator.id.elements[0];
    return isCallTo(init, 'Modal.useModal', resolver) && first?.type === AST_NODE_TYPES.Identifier && first.name === expr.name;
  }
  return false;
}

/**
 * The callee (`Modal.confirm`, `modal.info`) when the call opens an antd confirm dialog, else null.
 * Only `const` bindings are followed, so an API passed around through props or context isn't seen.
 */
export function modalApiCall(
  call: TSESTree.CallExpression,
  resolver: AntdResolver,
  sourceCode: Readonly<TSESLint.SourceCode>,
): string | null {
  const callee = unwrap(call.callee as TSESTree.Expression);
  if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.computed) return null;
  if (callee.property.type !== AST_NODE_TYPES.Identifier || !METHODS.has(callee.property.name)) return null;
  const method = callee.property.name;
  if (resolver.memberName(callee) === `Modal.${method}`) return `Modal.${method}`;
  const object = unwrap(callee.object);
  return isModalApi(object, resolver, sourceCode) ? `${sourceCode.getText(object)}.${method}` : null;
}
