import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAliasesInput, resolveConfig, type ConfigInputs } from '../src/config.js';
import { A11yLinter } from '../src/lint.js';
import type { ScanResult } from '../src/types.js';

const workspace = mkdtempSync(path.join(os.tmpdir(), 'a11y-aliases-'));

function withFile(json: unknown): Pick<ConfigInputs, 'workspace' | 'configFile'> {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'a11y-aliases-cfg-'));
  mkdirSync(path.join(dir, '.github'));
  writeFileSync(path.join(dir, '.github/antd-a11y.json'), JSON.stringify(json));
  return { workspace: dir, configFile: '.github/antd-a11y.json' };
}

// The beta report's repro, with the wrappers imported the way their codebase does.
const REPRO = `import { Tooltip, Button, Input } from 'antd';
import AccessibleTooltip from '@/components/AccessibleTooltip';
import LabelInput from '@/components/LabelInput';

export const A = () => (
  <>
    <Tooltip title="why disabled"><Button disabled aria-label="Add" /></Tooltip>
    <AccessibleTooltip title="why disabled"><Button disabled aria-label="Add" /></AccessibleTooltip>
    <Tooltip title="info"><span>plain</span></Tooltip>
    <AccessibleTooltip title="info"><span>plain</span></AccessibleTooltip>
    <AccessibleTooltip title="info" wrapInButton><span>plain</span></AccessibleTooltip>
    <Input />
    <LabelInput />
    <LabelInput label="Email" />
    <LabelInput label={<b>Email</b>} />
  </>
);
`;

function lint(code: string, inputs: Partial<ConfigInputs>) {
  const config = resolveConfig({ workspace, ...inputs });
  const linter = new A11yLinter({ config, failOn: 'serious' });
  const result: ScanResult = { findings: [], filesScanned: 0, parseErrors: [], suppressed: 0, rules: new Map() };
  linter.lintSource('a.tsx', code, result);
  expect(result.parseErrors).toEqual([]);
  const at = (line: number) => code.split('\n')[line - 1].trim();
  return { linter, found: result.findings.filter((f) => f.ruleId.startsWith('antd-a11y/')).map((f) => `${at(f.line!)} → ${f.ruleId}`) };
}

describe('wrapper aliases', () => {
  it('reports only direct antd usage without aliases, as in the beta report', () => {
    expect(lint(REPRO, {}).found).toEqual([
      '<Tooltip title="why disabled"><Button disabled aria-label="Add" /></Tooltip> → antd-a11y/tooltip-no-disabled-child',
      '<Tooltip title="info"><span>plain</span></Tooltip> → antd-a11y/popup-trigger-focusable',
      '<Input /> → antd-a11y/form-control-has-name',
    ]);
  });

  it('checks wrappers per rule, with prop conditions, from the config file', () => {
    const file = withFile({
      aliases: {
        AccessibleTooltip: { as: 'Tooltip', satisfies: { 'popup-trigger-focusable': 'wrapInButton' } },
        LabelInput: { as: 'Input', satisfies: { 'form-control-has-name': 'label:string' } },
      },
    });
    expect(lint(REPRO, file).found).toEqual([
      '<Tooltip title="why disabled"><Button disabled aria-label="Add" /></Tooltip> → antd-a11y/tooltip-no-disabled-child',
      '<AccessibleTooltip title="why disabled"><Button disabled aria-label="Add" /></AccessibleTooltip> → antd-a11y/tooltip-no-disabled-child',
      '<Tooltip title="info"><span>plain</span></Tooltip> → antd-a11y/popup-trigger-focusable',
      '<AccessibleTooltip title="info"><span>plain</span></AccessibleTooltip> → antd-a11y/popup-trigger-focusable',
      '<Input /> → antd-a11y/form-control-has-name',
      '<LabelInput /> → antd-a11y/form-control-has-name',
      '<LabelInput label={<b>Email</b>} /> → antd-a11y/form-control-has-name',
    ]);
  });

  it('applies the simple form from the input to every rule', () => {
    const { found } = lint(REPRO, { aliases: 'AccessibleTooltip: Tooltip' });
    expect(found.filter((f) => f.startsWith('<AccessibleTooltip'))).toHaveLength(3); // wrapInButton isn't known here
  });

  it('lets an input line replace the file entry for that wrapper', () => {
    const file = withFile({ aliases: { AccessibleTooltip: { as: 'Tooltip', except: ['tooltip-no-disabled-child'] } } });
    const config = resolveConfig({ ...file, aliases: 'AccessibleTooltip: Popover\nLabelInput: Input' });
    expect(config.aliases).toEqual({ AccessibleTooltip: { as: 'Popover' }, LabelInput: { as: 'Input' } });
  });

  it('records which aliases the scanned files use, for the unused-alias warning', () => {
    const { linter } = lint(REPRO, { aliases: 'AccessibleTooltip: Tooltip\nAccesibleTooltip: Tooltip\nUI.Tip: Tooltip' });
    expect([...linter.usedAliases]).toEqual(['AccessibleTooltip']);
  });

  it('fails clearly on a bad alias', () => {
    expect(() => parseAliasesInput('AccessibleTooltip Tooltip')).toThrow(/WrapperName: AntdComponent/);
    expect(() => parseAliasesInput('accessibleTooltip: Tooltip')).toThrow(/not a component name/);
    expect(() => resolveConfig({ ...withFile({ aliases: { T: { as: 'Tooltip', only: ['typo'] } } }) })).toThrow(
      /\.github\/antd-a11y\.json: aliases\.T\.only: unknown rule "typo"/,
    );
    expect(() => resolveConfig({ ...withFile({ aliases: { T: { as: 'Tooltip', satisfies: { 'popup-trigger-focusable': 'a b' } } } }) })).toThrow(
      /expected "prop", "!prop" or "prop:string"/,
    );
  });
});
