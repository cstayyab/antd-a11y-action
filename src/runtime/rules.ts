import type { Impact, RuleInfo } from '../types.js';

export const RUNTIME_PREFIX = 'runtime/';
export const AXE_PREFIX = 'axe/';

/** Rules the injected guard reports, with the impact the runtime guide assigns them. */
export const RUNTIME_RULES: Record<string, { impact: Impact; wcag: string[]; description: string }> = {
  'accessible-name': {
    impact: 'critical',
    wcag: ['4.1.2'],
    description: 'Interactive elements rendered at runtime must have an accessible name',
  },
  'image-alt': { impact: 'critical', wcag: ['1.1.1'], description: 'Rendered <img> elements must have alt text' },
  'frame-title': { impact: 'serious', wcag: ['4.1.2'], description: 'Rendered <iframe> elements must have a title' },
  'click-events-need-role': {
    impact: 'serious',
    wcag: ['2.1.1', '4.1.2'],
    description: 'Click handlers on non-interactive elements need an interactive role',
  },
  'interactive-role-focusable': {
    impact: 'serious',
    wcag: ['2.1.1'],
    description: 'Elements with an interactive role must be focusable',
  },
  'click-events-have-key-events': {
    impact: 'serious',
    wcag: ['2.1.1'],
    description: 'Clickable elements with an interactive role need a keyboard handler',
  },
  'no-positive-tabindex': { impact: 'moderate', wcag: ['2.4.3'], description: 'tabIndex greater than 0 breaks focus order' },
};

const AXE_IMPACTS = new Set<Impact>(['minor', 'moderate', 'serious', 'critical']);

export function runtimeRuleInfo(rule: string): RuleInfo {
  const known = RUNTIME_RULES[rule];
  return {
    id: `${RUNTIME_PREFIX}${rule}`,
    description: known?.description ?? rule,
    wcag: known?.wcag ?? [],
    impact: known?.impact ?? 'serious',
  };
}

export function axeImpact(impact: string | null | undefined): Impact {
  return impact && AXE_IMPACTS.has(impact as Impact) ? (impact as Impact) : 'moderate';
}

export function axeRuleInfo(id: string, help: string, helpUrl: string | undefined, impact: Impact): RuleInfo {
  return { id: `${AXE_PREFIX}${id}`, description: help, helpUri: helpUrl, wcag: [], impact };
}
