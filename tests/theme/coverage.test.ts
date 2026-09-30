// Every colour token antd derives, global or per component, must be checked in at least one pair or
// be listed in not-pairs.ts with a reason. A new antd release that adds tokens fails here until each
// new token is placed.
import { createRequire } from 'node:module';
import { parseColor } from '../../src/theme/color.js';
import { notPairFor, NOT_PAIRS } from '../../src/theme/not-pairs.js';
import { PAIRS, pairsFor } from '../../src/theme/pairs.js';
import { deriveTheme, loadAntdFrom } from '../../src/theme/tokens.js';

const require = createRequire(import.meta.url);
const isColor = (v: unknown) => typeof v === 'string' && !!parseColor(v);

for (const major of [5, 6]) {
  describe(`antd ${major}`, () => {
    const antd = loadAntdFrom(require.resolve(major === 5 ? 'antd-v5/package.json' : 'antd/package.json'));
    const derived = deriveTheme(antd, {});
    const pairs = pairsFor(major);

    // Which tokens the pairs reference, as "Component.token" for component tokens and "token" for global ones.
    const used = new Set<string>();
    for (const p of pairs) {
      const own = derived.componentOwn(p.component);
      for (const token of [p.fg, ...p.bg]) used.add(token in own ? `${p.component}.${token}` : token);
    }

    it('every global colour token is in a pair or documented as not one', () => {
      const missing = Object.entries(derived.global)
        .filter(([name, value]) => isColor(value) && !used.has(name) && !notPairFor(name))
        .map(([name]) => name);
      expect(missing).toEqual([]);
    });

    it('every component colour token is in a pair or documented as not one', () => {
      const missing: string[] = [];
      for (const component of antd.components.keys()) {
        for (const [name, value] of Object.entries(derived.componentOwn(component))) {
          if (isColor(value) && !used.has(`${component}.${name}`) && !notPairFor(name, component)) missing.push(`${component}.${name}`);
        }
      }
      expect(missing).toEqual([]);
    });

    it('every token a pair names exists', () => {
      const unknown: string[] = [];
      for (const p of pairs) {
        const tokens = derived.component(p.component);
        for (const token of [p.fg, ...p.bg]) if (!isColor(tokens[token])) unknown.push(`${p.id}: ${token}`);
      }
      expect(unknown).toEqual([]);
    });
  });
}

it('pair ids are unique', () => {
  const ids = PAIRS.map((p) => p.id);
  expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
});

it('every not-pair entry has a reason', () => {
  for (const entry of NOT_PAIRS) expect(entry.reason.length).toBeGreaterThan(10);
});
