// Theme audit fixture: a brand colour too light for white button labels, and a Menu override
// whose selected text is too pale. The dark branch is audited as its own configuration.
import type { ReactNode } from 'react';
import { ConfigProvider, theme } from 'antd';

const brand = { colorPrimary: '#faad14' };

export function ThemedApp({ dark, children }: { dark: boolean; children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { ...brand, colorTextPlaceholder: '#737373' },
        components: { Menu: { itemSelectedColor: '#91caff' } },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
