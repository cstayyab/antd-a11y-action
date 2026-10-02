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
    // antd hides its own close button for closeIcon={null} / {false}
    w(`<Modal open title="T" closeIcon={null} onCancel={close} footer={null}><Button onClick={close}>Close</Button></Modal>`),
    w(`<Modal open title="T" closeIcon={false} footer={null}><Button>Close</Button></Modal>`),
    // a dynamic closable can't be told
    w(`<Modal open title="T" closable={canClose} footer={null}><Button>Close</Button></Modal>`),
    // actions that start with "Close" but don't close the dialog
    w(`<Modal open title="Settings" onCancel={close}><Button danger onClick={closeAccount}>Close account</Button></Modal>`),
    w(`<Modal open title="Tickets" onCancel={close}><Button aria-label="Close ticket #4" onClick={closeTicket} /></Modal>`),
    // a form's own Cancel / Done row in the body is not a second X
    w(`<Modal open title="Edit" onCancel={close} footer={null}><form><Button onClick={close}>Cancel</Button><Button htmlType="submit">Save</Button></form></Modal>`),
    w(`<Modal open title="Settings" onCancel={close}><Button onClick={close}>Done</Button></Modal>`),
    w(`<Modal open title="Settings" onCancel={close}><Button onClick={close}>{t('done')}</Button></Modal>`),
    // a nested dialog's close button belongs to that dialog
    w(`<Modal open title="Outer" onCancel={a}><Modal open title="Inner" closable={false}><Button>Close</Button></Modal></Modal>`),
    // a Drawer named by its own aria-labelledby doesn't take its name from the title
    w(`<Drawer open aria-labelledby="h" title={<>Filters <Button>Reset</Button></>} />`),
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
    // an icon-only control with the same handler as onCancel
    { code: w(`<Modal open title="Settings" onCancel={close}><Button type="text" onClick={close} /></Modal>`), errors: [duplicateClose] },
    { code: w(`<Modal open title="Settings" closable={{ 'aria-label': 'Close settings' }}><Button>Close</Button></Modal>`), errors: [duplicateClose] },
    { code: w(`<Modal open title="Settings"><Button>×</Button></Modal>`), errors: [duplicateClose] },
    { code: w(`<Modal open title="Settings"><Button>Close</Button></Modal>`), errors: [duplicateClose] },
    { code: w(`<Modal open title="Settings"><button type="button" aria-label="Close dialog" /></Modal>`), errors: [duplicateClose] },
    { code: w(`<Modal open title="Settings"><div className="top"><Button icon={<CloseOutlined />} /></div></Modal>`), errors: [duplicateClose] },
  ],
});
