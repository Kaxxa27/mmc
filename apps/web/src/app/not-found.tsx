import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-bold tracking-tight text-primary">404</p>
      <h1 className="mt-4 text-xl font-semibold">This page is not in the catalog</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The link may be broken, or the page was removed.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
