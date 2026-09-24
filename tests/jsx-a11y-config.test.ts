import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  configWarnings,
  overridesNote,
  parseComponentsInput,
  parseRulesInput,
  resolveConfig,
  type ConfigInputs,
} from '../src/config.js';
import { A11yLinter } from '../src/lint.js';
import { buildRuntimeResult, type PageResult } from '../src/runtime/report.js';
import type { ScanResult } from '../src/types.js';

const workspace = mkdtempSync(path.join(os.tmpdir(), 'a11y-config-'));

function lint(code: string, inputs: Partial<ConfigInputs> = {}) {
  const config = resolveConfig({ workspace, ...inputs });
  const result: ScanResult = { findings: [], filesScanned: 0, parseErrors: [], suppressed: 0, rules: new Map() };
  new A11yLinter({ config, failOn: 'serious' }).lintSource('a.tsx', code, result);
  expect(result.parseErrors).toEqual([]);
  return result.findings;
}
const ids = (code: string, inputs?: Partial<ConfigInputs>) => lint(code, inputs).map((f) => f.ruleId);

function withFile(json: unknown): Partial<ConfigInputs> {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'a11y-cfg-'));
  mkdirSync(path.join(dir, '.github'));
  writeFileSync(path.join(dir, '.github/antd-a11y.json'), typeof json === 'string' ? json : JSON.stringify(json));
  return { workspace: dir, configFile: '.github/antd-a11y.json' };
}

describe('tuned jsx-a11y defaults (beta feedback 1 and 3)', () => {
  it('runs control-has-associated-label on native controls', () => {
    expect(ids('const A = () => <button><svg /></button>;')).toContain('jsx-a11y/control-has-associated-label');
    expect(ids('const A = () => <button>Save</button>;')).toEqual([]);
  });

  it('does not run no-autofocus', () => {
    expect(ids('const A = () => <input aria-label="Email" autoFocus />;')).toEqual([]);
  });

  it('allows role="list" on ul/ol but still flags other redundant roles', () => {
    expect(ids('const A = () => <ul role="list"><li>a</li></ul>;')).toEqual([]);
    expect(ids('const A = () => <ol role="list"><li>a</li></ol>;')).toEqual([]);
    expect(ids('const A = () => <button role="button">Save</button>;')).toEqual(['jsx-a11y/no-redundant-roles']);
  });
});

describe('components map (beta feedback 2)', () => {
  it('maps FontAwesomeIcon to svg by default, so an icon-only button is caught', () => {
    expect(ids('const A = () => <button><FontAwesomeIcon icon={faTrash} /></button>;')).toContain(
      'jsx-a11y/control-has-associated-label',
    );
  });

  it('accepts a titled icon as the name, since FontAwesome renders title as <title>', () => {
    expect(ids('const A = () => <button><FontAwesomeIcon icon={x} title="Delete" /></button>;')).toEqual([]);
    expect(ids('const A = () => <button><span><FontAwesomeIcon icon={x} title={t("delete")} /></span></button>;')).toEqual([]);
    // Near misses: an empty title, and an unmapped component.
    expect(ids('const A = () => <button><FontAwesomeIcon icon={x} title="" /></button>;')).toContain(
      'jsx-a11y/control-has-associated-label',
    );
    expect(ids('const A = () => <button><Glyph title="Delete" /></button>;', { components: 'Glyph: span' })).toContain(
      'jsx-a11y/control-has-associated-label',
    );
  });

  it('checks wrapper components the user maps', () => {
    const code = 'const A = () => <Btn icon={<Icon />} />;';
    expect(ids(code)).toEqual([]);
    expect(ids(code, { components: 'Btn: button' })).toContain('jsx-a11y/control-has-associated-label');
  });

  it('keeps only the antd finding when a user maps antd Button to button', () => {
    const code = "import { Button } from 'antd';\nconst A = () => <Button icon={<svg />} />;";
    expect(ids(code, { components: 'Button: button' })).toEqual(['antd-a11y/icon-button-has-name']);
  });
});

