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
    // trigger={[]}: a positioning anchor for a popup opened by another control
    w(`<Tooltip title="Saved" trigger={[]} open={open}><span>anchor</span></Tooltip>`),
    w(`<Popover content={c} trigger={[]}><div className="anchor" /></Popover>`),
    // A focusable control inside the wrapper: its focus and click events bubble to it
    w(`<Tooltip title="Limit reached" trigger={['hover', 'focus']}><span><Button aria-disabled={atMax}>Add</Button></span></Tooltip>`),
    w(`<Dropdown menu={m}><div className="toolbar-item"><Button>Actions</Button></div></Dropdown>`),
    w(`<Tooltip title="Docs"><span><a href="/docs">Docs</a></span></Tooltip>`),
    w(`<Tooltip title="Go"><span>{canGo && <Button>Go</Button>}</span></Tooltip>`),
    w(`<Tooltip title="Go"><span>{ready ? <Button>Go</Button> : <Spin />}</span></Tooltip>`),
    w(`<Tooltip title="Pick"><span><Input aria-label="Name" /></span></Tooltip>`),
    w(`const goButton = <Button>Go</Button>;
<Tooltip title="Go"><span className="wrap">{goButton}</span></Tooltip>`),
    // Children given to an unknown component are still found (a static limit: it may disable them at runtime)
    w(`<Tooltip title="t"><span><SourcePicker disabled={atMax}><Button aria-disabled={atMax}>Add</Button></SourcePicker></span></Tooltip>`),
    // A span around a disabled button is reported by tooltip-no-disabled-child instead, also through a variable
    w(`const tabButton = <Button disabled={disabled}>{name}</Button>;
<Tooltip title="Coming soon" trigger={['hover', 'focus']}><span className="wrap">{tabButton}</span></Tooltip>`),
    w(`<Tooltip title="Limit reached"><span><Button disabled={isAtMax}>Add</Button></span></Tooltip>`),
    `import { Tooltip } from '@mui/material'; <Tooltip title="x"><span>i</span></Tooltip>`,
  ],
  invalid: [
    { code: w(`<Dropdown menu={m}><span>Actions</span></Dropdown>`), errors: [error] },
    // A trigger list we can't read, or a non-empty one, is checked as usual
    { code: w(`<Tooltip title="Help" trigger={triggers}><span>?</span></Tooltip>`), errors: [error] },
    { code: w(`<Tooltip title="Help" trigger={['hover']}><span>?</span></Tooltip>`), errors: [error] },
    // Nothing focusable inside: an unknown component, a hidden input, a Button taken out of the tab order
    { code: w(`<Tooltip title="Help"><span><HelpGlyph /></span></Tooltip>`), errors: [error] },
    { code: w(`<Tooltip title="Help"><span><input type="hidden" value="x" /> ?</span></Tooltip>`), errors: [error] },
    { code: w(`<Tooltip title="Help"><span><Button tabIndex={-1}>?</Button></span></Tooltip>`), errors: [error] },
    // A trigger held in a variable is now checked too
    { code: w(`const hint = <span>?</span>;
<Tooltip title="Help">{hint}</Tooltip>`), errors: [error] },
    // tooltip-no-disabled-child doesn't cover Dropdown, so the span is still reported here
    { code: w(`<Dropdown menu={m}><span><Button disabled>Actions</Button></span></Dropdown>`), errors: [error] },
    { code: w(`<Dropdown menu={m}><a onClick={(e) => e.preventDefault()}>More</a></Dropdown>`), errors: [error] },
    { code: w(`<Tooltip title="Help"><DeleteOutlined /></Tooltip>`), errors: [error] },
    { code: w(`<Popover content={c}><Avatar src={u} /></Popover>`), errors: [error] },
    { code: w(`<Tooltip title="Full name"><div className="truncate">{name}</div></Tooltip>`), errors: [error] },
    { code: w(`<Tooltip title="Help"><span tabIndex={-1}>?</span></Tooltip>`), errors: [error] },
  ],
});
