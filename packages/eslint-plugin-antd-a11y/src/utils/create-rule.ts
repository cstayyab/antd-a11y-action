import { ESLintUtils } from '@typescript-eslint/utils';

export type Impact = 'minor' | 'moderate' | 'serious' | 'critical';

export interface AntdA11yDocs {
  description: string;
  /** Same scale axe-core uses, so static and runtime findings share one threshold. */
  impact: Impact;
  /** Per-message overrides, for findings that are real but weaker than the rule's main case. */
  impactByMessage?: Record<string, Impact>;
  /** WCAG success criteria, e.g. `4.1.2`. */
  wcag: string[];
}

export const DOCS_BASE = 'https://github.com/cstayyab/antd-a11y-action/blob/main/docs/rules';

export const createRule = ESLintUtils.RuleCreator<AntdA11yDocs>(
  (name) => `${DOCS_BASE}/${name}.md`,
);
