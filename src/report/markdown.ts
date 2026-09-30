import { IMPACTS, type Finding, type Impact, type ScanResult } from '../types.js';
import { criterion } from '../wcag.js';

export const COMMENT_MARKER = '<!-- antd-a11y-guard -->';
const MAX_ROWS = 50;

export interface MarkdownContext {
  failOn: Impact | 'none';
  /** `https://github.com/owner/repo/blob/<sha>` for file links; plain paths when absent. */
  blobBase?: string;
  scope: string;
  /** Sticky-comment marker; each layer (static, runtime) keeps its own comment. */
  marker?: string;
  title?: string;
  /** What was scanned, e.g. "4 routes". Defaults to the file count. */
  scanned?: string;
  /** Shown as a quote above the results, e.g. a guard health warning. */
  banner?: string;
  /** Footer note when configuration changed rule severities, so reviewers see a loosened gate. */
  overrides?: string;
  /** Sections rendered after the findings, e.g. the theme audit's; their findings stay out of the per-file table. */
  sections?: string[];
  /** With a baseline: "3 new · 41 baselined (oldest 8 months) · 2 fixed", and the fixed entries. */
  baseline?: { file: string; line: string; fixed: { file: string; rule: string; fixed: number }[] };
}

/** "[4.1.2](understanding link) [2.4.4](…)", hovering shows the criterion's name and level. */
function wcagCell(ids: readonly string[] = []): string {
  return ids
    .map((id) => {
      const c = criterion(id);
      return c.url ? `[${id}](${c.url} "${c.name} (Level ${c.level})")` : id;
    })
    .join(' ');
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').replace(/</g, '&lt;');
}

/** A finding's file and line, linked when the blob URL is known; its DOM target when it has no file. */
function where(f: Finding, ctx: MarkdownContext): string {
  if (!f.file) return f.target ? `\`${escapeCell(f.target)}\`` : 'unknown';
  const loc = f.line ? `${f.file}:${f.line}` : f.file;
  const anchor = f.line ? `#L${f.line}` : '';
  return ctx.blobBase ? `[${escapeCell(loc)}](${ctx.blobBase}/${encodeURI(f.file)}${anchor})` : `\`${loc}\``;
}

export function renderMarkdown(result: ScanResult, ctx: MarkdownContext): string {
  const blocking = result.findings.filter((f) => f.blocking).length;
  // Baselined findings are listed on their own, below; everything above is about new ones.
  const fresh = result.findings.filter((f) => f.baseline !== 'baselined');
  const baselined = result.findings.filter((f) => f.baseline === 'baselined');
  const other = fresh.length - blocking;
  const lines: string[] = [ctx.marker ?? COMMENT_MARKER, `## ${ctx.title ?? 'antd A11y Guard'}`, ''];
  if (ctx.banner) lines.push(`> ${ctx.banner}`, '');

  const files = ctx.scanned ?? `${result.filesScanned} ${result.filesScanned === 1 ? 'file' : 'files'}`;
  if (result.findings.length === 0) {
    lines.push(`No accessibility issues found in ${files} (${ctx.scope}).`);
  } else {
    const verdict = blocking > 0 ? `**${blocking} blocking**` : '**0 blocking**';
    const below = ctx.failOn === 'none' ? `${other} reported (fail-on: none)` : `${other} below the \`${ctx.failOn}\` threshold`;
    lines.push(`${verdict} · ${below} · ${files} scanned (${ctx.scope})`);
    lines.push('');
    if (ctx.baseline) lines.push(`Baseline \`${ctx.baseline.file}\`: ${ctx.baseline.line}`, '');

    const byRule = new Map<string, Record<Impact, number>>();
    for (const f of fresh) {
      const counts = byRule.get(f.ruleId) ?? { minor: 0, moderate: 0, serious: 0, critical: 0 };
      counts[f.impact] += 1;
      byRule.set(f.ruleId, counts);
    }
    lines.push(
      '| Rule | WCAG | Critical | Serious | Moderate | Minor |',
      '| --- | --- | ---: | ---: | ---: | ---: |',
    );
    for (const [ruleId, counts] of [...byRule].sort((a, b) => a[0].localeCompare(b[0]))) {
      const rule = result.rules.get(ruleId);
      const name = rule?.helpUri ? `[\`${ruleId}\`](${rule.helpUri})` : `\`${ruleId}\``;
      const cells = [...IMPACTS].reverse().map((impact) => (counts[impact] ? String(counts[impact]) : ''));
      lines.push(`| ${name} | ${wcagCell(rule?.wcag)} | ${cells.join(' | ')} |`);
    }
    lines.push('');

    const listed = fresh.filter((f) => !f.theme);
    const shown = listed.slice(0, MAX_ROWS);
    if (shown.length) lines.push(
      `<details${listed.some((f) => f.blocking) ? ' open' : ''}><summary>Findings${
        listed.length > MAX_ROWS ? ` (first ${MAX_ROWS} of ${listed.length})` : ''
      }</summary>`,
      '',
      '| | Location | Rule | WCAG | Message |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const f of shown) {
      const routes = f.routes?.length ? `<br><sub>${escapeCell(f.routes.join(', '))}</sub>` : '';
      lines.push(
        `| ${f.blocking ? 'Blocking' : f.impact} | ${where(f, ctx)}${routes} | \`${f.ruleId}\` | ${wcagCell(f.wcag)} | ${escapeCell(f.message)} |`,
      );
    }
    if (shown.length) lines.push('', '</details>');
  }
  if (baselined.length) {
    const perRule = new Map<string, number>();
    for (const f of baselined) perRule.set(f.ruleId, (perRule.get(f.ruleId) ?? 0) + 1);
    lines.push('', `<details><summary>Baselined: ${baselined.length} known ${baselined.length === 1 ? 'finding' : 'findings'} (reported, not blocking)</summary>`, '');
    lines.push('| Rule | Baselined |', '| --- | ---: |');
    for (const [rule, n] of [...perRule].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) lines.push(`| \`${rule}\` | ${n} |`);
    lines.push('');
    for (const f of baselined.filter((b) => !b.theme).slice(0, MAX_ROWS)) {
      lines.push(`- ${where(f, ctx)} \`${f.ruleId}\`: ${escapeCell(f.message)}`);
    }
    lines.push('', '</details>');
  }
  if (ctx.baseline?.fixed.length) {
    const total = ctx.baseline.fixed.reduce((n, e) => n + e.fixed, 0);
    lines.push('', `<details><summary>Fixed: ${total} baseline ${total === 1 ? 'entry' : 'entries'} to remove</summary>`, '');
    for (const e of ctx.baseline.fixed.slice(0, MAX_ROWS)) lines.push(`- \`${e.file}\` \`${e.rule}\`${e.fixed > 1 ? ` ×${e.fixed}` : ''}`);
    lines.push('', 'Run the action with `baseline-update: shrink` to drop them from the baseline.', '', '</details>');
  }
  for (const section of ctx.sections ?? []) lines.push('', section.trimEnd());

  const notes: string[] = [];
  if (result.suppressed > 0) notes.push(`${result.suppressed} suppressed with \`a11y-ignore\` or \`eslint-disable\``);
  if (result.parseErrors.length > 0) notes.push(`${result.parseErrors.length} files could not be parsed`);
  if (ctx.overrides) notes.push(ctx.overrides);
  if (notes.length > 0) lines.push('', `<sub>${notes.join(' · ')}</sub>`);
  return `${lines.join('\n')}\n`;
}
