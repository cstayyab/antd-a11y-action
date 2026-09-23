# antd-a11y/picker-has-name

`Select`, `DatePicker`, `DatePicker.RangePicker`, `TimePicker`, `Cascader`, `TreeSelect` and `AutoComplete` need a label.

**Impact:** serious · moderate for date and time pickers named only by their placeholder
**WCAG:** 4.1.2 · 1.3.1 · 3.3.2 Labels or Instructions

antd renders the `Select` placeholder as a `<span>`, not as a `placeholder` attribute, so screen readers announce an unnamed combobox. Date and time pickers put their placeholder ("Select date" by default) on the native `<input>`. Browsers use it as a fallback name, but it disappears once a value is picked, so those are reported at moderate impact.

The rule stays quiet when the element has `aria-label`, `aria-labelledby`, `id` (a `<label htmlFor>` may point at it), or spread props, or when it sits inside a `Form.Item` with a `label`. If the enclosing `Form.Item` has a `name` but no `label`, [`form-item-has-label`](form-item-has-label.md) reports it instead.

## Fails

```jsx
<Select placeholder="Country" options={countries} />
<DatePicker />
```

## Passes

```jsx
<Form.Item label="Country" name="country"><Select options={countries} /></Form.Item>
<Select aria-label="Country" options={countries} />
```
