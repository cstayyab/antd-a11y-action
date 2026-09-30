// CSS colour parsing, alpha compositing and WCAG 2.2 contrast. antd tokens are hex or rgba(), but a
// team's seed tokens can be any CSS colour, so named colours and hsl() are accepted too.

export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0–1 */
  a: number;
}

// CSS Color 4 named colours.
const NAMED: Record<string, string> = {
  aliceblue: 'f0f8ff', antiquewhite: 'faebd7', aqua: '00ffff', aquamarine: '7fffd4', azure: 'f0ffff',
  beige: 'f5f5dc', bisque: 'ffe4c4', black: '000000', blanchedalmond: 'ffebcd', blue: '0000ff',
  blueviolet: '8a2be2', brown: 'a52a2a', burlywood: 'deb887', cadetblue: '5f9ea0', chartreuse: '7fff00',
  chocolate: 'd2691e', coral: 'ff7f50', cornflowerblue: '6495ed', cornsilk: 'fff8dc', crimson: 'dc143c',
  cyan: '00ffff', darkblue: '00008b', darkcyan: '008b8b', darkgoldenrod: 'b8860b', darkgray: 'a9a9a9',
  darkgreen: '006400', darkgrey: 'a9a9a9', darkkhaki: 'bdb76b', darkmagenta: '8b008b', darkolivegreen: '556b2f',
  darkorange: 'ff8c00', darkorchid: '9932cc', darkred: '8b0000', darksalmon: 'e9967a', darkseagreen: '8fbc8f',
  darkslateblue: '483d8b', darkslategray: '2f4f4f', darkslategrey: '2f4f4f', darkturquoise: '00ced1',
  darkviolet: '9400d3', deeppink: 'ff1493', deepskyblue: '00bfff', dimgray: '696969', dimgrey: '696969',
  dodgerblue: '1e90ff', firebrick: 'b22222', floralwhite: 'fffaf0', forestgreen: '228b22', fuchsia: 'ff00ff',
  gainsboro: 'dcdcdc', ghostwhite: 'f8f8ff', gold: 'ffd700', goldenrod: 'daa520', gray: '808080',
  green: '008000', greenyellow: 'adff2f', grey: '808080', honeydew: 'f0fff0', hotpink: 'ff69b4',
  indianred: 'cd5c5c', indigo: '4b0082', ivory: 'fffff0', khaki: 'f0e68c', lavender: 'e6e6fa',
  lavenderblush: 'fff0f5', lawngreen: '7cfc00', lemonchiffon: 'fffacd', lightblue: 'add8e6', lightcoral: 'f08080',
  lightcyan: 'e0ffff', lightgoldenrodyellow: 'fafad2', lightgray: 'd3d3d3', lightgreen: '90ee90',
  lightgrey: 'd3d3d3', lightpink: 'ffb6c1', lightsalmon: 'ffa07a', lightseagreen: '20b2aa', lightskyblue: '87cefa',
  lightslategray: '778899', lightslategrey: '778899', lightsteelblue: 'b0c4de', lightyellow: 'ffffe0',
  lime: '00ff00', limegreen: '32cd32', linen: 'faf0e6', magenta: 'ff00ff', maroon: '800000',
  mediumaquamarine: '66cdaa', mediumblue: '0000cd', mediumorchid: 'ba55d3', mediumpurple: '9370db',
  mediumseagreen: '3cb371', mediumslateblue: '7b68ee', mediumspringgreen: '00fa9a', mediumturquoise: '48d1cc',
  mediumvioletred: 'c71585', midnightblue: '191970', mintcream: 'f5fffa', mistyrose: 'ffe4e1', moccasin: 'ffe4b5',
  navajowhite: 'ffdead', navy: '000080', oldlace: 'fdf5e6', olive: '808000', olivedrab: '6b8e23',
  orange: 'ffa500', orangered: 'ff4500', orchid: 'da70d6', palegoldenrod: 'eee8aa', palegreen: '98fb98',
  paleturquoise: 'afeeee', palevioletred: 'db7093', papayawhip: 'ffefd5', peachpuff: 'ffdab9', peru: 'cd853f',
  pink: 'ffc0cb', plum: 'dda0dd', powderblue: 'b0e0e6', purple: '800080', rebeccapurple: '663399',
  red: 'ff0000', rosybrown: 'bc8f8f', royalblue: '4169e1', saddlebrown: '8b4513', salmon: 'fa8072',
  sandybrown: 'f4a460', seagreen: '2e8b57', seashell: 'fff5ee', sienna: 'a0522d', silver: 'c0c0c0',
  skyblue: '87ceeb', slateblue: '6a5acd', slategray: '708090', slategrey: '708090', snow: 'fffafa',
  springgreen: '00ff7f', steelblue: '4682b4', tan: 'd2b48c', teal: '008080', thistle: 'd8bfd8',
  tomato: 'ff6347', turquoise: '40e0d0', violet: 'ee82ee', wheat: 'f5deb3', white: 'ffffff',
  whitesmoke: 'f5f5f5', yellow: 'ffff00', yellowgreen: '9acd32',
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function channel(part: string, scale: number): number {
  const p = part.trim();
  return p.endsWith('%') ? (parseFloat(p) / 100) * scale : parseFloat(p);
}

function alpha(part: string | undefined): number {
  if (part === undefined) return 1;
  const p = part.trim();
  return clamp(p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p), 0, 1);
}

