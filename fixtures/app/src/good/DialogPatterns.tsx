import { App, Button, Drawer, Modal, Tag } from 'antd';

// Dialogs whose name reaches role="dialog". Must stay silent.
export function DialogPatterns({ open, onClose, heading }: { open: boolean; onClose: () => void; heading: string }) {
  const { modal } = App.useApp();
  const removeInvoice = () => Modal.confirm({ title: 'Delete this invoice?', content: 'You cannot undo this.' });
  const showSaved = () => modal.info({ title: 'Profile saved' });
  return (
    <>
      <Modal open={open} title="Edit profile" onCancel={onClose}>…</Modal>
      <Modal open={open} title={heading} onCancel={onClose}>…</Modal>
      <Modal open={open} title={<><Tag>Draft</Tag> Invoice 1042</>} onCancel={onClose}>…</Modal>
      <Modal open={open} title={<span className="sr-only">Settings</span>} closable={false} footer={null}>
        <h2>Settings</h2>
        <Button onClick={onClose}>Close</Button>
      </Modal>
      {/* Drawer forwards aria-* to role="dialog" */}
      <Drawer open={open} aria-label="Filters" onClose={onClose}>…</Drawer>
      <Button onClick={removeInvoice}>Delete</Button>
      <Button onClick={showSaved}>Save</Button>
    </>
  );
}
