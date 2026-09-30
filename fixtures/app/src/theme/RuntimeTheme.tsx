// A theme built at runtime: discovery reports it as skipped instead of guessing.
import type { ReactNode } from 'react';
import { ConfigProvider } from 'antd';

const makeTheme = (seed: string) => ({ token: { colorPrimary: seed } });

export function RuntimeTheme({ seed, children }: { seed: string; children: ReactNode }) {
  return <ConfigProvider theme={makeTheme(seed)}>{children}</ConfigProvider>;
}