/** "a, b, c / d" or "a b c / d" or "a, b, c, d" → [a, b, c, d?] */
function args(body: string): string[] {
  const [main, slash] = body.split('/');
  const parts = main.includes(',') ? main.split(',') : main.trim().split(/\s+/);
  if (slash !== undefined) parts.push(slash);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** Parses a CSS colour; undefined when it isn't one this module understands (var(), gradients, keywords). */
export function parseColor(input: string): Rgba | undefined {
  const value = input.trim().toLowerCase();
  if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const hex = NAMED[value] ?? (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value)?.[1]);
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
    };
  }
  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(value);
  if (!fn) return undefined;
  const parts = args(fn[2]);
  if (parts.length < 3 || parts.length > 4) return undefined;
  let rgb: [number, number, number];
  if (fn[1].startsWith('rgb')) {
    rgb = [channel(parts[0], 255), channel(parts[1], 255), channel(parts[2], 255)];
  } else {
    const h = parseFloat(parts[0].replace(/deg$/, ''));
    rgb = hslToRgb(((h % 360) + 360) % 360, channel(parts[1], 1) / (parts[1].endsWith('%') ? 1 : 100), channel(parts[2], 1) / (parts[2].endsWith('%') ? 1 : 100));
  }
  const a = alpha(parts[3]);
  if ([...rgb, a].some((n) => Number.isNaN(n))) return undefined;
  const [r, g, b] = rgb.map((c) => clamp(c, 0, 255));
  return { r, g, b, a };
}

/** Paints `top` over `bottom` (source-over). */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
}

/** Composites a stack of layers, bottom first, onto an opaque base. */
export function flatten(layers: readonly Rgba[]): Rgba {
  return layers.reduce((acc, layer) => composite(layer, acc), { r: 255, g: 255, b: 255, a: 1 });
}

function linear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an opaque colour. */
export function luminance({ r, g, b }: Rgba): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio of `fg` painted over the opaque `bg`. */
export function contrast(fg: Rgba, bg: Rgba): number {
  const top = composite(fg, { ...bg, a: 1 });
  const [hi, lo] = [luminance(top), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Truncated to two decimals, so a ratio just under a threshold never displays as passing. */
export function formatRatio(ratio: number): string {
  return (Math.floor(ratio * 100) / 100).toFixed(2);
}

export function toHex({ r, g, b, a }: Rgba): string {
  const h = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}${a < 1 ? h(a * 255) : ''}`;
}

function rgbToHsl({ r, g, b }: Rgba): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s, l];
}

/**
 * The nearest colour to `fg` with the same hue and saturation that reaches `target` over `bg`: its
 * lightness moves towards black or white, whichever direction can pass, by the smallest step. A
 * translucent colour keeps its alpha when that can still pass, else it becomes opaque.
 */
export function suggestColor(fg: Rgba, bg: Rgba, target: number): Rgba | undefined {
  const [h, s, l0] = rgbToHsl(fg);
  const make = (l: number, a: number): Rgba => {
    const [r, g, b] = hslToRgb(h, s, l);
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a };
  };
  const passes = (c: Rgba) => contrast(c, bg) >= target;
  for (const a of fg.a < 1 ? [fg.a, 1] : [1]) {
    let best: Rgba | undefined;
    for (const end of [0, 1]) {
      if (!passes(make(end, a))) continue;
      // Binary search for the lightness closest to the original that still passes.
      let [pass, fail] = [end, l0];
      for (let i = 0; i < 24; i += 1) {
        const mid = (pass + fail) / 2;
        if (passes(make(mid, a))) pass = mid;
        else fail = mid;
      }
      const candidate = make(pass, a);
      // Rounding to 8-bit channels can land just under the threshold; step on until it passes.
      let l = pass;
      let c = candidate;
      while (!passes(c) && l !== end) {
        l = end === 0 ? Math.max(0, l - 0.002) : Math.min(1, l + 0.002);
        c = make(l, a);
      }
      if (!best || Math.abs(l - l0) < Math.abs(rgbToHsl(best)[2] - l0)) best = c;
    }
    if (best) return best;
  }
  return undefined;
}
