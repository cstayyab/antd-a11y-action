// Wraps eslint-plugin-jsx-a11y rules to drop reports that are wrong for patterns jsx-a11y
// can't see through. Rule ids and messages are unchanged; only false positives are removed.
import type { ESLint, Rule } from 'eslint';

interface Node {
  type: string;
  parent?: Node;
  [key: string]: unknown;
}

interface JSXAttribute extends Node {
  type: 'JSXAttribute';
  name: { type: string; name: string | { name: string } };
  value: Node | null;
}

interface JSXOpeningElement extends Node {
  type: 'JSXOpeningElement';
  attributes: Node[];
}

const INTERACTIVE_ROLES = new Set([
  'button', 'checkbox', 'combobox', 'gridcell', 'link', 'listbox', 'menu', 'menubar', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'radiogroup', 'scrollbar', 'searchbox',
  'slider', 'spinbutton', 'switch', 'tab', 'tablist', 'textbox', 'tree', 'treegrid', 'treeitem',
]);

// Non-interactive roles whose ARIA patterns expect keyboard handling on the element itself:
// Escape to close a dialog, arrow keys inside a group or tab panel.
const KEYBOARD_ROLES = new Set(['dialog', 'alertdialog', 'group', 'tabpanel']);
const MOUSE_HANDLERS = ['onClick', 'onMouseDown', 'onMouseUp'];

// A spread ({...attributes} from dnd-kit's useSortable, {...props}) may supply role, tabIndex or a label.
const SPREAD_BLIND_RULES = new Set([
  'click-events-have-key-events',
  'no-static-element-interactions',
  'no-noninteractive-element-interactions',
  'no-noninteractive-tabindex',
  'interactive-supports-focus',
  'control-has-associated-label',
]);

const ROLE_BLIND_RULES = new Set([
  'no-noninteractive-element-interactions',
  'no-noninteractive-tabindex',
  'no-static-element-interactions',
]);

function openingElement(node: Node | undefined): JSXOpeningElement | null {
  for (let current = node; current; current = current.parent) {
    if (current.type === 'JSXOpeningElement') return current as JSXOpeningElement;
    if (current.type === 'JSXElement') return (current as unknown as { openingElement: JSXOpeningElement }).openingElement;
  }
  return null;
}

function attrName(attr: JSXAttribute): string {
  return typeof attr.name.name === 'string' ? attr.name.name : attr.name.name.name;
}

function getAttr(el: JSXOpeningElement, name: string): JSXAttribute | undefined {
  return el.attributes.find((a): a is JSXAttribute => a.type === 'JSXAttribute' && attrName(a as JSXAttribute) === name);
}

/** String literals the expression can evaluate to: 'x', `x`, a ? 'x' : 'y', a && 'x', a || 'x'. */
function literalBranches(expr: Node | null | undefined): string[] {
  if (!expr) return [];
  switch (expr.type) {
    case 'Literal':
      return typeof expr.value === 'string' ? [expr.value] : [];
    case 'TemplateLiteral': {
      const quasis = expr.quasis as { value: { cooked: string } }[];
      return (expr.expressions as Node[]).length === 0 ? [quasis.map((q) => q.value.cooked).join('')] : [];
    }
    case 'ConditionalExpression':
      return [...literalBranches(expr.consequent as Node), ...literalBranches(expr.alternate as Node)];
    case 'LogicalExpression':
      return [...literalBranches(expr.left as Node), ...literalBranches(expr.right as Node)];
    case 'JSXExpressionContainer':
      return literalBranches(expr.expression as Node);
    case 'TSAsExpression':
      return literalBranches(expr.expression as Node);
    default:
      return [];
  }
}

function roleValue(el: JSXOpeningElement): { literal: string | null; conditional: string[] } {
  const attr = getAttr(el, 'role');
  if (!attr?.value) return { literal: null, conditional: [] };
  if (attr.value.type === 'Literal' && typeof attr.value.value === 'string') {
    return { literal: attr.value.value.trim(), conditional: [] };
  }
  const expr = attr.value.type === 'JSXExpressionContainer' ? (attr.value.expression as Node) : null;
  if (expr && (expr.type === 'Literal' || (expr.type === 'TemplateLiteral' && (expr.expressions as Node[]).length === 0))) {
    return { literal: literalBranches(expr)[0]?.trim() ?? null, conditional: [] };
  }
  return { literal: null, conditional: literalBranches(expr) };
}

function elementName(el: JSXOpeningElement): string {
  const name = el.name as Node;
  if (name.type === 'JSXIdentifier') return name.name as string;
  if (name.type === 'JSXMemberExpression') {
    return `${elementName({ name: name.object } as unknown as JSXOpeningElement)}.${(name.property as Node).name as string}`;
  }
  return '';
}

/** A child icon component (mapped to svg) with a non-empty title: icon libraries such as FontAwesome render it as <title>. */
function hasTitledIcon(el: JSXOpeningElement, components: Record<string, string>): boolean {
  const children = ((el.parent as Node | undefined)?.children as Node[] | undefined) ?? [];
  return children.some((child) => {
    if (child.type !== 'JSXElement') return false;
    const opening = child.openingElement as JSXOpeningElement;
    const title = getAttr(opening, 'title');
    const named =
      !!title?.value && !(title.value.type === 'Literal' && String(title.value.value).trim() === '');
    return (named && components[elementName(opening)] === 'svg') || hasTitledIcon(opening, components);
  });
}

/** Why a report should be dropped, or null to keep it. Exported for tests. */
export function suppressReason(
  rule: string,
  node: Node | undefined,
  components: Record<string, string> = {},
): string | null {
  const el = openingElement(node);
  if (!el) return null;

  if (SPREAD_BLIND_RULES.has(rule) && el.attributes.some((a) => a.type === 'JSXSpreadAttribute')) {
    return 'spread may supply role, tabIndex or label';
  }

  const role = roleValue(el);
  if (ROLE_BLIND_RULES.has(rule) && role.conditional.some((r) => r.split(/\s+/).some((t) => INTERACTIVE_ROLES.has(t)))) {
    return 'conditional role may be interactive';
  }

  if (
    rule === 'no-noninteractive-element-interactions' &&
    role.literal &&
    KEYBOARD_ROLES.has(role.literal) &&
    !MOUSE_HANDLERS.some((h) => getAttr(el, h))
  ) {
    return `role="${role.literal}" handles its own keyboard interaction`;
  }

  if (rule === 'control-has-associated-label' && hasTitledIcon(el, components)) {
    return 'a titled icon names the control';
  }
  return null;
}

function wrapRule(name: string, rule: Rule.RuleModule): Rule.RuleModule {
  return {
    ...rule,
    create(context) {
      const proxy = Object.create(context, {
        report: {
          value(descriptor: Rule.ReportDescriptor) {
            const node = 'node' in descriptor ? (descriptor.node as unknown as Node) : undefined;
            const settings = context.settings?.['jsx-a11y'] as { components?: Record<string, string> } | undefined;
            if (suppressReason(name, node, settings?.components)) return;
            context.report(descriptor);
          },
        },
      }) as Rule.RuleContext;
      return rule.create(proxy);
    },
  };
}

/** The same plugin with every rule wrapped, so filters apply whatever options the rules get. */
export function wrapPlugin(plugin: ESLint.Plugin): ESLint.Plugin {
  const rules = Object.fromEntries(
    Object.entries(plugin.rules ?? {}).map(([name, rule]) => [name, wrapRule(name, rule as Rule.RuleModule)]),
  );
  return { ...plugin, rules };
}
