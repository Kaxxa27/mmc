import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/app-shell';
import { ThemeToggle } from '@/components/layout/theme-toggle';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-primary/12 to-transparent" />
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        {children}
      </main>
    </div>
  );
}
