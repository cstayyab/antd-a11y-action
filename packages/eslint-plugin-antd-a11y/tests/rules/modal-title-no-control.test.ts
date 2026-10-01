import rule from '../../src/rules/modal-title-no-control.js';
import { run } from '../rule-tester.js';

const control = { messageId: 'control' };
const duplicateClose = { messageId: 'duplicateClose' };

const IMPORTS = `import { Button, Checkbox, Drawer, Modal, Tag, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
`;
const w = (code: string): string => IMPORTS + code;

run('modal-title-no-control', rule, {
  valid: [
    w(`<Modal open title="Edit order" onCancel={close}><Button>Save</Button></Modal>`),
    w(`<Modal open title={<><Tag>Draft</Tag> Invoice</>} />`),
    w(`<Drawer open title="Filters" extra={<Button>Reset</Button>} />`),
    // the app draws its own close button and turns antd's off
    w(`<Modal open title="Settings" closable={false} footer={null}><Button onClick={close}>Close</Button></Modal>`),
    // a control in the body that is not a close control
    w(`<Modal open title="Panel" onCancel={close}><Button onClick={collapse}>Collapse section</Button></Modal>`),
    // footer buttons are antd's normal Cancel / OK slot
    w(`<Modal open title="Delete" onCancel={close} footer={<Button onClick={close}>Close</Button>} />`),
    // a spread may set closable
    w(`<Modal {...props} title="Settings"><Button onClick={close}>Close</Button></Modal>`),
    // Drawer is not checked for a second close button
    w(`<Drawer open title="Filters" onClose={close}><Button onClick={close}>Close</Button></Drawer>`),
    `import { Modal } from 'other'; <Modal title={<button>x</button>} />`,
  ],
  invalid: [
    {
      code: w(`<Modal open closable={false} title={<>Edit order <Button aria-label="Help">?</Button></>} />`),
      errors: [control],
    },
    { code: w(`<Drawer open title={<Checkbox>Select all</Checkbox>} />`), errors: [control] },
    { code: w(`<Modal open closable={false} title={<span>Edit <a href="/help">help</a></span>} />`), errors: [control] },
    {
      code: w(`<Modal open onCancel={close} title={<>Edit order <Button icon={<CloseOutlined />} aria-label="Close" onClick={close} /></>} />`),
      errors: [control, duplicateClose],
    },
    { code: w(`<Modal open title="Settings" onCancel={close}><Button onClick={close}>Done</Button></Modal>`), errors: [duplicateClose] },
    { code: w(`<Modal open title="Settings"><Button>Close</Button></Modal>`), errors: [duplicateClose] },
    { code: w(`<Modal open title="Settings"><button type="button" aria-label="Close dialog" /></Modal>`), errors: [duplicateClose] },
    { code: w(`<Modal open title="Settings"><div className="top"><Button icon={<CloseOutlined />} /></div></Modal>`), errors: [duplicateClose] },
  ],
});
