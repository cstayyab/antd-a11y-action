import { discoverInFile } from '../../src/theme/discover.js';

const discover = (code: string) => discoverInFile('src/App.tsx', code);

describe('discoverInFile', () => {
  it('reads a literal ConfigProvider theme, with where each token is set', () => {
    const { themes, skipped } = discover(`
import { ConfigProvider, theme } from 'antd';
export const App = () => (
  <ConfigProvider
    theme={{
      algorithm: theme.darkAlgorithm,
      token: { colorPrimary: '#00b96b', borderRadius: 4 },
      components: { Button: { primaryColor: '#000', algorithm: true } },
    }}
  >
    <div />
  </ConfigProvider>
);`);
    expect(skipped).toEqual([]);
    expect(themes).toHaveLength(1);
    expect(themes[0].name).toBe('src/App.tsx:4 (dark)');
    expect(themes[0].input).toEqual({
      algorithm: 'darkAlgorithm',
      token: { colorPrimary: '#00b96b', borderRadius: 4 },
      components: { Button: { primaryColor: '#000', algorithm: true } },
    });
    expect(themes[0].locations.get('token.colorPrimary')?.line).toBe(7);
    expect(themes[0].locations.get('components.Button.primaryColor')?.line).toBe(8);
  });

  it('resolves constants and destructured algorithms, and audits each branch of a conditional', () => {
    const { themes, skipped } = discover(`
import { ConfigProvider, theme } from 'antd';
const { darkAlgorithm, defaultAlgorithm } = theme;
const brand = { colorPrimary: '#722ed1' };
const base = { token: { ...brand, colorLink: '#531dab' } };
export function App({ dark }: { dark: boolean }) {
  return <ConfigProvider theme={{ ...base, algorithm: dark ? darkAlgorithm : defaultAlgorithm }} />;
}`);
    expect(skipped).toEqual([]);
    expect(themes.map((t) => t.name)).toEqual(['src/App.tsx:7 (dark)', 'src/App.tsx:7 (light)']);
    expect(themes[0].input.token).toEqual({ colorPrimary: '#722ed1', colorLink: '#531dab' });
    expect(themes[1].input.algorithm).toBe('defaultAlgorithm');
  });

  it('merges nested providers, unless the inner one sets inherit: false', () => {
    const { themes } = discover(`
import { ConfigProvider } from 'antd';
export const App = () => (
  <ConfigProvider theme={{ token: { colorPrimary: '#f00' }, components: { Button: { primaryColor: '#fff' } } }}>
    <ConfigProvider theme={{ token: { colorText: '#111' }, components: { Button: { defaultColor: '#222' } } }} />
    <ConfigProvider theme={{ inherit: false, token: { colorText: '#333' } }} />
  </ConfigProvider>
);`);
    expect(themes).toHaveLength(3);
    expect(themes[1].input).toEqual({
      token: { colorPrimary: '#f00', colorText: '#111' },
      components: { Button: { primaryColor: '#fff', defaultColor: '#222' } },
    });
    expect(themes[2].input).toEqual({ token: { colorText: '#333' }, inherit: false });
  });

  it('finds ThemeConfig objects that no provider in the file uses', () => {
    const { themes } = discover(`
import type { ThemeConfig } from 'antd';
export const light: ThemeConfig = { token: { colorPrimary: '#1677ff' } };
export default { token: { colorPrimary: '#000' } } satisfies ThemeConfig;`);
    expect(themes.map((t) => [t.line, t.input.token?.colorPrimary])).toEqual([
      [3, '#1677ff'],
      [4, '#000'],
    ]);
  });

  it('audits a ThemeConfig constant once when a provider uses it', () => {
    const { themes } = discover(`
import { ConfigProvider, type ThemeConfig } from 'antd';
const appTheme: ThemeConfig = { token: { colorPrimary: '#1677ff' } };
export const App = () => <ConfigProvider theme={appTheme} />;`);
    expect(themes).toHaveLength(1);
    expect(themes[0].line).toBe(4);
  });

  it.each([
    ["import { appTheme } from './theme';", 'theme={appTheme}', '`appTheme` is not a constant defined in this file'],
    ['', 'theme={makeTheme()}', 'Call expression at line 3 needs code to run'],
    ['', "theme={{ token: { colorPrimary: `${'#'}fff` } }}", 'a template string with ${…} at line 3'],
    ['', 'theme={{ algorithm: myAlgorithm }}', '`myAlgorithm` is not a constant defined in this file'],
  ])('skips a theme it cannot evaluate: %s %s', (imports, prop, reason) => {
    const { themes, skipped } = discover(`import { ConfigProvider } from 'antd'; ${imports}
export const App = () =>
  <ConfigProvider ${prop} />;`);
    expect(themes).toEqual([]);
    expect(skipped).toEqual([{ file: 'src/App.tsx', line: 3, reason }]);
  });

  it('ignores files without antd themes', () => {
    expect(discover(`import { Button } from 'antd'; export const A = () => <Button />;`)).toEqual({ themes: [], skipped: [] });
    expect(discover(`const ConfigProvider = () => null; export const A = () => <ConfigProvider theme={{}} />;`)).toEqual({ themes: [], skipped: [] });
  });
});
