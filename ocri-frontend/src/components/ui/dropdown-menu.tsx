'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DropdownMenuContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextType | undefined>(undefined);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
      <DropdownMenuContext.Provider value={{ open, setOpen }}>
        <div className="relative inline-block text-left" ref={containerRef}>
          {children}
        </div>
      </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
                                      children,
                                      className,
                                      ...props
                                    }: React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu');

  return (
      <div
          onClick={() => context.setOpen(!context.open)}
          className={cn('cursor-pointer select-none', className)}
          {...props}
      >
        {children}
      </div>
  );
}

export function DropdownMenuContent({
                                      children,
                                      className,
                                      align = 'end'
                                    }: {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'end';
}) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu');

  if (!context.open) return null;

  return (
      <div className={cn(
          "absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 p-1.5 text-slate-100 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95",
          align === 'end' ? 'right-0' : 'left-0',
          className
      )}>
        {children}
      </div>
  );
}

export function DropdownMenuItem({
                                   children,
                                   className,
                                   onClick,
                                   ...props
                                 }: React.HTMLAttributes<HTMLDivElement> & { onClick?: () => void }) {
  const context = React.useContext(DropdownMenuContext);

  return (
      <div
          onClick={() => {
            onClick?.();
            context?.setOpen(false);
          }}
          className={cn(
              'relative flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white',
              className
          )}
          {...props}
      >
        {children}
      </div>
  );
}

export function DropdownMenuLabel({
                                    children,
                                    className
                                  }: React.HTMLAttributes<HTMLDivElement>) {
  return (
      <div className={cn('px-3 py-2 text-xs font-semibold text-slate-400', className)}>
        {children}
      </div>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return (
      <div className={cn('-mx-1 my-1 h-px bg-slate-800', className)} />
  );
}

export function DropdownMenuGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-0.5">{children}</div>;
}