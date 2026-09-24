import { useId, type ReactNode } from 'react';
import { Input, type InputProps } from 'antd';

// Associates a <label> only when `label` is a string; a ReactNode label renders bare, so the caller
// has to name the input (aria-labelledby) themselves.
export default function TextField({ label, ...props }: InputProps & { label?: ReactNode }) {
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
      <Input {...props} />
    </>
  );
}
