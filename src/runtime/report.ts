// Turns the per-route JSON written by runtime/a11y.spec.ts into the same outputs the
// static layer produces: annotations, SARIF, job summary, a sticky PR comment and a verdict.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { VERSION } from 'eslint-plugin-antd-a11y';
import { annotate } from '../report/annotations.js';
import { renderMarkdown } from '../report/markdown.js';
import { upsertComment } from '../report/pr-comment.js';
import { toSarif } from '../report/sarif.js';
import { IMPACTS, impactRank, type Finding, type Impact, type ScanResult } from '../types.js';
import { axeImpact, axeRuleInfo, runtimeRuleInfo } from './rules.js';
import { overridesNote, resolveConfig, type RuleOverride } from '../config.js';
import { blockingFor } from '../severity.js';

export const RUNTIME_MARKER = '<!-- antd-a11y-guard:runtime -->';

export interface PageResult {
  route: string;
  status: number | null;
  /** Path the page ended up on when it differs from the route (e.g. /login). */
  redirectedTo?: string | null;
  guard: { createElement: number; jsx: number; wraps: number } | null;
  runtime: {
    rule: string;
    message: string;
    site?: string;
    selector?: string;
    location?: { file: string; line?: number; column?: number } | null;
    /** app: the element is written in app code. library: rendered inside a library component used at `location`. */
    origin?: 'app' | 'library' | null;
  }[];
  axe: { id: string; impact: string | null; help: string; helpUrl?: string; tags?: string[]; targets: string[] }[];
}

export type FailOn = Impact | 'none';

export interface RuntimeOptions {
  failOn: FailOn;
  /** Per-rule overrides for runtime/* and axe/* ids (off drops findings; warn/error set blocking). */
  rules?: ReadonlyMap<string, RuleOverride>;
  /** App directory and repo root, to turn app-relative source paths into repo paths. */
  cwd: string;
  workspace: string;
}

export interface RuntimeResult extends ScanResult {
  routes: string[];
  guardActive: boolean;
  /** Routes that did not answer 2xx/3xx. */
  failedRoutes: string[];
  /** Routes that ended up on a different path; their findings describe that page. */
  redirects: { route: string; to: string }[];
}

// Prop-level rules describe how an element was written. Inside a library component that is the
// library's choice (e.g. antd's modal mask closes on click), so it can't be fixed from app code.
const AUTHORING_RULES = new Set([
  'click-events-need-role',
  'interactive-role-focusable',
  'click-events-have-key-events',
  'no-positive-tabindex',
]);

const NO_OVERRIDES: ReadonlyMap<string, RuleOverride> = new Map();

