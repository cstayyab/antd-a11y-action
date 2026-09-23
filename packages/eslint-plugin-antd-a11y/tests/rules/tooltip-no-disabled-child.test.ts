import rule from '../../src/rules/tooltip-no-disabled-child.js';
import { run, withImports as w } from '../rule-tester.js';

const error = { messageId: 'disabled' };

run('tooltip-no-disabled-child', rule, {
  valid: [
    w(`<Tooltip title="Save"><Button>Save</Button></Tooltip>`),
    w(`<Tooltip title="Save"><Button disabled={false}>Save</Button></Tooltip>`),
    w(`<Tooltip title="Why"><span><Button disabled>Save</Button></span></Tooltip>`),
    `import { Tooltip } from 'antd'; import { Button } from './b'; <Tooltip title="x"><Button disabled>Save</Button></Tooltip>`,
  ],
  invalid: [
    { code: w(`<Tooltip title="No permission"><Button disabled>Delete</Button></Tooltip>`), errors: [error] },
    { code: w(`<Tooltip title="No permission"><Button disabled={!canEdit}>Edit</Button></Tooltip>`), errors: [error] },
    { code: w(`<Popover content="x"><Button disabled={true}>Edit</Button></Popover>`), errors: [error] },
    { code: w(`<Tooltip title="x"><button disabled>Edit</button></Tooltip>`), errors: [error] },
  ],
});
