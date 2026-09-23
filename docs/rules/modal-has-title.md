# antd-a11y/modal-has-title

`Modal` and `Drawer` need a `title` so the dialog has a name.

**Impact:** serious
**WCAG:** 4.1.2 · 2.4.6 Headings and Labels

When `title` is set, antd renders `role="dialog" aria-labelledby="<title id>"`. Without one, the dialog is unnamed and screen readers announce just "dialog" when focus moves into it. Static `Modal.confirm()` calls are not checked.

## Fails

```jsx
<Modal open={open} onOk={remove}>Delete this order?</Modal>
<Drawer open={open}>…</Drawer>
```

## Passes

```jsx
<Modal open={open} title="Delete order" onOk={remove}>Delete this order?</Modal>
<Modal open={open} aria-labelledby="heading-id">…</Modal>
```
