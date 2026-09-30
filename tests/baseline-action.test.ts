import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tsParser from '@typescript-eslint/parser';
import { ESLint, type Linter } from 'eslint';
import antdA11y from 'eslint-plugin-antd-a11y';
import { applyBaseline, baselineLine } from '../src/baseline.js';
import { parseNameStatus } from '../src/changed-files.js';
import { resolveConfig } from '../src/config.js';
import { walk } from '../src/files.js';
import { A11yLinter } from '../src/lint.js';
import { renderMarkdown } from '../src/report/markdown.js';
import { toSarif } from '../src/report/sarif.js';

const today = '2026-10-01';

function workspace(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'a11y-baseline-'));
  for (const [file, code] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), code);
  }
  return dir;
}

async function scan(dir: string, update: 'false' | 'full' | 'shrink' = 'false') {
  const config = resolveConfig({ workspace: dir, baseline: 'baseline.json' });
  const linter = new A11yLinter({ config, failOn: 'serious', fingerprints: true });
  const files = await walk(dir, 'web');
  const result = await linter.lintFiles(dir, files);
  const summary = await applyBaseline(result, { file: 'baseline.json', workspace: dir, dir: 'web', scanned: new Set(files), update, today });
  return { result, summary };
}

const PAGE = `import { InputNumber, Modal } from 'antd';
export const Page = () => (
  <>
    <InputNumber />
    <InputNumber />
    <Modal open />
  </>
);
`;

describe('the baseline in the action', () => {
  it('creates, enforces and shrinks a baseline', async () => {
    const dir = workspace({ 'web/src/Page.tsx': PAGE });

    const created = await scan(dir, 'full');
    expect(created.summary.written).toMatchObject({ mode: 'full', before: 0, after: 2 });
    expect(created.result.findings.every((f) => !f.blocking)).toBe(true);
    const file = JSON.parse(readFileSync(path.join(dir, 'baseline.json'), 'utf8'));
    expect(file.entries.map((e: { rule: string; count: number }) => `${e.rule}×${e.count}`).sort()).toEqual([
      'antd-a11y/form-control-has-name×2',
      'antd-a11y/modal-has-title×1',
    ]);

    const clean = await scan(dir);
    expect(clean.summary).toMatchObject({ newFindings: 0, baselined: 3, fixed: [] });
    expect(clean.result.findings.some((f) => f.blocking)).toBe(false);
    expect(baselineLine(clean.summary, today)).toBe('0 new · 3 baselined (oldest 0 days)');

    // A third identical InputNumber is new; the page moving down two lines changes nothing else.
    writeFileSync(path.join(dir, 'web/src/Page.tsx'), `// header\n// more\n${PAGE.replace('<InputNumber />', '<InputNumber />\n    <InputNumber />')}`);
    const added = await scan(dir);
    expect(added.summary).toMatchObject({ newFindings: 1, baselined: 3 });
    expect(added.result.findings.filter((f) => f.blocking)).toHaveLength(1);

    // Fixing the modal is one fixed entry; shrink drops it and doesn't add the new InputNumber.
    writeFileSync(path.join(dir, 'web/src/Page.tsx'), PAGE.replace('<Modal open />', '<Modal open title="Order" />'));
    const fixed = await scan(dir);
    expect(fixed.summary.fixed.map((e) => e.rule)).toEqual(['antd-a11y/modal-has-title']);
    const markdown = renderMarkdown(fixed.result, { failOn: 'serious', scope: 'full scan', baseline: { file: 'baseline.json', line: baselineLine(fixed.summary, today), fixed: fixed.summary.fixed } });
    expect(markdown).toContain('Baseline `baseline.json`: 0 new · 2 baselined (oldest 0 days) · 1 fixed (remove from the baseline)');
    expect(markdown).toContain('Fixed: 1 baseline entry to remove');
    const shrunk = await scan(dir, 'shrink');
    expect(shrunk.summary.written).toMatchObject({ mode: 'shrink', before: 2, after: 1 });
  });

  it('marks SARIF results new or unchanged, with a stable fingerprint', async () => {
    const dir = workspace({ 'web/src/Page.tsx': PAGE });
    await scan(dir, 'full');
    writeFileSync(path.join(dir, 'web/src/Page.tsx'), PAGE.replace('<Modal open />', '<Modal open />\n    <Modal open={visible} />'));
    const { result } = await scan(dir);
    const sarif = toSarif(result, 'serious', 'test');
    const states = sarif.runs[0].results.map((r) => (r as { baselineState?: string }).baselineState).sort();
    expect(states).toEqual(['new', 'unchanged', 'unchanged', 'unchanged']);
    expect(sarif.runs[0].results.every((r) => /^[0-9a-f]{10}$/.test((r as { partialFingerprints: Record<string, string> }).partialFingerprints['antdA11y/v1']))).toBe(true);
  });

  it('local ESLint treats baselined findings as warnings, like the PR check', async () => {
    const dir = workspace({ 'web/src/Page.tsx': PAGE });
    await scan(dir, 'full');
    writeFileSync(path.join(dir, 'web/src/Page.tsx'), PAGE.replace('<Modal open />', '<Modal open />\n    <Modal open={visible} />'));
    const eslint = new ESLint({
      cwd: dir,
      overrideConfigFile: true,
      overrideConfig: antdA11y.config({ cwd: dir, configFile: false, baseline: 'baseline.json', parser: tsParser as Linter.Parser }),
    });
    const [report] = await eslint.lintFiles(['web/src/Page.tsx']);
    const local = report.messages.map((m) => `${m.line} ${m.ruleId} ${m.severity === 2 ? 'blocking' : 'non-blocking'}`).sort();
    const { result } = await scan(dir);
    const action = result.findings.map((f) => `${f.line} ${f.ruleId} ${f.blocking ? 'blocking' : 'non-blocking'}`).sort();
    expect(local).toEqual(action);
    expect(report.messages.filter((m) => m.severity === 2)).toHaveLength(1);
    expect(report.messages.find((m) => m.severity === 1)?.message).toMatch(/\(in the baseline\)$/);
  });
});

describe('parseNameStatus', () => {
  it('reads changes and renames from git diff --name-status -M', () => {
    const changes = parseNameStatus('M\tsrc/a.tsx\nR092\tsrc/old.tsx\tsrc/new.tsx\nD\tsrc/gone.tsx\nA\tsrc/added.tsx\n');
    expect(changes.files).toEqual(['src/a.tsx', 'src/new.tsx', 'src/added.tsx']);
    expect([...changes.renames]).toEqual([['src/old.tsx', 'src/new.tsx']]);
  });
});
