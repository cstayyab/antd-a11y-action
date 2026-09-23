import { DatePicker, Form, Input, Select, Switch } from 'antd';

// form-item-has-label, picker-has-name, form-control-has-name, auth-input-autocomplete
export function SignupForm() {
  return (
    <Form layout="vertical">
      <Form.Item name="email">
        <Input type="email" />
      </Form.Item>
      <Form.Item label="Password" name="password">
        <Input.Password autoComplete="off" onPaste={(e) => e.preventDefault()} />
      </Form.Item>
      <Select placeholder="Country" options={[{ value: 'pk', label: 'Pakistan' }]} />
      <DatePicker />
      <Input placeholder="Referral code" />
      <Switch />
    </Form>
  );
}
