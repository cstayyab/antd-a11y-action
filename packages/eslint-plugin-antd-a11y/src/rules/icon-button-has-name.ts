import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils/create-rule.js';
import { createResolver, type AntdResolver } from '../utils/antd-imports.js';
import { hasOwnName, hasTextContent } from '../utils/accessible-name.js';
import { getProp, hasMeaningfulProp, intrinsicName, meaningfulChildren } from '../utils/jsx.js';

type IconKind = 'antd-icon' | 'unnamed-graphic' | 'unknown';

/**
 * What an icon element contributes to the button's name:
 *  - antd-icon: @ant-design/icons renders role="img" aria-label="<icon id>", e.g. "delete"
 *  - unnamed-graphic: bare <svg>, <i>, or <img> without alt, so no name at all
 *  - unknown: a custom component we can't see into
 * A component mapped to svg in settings['jsx-a11y'].components (e.g. FontAwesomeIcon) counts as an svg.
 */
function classifyIcon(
  element: TSESTree.JSXElement,
  resolver: AntdResolver,
  components: Record<string, string>,
  nameOf: (node: TSESTree.JSXTagNameExpression) => string,
): IconKind {
  const opening = element.openingElement;
  if (resolver.isIcon(opening)) {
    return hasMeaningfulProp(opening, 'aria-label') ? 'unknown' : 'antd-icon';
  }
  const tag = intrinsicName(opening) ?? (components[nameOf(opening.name)] === 'svg' ? 'svg' : null);
  if (tag === 'svg' || tag === 'i') {
    return hasOwnName(opening, { extraProps: ['title'], allowId: false }) ? 'unknown' : 'unnamed-graphic';
  }
  if (tag === 'img') return getProp(opening, 'alt') ? 'unknown' : 'unnamed-graphic';
  return 'unknown';
}

export default createRule({
  name: 'icon-button-has-name',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require an accessible name on icon-only antd Buttons',
      impact: 'critical',
      impactByMessage: { iconLabelOnly: 'moderate' },
      wcag: ['4.1.2', '2.4.4'],
    },
    messages: {
      missing: 'Icon-only <Button> has no accessible name. Add aria-label (a Tooltip does not name it).',
      iconLabelOnly:
        'Icon-only <Button> is named only by the icon\'s built-in English label "{{icon}}", which is not translated and may not describe the action. Add aria-label.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const resolver = createResolver(context);
    const settings = context.settings['jsx-a11y'] as { components?: Record<string, string> } | undefined;
    const components = settings?.components ?? {};
    const nameOf = (name: TSESTree.JSXTagNameExpression) => context.sourceCode.getText(name);
    const isMappedSvg = (opening: TSESTree.JSXOpeningElement) => components[nameOf(opening.name)] === 'svg';
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        if (resolver.componentName(opening) !== 'Button') return;
        if (hasTextContent(node, resolver, isMappedSvg)) return;
        // `id` is not a naming mechanism for buttons, so it doesn't count here.
        if (hasOwnName(opening, { extraProps: ['title'], allowId: false })) return;

        const icons: TSESTree.JSXElement[] = [];
        const iconProp = getProp(opening, 'icon');
        if (iconProp?.value?.type === AST_NODE_TYPES.JSXExpressionContainer) {
          const expr = iconProp.value.expression;
          if (expr.type === AST_NODE_TYPES.JSXElement) icons.push(expr);
          else if (expr.type !== AST_NODE_TYPES.JSXEmptyExpression) return; // dynamic icon: can't tell
        } else if (iconProp?.value) {
          return;
        }
        for (const child of meaningfulChildren(node)) {
          if (child.type !== AST_NODE_TYPES.JSXElement) return;
          icons.push(child);
        }
        if (icons.length === 0) return;

        const kinds = icons.map((icon) => classifyIcon(icon, resolver, components, nameOf));
        if (kinds.includes('unknown')) return;
        if (kinds.every((kind) => kind === 'unnamed-graphic')) {
          context.report({ node: opening, messageId: 'missing' });
          return;
        }
        const antdIcon = icons[kinds.indexOf('antd-icon')];
        const iconName = context.sourceCode
          .getText(antdIcon.openingElement.name)
          .replace(/(Outlined|Filled|TwoTone)$/, '')
          .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
          .toLowerCase();
        context.report({ node: opening, messageId: 'iconLabelOnly', data: { icon: iconName } });
      },
    };
  },
});
