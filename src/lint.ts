import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { engine } from 'eslint-plugin-antd-a11y';
import { ConfigError, type ActionConfig } from './config.js';
import { ruleInfo } from './severity.js';
import type { Finding, Impact, ScanResult } from './types.js';

export const { SOURCE_EXTENSIONS, parseIgnoreDirectives } = engine;

export interface LintOptions {
  config: ActionConfig;
  failOn: Impact | 'none';
}

/** The ESLint config the action lints with: the plugin's own, plus the TypeScript parser. */
export function buildConfig(config: ActionConfig): Linter.Config[] {
  return engine.buildFlatConfig(config, {
    parser: tsParser as Linter.Parser,
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  });
}

export class A11yLinter {
  private readonly linter = new Linter({ configType: 'flat' });
  private readonly config: Linter.Config[];
  /** Alias names that appear as a JSX tag in at least one scanned file. */
  readonly usedAliases = new Set<string>();

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
    result.suppressed += suppressedMessages.filter((m) => engine.isA11yRule(m.ruleId)).length;

    // The same step the plugin's processor runs in a local ESLint: dedupe, a11y-ignore, blocking.
    const evaluation = engine.evaluateMessages(messages, code, this.options);
    result.suppressed += evaluation.ignored;
    for (const message of evaluation.other) {
      if (message.fatal) result.parseErrors.push({ file, line: message.line, message: message.message });
    }
    for (const { message, impact, blocking } of evaluation.findings) {
      if (!result.rules.has(message.ruleId)) result.rules.set(message.ruleId, ruleInfo(message.ruleId));
      const finding: Finding = {
        file,
        line: message.line,
        column: message.column,
        endLine: message.endLine,
        endColumn: message.endColumn,
        ruleId: message.ruleId,
        message: message.message,
        impact,
        blocking,
        wcag: result.rules.get(message.ruleId)!.wcag,
      };
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
