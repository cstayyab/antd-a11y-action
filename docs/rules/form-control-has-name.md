# antd-a11y/form-control-has-name

`Input`, `Input.Password`, `Input.TextArea`, `Input.Search`, `InputNumber`, `Mentions`, `Switch`, `Slider`, and text-less `Checkbox` or `Radio` need a label.

**Impact:** serious · moderate for text inputs named only by `placeholder`
**WCAG:** 4.1.2 · 1.3.1 · 3.3.2

A `placeholder` counts as a fallback name in browsers, but it vanishes as soon as the user types, so a placeholder-only input is reported at moderate impact. `Switch`, `Slider` and a bare `Checkbox` render no name at all.

Accepted names: `aria-label`, `aria-labelledby`, `id`, spread props, a labelled enclosing `Form.Item`, text children (`Checkbox`/`Radio`), `checkedChildren`/`unCheckedChildren` (`Switch`) and `ariaLabelForHandle`/`ariaLabelledByForHandle` (`Slider`).

## Fails

```jsx
<Input placeholder="Search" />   // moderate
<Switch />                      // serious
<Slider />                      // serious
<Checkbox checked={all} />      // serious
```

## Passes

```jsx
<Form.Item label="Search"><Input /></Form.Item>
<Switch aria-label="Dark mode" />
<Slider ariaLabelForHandle="Volume" />
<Checkbox>Select all</Checkbox>
```
