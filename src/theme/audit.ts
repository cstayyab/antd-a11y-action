// Checks every pair in pairs.ts against one theme configuration and turns failures into findings.
import { composite, contrast, formatRatio, parseColor, suggestColor, toHex, type Rgba } from './color.js';
import type { SourceLocation } from './discover.js';
import { pairsFor, type Pair } from './pairs.js';
import { deriveTheme, type AntdRuntime, type DerivedTheme, type ThemeInput, type TokenMap } from './tokens.js';

export type ThemeRule = 'text-contrast' | 'non-text-contrast' | 'placeholder-contrast' | 'text-contrast-enhanced';

export const THEME_RULE_INFO: Record<ThemeRule, { description: string; wcag: string[]; impact: 'serious' | 'moderate' | 'minor' }> = {
  'text-contrast': { description: 'Text colours in the antd theme must contrast 4.5:1 with their background (3:1 for large text)', wcag: ['1.4.3'], impact: 'serious' },
  'non-text-contrast': { description: 'Borders, indicators and icons that identify a control or its state must contrast 3:1', wcag: ['1.4.11'], impact: 'serious' },
  'placeholder-contrast': { description: 'Placeholder text must contrast 4.5:1 with the field background', wcag: ['1.4.3'], impact: 'moderate' },
  'text-contrast-enhanced': { description: 'Text colours must contrast 7:1 (4.5:1 for large text), WCAG AAA', wcag: ['1.4.6'], impact: 'minor' },
};

export interface ThemeConfiguration {
  name: string;
  input: ThemeInput;
  /** Where the theme and its values are defined, when it was read from source. */
  file?: string;
  line?: number;
  locations?: Map<string, SourceLocation>;
}

export interface ThemeFinding {
  configuration: string;
  rule: ThemeRule;
  /** Pairs that fail with these same colours, e.g. "Primary button label (hover)". */
  elements: string[];
  pairIds: string[];
  fg: { token: string; color: string };
  /** Background layers, bottom first, and the colour they composite to. */
  bg: { tokens: string[]; color: string };
  ratio: number;
  required: number;
  /** antd's default theme (same algorithm) is no better, so the team's theme didn't cause it. */
  inherited: boolean;
  /** Where the failing token comes from, e.g. "`colorPrimary` (set in theme)". */
  origin: string;
  /** The smallest same-hue change that passes, on whichever side needs less. */
  suggestion?: { path: string; value: string };
  location?: SourceLocation;
  message: string;
}

export interface AuditOptions {
  /** Runs the AAA rule; off unless configured. */
  enhanced?: boolean;
}

/** Which seed a derived global token follows, to say where to fix it. */
function seedOf(token: string): string | undefined {
  const status = /^(colorPrimary|colorSuccess|colorWarning|colorError|colorInfo|colorLink)/.exec(token)?.[1];
  if (status) return status;
  if (/^controlItemBg|^controlOutline/.test(token)) return 'colorPrimary';
  if (/^(colorText|colorFill|colorIcon)/.test(token)) return 'colorTextBase';
  if (/^(colorBg|colorBorder|colorSplit)/.test(token)) return 'colorBgBase';
  const preset = /^([a-z]+)-?\d+$/.exec(token)?.[1];
  return preset;
}

const LARGE_PX = 24;
const LARGE_BOLD_PX = 18.66;

function resolveColor(tokens: TokenMap, token: string): Rgba | undefined {
  const value = tokens[token];
  return typeof value === 'string' ? parseColor(value) : undefined;
}

function flatten(tokens: TokenMap, global: TokenMap, layers: string[]): Rgba | undefined {
  const colors = layers.map((t) => resolveColor(tokens, t));
  if (colors.some((c) => !c)) return undefined;
  // A translucent bottom layer sits on the container background (itself on white if translucent).
  let base: Rgba = { r: 255, g: 255, b: 255, a: 1 };
  const container = resolveColor(global, 'colorBgContainer');
  if (colors[0]!.a < 1 && container) base = composite(container, base);
  return colors.reduce<Rgba>((acc, c) => composite(c!, acc), base);
}

