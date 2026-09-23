import rule from '../../src/rules/modal-has-title.js';
import { run, withImports as w } from '../rule-tester.js';

const error = { messageId: 'missing' };

run('modal-has-title', rule, {
  valid: [
    w(`<Modal open title="Delete item" />`),
    w(`<Modal open title={t('x')} />`),
    w(`<Modal open aria-labelledby="h" />`),
    w(`<Drawer open title="Filters" />`),
    w(`<Modal {...modalProps} />`),
    `import Modal from 'react-modal'; <Modal isOpen />`,
  ],
  invalid: [
    { code: w(`<Modal open onOk={f}>Are you sure?</Modal>`), errors: [error] },
    { code: w(`<Modal open title="" />`), errors: [error] },
    { code: w(`<Modal open title={null} footer={null} />`), errors: [error] },
    { code: w(`<Drawer open />`), errors: [error] },
    { code: `import { Modal as Dialog } from 'antd'; <Dialog open />`, errors: [error] },
  ],
});
