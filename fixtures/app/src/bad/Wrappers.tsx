import { Button } from 'antd';
import HintTooltip from '../wrappers/HintTooltip';
import TextField from '../wrappers/TextField';

// Found only through the aliases in fixtures/app/antd-a11y.json, which the self-test passes as `config`:
// tooltip-no-disabled-child, popup-trigger-focusable (no asButton), form-control-has-name (ReactNode label)
export function Wrappers({ isAtMax }: { isAtMax: boolean }) {
  return (
    <div>
      <HintTooltip title="You can add up to 5 sources">
        <Button disabled={isAtMax}>Add</Button>
      </HintTooltip>
      <HintTooltip title="What this means">
        <span>?</span>
      </HintTooltip>
      <TextField label={<strong>Email</strong>} />
    </div>
  );
}
