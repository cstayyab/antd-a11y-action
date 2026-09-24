# antd-a11y/popup-trigger-focusable

`Tooltip`, `Popover`, `Dropdown` and `Popconfirm` triggers must be keyboard focusable.

**Impact:** serious
**WCAG:** 2.1.1 Keyboard · 4.1.2

antd attaches the trigger's events to whatever child you pass in and doesn't make it focusable. With a `<span>`, `<div>`, icon, `Avatar`, `Tag` or `<a>` without `href` as the trigger, the popup opens only for mouse users.

The rule skips:

- triggers that have `tabIndex` (other than `-1`), a `role`, `contentEditable`, or spread props;
- custom components it can't see into;
- a wrapper that contains an enabled focusable control (`<span><Button>Add</Button></span>`). Focus and click events bubble from the control to the wrapper antd listens on, so the popup is reachable by keyboard;
- popups with `trigger={[]}`, which bind no events to the child: it only positions a popup that another control opens.

A `<span>` around a *disabled* `Button` inside a `Tooltip` or `Popover` is reported by [`tooltip-no-disabled-child`](tooltip-no-disabled-child.md) instead, which names the real problem. A trigger held in a `const` (`const trigger = <span>…</span>`) is followed.

## Fails

```jsx
<Dropdown menu={{ items }}><span>Actions <DownOutlined /></span></Dropdown>
<Tooltip title="Help"><QuestionCircleOutlined /></Tooltip>
<Popover content={profile}><Avatar src={user.avatar} /></Popover>
```

## Passes

```jsx
<Dropdown menu={{ items }}><Button type="text">Actions <DownOutlined /></Button></Dropdown>
<Tooltip title="Help"><QuestionCircleOutlined tabIndex={0} aria-label="Help" /></Tooltip>
<Tooltip title={reason} trigger={['hover', 'focus']}><span><Button aria-disabled={atMax}>Add</Button></span></Tooltip>
<Popover content={details} trigger={[]} open={open}><span className="anchor" /></Popover>
```
