import type { ReactElement } from 'react';
import { Tooltip, type TooltipProps } from 'antd';

// An example in-house wrapper. With asButton it renders a real <button>
// around a trigger that can't take focus; without it the child is passed through as-is.
export default function HintTooltip({
  asButton,
  children,
  ...props
}: TooltipProps & { asButton?: boolean; children: ReactElement }) {
  const trigger = asButton ? (
    <button type="button" className="tooltip-trigger">
      {children}
    </button>
  ) : (
    children
  );
  return <Tooltip {...props}>{trigger}</Tooltip>;
}
