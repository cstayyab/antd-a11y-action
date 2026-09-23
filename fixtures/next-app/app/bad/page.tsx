'use client';

// Deliberate violations, rendered on the client so the guard sees them.
import { Button, Modal } from 'antd';
import { useEffect, useState } from 'react';

export default function Bad() {
  // antd portals only exist in the browser; open after mount to avoid a hydration mismatch.
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(true), []);
  return (
    <>
      <h1>Bad page</h1>
      <Button icon={<svg viewBox="0 0 16 16" width="16" height="16" />} />
      <div onClick={() => undefined}>Click me</div>
      <img src="/missing.png" width={16} height={16} />
      <Modal open={open} footer={null}>
        Are you sure?
      </Modal>
    </>
  );
}
