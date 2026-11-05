import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const control =
  'w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-10', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea className={cn(control, 'min-h-24 py-2 leading-relaxed', className)} {...props} />
  );
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={cn(control, 'h-10 cursor-pointer pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('text-sm font-medium', className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { label: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input
        type="checkbox"
        className="size-4 cursor-pointer rounded border-input accent-primary"
        {...props}
      />
      {label}
    </label>
  );
}