describe('false-positive filters (beta feedback 4, 6, 7)', () => {
  it('sees through spreads that may supply role and tabIndex (dnd-kit useSortable)', () => {
    expect(ids('const A = () => <div {...attributes} {...listeners} onClick={f}>x</div>;')).toEqual([]);
    expect(ids('const A = () => <li {...attributes} onKeyDown={f}>x</li>;')).toEqual([]);
    // Near miss: without the spread it still fires.
    expect(ids('const A = () => <div onClick={f}>x</div>;')).toEqual([
      'jsx-a11y/click-events-have-key-events',
      'jsx-a11y/no-static-element-interactions',
    ]);
  });

  it('accepts keyboard handlers on roles whose pattern needs them, not mouse handlers', () => {
    expect(ids('const A = () => <div role="dialog" aria-label="Edit" onKeyDown={onEscape}>x</div>;')).toEqual([]);
    expect(ids('const A = () => <div role="group" onKeyDown={f}>x</div>;')).toEqual([]);
    expect(ids('const A = () => <div role="group" onClick={f} onKeyDown={f}>x</div>;')).toContain(
      'jsx-a11y/no-noninteractive-element-interactions',
    );
  });

  it('treats a conditional interactive role as possibly interactive', () => {
    expect(
      ids("const A = () => <img alt=\"x\" role={c ? 'button' : undefined} tabIndex={c ? 0 : undefined} onClick={f} onKeyDown={f} />;"),
    ).toEqual([]);
    // Near miss: no interactive branch.
    expect(ids("const A = () => <img alt=\"x\" role={c ? 'presentation' : undefined} onClick={f} onKeyDown={f} />;")).toContain(
      'jsx-a11y/no-noninteractive-element-interactions',
    );
  });

  it('keeps filters on under the strict preset, where the order-dependent report happened', () => {
    const code = "const A = () => <div role={c ? 'button' : undefined} tabIndex={c ? 0 : undefined} onClick={f} onKeyDown={f} />;";
    expect(ids(code, { jsxA11y: 'strict' })).toEqual([]);
    expect(ids('const A = () => <span tabIndex={0}>x</span>;', { jsxA11y: 'strict' })).toContain(
      'jsx-a11y/no-noninteractive-tabindex',
    );
  });
});

