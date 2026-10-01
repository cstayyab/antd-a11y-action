# antd-a11y/modal-title-no-control

Keep buttons and links out of a dialog's `title`, and don't add a second close button to a `Modal`.

**Impact:** moderate
**WCAG:** 4.1.2 · 3.2.4 Consistent Identification

The rule reports:

- **`control`**: a `Button`, native `button`, link, or antd form control inside the `title` of a `Modal` or `Drawer`. antd names the dialog with `aria-labelledby` pointing at the title, so the name is all the text in it: a close button there gives a name like "Edit order Close".
- **`duplicateClose`**: a `Modal` that keeps antd's own close button (`closable` isn't `false`) and also has a close control in its `title` or body. Two close buttons with different names ("Close" and "Close dialog") confuse users. The rule counts a control as a close control when it has a `CloseOutlined` icon, an `aria-label` or text starting with "Close", or the same `onClick` as the Modal's `onCancel`. Buttons in `footer` aren't checked: that is antd's normal Cancel / OK slot.

A spread on the dialog or on the control keeps the rule quiet.

## Fails

```jsx
<Modal
  open={open}
  onCancel={close}
  title={<>Edit order <Button icon={<CloseOutlined />} aria-label="Close" onClick={close} /></>}
>
  …
</Modal>

<Modal open={open} title="Settings" onCancel={close}>
  <Button onClick={close}>Done</Button>
</Modal>
```

## Passes

```jsx
<Modal open={open} title="Edit order" onCancel={close}>…</Modal>

{/* Your own close button, with antd's turned off */}
<Modal open={open} title="Settings" closable={false} footer={null}>
  <Button onClick={close}>Close</Button>
</Modal>
```

To rename antd's own close button, use `closable={{ 'aria-label': 'Close settings' }}` rather than drawing a new one.
