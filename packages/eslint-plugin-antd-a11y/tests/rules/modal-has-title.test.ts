import rule from '../../src/rules/modal-has-title.js';
import { run, withImports as w } from '../rule-tester.js';

const missing = { messageId: 'missing' };
const dropped = { messageId: 'dropped' };
const emptyTitle = { messageId: 'emptyTitle' };
const imperative = { messageId: 'imperative' };

const APP = `import { App, Modal, Tag, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
`;
const a = (code: string): string => APP + code;

run('modal-has-title', rule, {
  valid: [
    w(`<Modal open title="Delete item" />`),
    w(`<Modal open title={t('x')} />`),
    w(`<Drawer open title="Filters" />`),
    w(`<Modal {...modalProps} />`),
    `import Modal from 'react-modal'; <Modal isOpen />`,
    // rc-drawer forwards aria-* to role="dialog"
    w(`<Drawer open aria-label="Filters" />`),
    w(`<Drawer open aria-labelledby="filters-heading" />`),
    // JSX titles with text, or that may render text
    a(`<Modal open title={<><Tag>Draft</Tag> Invoice 1042</>} />`),
    a(`<Modal open title={<Typography.Title level={3}>Invoice</Typography.Title>} />`),
    a(`<Modal open title={<span className="sr-only">Settings</span>} />`),
    a(`<Modal open title={<>{heading}</>} />`),
    a(`<Modal open title={<InfoCircleOutlined aria-label="Details" />} />`),
    a(`<Modal open title={<HeadingFromElsewhere />} />`),
    a(`<Modal open title={heading} />`),
    a(`const heading = <h2>Settings</h2>; <Modal open title={heading} />`),
    // a fragment in a const isn't followed, so the rule can't tell
    a(`const blank = <></>; <Modal open title={blank} />`),
    // the imperative API with a title, or one we can't read
    a(`Modal.confirm({ title: 'Delete this invoice?', content: 'You cannot undo this.' })`),
    a(`Modal.info({ title: t('saved') })`),
    a(`Modal.confirm({ ...base, content: 'x' })`),
    a(`Modal.confirm(options)`),
    a(`function C() { const { modal } = App.useApp(); modal.info({ title: 'Profile saved' }); }`),
    a(`function C() { const [modal, holder] = Modal.useModal(); modal.confirm({ title }); }`),
    // not antd's Modal API
    `import { Modal } from 'other'; Modal.confirm({ content: 'x' })`,
    a(`notification.info({ content: 'x' })`),
    a(`function C() { const modal = useMyModal(); modal.confirm({ content: 'x' }); }`),
  ],
  invalid: [
    { code: w(`<Modal open onOk={f}>Are you sure?</Modal>`), errors: [missing] },
    { code: w(`<Modal open title="" />`), errors: [missing] },
    { code: w(`<Modal open title={null} footer={null} />`), errors: [missing] },
    { code: w(`<Drawer open />`), errors: [missing] },
    { code: `import { Modal as Dialog } from 'antd'; <Dialog open />`, errors: [missing] },
    // antd drops aria-* on Modal
    { code: w(`<Modal open aria-label="Edit profile" />`), errors: [dropped] },
    { code: w(`<Modal open aria-labelledby="h" />`), errors: [dropped] },
    // a title that renders no text
    { code: a(`<Modal open title={<></>}><h2>Settings</h2></Modal>`), errors: [emptyTitle] },
    { code: a(`<Modal open title={<InfoCircleOutlined />} />`), errors: [emptyTitle] },
    { code: a(`<Modal open title={<span className="dot" />} />`), errors: [emptyTitle] },
    { code: a(`<Modal open title={<span aria-hidden="true">Settings</span>} />`), errors: [emptyTitle] },
    { code: w(`<Drawer open title={<></>} />`), errors: [emptyTitle] },
    // the imperative API
    { code: a(`Modal.confirm({ content: 'Delete this invoice?' })`), errors: [imperative] },
    { code: a(`Modal.warning()`), errors: [imperative] },
    { code: a(`Modal.info({ title: null, content: 'Saved' })`), errors: [imperative] },
    { code: a(`Modal.error({ title: '', content: 'Failed' })`), errors: [imperative] },
    { code: a(`Modal.success({ title: <></> })`), errors: [imperative] },
    { code: `import * as antd from 'antd'; antd.Modal.confirm({ content: 'x' })`, errors: [imperative] },
    { code: a(`function C() { const { modal } = App.useApp(); modal.info({ content: 'Saved' }); }`), errors: [imperative] },
    { code: a(`function C() { const { modal: dialogs } = App.useApp(); dialogs.warn({}); }`), errors: [imperative] },
    { code: a(`function C() { App.useApp().modal.confirm({ content: 'x' }); }`), errors: [imperative] },
    { code: a(`function C() { const [modal, holder] = Modal.useModal(); modal.confirm({ content: 'x' }); }`), errors: [imperative] },
  ],
});
