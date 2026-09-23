# antd-a11y/popup-trigger-focusable

`Tooltip`, `Popover`, `Dropdown` and `Popconfirm` triggers must be keyboard focusable.

**Impact:** serious
**WCAG:** 2.1.1 Keyboard · 4.1.2

antd attaches the trigger's events to whatever child you pass in and doesn't make it focusable. With a `<span>`, `<div>`, icon, `Avatar`, `Tag` or `<a>` without `href` as the trigger, the popup opens only for mouse users.

The rule skips triggers that have `tabIndex` (other than `-1`), a `role`, `contentEditable`, or spread props, as well as custom components it can't see into.

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
```
