import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv-draft-04';
import { describe, expect, it } from 'vitest';
import { filterFiles, normalizeDir, walk } from '../src/files.js';
import { list } from '../src/inputs.js';
import { resolveConfig } from '../src/config.js';
import { A11yLinter, parseIgnoreDirectives } from '../src/lint.js';
import { impactFor } from '../src/severity.js';
import { COMMENT_MARKER, renderMarkdown } from '../src/report/markdown.js';
import { toSarif } from '../src/report/sarif.js';
import type { ScanResult } from '../src/types.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = path.join(root, 'fixtures/app');

/** A linter with the default config, optionally without jsx-a11y. */
const makeLinter = (jsxA11y = true) =>
  new A11yLinter({ config: resolveConfig({ jsxA11y: String(jsxA11y), workspace: root }), failOn: 'serious' });

const emptyResult = (): ScanResult => ({ findings: [], filesScanned: 0, parseErrors: [], suppressed: 0, rules: new Map() });

async function scanFixture(): Promise<ScanResult> {
  const files = filterFiles(await walk(fixture, ''), '', ['**/*.{js,jsx,ts,tsx}'], []);
  return makeLinter(true).lintFiles(fixture, files);
}

describe('inputs', () => {
  it('splits lists on commas outside braces and on newlines', () => {
    expect(list('**/*.{js,jsx,ts,tsx}')).toEqual(['**/*.{js,jsx,ts,tsx}']);
    expect(list('src/**/*.tsx, lib/**/*.{js,ts}\n  apps/**')).toEqual(['src/**/*.tsx', 'lib/**/*.{js,ts}', 'apps/**']);
    expect(list('')).toEqual([]);
  });
});

describe('files', () => {
  it('normalizes the working directory', () => {
    expect(normalizeDir('.')).toBe('');
    expect(normalizeDir('./apps/web/')).toBe('apps/web');
    expect(() => normalizeDir('../elsewhere')).toThrow();
  });

  it('scopes to the working directory and applies include/exclude relative to it', () => {
    const files = [
      'apps/web/src/App.tsx',
      'apps/web/src/App.test.tsx',
      'apps/web/node_modules/antd/index.js',
      'apps/web/dist/bundle.js',
      'apps/api/src/server.ts',
      'apps/web/README.md',
      'apps/web/src/types.d.ts',
    ];
    expect(filterFiles(files, 'apps/web', ['**/*.{ts,tsx}'], ['**/*.test.tsx'])).toEqual(['apps/web/src/App.tsx']);
  });
});

describe('a11y-ignore', () => {
  it('parses bare, rule-scoped and JSX comment directives', () => {
    const directives = parseIgnoreDirectives(
      ['// a11y-ignore', 'x', '{/* a11y-ignore icon-button-has-name, jsx-a11y/alt-text -- decorative */}'].join('\n'),
    );
    expect(directives.get(1)).toEqual({ rules: null });
    expect(directives.get(3)).toEqual({ rules: ['icon-button-has-name', 'jsx-a11y/alt-text'] });
  });

  it('suppresses findings on the same or next line and counts them', () => {
    const linter = makeLinter(false);
    const result = emptyResult();
    linter.lintSource(
      'a.tsx',
      [
        "import { Switch, Modal } from 'antd';",
        '// a11y-ignore form-control-has-name',
        'export const A = () => <Switch />;',
        '// a11y-ignore picker-has-name',
        'export const B = () => <Modal open />;',
        '// eslint-disable-next-line antd-a11y/modal-has-title',
        'export const C = () => <Modal open />;',
      ].join('\n'),
      result,
    );
    expect(result.findings.map((f) => `${f.line}:${f.ruleId}`)).toEqual(['5:antd-a11y/modal-has-title']);
    expect(result.suppressed).toBe(2);
  });
});

