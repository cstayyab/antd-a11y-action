import { impactRank, type Finding, type Impact, type RuleInfo, type ScanResult } from '../types.js';

export const TOOL_NAME = 'antd-a11y-guard';
export const TOOL_URI = 'https://github.com/cstayyab/antd-a11y-action';

type Level = 'error' | 'warning' | 'note';

function levelFor(impact: Impact, blocking: boolean): Level {
  if (blocking) return 'error';
  return impactRank(impact) >= impactRank('moderate') ? 'warning' : 'note';
}

// Code Scanning sorts by security-severity; map impact onto its 0-10 scale.
const SEVERITY_SCORE: Record<Impact, string> = { minor: '2.0', moderate: '4.0', serious: '7.0', critical: '9.0' };

function ruleDescriptor(rule: RuleInfo, failOn: Impact | 'none') {
  const blocking = failOn !== 'none' && impactRank(rule.impact) >= impactRank(failOn);
  return {
    id: rule.id,
    name: rule.id,
    shortDescription: { text: rule.description },
    fullDescription: { text: rule.description },
    ...(rule.helpUri ? { helpUri: rule.helpUri, help: { text: `See ${rule.helpUri}` } } : {}),
    defaultConfiguration: { level: levelFor(rule.impact, blocking) },
    properties: {
      tags: ['accessibility', 'a11y', ...rule.wcag.map((sc) => `wcag${sc}`)],
      precision: 'high',
      'problem.severity': blocking ? 'error' : 'warning',
      'security-severity': SEVERITY_SCORE[rule.impact],
      impact: rule.impact,
    },
  };
}

function resultFor(finding: Finding & { file: string; line: number }, ruleIndex: number) {
  return {
    ruleId: finding.ruleId,
    ruleIndex,
    level: levelFor(finding.impact, finding.blocking),
    message: { text: finding.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: finding.file, uriBaseId: '%SRCROOT%' },
          region: {
            startLine: finding.line,
            startColumn: finding.column ?? 1,
            ...(finding.endLine ? { endLine: finding.endLine } : {}),
            ...(finding.endColumn ? { endColumn: finding.endColumn } : {}),
          },
        },
      },
    ],
    properties: { impact: finding.impact },
  };
}

export function toSarif(result: ScanResult, failOn: Impact | 'none', version: string, toolName = TOOL_NAME) {
  // Code Scanning needs a file in the repo; findings without one stay in the comment and artifact.
  const located = result.findings.filter(
    (f): f is Finding & { file: string; line: number } => Boolean(f.file && f.line),
  );
  const used = new Set(located.map((f) => f.ruleId));
  const rules = [...result.rules.values()].filter((r) => used.has(r.id)).sort((a, b) => a.id.localeCompare(b.id));
  const index = new Map(rules.map((rule, i) => [rule.id, i]));
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: toolName,
            informationUri: TOOL_URI,
            version,
            rules: rules.map((rule) => ruleDescriptor(rule, failOn)),
          },
        },
        automationDetails: { id: `${toolName}/` },
        results: located.map((finding) => resultFor(finding, index.get(finding.ruleId)!)),
      },
    ],
  };
}
