import rule from '../../src/rules/popup-trigger-focusable.js';
import { run, withImports as w } from '../rule-tester.js';

const error = { messageId: 'notFocusable' };

run('popup-trigger-focusable', rule, {
  valid: [
    w(`<Dropdown menu={m}><Button>Actions <DownOutlined /></Button></Dropdown>`),
    w(`<Dropdown menu={m}><a href="#">Actions</a></Dropdown>`),
    w(`<Dropdown menu={m}><a onClick={(e) => e.preventDefault()} tabIndex={0} role="button">More</a></Dropdown>`),
    w(`<Tooltip title="Help"><span tabIndex={0}>?</span></Tooltip>`),
    w(`<Tooltip title="Help"><DeleteOutlined tabIndex={0} aria-label="Help" /></Tooltip>`),
    w(`<Tooltip title="Help"><Input /></Tooltip>`),
    w(`<Popover content={c}><MyTrigger /></Popover>`),
    w(`<Tooltip title="Help"><span {...props} /></Tooltip>`),
    `import { Tooltip } from '@mui/material'; <Tooltip title="x"><span>i</span></Tooltip>`,
  ],
  invalid: [
    { code: w(`<Dropdown menu={m}><span>Actions</span></Dropdown>`), errors: [error] },
    { code: w(`<Dropdown menu={m}><a onClick={(e) => e.preventDefault()}>More</a></Dropdown>`), errors: [error] },
    { code: w(`<Tooltip title="Help"><DeleteOutlined /></Tooltip>`), errors: [error] },
    { code: w(`<Popover content={c}><Avatar src={u} /></Popover>`), errors: [error] },
    { code: w(`<Tooltip title="Full name"><div className="truncate">{name}</div></Tooltip>`), errors: [error] },
    { code: w(`<Tooltip title="Help"><span tabIndex={-1}>?</span></Tooltip>`), errors: [error] },
  ],
});