describe('lint', () => {
  it('reports every rule in fixtures/app/src/bad and nothing in src/good', async () => {
    const result = await scanFixture();
    expect(result.parseErrors).toEqual([]);
    expect(result.findings.filter((f) => f.file?.startsWith('src/good/'))).toEqual([]);
    const rules = new Set(result.findings.map((f) => f.ruleId));
    const antdRules = (await readdir(path.join(root, 'packages/eslint-plugin-antd-a11y/src/rules'))).map(
      (f) => `antd-a11y/${f.replace(/\.ts$/, '')}`,
    );
    // bad/Native.tsx covers the jsx-a11y layer on native elements.
    expect([...rules].sort()).toEqual([...antdRules, 'jsx-a11y/control-has-associated-label'].sort());
  });

  it('attaches each rule\'s WCAG criteria to its findings', async () => {
    const result = await scanFixture();
    const icon = result.findings.find((f) => f.ruleId === 'antd-a11y/icon-button-has-name');
    expect(icon?.wcag).toEqual(['4.1.2', '2.4.4']);
    const auth = result.findings.find((f) => f.ruleId === 'antd-a11y/auth-input-autocomplete');
    expect(auth?.wcag).toContain('3.3.8');
    expect(result.findings.every((f) => Array.isArray(f.wcag))).toBe(true);
  });

  it('marks findings blocking from their impact and the fail-on threshold', async () => {
    const result = await scanFixture();
    const weak = result.findings.find((f) => f.message.includes('built-in English label'));
    expect(weak).toMatchObject({ impact: 'moderate', blocking: false });
    const hard = result.findings.find((f) => f.ruleId === 'antd-a11y/modal-has-title');
    expect(hard).toMatchObject({ impact: 'serious', blocking: true });
    // Blocking findings sort first.
    const firstNonBlocking = result.findings.findIndex((f) => !f.blocking);
    expect(result.findings.slice(firstNonBlocking).every((f) => !f.blocking)).toBe(true);
  });

  it('runs jsx-a11y on plain elements and ignores unknown rules in disable comments', () => {
    const linter = makeLinter(true);
    const result = emptyResult();
    linter.lintSource(
      'b.jsx',
      [
        '// eslint-disable-next-line react-hooks/exhaustive-deps',
        'export const I = () => <img src="x.png" />;',
      ].join('\n'),
      result,
    );
    expect(result.findings.map((f) => f.ruleId)).toEqual(['jsx-a11y/alt-text']);
    expect(result.findings[0].impact).toBe('critical');
  });

  it('records parse errors without failing', () => {
    const result = emptyResult();
    makeLinter(false).lintSource('broken.tsx', 'const = <div', result);
    expect(result.findings).toEqual([]);
    expect(result.parseErrors).toHaveLength(1);
  });

  it('maps per-message impact overrides', () => {
    expect(impactFor('antd-a11y/icon-button-has-name', 'missing')).toBe('critical');
    expect(impactFor('antd-a11y/icon-button-has-name', 'iconLabelOnly')).toBe('moderate');
    expect(impactFor('jsx-a11y/no-autofocus')).toBe('minor');
    expect(impactFor('jsx-a11y/some-future-rule')).toBe('serious');
  });
});

describe('sarif', () => {
  it('validates against the SARIF 2.1.0 schema', async () => {
    const schema = JSON.parse(await readFile(path.join(root, 'tests/schemas/sarif-schema-2.1.0.json'), 'utf8'));
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const sarif = toSarif(await scanFixture(), 'serious', '0.0.0-test');
    const valid = validate(JSON.parse(JSON.stringify(sarif)));
    expect(validate.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it('uses repo-relative URIs, rule indexes and levels from blocking state', async () => {
    const result = await scanFixture();
    const run = toSarif(result, 'serious', '0.0.0-test').runs[0];
    expect(run.results).toHaveLength(result.findings.length);
    const iconRule = run.tool.driver.rules.find((r) => r.id === 'antd-a11y/icon-button-has-name');
    expect(iconRule?.help?.markdown).toContain('[4.1.2 Name, Role, Value (A)](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value)');
    for (const r of run.results) {
      expect(run.tool.driver.rules[r.ruleIndex].id).toBe(r.ruleId);
      expect(r.locations[0].physicalLocation.artifactLocation.uri).toMatch(/^src\//);
    }
    expect(new Set(run.results.map((r) => r.level))).toEqual(new Set(['error', 'warning']));
  });
});

describe('markdown', () => {
  it('renders the sticky comment with marker, counts and links', async () => {
    const result = await scanFixture();
    const md = renderMarkdown(result, {
      failOn: 'serious',
      blobBase: 'https://github.com/o/r/blob/abc123',
      scope: 'changed files',
    });
    expect(md.startsWith(COMMENT_MARKER)).toBe(true);
    const blocking = result.findings.filter((f) => f.blocking).length;
    expect(md).toContain(`**${blocking} blocking**`);
    expect(md).toContain('[src/bad/Orders.tsx:');
    expect(md).toContain('https://github.com/o/r/blob/abc123/src/bad/Orders.tsx#L');
    expect(md).toContain('| [`antd-a11y/modal-has-title`](');
    // WCAG column: criteria link to the W3C Understanding page, with name and level on hover.
    expect(md).toContain('| Rule | WCAG |');
    expect(md).toContain('[4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value "Name, Role, Value (Level A)")');
  });

  it('renders a clean result', () => {
    const md = renderMarkdown({ ...emptyResult(), filesScanned: 3 }, { failOn: 'serious', scope: 'changed files' });
    expect(md).toContain('No accessibility issues found in 3 files (changed files).');
  });
});
