import AccessibleTooltip from '../wrappers/AccessibleTooltip';
import LabelInput from '../wrappers/LabelInput';

// The same wrappers used as intended; the aliases' conditions keep these quiet.
export function WrapperPatterns() {
  return (
    <div>
      <AccessibleTooltip title="What this means" wrapInButton>
        <span>?</span>
      </AccessibleTooltip>
      <LabelInput label="Email" />
    </div>
  );
}
