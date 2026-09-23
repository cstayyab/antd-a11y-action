import rule from '../../src/rules/auth-input-autocomplete.js';
import { run, withImports as w } from '../rule-tester.js';

run('auth-input-autocomplete', rule, {
  valid: [
    w(`<Input.Password autoComplete="current-password" />`),
    w(`<Input.Password autoComplete="new-password" />`),
    w(`<Input type="email" autoComplete="email" />`),
    w(`<Input autoComplete="off" placeholder="Search" />`),
    w(`<Form.Item name="coupon"><Input autoComplete="off" /></Form.Item>`),
    w(`<Input type="number" name="password-length" autoComplete="off" />`),
    w(`<Input.Password onPaste={handlePaste} />`),
    w(`<Input.Password onPaste={(e) => track(e)} />`),
  ],
  invalid: [
    { code: w(`<Input.Password autoComplete="off" />`), errors: [{ messageId: 'autocompleteOff' }] },
    { code: w(`<Input type="email" autoComplete="off" />`), errors: [{ messageId: 'autocompleteOff' }] },
    { code: w(`<Form.Item name="username" label="User"><Input autoComplete="off" /></Form.Item>`), errors: [{ messageId: 'autocompleteOff' }] },
    { code: w(`<Form.Item name={['login', 'email']} label="Email"><Input autoComplete="off" /></Form.Item>`), errors: [{ messageId: 'autocompleteOff' }] },
    { code: `<input type="password" autoComplete="off" />`, errors: [{ messageId: 'autocompleteOff' }] },
    { code: w(`<Input.Password onPaste={(e) => e.preventDefault()} />`), errors: [{ messageId: 'pasteBlocked' }] },
    { code: w(`<Input.Password onPaste={function (e) { if (x) { e.preventDefault(); } }} autoComplete="off" />`), errors: [{ messageId: 'pasteBlocked' }, { messageId: 'autocompleteOff' }] },
  ],
});
