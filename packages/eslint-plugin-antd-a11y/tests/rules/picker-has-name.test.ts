import rule from '../../src/rules/picker-has-name.js';
import { run, withImports as w } from '../rule-tester.js';

const error = { messageId: 'missing' };
const weak = { messageId: 'placeholderOnly' };

run('picker-has-name', rule, {
  valid: [
    w(`<Select aria-label="Country" options={opts} />`),
    w(`<Select id="country" options={opts} />`),
    w(`<Select {...rest} />`),
    w(`<Form.Item label="Country" name="country"><Select options={opts} /></Form.Item>`),
    w(`<Form.Item label="Range"><DatePicker.RangePicker /></Form.Item>`),
    // Unlabelled Form.Item with name: form-item-has-label reports it, not this rule.
    w(`<Form.Item name="country"><Select options={opts} /></Form.Item>`),
    // noStyle wrapper inside a labelled item
    w(`<Form.Item label="When"><Form.Item name="d" noStyle><DatePicker /></Form.Item></Form.Item>`),
    // const { RangePicker } = DatePicker with a name
    w(`const { RangePicker } = DatePicker; <RangePicker aria-label="Period" />`),
    // Not antd
    `import Select from 'react-select'; <Select />`,
  ],
  invalid: [
    { code: w(`<Select options={opts} placeholder="Country" />`), errors: [error] },
    { code: w(`<DatePicker />`), errors: [weak] },
    { code: w(`<DatePicker.RangePicker />`), errors: [weak] },
    { code: w(`const { RangePicker } = DatePicker; <RangePicker />`), errors: [weak] },
    { code: `import { Cascader, TreeSelect, AutoComplete, TimePicker } from 'antd'; <><Cascader /><TreeSelect /><AutoComplete /><TimePicker /></>`, errors: [error, error, error, weak] },
    { code: w(`<Form.Item><Select /></Form.Item>`), errors: [error] },
    { code: w(`<Select aria-label="" />`), errors: [error] },
    { code: `import DatePicker from 'antd/lib/date-picker'; <DatePicker />`, errors: [weak] },
  ],
});
