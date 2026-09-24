import type { ReactElement } from 'react';
import { Tooltip, type TooltipProps } from 'antd';

// An in-house wrapper like the ones in the beta report. With wrapInButton it renders a real <button>
// around a trigger that can't take focus; without it the child is passed through as-is.
export default function AccessibleTooltip({
  wrapInButton,
  children,
  ...props
}: TooltipProps & { wrapInButton?: boolean; children: ReactElement }) {
  const trigger = wrapInButton ? (
    <button type="button" className="tooltip-trigger">
      {children}
    </button>
  ) : (
    children
  );
  return <Tooltip {...props}>{trigger}</Tooltip>;
}
