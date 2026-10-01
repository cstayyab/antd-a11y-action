# antd-a11y/modal-has-title

Every antd dialog needs a name, and on `Modal` only `title` can give it one.

**Impact:** serious
**WCAG:** 4.1.2 · 2.4.6 Headings and Labels

When `title` is truthy, antd renders `role="dialog" aria-labelledby="<title id>"`, and the dialog's name is the text inside the title. Without a name, screen readers announce just "dialog" when focus moves in.

The rule reports:

- **`missing`**: no `title`, or an empty one (`title=""`, `title={null}`).
- **`dropped`**: `aria-label` or `aria-labelledby` on `Modal`. antd passes neither to `role="dialog"` (rc-dialog copies only `data-*` to its root and sets its own `aria-labelledby`), so the dialog stays unnamed. `Drawer` is different: rc-drawer forwards `aria-*`, so they do name a `Drawer`.
- **`emptyTitle`**: a JSX `title` with no text, such as `title={<></>}`, a lone icon (the name becomes its English id, "info-circle"), or an empty `<span>`. antd still sets `aria-labelledby`, so the name is empty. A heading in the body does not help: `aria-labelledby` points only at antd's title node.
- **`imperative`**: `Modal.confirm()`, `.info()`, `.success()`, `.error()`, `.warning()` and `.warn()`, and the same calls on the object from `App.useApp()` (`const { modal } = App.useApp()`) or `Modal.useModal()` (`const [modal, holder] = Modal.useModal()`), without a `title`. They render the same dialog, and without a `title` it has no name.

A `title` whose value the rule can't read (a variable, `t('key')`, a component) counts as a name. A spread on the element, a call argument that isn't an object literal, or a spread inside it, keeps the rule quiet.

## Fails

```jsx
<Modal open={open} onOk={remove}>Delete this order?</Modal>
<Modal open={open} aria-label="Edit profile">…</Modal>
<Modal open={open} title={<></>}><h2>Settings</h2></Modal>
<Drawer open={open}>…</Drawer>

Modal.confirm({ content: 'Delete this invoice?' });
modal.info({ title: null, content: 'Profile saved.' });
```

## Passes

```jsx
<Modal open={open} title="Delete order" onOk={remove}>Delete this order?</Modal>
<Modal open={open} title={<><Tag>Draft</Tag> Invoice 1042</>}>…</Modal>
<Drawer open={open} aria-label="Filters">…</Drawer>

Modal.confirm({ title: 'Delete this invoice?', content: 'You cannot undo this.' });
```

## When the design shows no heading

Keep the name in `title` and hide it visually:

```jsx
<Modal open={open} title={<span className="sr-only">Settings</span>} closable={false} footer={null}>…</Modal>
```

On antd 6.6.5 `title` is the only prop that names a `Modal`. None of these do: `modalRender` (renders inside the dialog), `wrapProps` (lands on the wrapper around it), `classNames` / `styles`, or `panelRef` (internal, not part of `ModalProps`).

A house wrapper that sets the name on the dialog node itself can be described with an [alias](../../README.md#configuration) whose `name` condition holds; the rule then trusts it.

## Confirm dialogs: don't move the message into `title`

antd shows the `title` twice in a confirm dialog: hidden in the header, which names the dialog, and visible in the body. Putting the whole message in `title` so it is read on open makes screen readers read it twice. Use a short heading as `title` and the message as `content`.

## Not covered

- A name a wrapper sets at runtime, and a `title` from an expression. The runtime check runs axe `aria-dialog-name` for those.
- A `modal` object passed through props or context, rather than taken from `App.useApp()` or `Modal.useModal()` in the same component.
