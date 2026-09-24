import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import antdA11y from 'eslint-plugin-antd-a11y';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import { ConfigError, eslintRules, type ActionConfig } from './config.js';
import { wrapPlugin } from './jsx-a11y-filters.js';
import { blockingFor, impactFor, isA11yRule, ruleInfo } from './severity.js';
import type { Finding, Impact, ScanResult } from './types.js';

export const SOURCE_EXTENSIONS = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts'];

export interface LintOptions {
  config: ActionConfig;
  failOn: Impact;
}

// jsx-a11y rules run through filters for patterns they can't see through (spreads, conditional
// roles, keyboard-handling roles), whatever options the user gives them.
const wrappedJsxA11y = wrapPlugin(jsxA11y);

export function buildConfig(config: ActionConfig): Linter.Config[] {
  const rules = eslintRules(config);
  const { components, polymorphicPropName, attributes } = config.settings;
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
      // Registered even with the preset off, so a rule a user turns on individually still resolves.
      plugins: { 'antd-a11y': antdA11y, 'jsx-a11y': wrappedJsxA11y } as unknown as Linter.Config['plugins'],
      settings: {
        'antd-a11y': { aliases: config.aliases },
        'jsx-a11y': {
          components,
          ...(polymorphicPropName ? { polymorphicPropName } : {}),
          ...(attributes ? { attributes } : {}),
        },
      },
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
    this.config = buildConfig(options.config);
    // Invalid rule options throw here with ESLint's own message, instead of failing on every file.
    try {
      this.linter.verify('', this.config, { filename: 'config-check.tsx' });
    } catch (error) {
      throw new ConfigError(`Invalid rule configuration: ${(error as Error).message.replace(/\s*\n\s*/g, ' ').trim()}`);
    }
  }

  /** Lints one file's source. `file` is the repo-relative path used in reports. */
  /** Alias names that appear as a JSX tag in at least one scanned file. */
  readonly usedAliases = new Set<string>();

  lintSource(file: string, code: string, result: ScanResult): void {
    for (const name of Object.keys(this.options.config.aliases)) {
      if (!this.usedAliases.has(name) && new RegExp(`<${name.replace(/\./g, '\\.')}[\\s/>]`).test(code)) {
        this.usedAliases.add(name);
      }
    }
    const messages = this.linter.verify(code, this.config, { filename: file });
    // Present at runtime since ESLint 8.8, missing from the published types.
    const suppressedMessages = (this.linter as Linter & { getSuppressedMessages(): Linter.LintMessage[] })
      .getSuppressedMessages();
    result.suppressed += suppressedMessages.filter((m) => isA11yRule(m.ruleId)).length;

    const directives = parseIgnoreDirectives(code);
    // Where an antd-a11y rule reported, it's the more precise (DOM-verified) finding: drop a jsx-a11y
    // report on the same element, e.g. control-has-associated-label on a mapped antd Button.
    const antdAt = new Set(
      messages.filter((m) => m.ruleId?.startsWith('antd-a11y/')).map((m) => `${m.line}:${m.column}`),
    );
    for (const message of messages) {
      if (message.fatal) {
        result.parseErrors.push({ file, line: message.line, message: message.message });
        continue;
      }
      if (!isA11yRule(message.ruleId)) continue;
      if (message.ruleId.startsWith('jsx-a11y/') && antdAt.has(`${message.line}:${message.column}`)) continue;
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
        blocking: blockingFor(message.ruleId, impact, this.options.failOn, this.options.config.rules),
      };
      if (!result.rules.has(message.ruleId)) result.rules.set(message.ruleId, ruleInfo(message.ruleId));
      finding.wcag = result.rules.get(message.ruleId)!.wcag;
      result.findings.push(finding);
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
