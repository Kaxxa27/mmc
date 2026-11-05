'use client';

import { CircleAlert, LoaderCircle, type LucideIcon, Star } from 'lucide-react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { errorMessage } from '@/lib/api/client';
import { cn, initials } from '@/lib/utils';
import { Button } from './button';

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground [&_svg]:size-3',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-2xl border bg-card text-card-foreground shadow-xs', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} />;
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <div
      className={cn('flex items-center justify-center py-10 text-muted-foreground', className)}
      role="status"
    >
      <LoaderCircle className="size-6 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizes = {
    xs: 'size-6 text-[10px]',
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-14 text-lg',
    xl: 'size-24 text-3xl',
  };
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-rose-500 to-orange-400 font-semibold text-white',
        sizes[size],
        className,
      )}
      title={name ?? undefined}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- user uploads from Supabase Storage
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-input transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 rounded-full bg-muted p-3">
        <Icon className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/5 px-6 py-10 text-center',
        className,
      )}
    >
      <CircleAlert className="mb-3 size-6 text-red-500" aria-hidden />
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** 1-10 rating shown as ten stars; interactive when `onChange` is passed. */
export function StarRating({
  value,
  onChange,
  size = 'md',
  disabled,
}: {
  value: number | null;
  onChange?: (value: number | null) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  const star = size === 'sm' ? 'size-3.5' : 'size-5';
  if (!onChange) {
    return (
      <span
        className="inline-flex items-center gap-0.5"
        aria-label={value ? `${value} out of 10` : 'Not rated'}
      >
        <Star className={cn(star, 'fill-amber-400 text-amber-400')} aria-hidden />
        <span className="text-sm font-medium">{value ?? '–'}</span>
        <span className="text-xs text-muted-foreground">/10</span>
      </span>
    );
  }
  return (
    <div
      className="flex flex-wrap items-center gap-0.5"
      role="radiogroup"
      aria-label="Rating from 1 to 10"
    >
      {Array.from({ length: 10 }, (_, index) => index + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} out of 10`}
          disabled={disabled}
          onClick={() => onChange(value === n ? null : n)}
          className="rounded p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
        >
          <Star
            className={cn(
              star,
              value !== null && n <= value
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted-foreground/40',
            )}
          />
        </button>
      ))}
      <span className="ml-2 min-w-10 text-sm font-medium tabular-nums">
        {value ? `${value}/10` : ''}
      </span>
    </div>
  );
}
