'use client';

import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function DialogContent({
  title,
  description,
  children,
  size = 'md',
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 max-h-[88dvh] w-[calc(100%-1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-5 text-card-foreground shadow-2xl data-[state=open]:animate-pop-in sm:p-6',
          sizes[size],
          className,
        )}
      >
        <div className="mb-4 pr-8">
          <DialogPrimitive.Title className="text-lg font-semibold leading-tight">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            className={description ? 'mt-1 text-sm text-muted-foreground' : 'sr-only'}
          >
            {description ?? title}
          </DialogPrimitive.Description>
        </div>
        {children}
        <DialogPrimitive.Close
          className="absolute right-3 top-3 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}>
      {children}
    </div>
  );
}