interface Measured {
  pair: Pair;
  fg: Rgba;
  bg: Rgba;
  ratio: number;
  large: boolean;
}

function measure(pair: Pair, derived: DerivedTheme): Measured | undefined {
  const tokens = derived.component(pair.component);
  const fg = resolveColor(tokens, pair.fg);
  const bg = flatten(tokens, derived.global, pair.bg);
  // A fully transparent foreground draws nothing (e.g. a border set to transparent): nothing to check.
  if (!fg || !bg || fg.a === 0) return undefined;
  const size = pair.fontSize ? Number(tokens[pair.fontSize]) : Number(tokens.fontSize);
  const weight = pair.fontWeight ? Number(tokens[pair.fontWeight]) : 400;
  // WCAG large text: 18pt (24px), or 14pt (18.66px) bold. antd's fontWeightStrong (600) counts as bold.
  const large = size >= LARGE_PX || (size >= LARGE_BOLD_PX && weight >= 600);
  return { pair, fg, bg, ratio: contrast(fg, bg), large };
}

function required(rule: ThemeRule, large: boolean): number {
  if (rule === 'non-text-contrast') return 3;
  if (rule === 'text-contrast-enhanced') return large ? 4.5 : 7;
  if (rule === 'placeholder-contrast') return 4.5;
  return large ? 3 : 4.5;
}

function rulesFor(pair: Pair, options: AuditOptions): ThemeRule[] {
  if (pair.kind === 'non-text') return ['non-text-contrast'];
  if (pair.kind === 'placeholder') return ['placeholder-contrast'];
  return options.enhanced ? ['text-contrast', 'text-contrast-enhanced'] : ['text-contrast'];
}

const STATE_LABEL: Record<string, string> = { default: '', hover: 'hover', active: 'pressed', focus: 'focused', selected: 'selected', checked: 'checked', error: 'error', warning: 'warning', disabled: 'disabled' };

