import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { VERSION } from 'eslint-plugin-antd-a11y';
import { DefaultArtifactClient } from '@actions/artifact';
import { applyBaseline, baselineLine, type BaselineSummary } from './baseline.js';
import { changedFiles, lastCommitRenames, pullRequestFromContext } from './changed-files.js';
import { configWarnings, overridesNote, resolveConfig } from './config.js';
import { filterFiles, normalizeDir, walk } from './files.js';
import { readInputs } from './inputs.js';
import { A11yLinter } from './lint.js';
import { annotate } from './report/annotations.js';
import { renderMarkdown } from './report/markdown.js';
import { upsertComment } from './report/pr-comment.js';
import { toSarif } from './report/sarif.js';
import { renderThemeSection } from './report/theme.js';
import { runThemeAudit, type ThemeAuditResult } from './theme/index.js';
import type { ScanResult } from './types.js';

export async function run(): Promise<void> {
  const inputs = readInputs();
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const dir = normalizeDir(inputs.workingDirectory);
  const context = github.context;
  const octokit = inputs.token ? github.getOctokit(inputs.token) : null;
  const pr = pullRequestFromContext(context);

  const runStatic = inputs.modes.includes('static');
  const runTheme = inputs.modes.includes('theme');
  if (!runStatic && !runTheme) {
    core.warning('No available mode selected; nothing to do.');
    return;
  }

  const config = resolveConfig({
    failOn: inputs.failOn,
    jsxA11y: inputs.jsxA11y,
    rules: inputs.rules,
    components: inputs.components,
    aliases: inputs.aliases,
    themeConfig: inputs.themeConfig,
    baseline: inputs.baseline,
    configFile: inputs.configFile,
    workspace,
  });
  if (config.file) core.info(`Using ${config.file}.`);
  for (const warning of configWarnings(config)) core.warning(warning);

  let candidates: string[] | null = null;
  let renames: Map<string, string> | undefined;
  let scope = 'full scan';
  if (pr && (inputs.changedOnly || config.baseline)) {
    // A baseline follows the PR's renames, on a full scan too.
    const changes = await changedFiles(octokit, context, pr, workspace);
    renames = changes?.renames;
    if (inputs.changedOnly && changes) {
      candidates = changes.files;
      scope = 'changed files';
    }
  }
  if (inputs.changedOnly && !pr) {
    core.info('Not a pull_request event, so scanning the whole tree.');
  }
  candidates ??= await walk(workspace, dir);

  const files = filterFiles(candidates, dir, inputs.include, inputs.exclude);
  core.debug(`${candidates.length} candidates; include=${JSON.stringify(inputs.include)} exclude=${JSON.stringify(inputs.exclude)}`);
  if (runStatic) core.info(`Scanning ${files.length} files (${scope}).`);

  const failOn = config.failOn ?? 'serious';
  let result: ScanResult = { findings: [], filesScanned: 0, parseErrors: [], suppressed: 0, rules: new Map() };
  if (runStatic) {
    const linter = new A11yLinter({ config, failOn, fingerprints: !!config.baseline });
    result = await linter.lintFiles(workspace, files);
    const aliasNames = Object.keys(config.aliases);
    if (aliasNames.length) core.info(`Checking ${aliasNames.length} wrapper ${aliasNames.length === 1 ? 'alias' : 'aliases'}: ${aliasNames.join(', ')}.`);
    // Only a full scan can tell that an alias is never used; a PR's changed files may simply not include it.
    if (scope === 'full scan') {
      for (const name of aliasNames.filter((n) => !linter.usedAliases.has(n))) {
        core.warning(`Alias "${name}" matched no JSX tag in the scanned files. Check the spelling, and that it is imported where it is used.`);
      }
    }
  }

  let theme: ThemeAuditResult | undefined;
  if (runTheme) {
    // Themes are found in the whole tree: a PR that doesn't touch the theme still renders with it.
    const themeFiles = scope === 'full scan' ? files : filterFiles(await walk(workspace, dir), dir, inputs.include, inputs.exclude);
    theme = await runThemeAudit({
      workspace,
      dir,
      files: themeFiles,
      config,
      failOn,
      changed: scope === 'changed files' ? new Set(candidates) : undefined,
    });
    for (const note of theme.notes) core.info(note);
    for (const s of theme.skipped) core.warning(`Theme not audited: ${s.reason}.`, { file: s.file, startLine: s.line, title: 'antd-a11y: theme' });
    if (!theme.unchanged) core.info(`Theme audit: ${theme.configurations.map((c) => `${c.name} (${c.findings})`).join(', ')} with ${theme.antd}.`);
    result.findings.push(...theme.findings);
    for (const [id, info] of theme.rules) result.rules.set(id, info);
  }

  const today = new Date().toISOString().slice(0, 10);
  let baseline: BaselineSummary | undefined;
  if (config.baseline) {
    if (inputs.baselineUpdate === 'full' && scope !== 'full scan') {
      throw new Error('baseline-update: full rewrites the baseline from a whole scan; set changed-only: false.');
    }
    if (!pr && !renames) {
      renames = lastCommitRenames(workspace) ?? undefined;
      if (!renames) core.warning('Could not read the previous commit, so renamed files count as new and fixed. Use actions/checkout with fetch-depth: 2.');
    }
    const scanned = new Set<string>([...(runStatic ? files : []), ...(theme?.configurations.map((c) => c.file).filter((f): f is string => !!f) ?? [])]);
    baseline = await applyBaseline(result, {
      file: config.baseline,
      workspace,
      dir,
      scanned,
      renames,
      update: inputs.baselineUpdate,
      ageWarning: inputs.baselineAgeWarning,
      today,
    });
    if (baseline.missing && inputs.baselineUpdate === 'false') core.info(`No baseline at ${config.baseline} yet, so every finding is new.`);
    core.info(`Baseline ${config.baseline}: ${baselineLine(baseline, today)}.`);
    if (baseline.aged) {
      core.warning(`${baseline.aged} of ${baseline.matchedEntries} baselined entries are older than ${baseline.ageWarning} days.`);
    }
    if (baseline.written) {
      const w = baseline.written;
      core.info(`Wrote ${config.baseline} (${w.mode}): ${w.before} → ${w.after} entries.`);
      core.setOutput('baseline-file', w.path);
      await uploadBaseline(w.path, dir);
    }
  }
  result.findings.sort((a, b) => Number(b.blocking) - Number(a.blocking));
  const blocking = result.findings.filter((f) => f.blocking).length;

  annotate(result, inputs.maxAnnotations);

  const sarifPath = path.resolve(workspace, inputs.sarifFile);
  await mkdir(path.dirname(sarifPath), { recursive: true });
  await writeFile(sarifPath, `${JSON.stringify(toSarif(result, failOn, VERSION), null, 2)}\n`);
  core.info(`Wrote SARIF to ${sarifPath}`);

  const sha = pr?.headSha ?? context.sha;
  const serverUrl = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  // context.repo throws outside GitHub Actions, so read the env var directly.
  const repository = process.env.GITHUB_REPOSITORY;
  const blobBase = repository && sha ? `${serverUrl}/${repository}/blob/${sha}` : undefined;
  const markdown = renderMarkdown(result, {
    failOn,
    blobBase,
    scope,
    scanned: runStatic ? undefined : 'the theme',
    overrides: overridesNote(config, ['antd-a11y/', 'jsx-a11y/', 'theme/']),
    sections: theme ? [renderThemeSection(theme, blobBase)] : [],
    baseline: baseline && { file: baseline.file, line: baselineLine(baseline, today), fixed: baseline.fixed },
  });

  if (process.env.GITHUB_STEP_SUMMARY) {
    await core.summary.addRaw(markdown).write();
  }
  if (inputs.comment && pr && octokit && repository) {
    await upsertComment(octokit, context, pr.number, markdown, result.findings.length > 0);
  }

  core.setOutput('violations', result.findings.length);
  core.setOutput('blocking-violations', blocking);
  core.setOutput('sarif-file', sarifPath);
  if (baseline) {
    core.setOutput('baselined', baseline.baselined);
    core.setOutput('fixed', baseline.fixed.reduce((n, e) => n + e.fixed, 0));
    core.setOutput('baseline-oldest', baseline.oldest ?? '');
    core.setOutput('baseline-aged', baseline.aged);
  }

  const failures: string[] = [];
  if (blocking > 0) {
    failures.push(`${blocking} ${baseline ? 'new ' : ''}accessibility ${blocking === 1 ? 'issue' : 'issues'} at or above "${failOn}" impact.`);
  }
  const fixedCount = baseline ? baseline.fixed.reduce((n, e) => n + e.fixed, 0) : 0;
  if (baseline && inputs.baselineStrict && fixedCount > 0 && !baseline.written) {
    const where = [...new Set(baseline.fixed.map((e) => e.file))].slice(0, 10).join(', ');
    failures.push(`${fixedCount} baseline ${fixedCount === 1 ? 'entry is' : 'entries are'} already fixed (${where}); remove them from ${config.baseline} (baseline-update: shrink does it).`);
  }
  if (failures.length) core.setFailed(failures.join(' '));
  else core.info(`No issues at or above "${failOn}" (${result.findings.length} total findings).`);
}

/** Uploads the updated baseline, so a later step or a person can commit it. */
async function uploadBaseline(file: string, dir: string): Promise<void> {
  const name = `antd-a11y-baseline${dir ? `-${dir.replace(/[^\w.-]+/g, '-')}` : ''}`;
  try {
    await new DefaultArtifactClient().uploadArtifact(name, [file], path.dirname(file));
    core.info(`Uploaded the baseline as the "${name}" artifact.`);
  } catch (error) {
    core.warning(`Could not upload the baseline artifact (${(error as Error).message}). The file is in the workspace at ${file}.`);
  }
}
