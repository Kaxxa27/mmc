'use client';

import { RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <p className="text-5xl">🎞️</p>
      <h1 className="mt-4 text-xl font-semibold">Something broke on this page</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Try again — if it keeps happening, check that the API is running.
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
