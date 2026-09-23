# antd-a11y/auth-input-autocomplete

Don't turn off autocomplete or block paste on login fields.

**Impact:** serious
**WCAG:** 3.3.8 Accessible Authentication (Minimum) · 1.3.5 Identify Input Purpose

WCAG 2.2 requires that logging in doesn't depend on remembering or transcribing a password. Password managers and paste satisfy that requirement. `autoComplete="off"` and `onPaste={(e) => e.preventDefault()}` take both away.

The rule applies to `Input.Password`, `Input` or `<input>` with `type="password"` or `type="email"`, and inputs whose `name`, `id` or enclosing `Form.Item` `name` looks like email, username, login or password. It reports `autoComplete` values `off`, `false`, `nope` and `none`, and inline `onPaste` handlers that call `preventDefault()`. `autoComplete="new-password"` is correct on sign-up forms and passes.

## Fails

```jsx
<Input.Password autoComplete="off" />
<Form.Item name="username" label="Username"><Input autoComplete="off" /></Form.Item>
<Input.Password onPaste={(e) => e.preventDefault()} />
```

## Passes

```jsx
<Form.Item name="email" label="Email"><Input autoComplete="username" /></Form.Item>
<Form.Item name="password" label="Password"><Input.Password autoComplete="current-password" /></Form.Item>
```
