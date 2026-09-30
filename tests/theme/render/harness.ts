// Renders scenes in Chromium with a "fingerprint" theme: every colour token gets its own unique
// colour, so an element's computed colour names the exact token it came from, not just a token that
// happens to share its value.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Browser, CDPSession, Page } from 'playwright-core';
import { parseColor } from '../../../src/theme/color.js';
import type { LoadedAntd, ThemeInput } from '../../../src/theme/tokens.js';
import { deriveTheme } from '../../../src/theme/tokens.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

export async function bundlePage(major: number): Promise<string> {
  const result = await build({
    entryPoints: [path.join(here, 'page.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: major === 5 ? { antd: 'antd-v5', '@ant-design/icons': '@ant-design/icons-v5' } : {},
    nodePaths: [path.join(root, 'node_modules')],
    logLevel: 'error',
  });
  return result.outputFiles![0].text;
}

export async function launch(): Promise<Browser> {
  // Playwright is a dependency of the runtime sub-action, installed by `npm ci --prefix runtime`.
  const { chromium } = createRequire(path.join(root, 'runtime/package.json'))('playwright-core') as typeof import('playwright-core');
  return chromium.launch();
}

export type Pseudo = 'hover' | 'active' | 'focus' | 'focus-visible' | 'focus-within';

export interface Harness {
  page: Page;
  cdp: CDPSession;
  render(scene: string, theme: ThemeInput): Promise<void>;
  /** Forces pseudo-classes on every element matching `selector`; returns how many matched. */
  force(selector: string, states: Pseudo[]): Promise<number>;
}

export async function openHarness(browser: Browser, script: string): Promise<Harness> {
  const page = await browser.newPage({ viewport: { width: 1200, height: 2400 } });
  await page.setContent(
    '<!doctype html><html><head><style>*,*::before,*::after{transition:none!important;animation:none!important}</style></head><body><div id="root"></div></body></html>',
  );
  await page.addScriptTag({ content: script });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  return {
    page,
    cdp,
    async render(scene, theme) {
      await page.evaluate(([s, t]) => window.renderScene(s as string, t as never), [scene, theme] as const);
    },
    async force(selector, states) {
      const { root: doc } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: doc.nodeId, selector });
      for (const nodeId of nodeIds) await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: states });
      return nodeIds.length;
    },
  };
}

/** Distinct opaque colours; channels stay 16 apart so no two collide after rounding. */
function uniqueColor(i: number): string {
  const c = (n: number) => 8 + (n % 15) * 16;
  return `rgb(${c(i)}, ${c(Math.floor(i / 15))}, ${c(Math.floor(i / 225))})`;
}

export interface Fingerprint {
  theme: ThemeInput;
  /** Computed "rgb(r, g, b)" → token ("colorText", or "Button.primaryColor"). */
  tokenFor: Map<string, string>;
  colorFor: Map<string, string>;
}

/** Every colour token, global and per component, set to a unique colour. */
export function fingerprint(antd: LoadedAntd, base: ThemeInput = {}): Fingerprint {
  const derived = deriveTheme(antd, base);
  const tokenFor = new Map<string, string>();
  const colorFor = new Map<string, string>();
  let i = 1;
  const assign = (name: string) => {
    const color = uniqueColor(i++);
    tokenFor.set(color, name);
    colorFor.set(name, color);
    return color;
  };
  const token: Record<string, unknown> = { ...base.token };
  for (const [name, value] of Object.entries(derived.global)) {
    if (typeof value === 'string' && parseColor(value) && !/^(colorTextBase|colorBgBase)$/.test(name)) token[name] = assign(name);
  }
  const components: NonNullable<ThemeInput['components']> = {};
  for (const name of antd.components.keys()) {
    const own = derived.componentOwn(name);
    const overrides: Record<string, unknown> = { ...base.components?.[name] };
    for (const [key, value] of Object.entries(own)) {
      if (typeof value === 'string' && parseColor(value)) overrides[key] = assign(`${name}.${key}`);
    }
    if (Object.keys(overrides).length) components[name] = overrides;
  }
  return { theme: { ...base, token, components }, tokenFor, colorFor };
}

export interface Probe {
  path: string;
  text: string;
  color: string;
  background: string;
  border: string;
  outline: string;
  fill: string;
}

/** Colours of every element under body, for mapping back to tokens. */
export async function probeAll(page: Page): Promise<Probe[]> {
  return page.evaluate(() => {
    const out: Probe[] = [];
    const label = (el: Element) => {
      const parts: string[] = [];
      for (let e: Element | null = el; e && e !== document.body && parts.length < 3; e = e.parentElement) {
        const cls = [...e.classList].filter((c) => !/^css-|^ant-.*-css-var$/.test(c)).slice(0, 3).join('.');
        parts.unshift(`${e.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`);
      }
      return parts.join(' > ');
    };
    for (const el of document.body.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      const border = s.borderTopStyle !== 'none' && parseFloat(s.borderTopWidth) > 0 ? s.borderTopColor : '';
      const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 ? s.outlineColor : '';
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').trim();
      out.push({
        path: label(el),
        text: own.slice(0, 20),
        color: s.color,
        background: s.backgroundColor,
        border,
        outline,
        fill: el instanceof SVGElement ? s.fill : '',
      });
    }
    return out;
  });
}
