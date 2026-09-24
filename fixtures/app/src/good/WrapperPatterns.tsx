import HintTooltip from '../wrappers/HintTooltip';
import TextField from '../wrappers/TextField';

// The same wrappers used as intended; the aliases' conditions keep these quiet.
export function WrapperPatterns() {
  return (
    <div>
      <HintTooltip title="What this means" asButton>
        <span>?</span>
      </HintTooltip>
      <TextField label="Email" />
    </div>
  );
}
