import { Button, Dropdown, Popover, Tooltip } from 'antd';

// Popup triggers that are keyboard-reachable, or that antd never binds to. Must stay silent.
export function PopupPatterns({ atMax, open, reason }: { atMax: boolean; open: boolean; reason: string }) {
  const helpButton = <Button type="text">Help</Button>;
  return (
    <div>
      {/* The Button takes focus; its focus and click events bubble to the span antd listens on. */}
      <Tooltip title={atMax ? reason : ''} trigger={['hover', 'focus']}>
        <span>
          <Button aria-disabled={atMax}>Add</Button>
        </span>
      </Tooltip>
      <Dropdown menu={{ items: [{ key: 'rename', label: 'Rename' }] }}>
        <div className="toolbar-item">{helpButton}</div>
      </Dropdown>
      {/* trigger={[]}: only positions a popover that the toolbar opens. */}
      <Popover content="Saved" trigger={[]} open={open}>
        <span className="anchor" />
      </Popover>
    </div>
  );
}
