import { describe, expect, it } from 'vitest';
import { rules } from '../../src/index.js';
import { aliasErrors } from '../../src/utils/aliases.js';
import { run } from '../rule-tester.js';

// The wrappers from the beta report: AccessibleTooltip wraps antd Tooltip and, with wrapInButton,
// renders a real <button> around its child; LabelInput wraps Input and renders a <label> only
// when its label prop is a string.
const IMPORTS = `import { Button, Input, Tooltip } from 'antd';
import AccessibleTooltip from '@/components/AccessibleTooltip';
import LabelInput from '@/components/LabelInput';
import * as UI from '@/ui';
`;
const w = (code: string) => IMPORTS + code;

const settings = {
  'antd-a11y': {
    aliases: {
      AccessibleTooltip: { as: 'Tooltip', satisfies: { 'popup-trigger-focusable': 'wrapInButton' } },
      LabelInput: { as: 'Input', satisfies: { 'form-control-has-name': 'label:string' } },
      'UI.Tip': 'Tooltip',
    },
  },
};
const withSettings = (code: string) => ({ code: w(code), settings });

run('tooltip-no-disabled-child', rules['tooltip-no-disabled-child'], {
  valid: [
    // Without an alias the wrapper is invisible, as before.
    w(`<AccessibleTooltip title="x"><Button disabled>Add</Button></AccessibleTooltip>`),
    // A component defined in the file is not the imported wrapper, even with the same name.
    {
      code: `import { Button } from 'antd'; const AccessibleTooltip = (p) => p.children;
<AccessibleTooltip title="x"><Button disabled>Add</Button></AccessibleTooltip>`,
      settings,
    },
    withSettings(`<AccessibleTooltip title="x"><Button>Add</Button></AccessibleTooltip>`),
  ],
  invalid: [
    { ...withSettings(`<AccessibleTooltip title="why disabled"><Button disabled aria-label="Add" /></AccessibleTooltip>`), errors: [{ messageId: 'disabled', data: { popup: 'Tooltip' } }] },
    // The case from the report: the span restores hover, not focus. wrapInButton doesn't change this rule.
    {
      ...withSettings(`<AccessibleTooltip title={isAtMax ? MSG : ''} trigger={['hover', 'focus']} wrapInButton>
  <span><Button disabled={isAtMax}>Add</Button></span>
</AccessibleTooltip>`),
      errors: [{ messageId: 'wrapped' }],
    },
    { ...withSettings(`<UI.Tip title="x"><Button disabled>Add</Button></UI.Tip>`), errors: [{ messageId: 'disabled' }] },
  ],
});

run('popup-trigger-focusable', rules['popup-trigger-focusable'], {
  valid: [
    // wrapInButton renders a real <button>, so the rule is met.
    withSettings(`<AccessibleTooltip title="info" wrapInButton><span>plain</span></AccessibleTooltip>`),
    withSettings(`<AccessibleTooltip title="info" wrapInButton={true}><span>plain</span></AccessibleTooltip>`),
    // Can't tell statically: stay quiet.
    withSettings(`<AccessibleTooltip title="info" wrapInButton={needsButton}><span>plain</span></AccessibleTooltip>`),
    withSettings(`<AccessibleTooltip title="info" {...tooltipProps}><span>plain</span></AccessibleTooltip>`),
    // except / only
    {
      code: w(`<AccessibleTooltip title="info"><span>plain</span></AccessibleTooltip>`),
      settings: { 'antd-a11y': { aliases: { AccessibleTooltip: { as: 'Tooltip', except: ['popup-trigger-focusable'] } } } },
    },
    {
      code: w(`<AccessibleTooltip title="info"><span>plain</span></AccessibleTooltip>`),
      settings: { 'antd-a11y': { aliases: { AccessibleTooltip: { as: 'Tooltip', only: ['antd-a11y/tooltip-no-disabled-child'] } } } },
    },
  ],
  invalid: [
    { ...withSettings(`<AccessibleTooltip title="info"><span>plain</span></AccessibleTooltip>`), errors: [{ messageId: 'notFocusable' }] },
    { ...withSettings(`<AccessibleTooltip title="info" wrapInButton={false}><span>plain</span></AccessibleTooltip>`), errors: [{ messageId: 'notFocusable' }] },
    {
      code: w(`<AccessibleTooltip title="info"><span>plain</span></AccessibleTooltip>`),
      settings: { 'antd-a11y': { aliases: { AccessibleTooltip: 'Tooltip' } } },
      errors: [{ messageId: 'notFocusable' }],
    },
  ],
});

run('form-control-has-name', rules['form-control-has-name'], {
  valid: [
    withSettings(`<LabelInput label="Email" />`),
    // May be a string at runtime: stay quiet.
    withSettings(`<LabelInput label={t('email')} />`),
    // A ReactNode label renders bare, but the caller supplied a name.
    withSettings(`<LabelInput label={<Trans>Email</Trans>} aria-labelledby="email-label" />`),
    withSettings(`<LabelInput aria-label="Email" />`),
  ],
  invalid: [
    { ...withSettings(`<LabelInput />`), errors: 1 },
    { ...withSettings(`<LabelInput label={<Trans>Email</Trans>} />`), errors: 1 },
    { ...withSettings(`<LabelInput label="" />`), errors: 1 },
  ],
});

describe('aliasErrors', () => {
  const names = Object.keys(rules);
  it('accepts the simple and the per-rule form', () => {
    expect(
      aliasErrors(
        {
          AccessibleTooltip: { as: 'Tooltip', satisfies: { 'antd-a11y/popup-trigger-focusable': 'wrapInButton' } },
          LabelInput: 'Input',
          'UI.Field': { as: 'Form.Item', except: ['form-item-has-label'] },
          Picker: { as: 'Select', satisfies: { 'picker-has-name': '!unlabelled' } },
        },
        names,
      ),
    ).toEqual([]);
  });

  it('names each problem', () => {
    const errors = aliasErrors(
      {
        tooltip: 'Tooltip',
        A: 'not a name',
        B: { as: 'Tooltip', only: ['typo-rule'], except: [] },
        C: { as: 'Tooltip', satisfies: { 'popup-trigger-focusable': 'wrap in button' } },
        D: { as: 'Tooltip', satisfies: { 'popup-trigger-focusable': '!label:string' } },
        E: { is: 'Tooltip' },
      },
      names,
    );
    expect(errors).toEqual([
      'aliases: "tooltip" is not a component name (e.g. AccessibleTooltip or UI.Tooltip).',
      'aliases.A: "not a name" is not an antd component name (e.g. Tooltip or Form.Item).',
      'aliases.B.only: unknown rule "typo-rule" (only antd-a11y rules use aliases).',
      'aliases.B: use "only" or "except", not both.',
      'aliases.C.satisfies.popup-trigger-focusable: expected "prop", "!prop" or "prop:string", got "wrap in button".',
      'aliases.D.satisfies.popup-trigger-focusable: expected "prop", "!prop" or "prop:string", got "!label:string".',
      'aliases.E: unknown key "is" (allowed: as, only, except, satisfies).',
      'aliases.E.as: expected an antd component name (e.g. Tooltip or Form.Item).',
    ]);
  });
});
