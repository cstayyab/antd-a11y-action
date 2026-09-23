import antdA11y from 'eslint-plugin-antd-a11y';
import type { AntdA11yDocs } from 'eslint-plugin-antd-a11y';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import type { Impact, RuleInfo } from './types.js';

const ANTD_PREFIX = 'antd-a11y/';
const JSX_PREFIX = 'jsx-a11y/';

/**
 * jsx-a11y has no impact levels, so these follow axe-core's impact for the
 * matching axe rule where one exists. Rules that fire on common but harmless
 * patterns sit below the default `serious` threshold.
 */
const JSX_A11Y_IMPACT: Record<string, { impact: Impact; wcag: string[] }> = {
  'alt-text': { impact: 'critical', wcag: ['1.1.1'] },
  'anchor-ambiguous-text': { impact: 'minor', wcag: ['2.4.4'] },
  'anchor-has-content': { impact: 'serious', wcag: ['2.4.4', '4.1.2'] },
  'anchor-is-valid': { impact: 'moderate', wcag: ['2.1.1'] },
  'aria-activedescendant-has-tabindex': { impact: 'serious', wcag: ['2.1.1'] },
  'aria-props': { impact: 'critical', wcag: ['4.1.2'] },
  'aria-proptypes': { impact: 'critical', wcag: ['4.1.2'] },
  'aria-role': { impact: 'critical', wcag: ['4.1.2'] },
  'aria-unsupported-elements': { impact: 'critical', wcag: ['4.1.2'] },
  'autocomplete-valid': { impact: 'serious', wcag: ['1.3.5'] },
  'click-events-have-key-events': { impact: 'moderate', wcag: ['2.1.1'] },
  'control-has-associated-label': { impact: 'serious', wcag: ['4.1.2'] },
  'heading-has-content': { impact: 'moderate', wcag: ['2.4.6'] },
  'html-has-lang': { impact: 'serious', wcag: ['3.1.1'] },
  'iframe-has-title': { impact: 'serious', wcag: ['4.1.2'] },
  'img-redundant-alt': { impact: 'minor', wcag: ['1.1.1'] },
  'interactive-supports-focus': { impact: 'serious', wcag: ['2.1.1'] },
  'label-has-associated-control': { impact: 'serious', wcag: ['1.3.1', '4.1.2'] },
  'media-has-caption': { impact: 'critical', wcag: ['1.2.2'] },
  'mouse-events-have-key-events': { impact: 'moderate', wcag: ['2.1.1'] },
  'no-access-key': { impact: 'minor', wcag: [] },
  'no-autofocus': { impact: 'minor', wcag: [] },
  'no-distracting-elements': { impact: 'serious', wcag: ['2.2.2'] },
  'no-interactive-element-to-noninteractive-role': { impact: 'serious', wcag: ['4.1.2'] },
  'no-noninteractive-element-interactions': { impact: 'moderate', wcag: ['4.1.2'] },
  'no-noninteractive-element-to-interactive-role': { impact: 'serious', wcag: ['4.1.2'] },
  'no-noninteractive-tabindex': { impact: 'moderate', wcag: ['2.1.1'] },
  'no-redundant-roles': { impact: 'minor', wcag: [] },
  'no-static-element-interactions': { impact: 'moderate', wcag: ['4.1.2'] },
  'role-has-required-aria-props': { impact: 'critical', wcag: ['4.1.2'] },
  'role-supports-aria-props': { impact: 'serious', wcag: ['4.1.2'] },
  scope: { impact: 'moderate', wcag: ['1.3.1'] },
  'tabindex-no-positive': { impact: 'serious', wcag: ['2.4.3'] },
};

interface RuleMeta {
  meta?: { docs?: { description?: string; url?: string } & Partial<AntdA11yDocs> };
}

function antdDocs(ruleId: string): (Partial<AntdA11yDocs> & { url?: string }) | undefined {
  const rule = (antdA11y.rules as Record<string, RuleMeta>)[ruleId.slice(ANTD_PREFIX.length)];
  return rule?.meta?.docs;
}

export function isA11yRule(ruleId: string | null): ruleId is string {
  return !!ruleId && (ruleId.startsWith(ANTD_PREFIX) || ruleId.startsWith(JSX_PREFIX));
}

export function impactFor(ruleId: string, messageId?: string): Impact {
  if (ruleId.startsWith(ANTD_PREFIX)) {
    const docs = antdDocs(ruleId);
    return (messageId && docs?.impactByMessage?.[messageId]) || docs?.impact || 'serious';
  }
  return JSX_A11Y_IMPACT[ruleId.slice(JSX_PREFIX.length)]?.impact ?? 'serious';
}

export function ruleInfo(ruleId: string): RuleInfo {
  if (ruleId.startsWith(ANTD_PREFIX)) {
    const docs = antdDocs(ruleId);
    return {
      id: ruleId,
      description: docs?.description ?? ruleId,
      helpUri: docs?.url,
      wcag: docs?.wcag ?? [],
      impact: docs?.impact ?? 'serious',
    };
  }
  const short = ruleId.slice(JSX_PREFIX.length);
  const docs = (jsxA11y.rules as Record<string, RuleMeta>)[short]?.meta?.docs;
  const known = JSX_A11Y_IMPACT[short];
  return {
    id: ruleId,
    description: docs?.description ?? ruleId,
    helpUri: docs?.url,
    wcag: known?.wcag ?? [],
    impact: known?.impact ?? 'serious',
  };
}
