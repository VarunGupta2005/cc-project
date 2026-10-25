import React from 'react';
import { cn } from '../../lib/utils';

export function Card({ className = '', children, ...props }) {
  return (
    <div className={cn('ui-card', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }) {
  return (
    <div className={cn('ui-card-header', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }) {
  return (
    <h3 className={cn('ui-card-title', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = '', children, ...props }) {
  return (
    <p className={cn('ui-card-description', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = '', children, ...props }) {
  return (
    <div className={cn('ui-card-content', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...props }) {
  return (
    <div className={cn('ui-card-footer', className)} {...props}>
      {children}
    </div>
  );
}
