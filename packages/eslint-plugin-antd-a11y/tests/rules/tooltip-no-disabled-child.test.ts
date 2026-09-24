import rule from '../../src/rules/tooltip-no-disabled-child.js';
import { run, withImports as w } from '../rule-tester.js';

const error = { messageId: 'disabled' };
const wrapped = { messageId: 'wrapped' };

run('tooltip-no-disabled-child', rule, {
  valid: [
    w(`<Tooltip title="Save"><Button>Save</Button></Tooltip>`),
    w(`<Tooltip title="Save"><Button disabled={false}>Save</Button></Tooltip>`),
    // A focusable or labelled wrapper, or one holding more than the button, is not this pattern
    w(`<Tooltip title="Why"><span tabIndex={0}><Button disabled>Save</Button></span></Tooltip>`),
    w(`<Tooltip title="Why"><span role="button"><Button disabled>Save</Button></span></Tooltip>`),
    w(`<Tooltip title="Why"><span {...props}><Button disabled>Save</Button></span></Tooltip>`),
    w(`<Tooltip title="Why"><span><Button disabled>Save</Button> Why</span></Tooltip>`),
    w(`<Tooltip title="Why"><span><Button>Save</Button></span></Tooltip>`),
    w(`<Tooltip title="Why"><p><Button disabled>Save</Button></p></Tooltip>`),
    // trigger={[]}: the child is only an anchor for a popup opened elsewhere
    w(`<Tooltip title="Why" trigger={[]} open={open}><Button disabled>Save</Button></Tooltip>`),
    // Only const JSX variables are followed
    w(`let saveButton = <Button disabled>Save</Button>;
<Tooltip title="Why">{saveButton}</Tooltip>`),
    `import { Tooltip } from 'antd'; import { Button } from './b'; <Tooltip title="x"><Button disabled>Save</Button></Tooltip>`,
  ],
  invalid: [
    { code: w(`<Tooltip title="No permission"><Button disabled>Delete</Button></Tooltip>`), errors: [error] },
    { code: w(`<Tooltip title="No permission"><Button disabled={!canEdit}>Edit</Button></Tooltip>`), errors: [error] },
    { code: w(`<Popover content="x"><Button disabled={true}>Edit</Button></Popover>`), errors: [error] },
    { code: w(`<Tooltip title="x"><button disabled>Edit</button></Tooltip>`), errors: [error] },
    // The span restores hover but not focus
    {
      code: w(`<Tooltip title="Limit reached" trigger={['hover', 'focus']}><span><Button disabled={isAtMax}>Add</Button></span></Tooltip>`),
      errors: [{ ...wrapped, data: { popup: 'Tooltip', wrapper: 'span' } }],
    },
    { code: w(`<Tooltip title="x"><span style={{ cursor: 'not-allowed' }}><Button disabled>Add</Button></span></Tooltip>`), errors: [wrapped] },
    { code: w(`<Popover content="x"><div><button disabled>Add</button></div></Popover>`), errors: [wrapped] },
    { code: w(`<Tooltip title="x"><span tabIndex={-1}><Button disabled>Add</Button></span></Tooltip>`), errors: [wrapped] },
    // The button assigned to a variable first, then wrapped
    {
      code: w(`const tabButton = <Button disabled={disabled}>{name}</Button>;
function Tab() {
  if (!disabled) return tabButton;
  return (
    <Tooltip title="Coming soon" trigger={['hover', 'focus']}>
      <span className="disabled-tab-wrap">{tabButton}</span>
    </Tooltip>
  );
}`),
      // Reported where it's wrapped ({tabButton} inside the span), not where the variable is declared
      errors: [{ ...wrapped, data: { popup: 'Tooltip', wrapper: 'span' }, line: 8, column: 43 }],
    },
    { code: w(`const saveButton = (<Button disabled>Save</Button>) as JSX.Element;
<Tooltip title="Why">{saveButton}</Tooltip>`), errors: [error] },
  ],
});
