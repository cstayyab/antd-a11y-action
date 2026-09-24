import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { VERSION } from 'eslint-plugin-antd-a11y';
import { changedFiles, pullRequestFromContext } from './changed-files.js';
import { configWarnings, overridesNote, resolveConfig } from './config.js';
import { filterFiles, normalizeDir, walk } from './files.js';
import { readInputs } from './inputs.js';
import { A11yLinter } from './lint.js';
import { annotate } from './report/annotations.js';
import { renderMarkdown } from './report/markdown.js';
import { upsertComment } from './report/pr-comment.js';
import { toSarif } from './report/sarif.js';

export async function run(): Promise<void> {
  const inputs = readInputs();
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const dir = normalizeDir(inputs.workingDirectory);
  const context = github.context;
  const octokit = inputs.token ? github.getOctokit(inputs.token) : null;
  const pr = pullRequestFromContext(context);

  if (!inputs.modes.includes('static')) {
    core.warning('No available mode selected; nothing to do.');
    return;
  }

  let candidates: string[] | null = null;
  let scope = 'full scan';
  if (inputs.changedOnly && pr) {
    candidates = await changedFiles(octokit, context, pr, workspace);
    if (candidates) scope = 'changed files';
  } else if (inputs.changedOnly) {
    core.info('Not a pull_request event, so scanning the whole tree.');
  }
  candidates ??= await walk(workspace, dir);

  const files = filterFiles(candidates, dir, inputs.include, inputs.exclude);
  core.debug(`${candidates.length} candidates; include=${JSON.stringify(inputs.include)} exclude=${JSON.stringify(inputs.exclude)}`);
  core.info(`Scanning ${files.length} files (${scope}).`);

  const config = resolveConfig({
    jsxA11y: inputs.jsxA11y,
    rules: inputs.rules,
    components: inputs.components,
    configFile: inputs.configFile,
    workspace,
  });
  if (config.file) core.info(`Using ${config.file}.`);
  for (const warning of configWarnings(config)) core.warning(warning);
  const linter = new A11yLinter({ config, failOn: inputs.failOn });
  const result = await linter.lintFiles(workspace, files);
  const blocking = result.findings.filter((f) => f.blocking).length;

  annotate(result, inputs.maxAnnotations);

  const sarifPath = path.resolve(workspace, inputs.sarifFile);
  await mkdir(path.dirname(sarifPath), { recursive: true });
  await writeFile(sarifPath, `${JSON.stringify(toSarif(result, inputs.failOn, VERSION), null, 2)}\n`);
  core.info(`Wrote SARIF to ${sarifPath}`);

  const sha = pr?.headSha ?? context.sha;
  const serverUrl = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  // context.repo throws outside GitHub Actions, so read the env var directly.
  const repository = process.env.GITHUB_REPOSITORY;
  const blobBase = repository && sha ? `${serverUrl}/${repository}/blob/${sha}` : undefined;
  const markdown = renderMarkdown(result, {
    failOn: inputs.failOn,
    blobBase,
    scope,
    overrides: overridesNote(config, ['antd-a11y/', 'jsx-a11y/']),
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

  if (blocking > 0) {
    core.setFailed(
      `${blocking} accessibility ${blocking === 1 ? 'issue' : 'issues'} at or above "${inputs.failOn}" impact.`,
    );
  } else {
    core.info(`No issues at or above "${inputs.failOn}" (${result.findings.length} total findings).`);
  }
}
