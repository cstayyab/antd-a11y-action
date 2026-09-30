// The render check's page: renders one scene inside a ConfigProvider with the given theme. Bundled
// by harness.ts once per antd major (antd resolves to antd-v5 for 5).
import { ConfigProvider, theme as antdTheme } from 'antd';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { scenes } from './scenes';

type Named = 'defaultAlgorithm' | 'darkAlgorithm' | 'compactAlgorithm';
interface ThemeJson {
  token?: Record<string, unknown>;
  algorithm?: Named | Named[];
  components?: Record<string, Record<string, unknown> & { algorithm?: boolean | Named | Named[] }>;
}

const algo = (a: Named | Named[]) => (Array.isArray(a) ? a.map((n) => antdTheme[n]) : antdTheme[a]);

let root: Root | undefined;

declare global {
  interface Window {
    renderScene(scene: string, theme: ThemeJson): string[];
  }
}

window.renderScene = (scene, theme) => {
  const make = scenes[scene];
  if (!make) throw new Error(`Unknown scene ${scene}`);
  const components = Object.fromEntries(
    Object.entries(theme.components ?? {}).map(([name, value]) => {
      const { algorithm, ...rest } = value;
      return [name, algorithm === undefined || algorithm === true || algorithm === false ? { ...rest, ...(algorithm === undefined ? {} : { algorithm }) } : { ...rest, algorithm: algo(algorithm) }];
    }),
  );
  root?.unmount();
  const container = document.getElementById('root')!;
  container.innerHTML = '';
  root = createRoot(container);
  flushSync(() => {
    root!.render(
      <ConfigProvider
        theme={{ token: { ...theme.token, motion: false }, algorithm: theme.algorithm ? algo(theme.algorithm) : undefined, components }}
        wave={{ disabled: true }}
      >
        <div id="scene" style={{ padding: 16 }}>{make()}</div>
      </ConfigProvider>,
    );
  });
  return Object.keys(scenes);
};
