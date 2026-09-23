import { Button, Dropdown, Tooltip } from 'antd';
import { DeleteOutlined, MoreOutlined } from '@ant-design/icons';

// icon-button-has-name (unnamed graphic, critical)
// icon-button-has-name (icon's built-in label only, moderate)
// tooltip-no-disabled-child, popup-trigger-focusable
export function Toolbar({ canDelete }: { canDelete: boolean }) {
  return (
    <div>
      <Button icon={<svg viewBox="0 0 16 16" />} onClick={() => undefined} />
      <Button type="text" icon={<DeleteOutlined />} />
      <Tooltip title="You need delete rights">
        <Button disabled={!canDelete}>Delete</Button>
      </Tooltip>
      <Dropdown menu={{ items: [{ key: 'rename', label: 'Rename' }] }}>
        <span>
          More <MoreOutlined />
        </span>
      </Dropdown>
    </div>
  );
}
