import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from '../../src/config.js';
import { filterFiles, walk } from '../../src/files.js';
import { renderThemeSection } from '../../src/report/theme.js';
import { runThemeAudit } from '../../src/theme/index.js';
import { loadThemeModule } from '../../src/theme/module.js';

const workspace = path.resolve(fileURLToPath(import.meta.url), '../../..');
const dir = 'fixtures/app';

async function run(extra: { rules?: string; changed?: string[]; inherited?: string; themeConfig?: string } = {}) {
  const files = filterFiles(await walk(workspace, dir), dir, ['**/*.{ts,tsx}'], []);
  const config = resolveConfig({ workspace, rules: extra.rules, themeConfig: extra.themeConfig });
  if (extra.inherited) config.theme.inherited = extra.inherited as 'warn';
  return runThemeAudit({ workspace, dir, files, config, failOn: 'serious', changed: extra.changed && new Set(extra.changed) });
}

describe('runThemeAudit on fixtures/app', () => {
  it('audits each configuration it can read and reports the one it cannot', async () => {
    const result = await run();
    expect(result.configurations.map((c) => c.name)).toEqual([
      'fixtures/app/src/theme/ThemedApp.tsx:10 (dark)',
      'fixtures/app/src/theme/ThemedApp.tsx:10 (light)',
    ]);
    expect(result.skipped).toEqual([
      { file: 'fixtures/app/src/theme/RuntimeTheme.tsx', line: 8, reason: 'Call expression at line 8 needs code to run' },
      { file: 'fixtures/app/src/theme/brand.ts', line: 6, reason: 'Call expression at line 6 needs code to run' },
      { file: 'fixtures/app/src/theme/brand.ts', line: 7, reason: 'Call expression at line 7 needs code to run' },
    ]);
    // The brand colour is the team's: blocking. antd's own defaults are warnings.
    const light = result.configurations[1];
    expect(light.blocking).toBeGreaterThan(0);
    expect(result.findings.filter((f) => f.theme?.inherited).every((f) => !f.blocking)).toBe(true);
    const primary = result.findings.find((f) => f.theme?.configuration === light.name && f.theme.pairIds.includes('button.primary'))!;
    expect(primary).toMatchObject({ ruleId: 'theme/text-contrast', blocking: true, file: 'fixtures/app/src/theme/ThemedApp.tsx', line: 6 });
    // The placeholder override fixes antd's default failure.
    expect(result.details.some((d) => d.configuration === light.name && d.fg.token === 'colorTextPlaceholder')).toBe(false);
    const markdown = renderThemeSection(result);
    expect(markdown).toContain('### Theme contrast');
    expect(markdown).toContain('Call expression at line 8 needs code to run');
  });

  it('applies rule severities and theme.inherited', async () => {
    const off = await run({ rules: 'theme/non-text-contrast: off' });
    expect(off.findings.some((f) => f.ruleId === 'theme/non-text-contrast')).toBe(false);
    const warn = await run({ rules: 'theme/text-contrast: warn' });
    expect(warn.findings.filter((f) => f.ruleId === 'theme/text-contrast').every((f) => !f.blocking)).toBe(true);
    const inherited = await run({ inherited: 'error' });
    expect(inherited.findings.filter((f) => f.theme?.inherited).every((f) => f.blocking)).toBe(true);
    const hidden = await run({ inherited: 'off' });
    expect(hidden.findings.some((f) => f.theme?.inherited)).toBe(false);
  });

  it('skips the audit when a pull request changes nothing that affects the theme', async () => {
    const skipped = await run({ changed: ['fixtures/app/src/bad/Orders.tsx'] });
    expect(skipped.unchanged).toBe(true);
    expect(skipped.findings).toEqual([]);
    const audited = await run({ changed: ['fixtures/app/src/theme/ThemedApp.tsx'] });
    expect(audited.unchanged).toBeUndefined();
    const bumped = await run({ changed: ['fixtures/app/package.json'] });
    expect(bumped.findings.length).toBeGreaterThan(0);
  });
});

describe('theme-config', () => {
  it('evaluates the module in a separate process and audits each named theme', async () => {
    const configs = await loadThemeModule('fixtures/app/src/theme/brand.ts', workspace);
    expect(configs.map((c) => c.name)).toEqual(['fixtures/app/src/theme/brand.ts (light)', 'fixtures/app/src/theme/brand.ts (dark)']);
    expect(configs[1].input).toEqual({ token: { colorPrimary: '#faad14', borderRadius: 4 }, algorithm: 'darkAlgorithm' });
    const named = await loadThemeModule('fixtures/app/src/theme/brand.ts#dark', workspace);
    expect(named.map((c) => c.name)).toEqual(['fixtures/app/src/theme/brand.ts#dark']);
  }, 30_000);

  it('does not pass the token or other environment to the module', async () => {
    process.env.ANTD_A11Y_SENTINEL = 'secret';
    try {
      const [config] = await loadThemeModule('tests/theme/fixtures/env-theme.mjs', workspace);
      expect(config.input.token?.colorPrimary).toBe('#1677ff');
    } finally {
      delete process.env.ANTD_A11Y_SENTINEL;
    }
  }, 30_000);

  it('audits the module instead of discovering themes when theme-config is set', async () => {
    const result = await run({ themeConfig: 'fixtures/app/src/theme/brand.ts' });
    expect(result.configurations.map((c) => c.name)).toEqual(['fixtures/app/src/theme/brand.ts (light)', 'fixtures/app/src/theme/brand.ts (dark)']);
    expect(result.skipped).toEqual([]);
  }, 30_000);

  it.each([
    ['../outside.ts', 'must be inside the repository'],
    ['fixtures/app/src/theme/missing.ts', 'does not exist'],
    ['fixtures/app/src/theme/brand.ts#nope', 'exports no theme'],
  ])('rejects %s', async (spec, message) => {
    await expect(loadThemeModule(spec, workspace)).rejects.toThrow(message);
  }, 30_000);
});
