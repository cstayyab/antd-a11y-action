# antd-a11y/tooltip-no-disabled-child

A `Tooltip` or `Popover` whose trigger is a disabled button is unreachable by keyboard.

**Impact:** serious
**WCAG:** 2.1.1 Keyboard · 1.3.1

"Disabled with a tooltip explaining why" is a common pattern, but a disabled `<button>` can't take focus, so keyboard and screen reader users never get the explanation. antd lets mouse users hover disabled buttons, but that doesn't help anyone else.

The rule also reports `disabled={expression}`: whenever the expression is true, the tooltip can't be reached.

Wrapping the button in a `<span>` or `<div>` is a common workaround, because disabled buttons get no pointer events and the wrapper brings hover back. It fixes only the mouse half: the wrapper can't take focus either, so the rule reports that too. A wrapper with `tabIndex={0}` or a `role` is left alone.

## Fails

```jsx
<Tooltip title="You need admin rights">
  <Button disabled={!isAdmin}>Delete</Button>
</Tooltip>
```

```jsx
<Tooltip title="Limit reached">
  <span>
    <Button disabled={isAtMax}>Add</Button>
  </span>
</Tooltip>
```

## Passes

```jsx
<Button disabled={!isAdmin}>Delete</Button>
{!isAdmin && <Typography.Text type="secondary">You need admin rights to delete.</Typography.Text>}

<Tooltip title="You need admin rights">
  <Button aria-disabled={!isAdmin} onClick={isAdmin ? remove : undefined}>Delete</Button>
</Tooltip>
```
