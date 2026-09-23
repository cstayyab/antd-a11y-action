import rule from '../../src/rules/form-item-has-label.js';
import { run, withImports as w } from '../rule-tester.js';

const error = { messageId: 'missing' };

run('form-item-has-label', rule, {
  valid: [
    w(`<Form.Item name="email" label="Email"><Input /></Form.Item>`),
    w(`<Form.Item name="email"><Input aria-label="Email" /></Form.Item>`),
    w(`<Form.Item name="agree" valuePropName="checked"><Checkbox>I agree</Checkbox></Form.Item>`),
    w(`<Form.Item name="id" hidden><Input /></Form.Item>`),
    w(`<Form.Item label="Phone"><Form.Item name="phone" noStyle><Input /></Form.Item></Form.Item>`),
    w(`<Form.Item name="x" noStyle><Input /></Form.Item>`),
    w(`<Form.Item name="email" {...itemProps}><Input /></Form.Item>`),
    // Custom control: may label itself
    w(`<Form.Item name="address"><AddressField /></Form.Item>`),
    w(`<Form.Item name="email">{(ctl) => <Input {...ctl} />}</Form.Item>`),
    // Submit row
    w(`<Form.Item><Button htmlType="submit">Save</Button></Form.Item>`),
    `import { Form } from 'formik'; <Form.Item name="x"><input /></Form.Item>`,
  ],
  invalid: [
    { code: w(`<Form.Item name="email"><Input /></Form.Item>`), errors: [{ ...error, data: { field: 'email' } }] },
    { code: w(`<Form.Item name={['user', 'city']} rules={r}><Select /></Form.Item>`), errors: [error] },
    { code: w(`<Form.Item name="notes" label=""><Input.TextArea /></Form.Item>`), errors: [error] },
    { code: w(`<Form.Item name="dob"><DatePicker /></Form.Item>`), errors: [error] },
    { code: w(`<Form.Item name="raw"><input /></Form.Item>`), errors: [error] },
    { code: `import { Form, Input } from 'antd'; const { Item } = Form; <Item name="q"><Input /></Item>`, errors: [error] },
  ],
});
