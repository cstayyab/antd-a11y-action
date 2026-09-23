'use client';

import { Button } from 'antd';

// Deliberate violation, only reachable when signed in.
export function AccountPanel() {
  return <Button icon={<svg viewBox="0 0 16 16" width="16" height="16" />} />;
}
