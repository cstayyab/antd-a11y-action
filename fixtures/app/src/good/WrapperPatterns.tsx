import { Form } from 'antd';
import HintTooltip from '../wrappers/HintTooltip';
import TextField from '../wrappers/TextField';

// The same wrappers used as intended; the aliases' conditions keep these quiet.
export function WrapperPatterns({ index }: { index: number }) {
  return (
    <div>
      <HintTooltip title="What this means" asButton>
        <span>?</span>
      </HintTooltip>
      <TextField label="Email" />
      {/* "name" covers form-item-has-label as well as form-control-has-name */}
      <Form.Item name="email">
        <TextField label="Email" />
      </Form.Item>
      {/* a renamed aria prop, forwarded by the wrapper */}
      <TextField label={<></>} ariaLabel={`Answer option ${index + 1}`} />
    </div>
  );
}
