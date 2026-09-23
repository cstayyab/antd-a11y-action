import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import antdA11y, { configs as antdConfigs } from 'eslint-plugin-antd-a11y';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import { impactFor, isA11yRule, ruleInfo } from './severity.js';
import { impactRank, type Finding, type Impact, type ScanResult } from './types.js';

export const SOURCE_EXTENSIONS = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts'];

export interface LintOptions {
  jsxA11y: boolean;
  failOn: Impact;
}

export function buildConfig(options: Pick<LintOptions, 'jsxA11y'>): Linter.Config[] {
  const plugins: Record<string, unknown> = { 'antd-a11y': antdA11y };
  let rules: Linter.RulesRecord = { ...(antdConfigs.recommended.rules as Linter.RulesRecord) };
  if (options.jsxA11y) {
    plugins['jsx-a11y'] = jsxA11y;
    rules = { ...(jsxA11y.flatConfigs.recommended.rules as Linter.RulesRecord), ...rules };
  }
  return [
    {
      files: [`**/*.{${SOURCE_EXTENSIONS.join(',')}}`],
      languageOptions: {
        parser: tsParser as Linter.Parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      linterOptions: { reportUnusedDisableDirectives: 'off' },
      plugins: plugins as Linter.Config['plugins'],
      rules,
    },
  ];
}

// `// a11y-ignore`, `/* a11y-ignore icon-button-has-name */`, `{/* a11y-ignore jsx-a11y/alt-text, picker-has-name */}`
const IGNORE_COMMENT = /(?:\/\/|\/\*)\s*a11y-ignore\b([^\n*]*)/;

interface IgnoreDirective {
  rules: string[] | null; // null = every rule
}

export function parseIgnoreDirectives(code: string): Map<number, IgnoreDirective> {
  const directives = new Map<number, IgnoreDirective>();
  code.split(/\r?\n/).forEach((text, index) => {
    const match = IGNORE_COMMENT.exec(text);
    if (!match) return;
    const list = match[1]
      .replace(/--.*$/, '') // allow "a11y-ignore rule -- reason"
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    directives.set(index + 1, { rules: list.length > 0 ? list : null });
  });
  return directives;
}

function isIgnored(directives: Map<number, IgnoreDirective>, line: number, ruleId: string): boolean {
  for (const candidate of [line, line - 1]) {
    const directive = directives.get(candidate);
    if (!directive) continue;
    if (directive.rules === null) return true;
    const short = ruleId.replace(/^antd-a11y\//, '');
    if (directive.rules.some((r) => r === ruleId || r === short)) return true;
  }
  return false;
}

export class A11yLinter {
  private readonly linter = new Linter({ configType: 'flat' });
  private readonly config: Linter.Config[];

  constructor(private readonly options: LintOptions) {
    this.config = buildConfig(options);
  }

  /** Lints one file's source. `file` is the repo-relative path used in reports. */
  lintSource(file: string, code: string, result: ScanResult): void {
    const messages = this.linter.verify(code, this.config, { filename: file });
    // Present at runtime since ESLint 8.8, missing from the published types.
    const suppressedMessages = (this.linter as Linter & { getSuppressedMessages(): Linter.LintMessage[] })
      .getSuppressedMessages();
    result.suppressed += suppressedMessages.filter((m) => isA11yRule(m.ruleId)).length;

    const directives = parseIgnoreDirectives(code);
    for (const message of messages) {
      if (message.fatal) {
        result.parseErrors.push({ file, line: message.line, message: message.message });
        continue;
      }
      if (!isA11yRule(message.ruleId)) continue;
      if (isIgnored(directives, message.line, message.ruleId)) {
        result.suppressed += 1;
        continue;
      }
      const impact = impactFor(message.ruleId, message.messageId);
      const finding: Finding = {
        file,
        line: message.line,
        column: message.column,
        endLine: message.endLine,
        endColumn: message.endColumn,
        ruleId: message.ruleId,
        message: message.message,
        impact,
        blocking: impactRank(impact) >= impactRank(this.options.failOn),
      };
      result.findings.push(finding);
      if (!result.rules.has(message.ruleId)) result.rules.set(message.ruleId, ruleInfo(message.ruleId));
    }
    result.filesScanned += 1;
  }

  async lintFiles(root: string, files: string[]): Promise<ScanResult> {
    const result: ScanResult = { findings: [], filesScanned: 0, parseErrors: [], suppressed: 0, rules: new Map() };
    for (const file of files) {
      let code: string;
      try {
        code = await readFile(path.join(root, file), 'utf8');
      } catch {
        continue; // deleted or unreadable since the file list was built
      }
      this.lintSource(file, code, result);
    }
    result.findings.sort(
      (a, b) =>
        Number(b.blocking) - Number(a.blocking) ||
        (a.file ?? '').localeCompare(b.file ?? '') ||
        (a.line ?? 0) - (b.line ?? 0) ||
        (a.column ?? 0) - (b.column ?? 0),
    );
    return result;
  }
}
