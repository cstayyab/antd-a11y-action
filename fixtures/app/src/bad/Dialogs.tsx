import { App, Button, Drawer, Modal } from 'antd';
import { CloseOutlined, InfoCircleOutlined } from '@ant-design/icons';

// modal-has-title (dropped, emptyTitle x3, imperative x2)
// modal-title-no-control (control, duplicateClose)
export function Dialogs({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { modal } = App.useApp();
  const removeInvoice = () => Modal.confirm({ content: 'Delete this invoice?' });
  const showSaved = () => modal.info({ title: null, content: 'Profile saved.' });
  return (
    <>
      <Modal open={open} aria-label="Edit profile" onCancel={onClose}>…</Modal>
      <Modal open={open} title={<></>} onCancel={onClose}>
        <h2>Settings</h2>
      </Modal>
      <Modal open={open} title={<InfoCircleOutlined />} onCancel={onClose}>…</Modal>
      <Drawer open={open} title={<></>} onClose={onClose}>…</Drawer>
      <Modal
        open={open}
        onCancel={onClose}
        title={
          <>
            Edit order <Button type="text" icon={<CloseOutlined />} aria-label="Close" onClick={onClose} />
          </>
        }
      >
        …
      </Modal>
      <Button onClick={removeInvoice}>Delete</Button>
      <Button onClick={showSaved}>Save</Button>
    </>
  );
}
