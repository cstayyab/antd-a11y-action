// Renders every pair in Chromium with a fingerprint theme (each colour token a unique colour) and
// checks the element's computed colour comes from exactly the token the pair names. A change in how
// antd styles a component then fails here instead of silently skewing the audit.
import { createRequire } from 'node:module';
import type { Browser } from 'playwright-core';
import { pairsFor, type Pair, type StyleProp } from '../../src/theme/pairs.js';
import { deriveTheme, loadAntdFrom, type LoadedAntd } from '../../src/theme/tokens.js';
import { bundlePage, fingerprint, launch, openHarness, type Fingerprint, type Harness } from './render/harness.js';

const require = createRequire(import.meta.url);

async function readProp(h: Harness, selector: string, prop: StyleProp, pseudo?: string): Promise<string> {
  return h.page.evaluate(
    ([sel, p, ps]) => {
      const el = document.querySelector(sel);
      if (!el) return `nothing matches ${sel}`;
      const s = getComputedStyle(el, ps || null);
      if (p === 'color') return s.color;
      if (p === 'fill') return s.fill;
      if (p === 'background') return s.backgroundColor;
      for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
        if (s[`border${side}Style`] !== 'none' && parseFloat(s[`border${side}Width`]) > 0) return s[`border${side}Color`];
      }
      return `no border on ${sel}`;
    },
    [selector, prop, pseudo ?? ''] as const,
  );
}

const normalize = (c: string) => c.replace(/^rgba\((\d+), (\d+), (\d+), 1\)$/, 'rgb($1, $2, $3)');

for (const major of [5, 6]) {
  describe(`antd ${major}`, () => {
    let antd: LoadedAntd;
    let fp: Fingerprint;
    let browser: Browser;
    let h: Harness;
    let own: (component: string, token: string) => boolean;

    beforeAll(async () => {
      antd = loadAntdFrom(require.resolve(major === 5 ? 'antd-v5/package.json' : 'antd/package.json'));
      fp = fingerprint(antd);
      const derived = deriveTheme(antd, {});
      own = (component, token) => token in derived.componentOwn(component);
      browser = await launch();
      h = await openHarness(browser, await bundlePage(major));
    }, 60_000);
    afterAll(async () => {
      await browser?.close();
    });

    const expectToken = async (pair: Pair, selector: string, prop: StyleProp, token: string, pseudo?: string) => {
      const name = own(pair.component, token) ? `${pair.component}.${token}` : token;
      const actual = normalize(await readProp(h, selector, prop, pseudo));
      const actualToken = fp.tokenFor.get(actual) ?? (actual.startsWith('rgb') ? `unmapped ${actual}` : actual);
      expect(actualToken, `${pair.id}: ${prop} of ${selector}${pseudo ?? ''}`).toBe(name);
    };

    const pairs = pairsFor(major).filter((p) => p.render);
    it.each(pairs.map((p) => [p.id, p] as const))('%s', async (_id, pair) => {
      const { v5, ...base } = pair.render!;
      const r = major === 5 ? { ...base, ...v5 } : base;
      await h.render(r.scene, fp.theme);
      if (r.force) {
        const on = r.on ?? r.bg ?? r.fg;
        expect(await h.force(on, [r.force].flat()), `nothing matches ${on}`).toBeGreaterThan(0);
      }
      await expectToken(pair, r.fg, r.fgProp ?? 'color', pair.fg, r.fgPseudo);
      if (r.bg) await expectToken(pair, r.bg, r.bgProp ?? 'background', pair.bg.at(-1)!);
    });
  });
}