describe('configuration (C and C2)', () => {
  it('parses the rules and components inputs', () => {
    const rules = parseRulesInput('jsx-a11y/no-autofocus: error\npicker-has-name: warn # backlog\n\naxe/color-contrast: off');
    expect([...rules].map(([id, o]) => `${id}=${o.severity}`)).toEqual([
      'jsx-a11y/no-autofocus=error',
      'antd-a11y/picker-has-name=warn',
      'axe/color-contrast=off',
    ]);
    expect(parseComponentsInput('Icon: svg\nUI.Link: a')).toEqual({ Icon: 'svg', 'UI.Link': 'a' });
    expect(() => parseRulesInput('jsx-a11y/not-a-rule: error')).toThrow(ConfigError);
    expect(() => parseRulesInput('jsx-a11y/alt-text: loud')).toThrow(/off, warn or error/);
    expect(() => parseComponentsInput('icon svg')).toThrow(/Name: tag/);
  });

  it('turns a rule off, and back on with options from the config file', () => {
    expect(ids('const A = () => <img src="x" />;', { rules: 'jsx-a11y/alt-text: off' })).toEqual([]);
    const file = withFile({ rules: { 'jsx-a11y/no-autofocus': ['error', { ignoreNonDOM: true }] } });
    expect(ids('const A = () => <input aria-label="e" autoFocus />;', file)).toEqual(['jsx-a11y/no-autofocus']);
    expect(ids('const A = () => <Dropdown autoFocus menu={m}><button>x</button></Dropdown>;', file)).toEqual([]);
  });

  it('applies warn and error to blocking', () => {
    const img = 'const A = () => <img src="x" />;'; // alt-text is critical
    expect(lint(img)[0].blocking).toBe(true);
    expect(lint(img, { rules: 'jsx-a11y/alt-text: warn' })[0].blocking).toBe(false);
    const heading = 'const A = () => <h1 />;'; // heading-has-content is moderate
    expect(lint(heading)[0].blocking).toBe(false);
    expect(lint(heading, { rules: 'jsx-a11y/heading-has-content: error' })[0].blocking).toBe(true);
  });

  it('lets inputs override the file, and keeps file options when an input only changes severity', () => {
    const file = withFile({ jsxA11y: 'false', rules: { 'jsx-a11y/no-autofocus': ['warn', { ignoreNonDOM: true }] } });
    const config = resolveConfig({ ...file, workspace: file.workspace!, jsxA11y: 'recommended', rules: 'jsx-a11y/no-autofocus: error' });
    expect(config.jsxA11y).toBe('recommended');
    expect(config.rules.get('jsx-a11y/no-autofocus')).toEqual({ severity: 'error', options: [{ ignoreNonDOM: true }], source: 'input' });
    expect(config.file).toBe('.github/antd-a11y.json');
  });

  it('merges settings from the file with the default components', () => {
    const file = withFile({ settings: { components: { Icon: 'svg' }, polymorphicPropName: 'as' } });
    const config = resolveConfig({ ...file, workspace: file.workspace! });
    expect(config.settings).toEqual({ components: { FontAwesomeIcon: 'svg', Icon: 'svg' }, polymorphicPropName: 'as' });
    expect(ids('const A = () => <Box as="img" src="x" />;', { ...file, components: 'Box: div' })).toContain('jsx-a11y/alt-text');
  });

  it('fails clearly on bad config instead of silently disabling rules', () => {
    expect(() => resolveConfig(withFile('{ nope') as ConfigInputs)).toThrow(/not valid JSON/);
    expect(() => resolveConfig(withFile({ rule: {} }) as ConfigInputs)).toThrow(/unknown key "rule"/);
    expect(() => resolveConfig(withFile({ rules: { 'jsx-a11y/typo': 'off' } }) as ConfigInputs)).toThrow(/unknown rule/);
    expect(() => resolveConfig(withFile({ rules: { 'axe/region': ['warn', {}] } }) as ConfigInputs)).toThrow(/takes no options/);
    const badOptions = resolveConfig(withFile({ rules: { 'jsx-a11y/no-autofocus': ['error', { ignoreNonDOM: 'yes' }] } }) as ConfigInputs);
    expect(() => new A11yLinter({ config: badOptions, failOn: 'serious' })).toThrow(/Invalid rule configuration: .*no-autofocus.*should be boolean/);
    expect(() => resolveConfig({ workspace, jsxA11y: 'loose' })).toThrow(/recommended, strict or false/);
  });

  it('warns when every antd rule is off and notes overrides for reviewers', () => {
    const allOff = [
      'icon-button-has-name', 'picker-has-name', 'form-control-has-name', 'form-item-has-label', 'modal-has-title',
      'table-column-has-title', 'image-has-alt', 'tooltip-no-disabled-child', 'popup-trigger-focusable', 'auth-input-autocomplete',
    ].map((r) => `${r}: off`).join('\n');
    const config = resolveConfig({ workspace, rules: allOff });
    expect(configWarnings(config)).toHaveLength(1);
    expect(overridesNote(config, ['antd-a11y/', 'jsx-a11y/'])).toBe('10 rules overridden (inputs): 10 off');
    expect(overridesNote(resolveConfig({ workspace }), ['antd-a11y/'])).toBeUndefined();
  });

  it('applies runtime overrides: off drops findings, warn stops blocking', () => {
    const page: PageResult = {
      route: '/',
      status: 200,
      guard: null,
      runtime: [],
      axe: [
        { id: 'color-contrast', impact: 'serious', help: 'contrast', tags: ['wcag143'], targets: ['.a'] },
        { id: 'region', impact: 'moderate', help: 'region', targets: ['body'] },
        { id: 'image-alt', impact: 'critical', help: 'alt', targets: ['img'] },
      ],
    };
    const rules = parseRulesInput('axe/region: off\naxe/color-contrast: warn');
    const result = buildRuntimeResult([page], { failOn: 'serious', cwd: workspace, workspace, rules });
    expect(result.findings.map((f) => `${f.ruleId}:${f.blocking}`)).toEqual(['axe/image-alt:true', 'axe/color-contrast:false']);
  });
});
