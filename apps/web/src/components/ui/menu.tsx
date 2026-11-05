'use client';

import { DropdownMenu as Menu, Popover as PopoverPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

const panel =
  'z-50 min-w-48 overflow-hidden rounded-xl border bg-card p-1 text-card-foreground shadow-xl data-[state=open]:animate-fade-in';

export function DropdownMenuContent({
  className,
  align = 'end',
  ...props
}: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn(panel, className)}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: ComponentProps<typeof Menu.Item> & { destructive?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-muted data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground',
        destructive && 'text-red-600 dark:text-red-400 [&_svg]:text-current',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return (
    <Menu.Label className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
      {children}
    </Menu.Label>
  );
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-border" />;
}

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  align = 'end',
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={8}
        collisionPadding={8}
        className={cn(panel, 'p-0', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
