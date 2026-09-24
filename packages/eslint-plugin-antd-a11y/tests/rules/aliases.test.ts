import { describe, expect, it } from 'vitest';
import { rules } from '../../src/index.js';
import { aliasErrors } from '../../src/utils/aliases.js';
import { run } from '../rule-tester.js';

// Example wrappers: HintTooltip wraps antd Tooltip and, with asButton,
// renders a real <button> around its child; TextField wraps Input and renders a <label> only
// when its label prop is a string.
const IMPORTS = `import { Button, Input, Tooltip } from 'antd';
import HintTooltip from '@/components/HintTooltip';
import TextField from '@/components/TextField';
import * as UI from '@/ui';
`;
const w = (code: string) => IMPORTS + code;

const settings = {
  'antd-a11y': {
    aliases: {
      HintTooltip: { as: 'Tooltip', satisfies: { 'popup-trigger-focusable': 'asButton' } },
      TextField: { as: 'Input', satisfies: { 'form-control-has-name': 'label:string' } },
      'UI.Tip': 'Tooltip',
    },
  },
};
const withSettings = (code: string) => ({ code: w(code), settings });

run('tooltip-no-disabled-child', rules['tooltip-no-disabled-child'], {
  valid: [
    // Without an alias the wrapper is invisible, as before.
    w(`<HintTooltip title="x"><Button disabled>Add</Button></HintTooltip>`),
    // A component defined in the file is not the imported wrapper, even with the same name.
    {
      code: `import { Button } from 'antd'; const HintTooltip = (p) => p.children;
<HintTooltip title="x"><Button disabled>Add</Button></HintTooltip>`,
      settings,
    },
    withSettings(`<HintTooltip title="x"><Button>Add</Button></HintTooltip>`),
  ],
  invalid: [
    { ...withSettings(`<HintTooltip title="why disabled"><Button disabled aria-label="Add" /></HintTooltip>`), errors: [{ messageId: 'disabled', data: { popup: 'Tooltip' } }] },
    // A span wrapper restores hover, not focus. asButton doesn't change this rule.
    {
      ...withSettings(`<HintTooltip title={isAtMax ? MSG : ''} trigger={['hover', 'focus']} asButton>
  <span><Button disabled={isAtMax}>Add</Button></span>
</HintTooltip>`),
      errors: [{ messageId: 'wrapped' }],
    },
    { ...withSettings(`<UI.Tip title="x"><Button disabled>Add</Button></UI.Tip>`), errors: [{ messageId: 'disabled' }] },
  ],
});

run('popup-trigger-focusable', rules['popup-trigger-focusable'], {
  valid: [
    // asButton renders a real <button>, so the rule is met.
    withSettings(`<HintTooltip title="info" asButton><span>plain</span></HintTooltip>`),
    withSettings(`<HintTooltip title="info" asButton={true}><span>plain</span></HintTooltip>`),
    // Can't tell statically: stay quiet.
    withSettings(`<HintTooltip title="info" asButton={needsButton}><span>plain</span></HintTooltip>`),
    withSettings(`<HintTooltip title="info" {...tooltipProps}><span>plain</span></HintTooltip>`),
    // except / only
    {
      code: w(`<HintTooltip title="info"><span>plain</span></HintTooltip>`),
      settings: { 'antd-a11y': { aliases: { HintTooltip: { as: 'Tooltip', except: ['popup-trigger-focusable'] } } } },
    },
    {
      code: w(`<HintTooltip title="info"><span>plain</span></HintTooltip>`),
      settings: { 'antd-a11y': { aliases: { HintTooltip: { as: 'Tooltip', only: ['antd-a11y/tooltip-no-disabled-child'] } } } },
    },
  ],
  invalid: [
    { ...withSettings(`<HintTooltip title="info"><span>plain</span></HintTooltip>`), errors: [{ messageId: 'notFocusable' }] },
    { ...withSettings(`<HintTooltip title="info" asButton={false}><span>plain</span></HintTooltip>`), errors: [{ messageId: 'notFocusable' }] },
    {
      code: w(`<HintTooltip title="info"><span>plain</span></HintTooltip>`),
      settings: { 'antd-a11y': { aliases: { HintTooltip: 'Tooltip' } } },
      errors: [{ messageId: 'notFocusable' }],
    },
  ],
});

run('form-control-has-name', rules['form-control-has-name'], {
  valid: [
    withSettings(`<TextField label="Email" />`),
    // May be a string at runtime: stay quiet.
    withSettings(`<TextField label={t('email')} />`),
    // A ReactNode label renders bare, but the caller supplied a name.
    withSettings(`<TextField label={<Trans>Email</Trans>} aria-labelledby="email-label" />`),
    withSettings(`<TextField aria-label="Email" />`),
  ],
  invalid: [
    { ...withSettings(`<TextField />`), errors: 1 },
    { ...withSettings(`<TextField label={<Trans>Email</Trans>} />`), errors: 1 },
    { ...withSettings(`<TextField label="" />`), errors: 1 },
  ],
});

describe('aliasErrors', () => {
  const names = Object.keys(rules);
  it('accepts the simple and the per-rule form', () => {
    expect(
      aliasErrors(
        {
          HintTooltip: { as: 'Tooltip', satisfies: { 'antd-a11y/popup-trigger-focusable': 'asButton' } },
          TextField: 'Input',
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
      'aliases: "tooltip" is not a component name (e.g. HintTooltip or UI.Tooltip).',
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
