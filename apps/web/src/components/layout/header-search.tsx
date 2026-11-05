'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { cn } from '@/lib/utils';

/** Global search: movies by title (also alternative titles) and people. */
export function HeaderSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const query = value.trim();
    if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form role="search" onSubmit={submit} className={cn('relative w-full', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search movies and people…"
        aria-label="Search movies and people"
        className="h-10 w-full rounded-full border border-input bg-muted/60 pl-9 pr-4 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      />
    </form>
  );
}
