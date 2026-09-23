import rule from '../../src/rules/form-control-has-name.js';
import { run, withImports as w } from '../rule-tester.js';

const error = { messageId: 'missing' };
const weak = { messageId: 'placeholderOnly' };

run('form-control-has-name', rule, {
  valid: [
    w(`<Input aria-label="Search" />`),
    w(`<Input id="email" />`),
    w(`<Form.Item label="Email" name="email"><Input /></Form.Item>`),
    w(`<Form.Item label={t('email')}><Input.Password /></Form.Item>`),
    w(`<Checkbox>Remember me</Checkbox>`),
    w(`<Checkbox children="Remember me" />`),
    w(`<Radio value="a">A</Radio>`),
    w(`<Switch checkedChildren="On" unCheckedChildren="Off" />`),
    w(`<Slider ariaLabelForHandle="Volume" />`),
    w(`<InputNumber {...props} />`),
    w(`const { TextArea } = Input; <TextArea aria-label="Notes" />`),
    w(`<Form.Item name="agree" valuePropName="checked"><Checkbox>I agree</Checkbox></Form.Item>`),
    // Owned by form-item-has-label
    w(`<Form.Item name="email"><Input /></Form.Item>`),
    `import { Input } from '@mui/material'; <Input />`,
  ],
  invalid: [
    { code: w(`<Input placeholder="Search" />`), errors: [weak] },
    { code: w(`<Input />`), errors: [error] },
    { code: w(`<Input.Password />`), errors: [error] },
    { code: w(`const { TextArea } = Input; <TextArea rows={4} />`), errors: [error] },
    { code: w(`<InputNumber min={0} />`), errors: [error] },
    { code: w(`<Switch />`), errors: [error] },
    { code: w(`<Slider />`), errors: [error] },
    { code: w(`<Checkbox checked={x} onChange={f} />`), errors: [error] },
    { code: w(`<Radio />`), errors: [error] },
    { code: w(`<Form.Item><Input /></Form.Item>`), errors: [error] },
    { code: w(`<Form.Item name="q" noStyle><Input /></Form.Item>`), errors: [error] },
    { code: `import { Input as AntInput } from 'antd'; <AntInput.Search />`, errors: [error] },
  ],
});