/** Merges per-route results, deduping the same issue seen on several routes. */
export function buildRuntimeResult(pages: PageResult[], opts: RuntimeOptions): RuntimeResult {
  const rules = opts.rules ?? NO_OVERRIDES;
  const result: RuntimeResult = {
    findings: [],
    filesScanned: 0,
    parseErrors: [],
    suppressed: 0,
    rules: new Map(),
    routes: pages.map((p) => p.route).sort(),
    guardActive: pages.some((p) => p.guard && (p.guard.createElement > 0 || p.guard.jsx > 0)),
    failedRoutes: pages.filter((p) => p.status !== null && p.status >= 400).map((p) => p.route),
    redirects: pages
      .filter((p): p is PageResult & { redirectedTo: string } => Boolean(p.redirectedTo))
      .map((p) => ({ route: p.route, to: p.redirectedTo })),
  };
  // Findings on a redirected page belong to where it landed, so label them "/account → /login".
  const label = (p: PageResult) => (p.redirectedTo ? `${p.route} → ${p.redirectedTo}` : p.route);
  const merged = new Map<string, Finding>();
  const add = (key: string, route: string, make: () => Finding) => {
    const existing = merged.get(key);
    if (existing) {
      if (!existing.routes!.includes(route)) existing.routes!.push(route);
      return;
    }
    const finding = make();
    finding.routes = [route];
    merged.set(key, finding);
  };

  for (const page of pages) {
    for (const v of page.runtime) {
      const info = runtimeRuleInfo(v.rule);
      if (rules.get(info.id)?.severity === 'off') continue;
      result.rules.set(info.id, info);
      const inLibrary = v.origin === 'library' && AUTHORING_RULES.has(v.rule);
      const impact: Impact = inLibrary ? 'minor' : info.impact;
      const message = inLibrary ? `${v.message} (inside a library component used here)` : v.message;
      const file = v.location
        ? path.relative(opts.workspace, path.join(opts.cwd, v.location.file)).split(path.sep).join('/')
        : undefined;
      // Origin is part of the key: with file-only (webpack) locations, an app element and a
      // library-internal one in the same file must stay separate findings.
      const key = `${info.id}|${v.origin ?? ''}|${file ?? v.site ?? v.selector ?? v.message}|${v.location?.line ?? ''}`;
      add(key, label(page), () => ({
        file,
        line: v.location?.line,
        column: v.location?.column,
        ruleId: info.id,
        message,
        impact,
        blocking: blockingFor(info.id, impact, opts.failOn, rules),
        target: file ? undefined : (v.selector ?? v.site),
        wcag: info.wcag,
      }));
    }
    for (const v of page.axe) {
      const impact = axeImpact(v.impact);
      const info = axeRuleInfo(v.id, v.help, v.helpUrl, impact, v.tags);
      if (rules.get(info.id)?.severity === 'off') continue;
      if (!result.rules.has(info.id)) result.rules.set(info.id, info);
      for (const target of v.targets) {
        add(`${info.id}|${target}`, label(page), () => ({
          ruleId: info.id,
          message: v.help,
          impact,
          blocking: blockingFor(info.id, impact, opts.failOn, rules),
          target,
          wcag: info.wcag,
        }));
      }
    }
  }

  result.findings = [...merged.values()].sort(
    (a, b) =>
      Number(b.blocking) - Number(a.blocking) ||
      impactRank(b.impact) - impactRank(a.impact) ||
      a.ruleId.localeCompare(b.ruleId) ||
      (a.file ?? a.target ?? '').localeCompare(b.file ?? b.target ?? ''),
  );
  return result;
}

export async function readPages(dir: string): Promise<PageResult[]> {
  let names: string[] = [];
  try {
    names = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return [];
  }
  return Promise.all(names.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8')) as PageResult));
}

async function readSetupStatus(file: string | undefined): Promise<{ ok: boolean; error?: string } | null> {
  if (!file) return null;
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // The setup test never wrote its status: Playwright did not get that far (e.g. the server failed to start).
    return { ok: false, error: 'it did not run; see the crawl step log' };
  }
}

function parseFailOn(value: string | undefined): FailOn {
  const v = (value || 'serious').toLowerCase();
  if (v === 'none' || (IMPACTS as readonly string[]).includes(v)) return v as FailOn;
  throw new Error(`fail-on must be one of ${IMPACTS.join(', ')} or none, got "${v}".`);
}

