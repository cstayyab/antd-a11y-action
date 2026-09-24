import { IMPACTS, type Impact, type ScanResult } from '../types.js';
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

export function renderMarkdown(result: ScanResult, ctx: MarkdownContext): string {
  const blocking = result.findings.filter((f) => f.blocking).length;
  const other = result.findings.length - blocking;
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

    const byRule = new Map<string, Record<Impact, number>>();
    for (const f of result.findings) {
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

    const shown = result.findings.slice(0, MAX_ROWS);
    lines.push(
      `<details${blocking > 0 ? ' open' : ''}><summary>Findings${
        result.findings.length > MAX_ROWS ? ` (first ${MAX_ROWS} of ${result.findings.length})` : ''
      }</summary>`,
      '',
      '| | Location | Rule | WCAG | Message |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const f of shown) {
      let where: string;
      if (f.file) {
        const loc = f.line ? `${f.file}:${f.line}` : f.file;
        const anchor = f.line ? `#L${f.line}` : '';
        where = ctx.blobBase ? `[${escapeCell(loc)}](${ctx.blobBase}/${encodeURI(f.file)}${anchor})` : `\`${loc}\``;
      } else {
        where = f.target ? `\`${escapeCell(f.target)}\`` : 'unknown';
      }
      if (f.routes?.length) where += `<br><sub>${escapeCell(f.routes.join(', '))}</sub>`;
      lines.push(
        `| ${f.blocking ? 'Blocking' : f.impact} | ${where} | \`${f.ruleId}\` | ${wcagCell(f.wcag)} | ${escapeCell(f.message)} |`,
      );
    }
    lines.push('', '</details>');
  }

  const notes: string[] = [];
  if (result.suppressed > 0) notes.push(`${result.suppressed} suppressed with \`a11y-ignore\` or \`eslint-disable\``);
  if (result.parseErrors.length > 0) notes.push(`${result.parseErrors.length} files could not be parsed`);
  if (ctx.overrides) notes.push(ctx.overrides);
  if (notes.length > 0) lines.push('', `<sub>${notes.join(' · ')}</sub>`);
  return `${lines.join('\n')}\n`;
}
