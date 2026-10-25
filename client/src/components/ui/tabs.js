import React, { createContext, useContext } from 'react';
import { cn } from '../../lib/utils';

const TabsContext = createContext({
  activeTab: '',
  onTabChange: () => {},
});

export function Tabs({
  value,
  onValueChange,
  className = '',
  children,
  ...props
}) {
  return (
    <TabsContext.Provider value={{ activeTab: value, onTabChange: onValueChange }}>
      <div className={cn('ui-tabs', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className = '', children, ...props }) {
  return (
    <div className={cn('ui-tabs-list', className)} {...props}>
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  className = '',
  disabled = false,
  children,
  ...props
}) {
  const { activeTab, onTabChange } = useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <button
      type="button"
      role="tab"
      disabled={disabled}
      aria-selected={isActive}
      className={cn('ui-tabs-trigger', isActive && 'ui-tabs-trigger--active', className)}
      onClick={() => onTabChange && onTabChange(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className = '',
  children,
  ...props
}) {
  const { activeTab } = useContext(TabsContext);
  if (activeTab !== value) return null;

  return (
    <div role="tabpanel" className={cn('ui-tabs-content', className)} {...props}>
      {children}
    </div>
  );
}
