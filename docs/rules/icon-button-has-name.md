# antd-a11y/icon-button-has-name

Icon-only `Button`s need an accessible name that says what the button does.

**Impact:** critical when the button has no name at all · moderate when only an `@ant-design/icons` label names it
**WCAG:** 4.1.2 Name, Role, Value · 2.4.4 Link Purpose

Every `@ant-design/icons` icon renders `role="img" aria-label="<icon id>"`, so `<Button icon={<DeleteOutlined />} />` is announced as "delete, button". The rule reports that case at moderate impact, below the default `fail-on: serious`. The name is the English icon id: it isn't translated and often doesn't describe the action (`ellipsis`, `more`, `setting`). A bare `<svg>`, `<i className="fa-…">` or an `<img>` without `alt` gives no name at all, and that case is reported as critical.

A `Tooltip` does **not** name the button. antd sets only `aria-describedby`, and only while the tooltip is open.

## Fails

```jsx
<Button icon={<svg viewBox="0 0 16 16">…</svg>} />      // critical: no name
<Button><i className="fa fa-trash" /></Button>          // critical: no name
<Button icon={<DeleteOutlined />} />                    // moderate: named "delete"
<Tooltip title="Delete"><Button icon={<DeleteOutlined />} /></Tooltip>
```

## Passes

```jsx
<Button icon={<DeleteOutlined />} aria-label="Delete order" />
<Button icon={<DeleteOutlined />}>Delete</Button>
<Button icon={<TrashIcon />} />   // custom component: not checked, it may name itself
```
