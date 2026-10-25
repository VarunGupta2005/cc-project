import React from 'react';
import { cn } from '../../lib/utils';

export function Badge({
  className = '',
  variant = 'default',
  children,
  ...props
}) {
  return (
    <span
      className={cn('ui-badge', `ui-badge--${variant}`, className)}
      {...props}
    >
      {children}
    </span>
  );
}
