import type { Impact } from 'eslint-plugin-antd-a11y';

export type { Impact };

export const IMPACTS: readonly Impact[] = ['minor', 'moderate', 'serious', 'critical'];

export function impactRank(impact: Impact): number {
  return IMPACTS.indexOf(impact);
}

export interface Finding {
  /** Repo-relative, forward slashes. Absent for runtime findings that could not be tied to source. */
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  /** Runtime findings: routes where the issue was seen, and the DOM selector (axe) or callsite. */
  routes?: string[];
  target?: string;
  ruleId: string;
  message: string;
  impact: Impact;
  /** At or above the `fail-on` threshold. */
  blocking: boolean;
}

export interface RuleInfo {
  id: string;
  description: string;
  helpUri?: string;
  wcag: string[];
  impact: Impact;
}

export interface ScanResult {
  findings: Finding[];
  filesScanned: number;
  /** Files that failed to parse; reported but never blocking. */
  parseErrors: { file: string; line: number; message: string }[];
  /** Findings silenced with `a11y-ignore` or `eslint-disable` comments. */
  suppressed: number;
  rules: Map<string, RuleInfo>;
}
