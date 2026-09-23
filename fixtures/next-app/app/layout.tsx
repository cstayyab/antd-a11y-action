import type { ReactNode } from 'react';

export const metadata = { title: 'antd A11y Guard fixture' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
