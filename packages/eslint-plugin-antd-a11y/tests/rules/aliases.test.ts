import { describe, expect, it } from 'vitest';
import { rules } from '../../src/index.js';
import { aliasErrors, aliasWarnings } from '../../src/utils/aliases.js';
import { run } from '../rule-tester.js';

// Example wrappers: HintTooltip wraps antd Tooltip and, with asButton,
// renders a real <button> around its child; TextField wraps Input and renders a <label> only
// when its label prop is a string.
const IMPORTS = `import { Button, Form, Input, Tooltip } from 'antd';
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
      'aliases.C.satisfies.popup-trigger-focusable: expected "prop", "!prop", "prop:string" or a list of them, got "wrap in button".',
      'aliases.D.satisfies.popup-trigger-focusable: expected "prop", "!prop", "prop:string" or a list of them, got "!label:string".',
      'aliases.E: unknown key "is" (allowed: as, only, except, satisfies, name, props).',
      'aliases.E.as: expected an antd component name (e.g. Tooltip or Form.Item).',
    ]);
  });
});

// A wrapper that labels its input only for a string `label`, and forwards `ariaLabel` as aria-label.
const naming = {
  'antd-a11y': {
    aliases: {
      TextField: { as: 'Input', name: ['label:string', 'ariaLabel'], props: { ariaLabel: 'aria-label' } },
      Choice: { as: 'Select', name: 'label:string' },
    },
  },
};
const named = (code: string) => ({ code: w(`import Choice from '@/components/Choice';\n${code}`), settings: naming });

run('form-control-has-name', rules['form-control-has-name'], {
  valid: [
    named(`<TextField label="Email" />`),
    // A forwarded prop under its wrapper name: through the prop map and through "name".
    named(`<TextField label={<></>} ariaLabel="Custom Password" />`),
    named('<TextField label={<></>} ariaLabel={`Answer option ${index + 1}`} />'),
    // The prop map alone, without a name condition for it.
    {
      code: w(`<TextField ariaLabel="Search" />`),
      settings: { 'antd-a11y': { aliases: { TextField: { as: 'Input', props: { ariaLabel: 'aria-label' } } } } },
    },
  ],
  invalid: [
    { ...named(`<TextField label={<></>} />`), errors: 1 },
    { ...named(`<TextField ariaLabel="" />`), errors: 1 },
  ],
});

run('form-item-has-label', rules['form-item-has-label'], {
  valid: [
    // "name" covers form-item-has-label too, which a satisfies entry for form-control-has-name didn't.
    named(`<Form.Item name="email"><TextField label="Email" /></Form.Item>`),
    named(`<Form.Item name="kind"><Choice label="Kind" /></Form.Item>`),
  ],
  invalid: [
    { ...named(`<Form.Item name="email"><TextField /></Form.Item>`), errors: 1 },
    {
      code: w(`<Form.Item name="email"><TextField label="Email" /></Form.Item>`),
      settings: { 'antd-a11y': { aliases: { TextField: { as: 'Input', satisfies: { 'form-control-has-name': 'label:string' } } } } },
      errors: 1,
    },
  ],
});

run('picker-has-name', rules['picker-has-name'], {
  valid: [named(`<Choice label="Kind" options={o} />`)],
  invalid: [{ ...named(`<Choice options={o} />`), errors: 1 }],
});

run('popup-trigger-focusable', rules['popup-trigger-focusable'], {
  valid: [
    // Any one condition in a list meets the rule.
    {
      code: w(`<HintTooltip title="i" focusable><span>?</span></HintTooltip>`),
      settings: { 'antd-a11y': { aliases: { HintTooltip: { as: 'Tooltip', satisfies: { 'popup-trigger-focusable': ['asButton', 'focusable'] } } } } },
    },
  ],
  invalid: [
    {
      code: w(`<HintTooltip title="i"><span>?</span></HintTooltip>`),
      settings: { 'antd-a11y': { aliases: { HintTooltip: { as: 'Tooltip', satisfies: { 'popup-trigger-focusable': ['asButton', 'focusable'] } } } } },
      errors: 1,
    },
  ],
});

describe('aliasWarnings', () => {
  it('warns when a naming condition covers some naming rules and not the rest', () => {
    expect(
      aliasWarnings({
        TextField: { as: 'Input', satisfies: { 'form-control-has-name': 'label:string' } },
        Choice: { as: 'Select', satisfies: { 'antd-a11y/picker-has-name': 'label:string', 'form-item-has-label': 'label:string' } },
        Both: { as: 'Input', name: 'label:string' },
        HintTooltip: { as: 'Tooltip', satisfies: { 'popup-trigger-focusable': 'asButton' } },
        Plain: 'Input',
      }),
    ).toEqual([
      'Alias "TextField" names its control for form-control-has-name but not form-item-has-label, which still checks it as unnamed. Use "name" instead of "satisfies" to cover every naming rule at once.',
    ]);
  });

  it('validates name and props', () => {
    expect(aliasErrors({ A: { as: 'Input', name: ['label:string', 'aria label'] } }, Object.keys(rules))).toEqual([
      'aliases.A.name: expected "prop", "!prop", "prop:string" or a list of them, got ["label:string","aria label"].',
    ]);
    expect(aliasErrors({ A: { as: 'Input', props: { ariaLabel: 'aria label' } } }, Object.keys(rules))).toEqual([
      'aliases.A.props: "ariaLabel" → "aria label" is not a prop mapping like "ariaLabel": "aria-label".',
    ]);
    expect(aliasErrors({ A: { as: 'Input', name: [], props: [] } }, Object.keys(rules))).toHaveLength(2);
  });
});
