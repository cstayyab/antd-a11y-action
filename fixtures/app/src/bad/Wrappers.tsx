import { Button } from 'antd';
import AccessibleTooltip from '../wrappers/AccessibleTooltip';
import LabelInput from '../wrappers/LabelInput';

// Found only through the aliases in fixtures/app/antd-a11y.json, which the self-test passes as `config`:
// tooltip-no-disabled-child, popup-trigger-focusable (no wrapInButton), form-control-has-name (ReactNode label)
export function Wrappers({ isAtMax }: { isAtMax: boolean }) {
  return (
    <div>
      <AccessibleTooltip title="You can add up to 5 sources">
        <Button disabled={isAtMax}>Add</Button>
      </AccessibleTooltip>
      <AccessibleTooltip title="What this means">
        <span>?</span>
      </AccessibleTooltip>
      <LabelInput label={<strong>Email</strong>} />
    </div>
  );
}
