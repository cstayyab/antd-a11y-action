import { useId, type ReactNode } from 'react';
import { Input, type InputProps } from 'antd';

// Associates a <label> only when `label` is a string; otherwise the caller names the input,
// e.g. with `ariaLabel`, which is forwarded as aria-label.
export default function TextField({
  label,
  ariaLabel,
  ...props
}: InputProps & { label?: ReactNode; ariaLabel?: string }) {
  const id = useId();
  if (typeof label === 'string') {
    return (
      <>
        <label htmlFor={id}>{label}</label>
        <Input id={id} {...props} />
      </>
    );
  }
  return (
    <>
      {label}
      <Input aria-label={ariaLabel} {...props} />
    </>
  );
}
