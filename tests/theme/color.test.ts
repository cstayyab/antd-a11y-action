import { createRequire } from 'node:module';
import { composite, contrast, formatRatio, parseColor, suggestColor, toHex } from '../../src/theme/color.js';
import { deriveTheme, loadAntdFrom } from '../../src/theme/tokens.js';

describe('parseColor', () => {
  it.each([
    ['#fff', { r: 255, g: 255, b: 255, a: 1 }],
    ['#1677ffcc', { r: 22, g: 119, b: 255, a: 0.8 }],
    ['rgba(0, 0, 0, 0.88)', { r: 0, g: 0, b: 0, a: 0.88 }],
    ['rgb(0 0 0 / 50%)', { r: 0, g: 0, b: 0, a: 0.5 }],
    ['white', { r: 255, g: 255, b: 255, a: 1 }],
    ['transparent', { r: 0, g: 0, b: 0, a: 0 }],
  ])('%s', (input, expected) => {
    const c = parseColor(input)!;
    expect({ ...c, a: Math.round(c.a * 100) / 100 }).toEqual(expected);
  });

  it('parses hsl()', () => {
    expect(toHex(parseColor('hsl(210, 50%, 40%)')!)).toBe('#336699');
  });

  it.each(['var(--x)', 'bogus', 'linear-gradient(red, blue)', '#12'])('rejects %s', (input) => {
    expect(parseColor(input)).toBeUndefined();
  });
});

describe('contrast', () => {
  it('matches WCAG for black on white', () => {
    expect(contrast(parseColor('#000')!, parseColor('#fff')!)).toBeCloseTo(21, 5);
  });

  it('composites a translucent foreground first', () => {
    const fg = parseColor('rgba(0, 0, 0, 0.5)')!;
    const flat = composite(fg, parseColor('#fff')!);
    expect(contrast(fg, parseColor('#fff')!)).toBeCloseTo(contrast(flat, parseColor('#fff')!), 10);
  });

  it('never rounds a failing ratio up to the threshold', () => {
    expect(formatRatio(4.4999)).toBe('4.49');
  });
});

describe('suggestColor', () => {
  it('keeps the hue and reaches the target with the smallest change', () => {
    const bg = parseColor('#fff')!;
    const fg = parseColor('#1677ff')!;
    const suggestion = suggestColor(fg, bg, 4.5)!;
    expect(contrast(suggestion, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(suggestion, bg)).toBeLessThan(4.7);
  });

  it('lightens on a dark background', () => {
    const bg = parseColor('#141414')!;
    const suggestion = suggestColor(parseColor('#1668dc')!, bg, 4.5)!;
    expect(contrast(suggestion, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

// The default-theme measurements in issue #2, reproduced from the derived tokens. Ratios are
// truncated to two decimals, as the report shows them.
describe.each([
  ['antd-v5', 5],
  ['antd', 6],
])('antd %s default theme', (pkg) => {
  const antd = loadAntdFrom(createRequire(import.meta.url).resolve(`${pkg}/package.json`));
  const ratio = (algorithm: 'defaultAlgorithm' | 'darkAlgorithm', fg: string, bg = 'colorBgContainer') => {
    const t = deriveTheme(antd, { algorithm }).global;
    return formatRatio(contrast(parseColor(t[fg] as string)!, parseColor(t[bg] as string)!));
  };
  it.each([
    ['colorText', '16.55', '13.40'],
    ['colorTextSecondary', '6.97', '8.18'],
    ['colorTextTertiary', '3.35', '4.52'],
    ['colorTextPlaceholder', '1.83', '2.24'],
    ['colorLink', '4.10', '3.55'],
    ['colorErrorText', '3.26', '4.34'],
    ['colorWarningText', '1.90', '7.27'],
    ['colorSuccessText', '2.26', '6.18'],
    ['colorBorder', '1.41', '1.83'],
  ])('%s: light %s, dark %s', (token, light, dark) => {
    expect(ratio('defaultAlgorithm', token)).toBe(light);
    expect(ratio('darkAlgorithm', token)).toBe(dark);
  });
  it('white on colorPrimary: light 4.10, dark 5.18', () => {
    expect(ratio('defaultAlgorithm', 'colorTextLightSolid', 'colorPrimary')).toBe('4.10');
    expect(ratio('darkAlgorithm', 'colorTextLightSolid', 'colorPrimary')).toBe('5.18');
  });
});
