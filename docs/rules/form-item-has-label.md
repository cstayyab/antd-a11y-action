# antd-a11y/form-item-has-label

A `Form.Item` with a `name` but no `label` leaves its control unnamed.

**Impact:** serious
**WCAG:** 1.3.1 · 3.3.2 · 4.1.2

With a `name`, antd gives the control an `id` and would point `<label for>` at it. Without a `label` there is nothing to point, so the input is announced as just "edit text".

The rule only reports when the only child is a known control: an antd input, picker, `Switch`, `Slider`, `Checkbox`, `Radio`, their groups, `Rate`, `ColorPicker`, or a native `input`, `select` or `textarea`. It skips `noStyle` and `hidden` items, items nested in a labelled `Form.Item`, children that name themselves, custom components, and render-prop children.

## Fails

```jsx
<Form.Item name="email"><Input /></Form.Item>
<Form.Item name={['address', 'city']} label=""><Select /></Form.Item>
```

## Passes

```jsx
<Form.Item name="email" label="Email"><Input /></Form.Item>
<Form.Item name="agree" valuePropName="checked"><Checkbox>I agree to the terms</Checkbox></Form.Item>
<Form.Item label="Phone"><Form.Item name="phone" noStyle><Input /></Form.Item></Form.Item>
```
