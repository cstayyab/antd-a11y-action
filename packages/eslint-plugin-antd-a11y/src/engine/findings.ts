// What happens to lint messages after ESLint runs, in the action and in the plugin's processor alike:
// the jsx-a11y duplicate of an antd finding is dropped, a11y-ignore comments apply, and each
// finding gets its impact and whether it blocks.
import type { Linter } from 'eslint';
import type { Impact } from '../utils/create-rule.js';
import type { A11yConfig } from './config.js';
import { blockingFor, impactFor, isA11yRule } from './impact.js';

// `// a11y-ignore`, `/* a11y-ignore icon-button-has-name */`, `{/* a11y-ignore jsx-a11y/alt-text, picker-has-name */}`,
// and block comments over several lines, which usually carry the reason:
//   {/* a11y-ignore popup-trigger-focusable -- the radio card is the focus stop,
//       and a visually hidden sibling carries the text */}
const COMMENT = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
const DIRECTIVE = /^(?:\/\/|\/\*)\s*a11y-ignore\b([\s\S]*?)(?:\*\/)?$/;

export interface IgnoreDirective {
  rules: string[] | null; // null = every rule
}

/**
 * Lines that carry an a11y-ignore directive. A directive covers its own line and the next one; a block
 * comment over several lines counts on the line where it ends too, so it covers the element right after it.
 */
export function parseIgnoreDirectives(code: string): Map<number, IgnoreDirective> {
  const directives = new Map<number, IgnoreDirective>();
  const lineAt = (index: number) => code.slice(0, index).split('\n').length;
  for (const match of code.matchAll(COMMENT)) {
    const directive = DIRECTIVE.exec(match[0]);
    if (!directive) continue;
    const list = directive[1]
      .replace(/--[\s\S]*$/, '') // allow "a11y-ignore rule -- reason", the reason on as many lines as it needs
      .split(/[\s,]+/)
      .filter(Boolean);
    const entry = { rules: list.length > 0 ? list : null };
    directives.set(lineAt(match.index), entry);
    directives.set(lineAt(match.index + match[0].length), entry);
  }
  return directives;
}

export function isIgnored(directives: Map<number, IgnoreDirective>, line: number, ruleId: string): boolean {
  for (const candidate of [line, line - 1]) {
    const directive = directives.get(candidate);
    if (!directive) continue;
    if (directive.rules === null) return true;
    const short = ruleId.replace(/^antd-a11y\//, '');
    if (directive.rules.some((r) => r === ruleId || r === short)) return true;
  }
  return false;
}

export interface EvaluatedMessage {
  message: Linter.LintMessage & { ruleId: string };
  impact: Impact;
  blocking: boolean;
}

export interface Evaluation {
  /** Accessibility findings that survive deduplication and a11y-ignore. */
  findings: EvaluatedMessage[];
  /** Findings silenced by a11y-ignore comments. */
  ignored: number;
  /** Everything else ESLint reported: parse errors and other plugins' rules, untouched. */
  other: Linter.LintMessage[];
}

/** Applies deduplication, a11y-ignore and blocking to one file's messages. */
export function evaluateMessages(
  messages: readonly Linter.LintMessage[],
  code: string,
  options: { config: A11yConfig; failOn: Impact | 'none' },
): Evaluation {
  const directives = parseIgnoreDirectives(code);
  // Where an antd-a11y rule reported, it's the more precise (DOM-verified) finding: drop a jsx-a11y
  // report on the same element, e.g. control-has-associated-label on a mapped antd Button.
  const antdAt = new Set(
    messages.filter((m) => m.ruleId?.startsWith('antd-a11y/')).map((m) => `${m.line}:${m.column}`),
  );
  const evaluation: Evaluation = { findings: [], ignored: 0, other: [] };
  for (const message of messages) {
    if (message.fatal || !isA11yRule(message.ruleId)) {
      evaluation.other.push(message);
      continue;
    }
    if (message.ruleId.startsWith('jsx-a11y/') && antdAt.has(`${message.line}:${message.column}`)) continue;
    if (isIgnored(directives, message.line, message.ruleId)) {
      evaluation.ignored += 1;
      continue;
    }
    const impact = impactFor(message.ruleId, message.messageId);
    evaluation.findings.push({
      message: message as EvaluatedMessage['message'],
      impact,
      blocking: blockingFor(message.ruleId, impact, options.failOn, options.config.rules),
    });
  }
  return evaluation;
}
