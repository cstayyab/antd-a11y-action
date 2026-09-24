import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { configWarnings, parseAliasesInput, resolveConfig, type ConfigInputs } from '../src/config.js';
import { A11yLinter } from '../src/lint.js';
import type { ScanResult } from '../src/types.js';

const workspace = mkdtempSync(path.join(os.tmpdir(), 'a11y-aliases-'));

function withFile(json: unknown): Pick<ConfigInputs, 'workspace' | 'configFile'> {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'a11y-aliases-cfg-'));
  mkdirSync(path.join(dir, '.github'));
  writeFileSync(path.join(dir, '.github/antd-a11y.json'), JSON.stringify(json));
  return { workspace: dir, configFile: '.github/antd-a11y.json' };
}

// Direct antd usage next to in-house wrappers, imported the way an app would.
const REPRO = `import { Tooltip, Button, Input } from 'antd';
import HintTooltip from '@/components/HintTooltip';
import TextField from '@/components/TextField';

export const A = () => (
  <>
    <Tooltip title="why disabled"><Button disabled aria-label="Add" /></Tooltip>
    <HintTooltip title="why disabled"><Button disabled aria-label="Add" /></HintTooltip>
    <Tooltip title="info"><span>plain</span></Tooltip>
    <HintTooltip title="info"><span>plain</span></HintTooltip>
    <HintTooltip title="info" asButton><span>plain</span></HintTooltip>
    <Input />
    <TextField />
    <TextField label="Email" />
    <TextField label={<b>Email</b>} />
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
  it('reports only direct antd usage without aliases, which is why wrappers need aliases', () => {
    expect(lint(REPRO, {}).found).toEqual([
      '<Tooltip title="why disabled"><Button disabled aria-label="Add" /></Tooltip> → antd-a11y/tooltip-no-disabled-child',
      '<Tooltip title="info"><span>plain</span></Tooltip> → antd-a11y/popup-trigger-focusable',
      '<Input /> → antd-a11y/form-control-has-name',
    ]);
  });

  it('checks wrappers per rule, with prop conditions, from the config file', () => {
    const file = withFile({
      aliases: {
        HintTooltip: { as: 'Tooltip', satisfies: { 'popup-trigger-focusable': 'asButton' } },
        TextField: { as: 'Input', satisfies: { 'form-control-has-name': 'label:string' } },
      },
    });
    expect(lint(REPRO, file).found).toEqual([
      '<Tooltip title="why disabled"><Button disabled aria-label="Add" /></Tooltip> → antd-a11y/tooltip-no-disabled-child',
      '<HintTooltip title="why disabled"><Button disabled aria-label="Add" /></HintTooltip> → antd-a11y/tooltip-no-disabled-child',
      '<Tooltip title="info"><span>plain</span></Tooltip> → antd-a11y/popup-trigger-focusable',
      '<HintTooltip title="info"><span>plain</span></HintTooltip> → antd-a11y/popup-trigger-focusable',
      '<Input /> → antd-a11y/form-control-has-name',
      '<TextField /> → antd-a11y/form-control-has-name',
      '<TextField label={<b>Email</b>} /> → antd-a11y/form-control-has-name',
    ]);
  });

  it('applies the simple form from the input to every rule', () => {
    const { found } = lint(REPRO, { aliases: 'HintTooltip: Tooltip' });
    expect(found.filter((f) => f.startsWith('<HintTooltip'))).toHaveLength(3); // asButton isn't known here
  });

  it('lets an input line replace the file entry for that wrapper', () => {
    const file = withFile({ aliases: { HintTooltip: { as: 'Tooltip', except: ['tooltip-no-disabled-child'] } } });
    const config = resolveConfig({ ...file, aliases: 'HintTooltip: Popover\nTextField: Input' });
    expect(config.aliases).toEqual({ HintTooltip: { as: 'Popover' }, TextField: { as: 'Input' } });
  });

  it('records which aliases the scanned files use, for the unused-alias warning', () => {
    const { linter } = lint(REPRO, { aliases: 'HintTooltip: Tooltip\nHintTooltp: Tooltip\nUI.Tip: Tooltip' });
    expect([...linter.usedAliases]).toEqual(['HintTooltip']);
  });

  it('fails clearly on a bad alias', () => {
    expect(() => parseAliasesInput('HintTooltip Tooltip')).toThrow(/WrapperName: AntdComponent/);
    expect(() => parseAliasesInput('hintTooltip: Tooltip')).toThrow(/not a component name/);
    expect(() => resolveConfig({ ...withFile({ aliases: { T: { as: 'Tooltip', only: ['typo'] } } }) })).toThrow(
      /\.github\/antd-a11y\.json: aliases\.T\.only: unknown rule "typo"/,
    );
    expect(() => resolveConfig({ ...withFile({ aliases: { T: { as: 'Tooltip', satisfies: { 'popup-trigger-focusable': 'a b' } } } }) })).toThrow(
      /expected "prop", "!prop", "prop:string" or a list of them/,
    );
  });

  it('warns about a naming condition given to one naming rule but not its siblings', () => {
    const file = withFile({ aliases: { TextField: { as: 'Input', satisfies: { 'form-control-has-name': 'label:string' } } } });
    expect(configWarnings(resolveConfig(file))).toEqual([
      expect.stringContaining('Alias "TextField" names its control for form-control-has-name but not form-item-has-label'),
    ]);
    const fixed = withFile({ aliases: { TextField: { as: 'Input', name: 'label:string' } } });
    expect(configWarnings(resolveConfig(fixed))).toEqual([]);
  });
});