export function auditConfiguration(antd: AntdRuntime, config: ThemeConfiguration, options: AuditOptions = {}): ThemeFinding[] {
  const derived = deriveTheme(antd, config.input);
  const baseline = deriveTheme(antd, { algorithm: config.input.algorithm });
  const groups = new Map<string, ThemeFinding>();

  for (const pair of pairsFor(antd.major)) {
    if (pair.exempt) continue;
    const m = measure(pair, derived);
    if (!m) continue;
    const base = measure(pair, baseline);
    for (const rule of rulesFor(pair, options)) {
      const needed = required(rule, m.large);
      if (m.ratio >= needed) continue;
      const inherited = !!base && base.ratio < needed && m.ratio >= base.ratio - 0.005;
      const ownTokens = derived.componentOwn(pair.component);
      const fgPath = pair.fg in ownTokens ? `components.${pair.component}.${pair.fg}` : `token.${pair.fg}`;
      const bgTop = pair.bg.at(-1)!;
      const bgPath = bgTop in ownTokens ? `components.${pair.component}.${bgTop}` : `token.${bgTop}`;
      // Same colours, same problem and same fix, whichever component shows them.
      const key = [rule, toHex(m.fg), toHex(m.bg), inherited].join('|');
      const state = STATE_LABEL[pair.state];
      const element = state ? `${pair.element} (${state})` : pair.element;
      const existing = groups.get(key);
      if (existing) {
        if (!existing.elements.includes(element)) existing.elements.push(element);
        existing.pairIds.push(pair.id);
        continue;
      }

      const where = (path: string) => config.locations?.get(path);
      const tokens = derived.component(pair.component);
      // Where to fix it: a token the theme sets for either side, else the seed it derives from.
      const sides = [
        { token: pair.fg, path: fgPath, own: pair.fg in ownTokens },
        { token: bgTop, path: bgPath, own: bgTop in ownTokens },
      ].map((side) => {
        // A component token left at its default usually equals a global one: follow that.
        const global = side.own ? sameAsGlobal(derived, tokens[side.token]) : side.token;
        return { ...side, global, seed: global ? seedOf(global) : undefined };
      });
      let origin: string | undefined;
      let location: SourceLocation | undefined;
      for (const side of sides) {
        if (where(side.path)) {
          origin = `\`${side.path}\` (set in the theme)`;
          location = where(side.path);
          break;
        }
      }
      for (const side of origin ? [] : sides) {
        if (side.global && where(`token.${side.global}`)) {
          origin = `\`${side.token}\` follows \`token.${side.global}\` (set in the theme)`;
          location = where(`token.${side.global}`);
          break;
        }
      }
      for (const side of origin ? [] : sides) {
        if (side.seed && where(`token.${side.seed}`)) {
          origin = `\`${side.token}\`, derived from \`token.${side.seed}\``;
          location = where(`token.${side.seed}`);
          break;
        }
      }
      if (!origin) {
        const algos = [config.input.algorithm ?? 'defaultAlgorithm'].flat().join(' + ');
        const fgSide = sides[0];
        origin = fgSide.own
          ? `\`${pair.component}.${pair.fg}\` (antd's default for ${pair.component})`
          : `\`${pair.fg}\` (antd's default${fgSide.seed && fgSide.seed !== pair.fg ? `, derived from \`${fgSide.seed}\`` : ''} by ${algos})`;
      }
      location ??= config.file ? { file: config.file, line: config.line ?? 1, column: 1 } : undefined;

      const suggestion = suggest(m, needed, pair, fgPath, bgPath, derived);
      const message = [
        `${element}: \`${pair.fg}\` ${toHex(m.fg)} on ${pair.bg.length > 1 ? `\`${pair.bg.join('` › `')}\`` : `\`${bgTop}\``} ${toHex(m.bg)} is ${formatRatio(m.ratio)}:1, needs ${needed}:1.`,
        inherited ? 'antd\'s default theme has the same problem.' : '',
        suggestion ? `Suggested: \`${suggestion.path}: '${suggestion.value}'\`.` : '',
      ].filter(Boolean).join(' ');

      groups.set(key, {
        configuration: config.name,
        rule,
        elements: [element],
        pairIds: [pair.id],
        fg: { token: pair.fg, color: toHex(m.fg) },
        bg: { tokens: pair.bg, color: toHex(m.bg) },
        ratio: m.ratio,
        required: needed,
        inherited,
        origin,
        suggestion,
        location,
        message,
      });
    }
  }
  return [...groups.values()];
}

/** The global colour token a component default resolved to, preferring semantic names over palette swatches. */
function sameAsGlobal(derived: DerivedTheme, value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const matches = Object.entries(derived.global).filter(([name, v]) => v === value && name.startsWith('color') && !/^color(TextBase|BgBase|White)$/.test(name));
  return matches.find(([name]) => seedOf(name))?.[0] ?? matches[0]?.[0];
}

/** Adjusts the foreground, or the top background layer when that's the smaller change. */
function suggest(m: Measured, needed: number, pair: Pair, fgPath: string, bgPath: string, derived: DerivedTheme): ThemeFinding['suggestion'] {
  const fgFix = suggestColor(m.fg, m.bg, needed);
  const tokens = derived.component(pair.component);
  const top = resolveColor(tokens, pair.bg.at(-1)!);
  let bgFix: Rgba | undefined;
  if (top && top.a === 1) {
    // Search for a background the foreground passes on: same maths with the roles swapped.
    const fgOnTop = composite(m.fg, top);
    bgFix = suggestColor(top, fgOnTop, needed);
  }
  const delta = (a: Rgba, b: Rgba) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
  if (bgFix && (!fgFix || delta(bgFix, top!) < delta(fgFix, m.fg))) return { path: bgPath, value: toHex(bgFix) };
  return fgFix ? { path: fgPath, value: toHex(fgFix) } : undefined;
}