export async function run(env = process.env): Promise<void> {
  const failOn = parseFailOn(env.IN_FAIL_ON);
  const mode = env.A11Y_MODE ?? 'generic';
  const requireGuard = mode === 'next' && env.IN_REQUIRE_GUARD !== 'false';
  const workspace = env.GITHUB_WORKSPACE ?? process.cwd();
  const cwd = env.A11Y_CWD ?? workspace;

  const setupStatus = await readSetupStatus(env.A11Y_SETUP_STATUS);
  if (setupStatus && !setupStatus.ok) {
    core.setFailed(`The setup module failed, so no route was crawled: ${setupStatus.error}`);
    return;
  }
  const pages = await readPages(env.A11Y_OUT ?? '');
  if (pages.length === 0) {
    core.setFailed('The runtime check produced no results: no route loaded. See the crawl step log.');
    return;
  }
  const config = resolveConfig({
    rules: env.IN_RULES,
    configFile: env.IN_CONFIG || '.github/antd-a11y.json',
    workspace,
  });
  const result = buildRuntimeResult(pages, { failOn, cwd, workspace, rules: config.rules });
  const blockingCount = result.findings.filter((f) => f.blocking).length;

  const maxAnnotations = Number(env.IN_MAX_ANNOTATIONS || 50);
  annotate(result, Number.isInteger(maxAnnotations) && maxAnnotations >= 0 ? maxAnnotations : 50);

  const sarifPath = path.resolve(workspace, env.IN_SARIF_FILE || 'antd-a11y-runtime.sarif');
  await mkdir(path.dirname(sarifPath), { recursive: true });
  await writeFile(sarifPath, `${JSON.stringify(toSarif(result, failOn, VERSION, 'antd-a11y-guard-runtime'), null, 2)}\n`);

  let banner: string | undefined;
  if (mode === 'next' && !result.guardActive) {
    banner =
      '**The guard did not intercept any renders**, so only axe results are shown. Check the inject step log and that instrumentation-client is where Next expects it.';
  } else if (mode !== 'next') {
    banner = 'Generic mode: axe scan of the rendered pages. Findings point at DOM selectors, not source lines.';
  }
  if (result.failedRoutes.length > 0) {
    const failed = `Routes that returned an error status: ${result.failedRoutes.join(', ')}.`;
    banner = banner ? `${banner}<br>${failed}` : failed;
  }
  if (result.redirects.length > 0) {
    const list = result.redirects.map((r) => `${r.route} → ${r.to}`).join(', ');
    const note = `Redirected, so the page it landed on was checked instead: ${list}. For signed-in pages, sign in with the \`setup\` input.`;
    banner = banner ? `${banner}<br>${note}` : note;
    for (const r of result.redirects) core.warning(`Route ${r.route} redirected to ${r.to}.`);
  }

  const sha = github.context.payload.pull_request?.head?.sha ?? github.context.sha;
  const repository = env.GITHUB_REPOSITORY;
  const blobBase = repository && sha ? `${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repository}/blob/${sha}` : undefined;
  const markdown = renderMarkdown(result, {
    failOn,
    blobBase,
    scope: mode === 'next' ? 'Next.js guard + axe' : 'axe',
    marker: RUNTIME_MARKER,
    title: 'antd A11y Guard: runtime',
    scanned: `${result.routes.length} ${result.routes.length === 1 ? 'route' : 'routes'}`,
    banner,
    overrides: overridesNote(config, ['runtime/', 'axe/']),
  });
  if (env.GITHUB_STEP_SUMMARY) await core.summary.addRaw(markdown).write();

  const pr = github.context.payload.pull_request;
  if (env.IN_COMMENT !== 'false' && pr && env.IN_TOKEN && repository) {
    await upsertComment(github.getOctokit(env.IN_TOKEN), github.context, pr.number, markdown, result.findings.length > 0, RUNTIME_MARKER);
  }

  core.setOutput('total', result.findings.length);
  core.setOutput('blocking', blockingCount);
  core.setOutput('guard-active', result.guardActive);
  core.setOutput('redirects', result.redirects.length);
  core.setOutput('sarif-file', sarifPath);
  for (const impact of IMPACTS) core.setOutput(impact, result.findings.filter((f) => f.impact === impact).length);

  const problems: string[] = [];
  if (blockingCount > 0) problems.push(`${blockingCount} accessibility ${blockingCount === 1 ? 'issue' : 'issues'} at or above "${failOn}" impact`);
  if (requireGuard && !result.guardActive) problems.push('the guard did not intercept any renders (set require-guard: false to allow axe-only runs)');
  if (env.IN_FAIL_ON_REDIRECT === 'true' && result.redirects.length > 0) {
    problems.push(`${result.redirects.length} ${result.redirects.length === 1 ? 'route' : 'routes'} redirected (${result.redirects.map((r) => `${r.route} → ${r.to}`).join(', ')})`);
  }
  if (problems.length > 0) core.setFailed(`Runtime check: ${problems.join('; ')}.`);
  else core.info(`Runtime check passed: ${result.findings.length} findings, none at or above "${failOn}".`);
}

