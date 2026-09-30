import { createRequire } from 'node:module';
import { auditConfiguration } from '../../src/theme/audit.js';
import { contrast, parseColor } from '../../src/theme/color.js';
import { loadAntdFrom } from '../../src/theme/tokens.js';

const require = createRequire(import.meta.url);

describe.each([
  ['antd-v5', 5],
  ['antd', 6],
])('%s', (pkg) => {
  const antd = loadAntdFrom(require.resolve(`${pkg}/package.json`));

  it("marks antd's own default-theme failures as inherited", () => {
    const findings = auditConfiguration(antd, { name: 'default', input: {} });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.inherited)).toBe(true);
    const placeholder = findings.find((f) => f.rule === 'placeholder-contrast' && f.fg.token === 'colorTextPlaceholder')!;
    expect(placeholder.ratio).toBeCloseTo(1.83, 1);
    // Disabled controls are exempt.
    expect(findings.some((f) => f.fg.token === 'colorTextDisabled')).toBe(false);
  });

  it("reports a team's own seed change at the line that sets it, with a passing suggestion", () => {
    const findings = auditConfiguration(antd, {
      name: 'brand',
      file: 'src/theme.ts',
      line: 3,
      input: { token: { colorPrimary: '#ffd666' } },
      locations: new Map([['token.colorPrimary', { file: 'src/theme.ts', line: 5, column: 3 }]]),
    });
    const primary = findings.find((f) => f.pairIds.includes('button.primary'))!;
    expect(primary.inherited).toBe(false);
    expect(primary.location).toEqual({ file: 'src/theme.ts', line: 5, column: 3 });
    expect(primary.origin).toContain('token.colorPrimary');
    expect(primary.suggestion).toBeDefined();
    // The suggestion passes when applied.
    const path = primary.suggestion!.path;
    const value = parseColor(primary.suggestion!.value)!;
    const other = path.endsWith('colorPrimary') ? parseColor(primary.fg.color)! : parseColor(primary.bg.color)!;
    expect(contrast(path.endsWith('colorPrimary') ? other : value, path.endsWith('colorPrimary') ? value : other)).toBeGreaterThanOrEqual(primary.required);
  });

  it('groups pairs that fail with the same colours into one finding', () => {
    const findings = auditConfiguration(antd, { name: 'grey', input: { token: { colorText: '#aaaaaa' } } });
    const text = findings.filter((f) => f.fg.token === 'colorText' && f.bg.tokens.join() === 'colorBgContainer');
    expect(text).toHaveLength(1);
    expect(text[0].elements.length).toBeGreaterThan(5);
    expect(text[0].inherited).toBe(false);
  });

  it('a theme that fixes a default failure has no finding for it', () => {
    const findings = auditConfiguration(antd, { name: 'fixed', input: { token: { colorTextPlaceholder: '#595959' } } });
    expect(findings.some((f) => f.fg.token === 'colorTextPlaceholder')).toBe(false);
  });

  it('checks component overrides in their own token map', () => {
    const findings = auditConfiguration(antd, {
      name: 'menu',
      input: { components: { Menu: { itemSelectedColor: '#91caff', itemSelectedBg: '#e6f4ff' } } },
      locations: new Map([['components.Menu.itemSelectedColor', { file: 'src/App.tsx', line: 9, column: 5 }]]),
    });
    const menu = findings.find((f) => f.pairIds.includes('menu.item.selected'))!;
    expect(menu.inherited).toBe(false);
    expect(menu.location?.line).toBe(9);
    expect(menu.suggestion?.path).toMatch(/^components\.Menu\./);
  });

  it('runs the AAA rule only when asked', () => {
    expect(auditConfiguration(antd, { name: 'd', input: {} }).some((f) => f.rule === 'text-contrast-enhanced')).toBe(false);
    expect(auditConfiguration(antd, { name: 'd', input: {} }, { enhanced: true }).some((f) => f.rule === 'text-contrast-enhanced')).toBe(true);
  });

  it('audits the dark algorithm against its own default', () => {
    const findings = auditConfiguration(antd, { name: 'dark', input: { algorithm: 'darkAlgorithm' } });
    expect(findings.every((f) => f.inherited)).toBe(true);
    expect(findings.find((f) => f.elements.includes('Link'))?.ratio).toBeCloseTo(3.55, 1);
  });
});
