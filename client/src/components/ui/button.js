import React from 'react';
import { cn } from '../../lib/utils';

export function Button({
  className = '',
  variant = 'default',
  size = 'default',
  type = 'button',
  disabled = false,
  children,
  ...props
}) {
  const baseClasses = 'ui-button';
  const variantClass = `ui-button--${variant}`;
  const sizeClass = `ui-button--${size}`;

  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(baseClasses, variantClass, sizeClass, className)}
      {...props}
    >
      {children}
    </button>
  );
}
