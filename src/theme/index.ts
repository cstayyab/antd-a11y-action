// mode: theme. Finds the app's themes, audits each configuration and returns findings in the same
// shape as the static check's, plus a summary for the report.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { engine } from 'eslint-plugin-antd-a11y';
import type { ActionConfig } from '../config.js';
import type { Finding, Impact, RuleInfo } from '../types.js';
import { auditConfiguration, THEME_RULE_INFO, type ThemeConfiguration, type ThemeFinding, type ThemeRule } from './audit.js';
import { discoverInFile, mayContainTheme, type SkippedTheme } from './discover.js';
import { loadThemeModule } from './module.js';
import { loadAntd } from './tokens.js';

export const THEME_PREFIX = 'theme/';
const README = 'https://github.com/cstayyab/antd-a11y-action#theme-contrast-audit';

export function themeRuleInfo(rule: ThemeRule): RuleInfo {
  const info = THEME_RULE_INFO[rule];
  return { id: `${THEME_PREFIX}${rule}`, description: info.description, wcag: info.wcag, impact: info.impact, helpUri: README };
}

export interface ConfigurationSummary {
  name: string;
  file?: string;
  line?: number;
  findings: number;
  blocking: number;
  inherited: number;
}

export interface ThemeAuditResult {
  findings: Finding[];
  rules: Map<string, RuleInfo>;
  configurations: ConfigurationSummary[];
  skipped: SkippedTheme[];
  /** e.g. "antd 6.6.5 from the repository" */
  antd: string;
  /** Set when antd came from the bundle, or the module failed to load. */
  notes: string[];
  /** The details behind each finding, for the report's per-configuration section. */
  details: ThemeFinding[];
  /** Changed-files run where nothing that affects the theme changed: nothing was audited. */
  unchanged?: boolean;
}

export interface ThemeAuditOptions {
  workspace: string;
  /** Repo-relative working directory ('' for the root); antd and package.json are looked up there first. */
  dir: string;
  /** Repo-relative source files to search for themes. */
  files: string[];
  config: ActionConfig;
  failOn: Impact | 'none';
  /**
   * Files a pull request changed, when only those are checked. The theme is then audited only when the
   * change can affect it: a file defining a theme, the theme module, package.json or a lockfile, or
   * the config file.
   */
  changed?: ReadonlySet<string>;
}

const PACKAGE_FILES = ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb'];

export async function runThemeAudit(options: ThemeAuditOptions): Promise<ThemeAuditResult> {
  const { workspace, config, failOn } = options;
  const notes: string[] = [];
  const configurations: ThemeConfiguration[] = [];
  const skipped: SkippedTheme[] = [];

  const unchanged = (relevant: string[]): ThemeAuditResult | undefined => {
    const changed = options.changed;
    if (!changed || relevant.some((f) => changed.has(f))) return undefined;
    return {
      findings: [],
      rules: new Map(),
      configurations: [],
      skipped: [],
      antd: '',
      notes: ['Nothing in this pull request changes the theme (theme files, package.json or lockfiles), so it was not audited.'],
      details: [],
      unchanged: true,
    };
  };
  const always = [...PACKAGE_FILES.flatMap((f) => [f, options.dir ? `${options.dir}/${f}` : f]), ...(config.file ? [config.file] : [])];

  if (config.theme.config) {
    // The module may import neighbouring files, so any change in its directory counts.
    const moduleFile = config.theme.config.split('#')[0].replace(/^\.\//, '');
    const moduleDir = path.posix.dirname(moduleFile);
    const skip = unchanged([...always, moduleFile, ...[...(options.changed ?? [])].filter((f) => f.startsWith(`${moduleDir}/`))]);
    if (skip) return skip;
    configurations.push(...(await loadThemeModule(config.theme.config, workspace)));
  } else {
    for (const file of options.files) {
      let code: string;
      try {
        code = await readFile(path.join(workspace, file), 'utf8');
      } catch {
        continue;
      }
      if (!mayContainTheme(code)) continue;
      const found = discoverInFile(file, code);
      configurations.push(...found.themes);
      skipped.push(...found.skipped);
    }
    const skip = unchanged([...always, ...configurations.map((c) => c.file!).filter(Boolean), ...skipped.map((s) => s.file)]);
    if (skip) return skip;
    if (configurations.length === 0) {
      notes.push(
        skipped.length
          ? 'No theme could be read without running code, so antd\'s default theme was audited. Set `theme-config` to audit your theme module.'
          : 'No `ConfigProvider theme` or `ThemeConfig` found, so antd\'s default theme was audited.',
      );
      configurations.push({ name: 'antd default theme', input: {} });
    }
  }

  const dirs = [...new Set([path.join(workspace, options.dir), workspace])];
  const antd = await loadAntd(dirs);
  if (antd.note) notes.push(antd.note);

  const overrides = config.rules;
  const severity = (rule: ThemeRule) => overrides.get(`${THEME_PREFIX}${rule}`)?.severity;
  const enhanced = !!severity('text-contrast-enhanced') && severity('text-contrast-enhanced') !== 'off';

  const findings: Finding[] = [];
  const details: ThemeFinding[] = [];
  const rules = new Map<string, RuleInfo>();
  const summaries: ConfigurationSummary[] = [];
  for (const configuration of configurations) {
    const summary: ConfigurationSummary = { name: configuration.name, file: configuration.file, line: configuration.line, findings: 0, blocking: 0, inherited: 0 };
    for (const f of auditConfiguration(antd, configuration, { enhanced })) {
      const ruleId = `${THEME_PREFIX}${f.rule}`;
      if (severity(f.rule) === 'off') continue;
      if (f.inherited && config.theme.inherited === 'off') continue;
      const info = themeRuleInfo(f.rule);
      const blocking = f.inherited && config.theme.inherited !== 'error'
        ? false
        : f.inherited
          ? true
          : engine.blockingFor(ruleId, info.impact, failOn, overrides);
      rules.set(ruleId, info);
      details.push(f);
      findings.push({
        file: f.location?.file,
        line: f.location?.line,
        column: f.location?.column,
        ruleId,
        message: `[${configuration.name}] ${f.message}${f.elements.length > 1 ? ` Also: ${f.elements.slice(1).join('; ')}.` : ''}`,
        impact: info.impact,
        blocking,
        wcag: info.wcag,
        target: f.location ? undefined : configuration.name,
        theme: { configuration: configuration.name, inherited: f.inherited, pairIds: f.pairIds },
      });
      summary.findings += 1;
      if (blocking) summary.blocking += 1;
      if (f.inherited) summary.inherited += 1;
    }
    summaries.push(summary);
  }
  return {
    findings,
    rules,
    configurations: summaries,
    skipped,
    antd: `antd ${antd.version} (${antd.source === 'repository' ? 'from the repository' : 'bundled'})`,
    notes,
    details,
  };
}
