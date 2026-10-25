import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef(function Input(
  { className = '', type = 'text', disabled = false, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn('ui-input', className)}
      {...props}
    />
  );
});
