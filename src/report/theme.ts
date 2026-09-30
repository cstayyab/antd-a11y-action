import type { ThemeAuditResult } from '../theme/index.js';
import { formatRatio } from '../theme/color.js';

const MAX_ROWS = 40;

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').replace(/</g, '&lt;');
}

function where(file: string | undefined, line: number | undefined, blobBase?: string): string {
  if (!file) return '';
  const loc = line ? `${file}:${line}` : file;
  return blobBase ? `[${cell(loc)}](${blobBase}/${encodeURI(file)}${line ? `#L${line}` : ''})` : `\`${loc}\``;
}

/** The PR comment's theme section: a row per configuration, then each configuration's findings. */
export function renderThemeSection(theme: ThemeAuditResult, blobBase?: string): string {
  const lines: string[] = ['### Theme contrast', ''];
  if (theme.unchanged) {
    lines.push(...theme.notes, '');
    return lines.join('\n');
  }
  const n = theme.configurations.length;
  lines.push(`${theme.antd} · ${n} ${n === 1 ? 'configuration' : 'configurations'} audited`, '');
  if (n) {
    lines.push('| Configuration | Blocking | Same in antd\'s default theme | Total |', '| --- | ---: | ---: | ---: |');
    for (const c of theme.configurations) {
      const name = c.file ? `${cell(c.name)}` : cell(c.name);
      lines.push(`| ${name} | ${c.blocking || ''} | ${c.inherited || ''} | ${c.findings || '0'} |`);
    }
    lines.push('');
  }
  for (const c of theme.configurations) {
    const rows = theme.details
      .map((d, i) => ({ d, f: theme.findings[i] }))
      .filter(({ d }) => d.configuration === c.name)
      .sort((a, b) => Number(b.f.blocking) - Number(a.f.blocking) || Number(a.d.inherited) - Number(b.d.inherited) || a.d.ratio - b.d.ratio);
    if (!rows.length) continue;
    lines.push(
      `<details${c.blocking ? ' open' : ''}><summary>${cell(c.name)}: ${rows.length} ${rows.length === 1 ? 'finding' : 'findings'}${c.blocking ? `, ${c.blocking} blocking` : ''}</summary>`,
      '',
      '| | Element | Colours | Ratio | Source | Suggested fix |',
      '| --- | --- | --- | ---: | --- | --- |',
    );
    for (const { d, f } of rows.slice(0, MAX_ROWS)) {
      const status = f.blocking ? 'Blocking' : d.inherited ? 'antd default' : f.impact;
      const elements = `${cell(d.elements[0])}${d.elements.length > 1 ? ` <sub>+${d.elements.length - 1} more</sub>` : ''}`;
      const colours = `\`${d.fg.token}\` ${d.fg.color} on \`${d.bg.tokens.at(-1)}\` ${d.bg.color}`;
      const source = `${cell(d.origin)}${d.location ? `<br>${where(d.location.file, d.location.line, blobBase)}` : ''}`;
      const fix = d.suggestion ? `\`${d.suggestion.path}: '${d.suggestion.value}'\`` : '';
      lines.push(`| ${status} | ${elements} | ${cell(colours)} | ${formatRatio(d.ratio)}:1 (needs ${d.required}:1) | ${source} | ${fix} |`);
    }
    if (rows.length > MAX_ROWS) lines.push('', `<sub>First ${MAX_ROWS} of ${rows.length}; the SARIF report has all of them.</sub>`);
    lines.push('', '</details>', '');
  }
  if (theme.skipped.length) {
    lines.push('<details><summary>Themes that could not be read without running code</summary>', '');
    for (const s of theme.skipped) lines.push(`- ${where(s.file, s.line, blobBase)}: ${cell(s.reason)}`);
    lines.push('', 'Set the `theme-config` input to a module that exports the theme to audit these.', '', '</details>', '');
  }
  for (const note of theme.notes) lines.push(`> ${note}`, '');
  return lines.join('\n');
}
